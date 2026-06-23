use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use p256::{
    ecdsa::{signature::Verifier, Signature, VerifyingKey},
    pkcs8::DecodePublicKey,
};
use sha2::{Digest, Sha256};

pub const MOBILE_INTENT_PROTOCOL_VERSION: u8 = 1;
pub const MAX_MOBILE_INTENT_TTL_MS: u64 = 5 * 60_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MobileIntentAuthMetadata {
    pub device_id: String,
    pub nonce: String,
    pub timestamp_ms: u64,
    pub ttl_ms: u64,
    pub body_sha256: String,
    pub idempotency_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MobileIntentVerificationRequest {
    pub method: String,
    pub path: String,
    pub protocol_version: u8,
    pub metadata: MobileIntentAuthMetadata,
    pub signature_b64: String,
    pub public_key_der_b64: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MobileIntentAuthError {
    MissingDeviceId,
    MissingNonce,
    MissingIdempotencyKey,
    EmptyBodyHash,
    BodyHashMismatch,
    TimestampInFuture,
    Expired,
    TtlTooLong,
    UnsupportedProtocolVersion,
    MissingSignature,
    MissingPublicKey,
    InvalidPublicKey,
    InvalidSignature,
    SignatureMismatch,
}

pub fn body_sha256_hex(body: &[u8]) -> String {
    let digest = Sha256::digest(body);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn validate_mobile_intent_metadata(
    metadata: &MobileIntentAuthMetadata,
    body: &[u8],
    now_ms: u64,
) -> Result<(), MobileIntentAuthError> {
    if metadata.device_id.trim().is_empty() {
        return Err(MobileIntentAuthError::MissingDeviceId);
    }
    if metadata.nonce.trim().is_empty() {
        return Err(MobileIntentAuthError::MissingNonce);
    }
    if metadata.idempotency_key.trim().is_empty() {
        return Err(MobileIntentAuthError::MissingIdempotencyKey);
    }
    if metadata.body_sha256.trim().is_empty() {
        return Err(MobileIntentAuthError::EmptyBodyHash);
    }
    if metadata.ttl_ms > MAX_MOBILE_INTENT_TTL_MS {
        return Err(MobileIntentAuthError::TtlTooLong);
    }
    if !metadata
        .body_sha256
        .trim()
        .eq_ignore_ascii_case(&body_sha256_hex(body))
    {
        return Err(MobileIntentAuthError::BodyHashMismatch);
    }
    if metadata.timestamp_ms > now_ms.saturating_add(30_000) {
        return Err(MobileIntentAuthError::TimestampInFuture);
    }
    if now_ms.saturating_sub(metadata.timestamp_ms) > metadata.ttl_ms {
        return Err(MobileIntentAuthError::Expired);
    }
    Ok(())
}

pub fn canonical_mobile_intent_signing_payload(
    method: &str,
    path: &str,
    protocol_version: u8,
    metadata: &MobileIntentAuthMetadata,
) -> String {
    format!(
        "CLAUDE_HUD_MOBILE_INTENT_V1\nmethod:{}\npath:{}\nprotocolVersion:{}\ndeviceId:{}\nnonce:{}\ntimestampMs:{}\nttlMs:{}\nidempotencyKey:{}\nbodySha256:{}\n",
        method.trim().to_ascii_uppercase(),
        path.trim(),
        protocol_version,
        metadata.device_id.trim(),
        metadata.nonce.trim(),
        metadata.timestamp_ms,
        metadata.ttl_ms,
        metadata.idempotency_key.trim(),
        metadata.body_sha256.trim().to_ascii_lowercase(),
    )
}

pub fn verify_mobile_intent_request(
    request: &MobileIntentVerificationRequest,
    body: &[u8],
    now_ms: u64,
) -> Result<(), MobileIntentAuthError> {
    if request.protocol_version != MOBILE_INTENT_PROTOCOL_VERSION {
        return Err(MobileIntentAuthError::UnsupportedProtocolVersion);
    }
    validate_mobile_intent_metadata(&request.metadata, body, now_ms)?;
    if request.signature_b64.trim().is_empty() {
        return Err(MobileIntentAuthError::MissingSignature);
    }
    if request.public_key_der_b64.trim().is_empty() {
        return Err(MobileIntentAuthError::MissingPublicKey);
    }

    let canonical = canonical_mobile_intent_signing_payload(
        &request.method,
        &request.path,
        request.protocol_version,
        &request.metadata,
    );
    verify_p256_ecdsa_signature(
        &request.public_key_der_b64,
        &request.signature_b64,
        canonical.as_bytes(),
    )
}

fn verify_p256_ecdsa_signature(
    public_key_der_b64: &str,
    signature_b64: &str,
    payload: &[u8],
) -> Result<(), MobileIntentAuthError> {
    let public_key_der = BASE64_STANDARD
        .decode(public_key_der_b64.trim())
        .map_err(|_| MobileIntentAuthError::InvalidPublicKey)?;
    let verifying_key = VerifyingKey::from_public_key_der(&public_key_der)
        .map_err(|_| MobileIntentAuthError::InvalidPublicKey)?;
    let signature_der = BASE64_STANDARD
        .decode(signature_b64.trim())
        .map_err(|_| MobileIntentAuthError::InvalidSignature)?;
    let signature = Signature::from_der(&signature_der)
        .map_err(|_| MobileIntentAuthError::InvalidSignature)?;

    verifying_key
        .verify(payload, &signature)
        .map_err(|_| MobileIntentAuthError::SignatureMismatch)
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::{
        ecdsa::{signature::Signer, SigningKey},
        pkcs8::EncodePublicKey,
    };

    fn valid_metadata(body: &[u8]) -> MobileIntentAuthMetadata {
        MobileIntentAuthMetadata {
            device_id: "device-1".to_string(),
            nonce: "nonce-1".to_string(),
            timestamp_ms: 1_000,
            ttl_ms: 60_000,
            body_sha256: body_sha256_hex(body),
            idempotency_key: "idem-1".to_string(),
        }
    }

    fn signed_request(body: &[u8]) -> MobileIntentVerificationRequest {
        let signing_key = SigningKey::from_slice(&[7_u8; 32]).unwrap();
        let public_key_der = signing_key
            .verifying_key()
            .to_public_key_der()
            .unwrap()
            .as_bytes()
            .to_vec();
        let metadata = valid_metadata(body);
        let canonical = canonical_mobile_intent_signing_payload("POST", "/intent/resolve", 1, &metadata);
        let signature: Signature = signing_key.sign(canonical.as_bytes());

        MobileIntentVerificationRequest {
            method: "POST".to_string(),
            path: "/intent/resolve".to_string(),
            protocol_version: 1,
            metadata,
            signature_b64: BASE64_STANDARD.encode(signature.to_der().as_bytes()),
            public_key_der_b64: BASE64_STANDARD.encode(public_key_der),
        }
    }

    #[test]
    fn mobile_intent_metadata_accepts_fresh_body_hash() {
        let body = br#"{"kind":"dismiss"}"#;
        let metadata = valid_metadata(body);

        assert_eq!(validate_mobile_intent_metadata(&metadata, body, 2_000), Ok(()));
    }

    #[test]
    fn mobile_intent_metadata_rejects_body_hash_mismatch() {
        let body = br#"{"kind":"dismiss"}"#;
        let metadata = valid_metadata(body);

        assert_eq!(
            validate_mobile_intent_metadata(&metadata, br#"{"kind":"other"}"#, 2_000),
            Err(MobileIntentAuthError::BodyHashMismatch)
        );
    }

    #[test]
    fn mobile_intent_metadata_rejects_expired_requests() {
        let body = br#"{"kind":"dismiss"}"#;
        let metadata = MobileIntentAuthMetadata {
            ttl_ms: 1_000,
            ..valid_metadata(body)
        };

        assert_eq!(
            validate_mobile_intent_metadata(&metadata, body, 3_000),
            Err(MobileIntentAuthError::Expired)
        );
    }

    #[test]
    fn mobile_intent_metadata_rejects_overlong_ttl() {
        let body = br#"{"kind":"dismiss"}"#;
        let metadata = MobileIntentAuthMetadata {
            ttl_ms: MAX_MOBILE_INTENT_TTL_MS + 1,
            ..valid_metadata(body)
        };

        assert_eq!(
            validate_mobile_intent_metadata(&metadata, body, 2_000),
            Err(MobileIntentAuthError::TtlTooLong)
        );
    }

    #[test]
    fn mobile_intent_metadata_requires_device_and_nonce() {
        let body = br#"{"kind":"dismiss"}"#;
        let missing_device = MobileIntentAuthMetadata {
            device_id: "".to_string(),
            ..valid_metadata(body)
        };
        let missing_nonce = MobileIntentAuthMetadata {
            nonce: "".to_string(),
            ..valid_metadata(body)
        };

        assert_eq!(
            validate_mobile_intent_metadata(&missing_device, body, 2_000),
            Err(MobileIntentAuthError::MissingDeviceId)
        );
        assert_eq!(
            validate_mobile_intent_metadata(&missing_nonce, body, 2_000),
            Err(MobileIntentAuthError::MissingNonce)
        );
    }

    #[test]
    fn mobile_intent_signature_accepts_canonical_payload() {
        let body = br#"{"intentId":"intent-1","action":"dismiss"}"#;
        let request = signed_request(body);

        assert_eq!(verify_mobile_intent_request(&request, body, 2_000), Ok(()));
    }

    #[test]
    fn mobile_intent_signature_rejects_tampered_body() {
        let body = br#"{"intentId":"intent-1","action":"dismiss"}"#;
        let request = signed_request(body);

        assert_eq!(
            verify_mobile_intent_request(&request, br#"{"intentId":"intent-1","action":"deny"}"#, 2_000),
            Err(MobileIntentAuthError::BodyHashMismatch)
        );
    }

    #[test]
    fn canonical_payload_does_not_include_raw_body() {
        let body = br#"{"answerText":"secret answer"}"#;
        let metadata = valid_metadata(body);
        let payload = canonical_mobile_intent_signing_payload("post", "/intent/resolve", 1, &metadata);

        assert!(payload.contains("bodySha256"));
        assert!(!payload.contains("secret answer"));
    }
}
