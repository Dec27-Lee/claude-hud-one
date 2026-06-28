use std::{collections::BTreeSet, env, fs, path::PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use rcgen::{generate_simple_self_signed, CertificateParams, KeyPair};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudCertificatePaths {
    pub directory: PathBuf,
    pub certificate_pem: PathBuf,
    pub private_key_pem: PathBuf,
    pub metadata_json: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudCertificateMetadata {
    pub subject_alt_names: Vec<String>,
    pub spki_fingerprint: String,
}

#[derive(Debug, Clone)]
pub struct MobileHudServerCertificate {
    pub certificate_pem: String,
    pub private_key_pem: String,
    pub spki_fingerprint: String,
}

pub fn default_certificate_paths() -> MobileHudCertificatePaths {
    let root = env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    certificate_paths_for_root(root.join("Claude HUD One"))
}

pub fn certificate_paths_for_root(root: PathBuf) -> MobileHudCertificatePaths {
    let directory = root.join("mobile-hud");
    MobileHudCertificatePaths {
        certificate_pem: directory.join("server-cert.pem"),
        private_key_pem: directory.join("server-key.pem"),
        metadata_json: directory.join("server-cert-metadata.json"),
        directory,
    }
}

pub fn generate_server_certificate(
    subject_alt_names: &[String],
) -> Result<MobileHudServerCertificate, String> {
    let names = normalize_subject_alt_names(subject_alt_names);
    let certified = generate_simple_self_signed(names).map_err(|error| error.to_string())?;
    let spki_der = certified.key_pair.public_key_der();

    Ok(MobileHudServerCertificate {
        certificate_pem: certified.cert.pem(),
        private_key_pem: certified.key_pair.serialize_pem(),
        spki_fingerprint: spki_fingerprint_sha256(spki_der.as_ref()),
    })
}

pub fn generate_server_certificate_from_private_key(
    subject_alt_names: &[String],
    private_key_pem: &str,
) -> Result<MobileHudServerCertificate, String> {
    let names = normalize_subject_alt_names(subject_alt_names);
    let key_pair = KeyPair::from_pem(private_key_pem).map_err(|error| error.to_string())?;
    let certificate = CertificateParams::new(names)
        .map_err(|error| error.to_string())?
        .self_signed(&key_pair)
        .map_err(|error| error.to_string())?;
    let spki_der = key_pair.public_key_der();

    Ok(MobileHudServerCertificate {
        certificate_pem: certificate.pem(),
        private_key_pem: private_key_pem.to_string(),
        spki_fingerprint: spki_fingerprint_sha256(spki_der.as_ref()),
    })
}

pub fn normalize_subject_alt_names(subject_alt_names: &[String]) -> Vec<String> {
    let mut names = subject_alt_names
        .iter()
        .map(|name| name.trim().to_ascii_lowercase())
        .filter(|name| !name.is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    if names.is_empty() {
        names.push("claude-hud-one.local".to_string());
    }
    names
}

pub fn read_certificate_metadata(
    paths: &MobileHudCertificatePaths,
) -> Result<MobileHudCertificateMetadata, String> {
    let raw = fs::read_to_string(&paths.metadata_json).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

pub fn write_certificate_metadata(
    paths: &MobileHudCertificatePaths,
    subject_alt_names: &[String],
    spki_fingerprint: &str,
) -> Result<(), String> {
    let metadata = MobileHudCertificateMetadata {
        subject_alt_names: normalize_subject_alt_names(subject_alt_names),
        spki_fingerprint: spki_fingerprint.to_string(),
    };
    let raw = serde_json::to_string_pretty(&metadata).map_err(|error| error.to_string())?;
    fs::write(&paths.metadata_json, raw).map_err(|error| error.to_string())
}

pub fn certificate_metadata_covers_subject_alt_names(
    metadata: &MobileHudCertificateMetadata,
    subject_alt_names: &[String],
) -> bool {
    let available = normalize_subject_alt_names(&metadata.subject_alt_names);
    normalize_subject_alt_names(subject_alt_names)
        .iter()
        .all(|name| available.contains(name))
}

pub fn spki_fingerprint_sha256(spki_der: &[u8]) -> String {
    let digest = Sha256::digest(spki_der);
    format!("sha256/{}", BASE64_STANDARD.encode(digest))
}

pub fn spki_fingerprint_from_private_key_pem(private_key_pem: &str) -> Result<String, String> {
    let key_pair = KeyPair::from_pem(private_key_pem).map_err(|error| error.to_string())?;
    Ok(spki_fingerprint_sha256(key_pair.public_key_der().as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spki_fingerprint_uses_okhttp_certificate_pinner_format() {
        let fingerprint = spki_fingerprint_sha256(b"mobile-hud-spki");

        assert!(fingerprint.starts_with("sha256/"));
        assert_eq!(fingerprint.len(), "sha256/".len() + 44);
    }

    #[test]
    fn generated_certificate_has_stable_fingerprint_for_same_key_material() {
        let certificate = generate_server_certificate(&["127.0.0.1".to_string()])
            .expect("certificate generation should succeed");

        assert!(certificate.certificate_pem.contains("BEGIN CERTIFICATE"));
        assert!(certificate.private_key_pem.contains("BEGIN"));
        assert!(certificate.spki_fingerprint.starts_with("sha256/"));
        assert!(!certificate
            .certificate_pem
            .contains(&certificate.private_key_pem));
    }

    #[test]
    fn certificate_paths_keep_private_key_out_of_settings_json() {
        let paths = certificate_paths_for_root(PathBuf::from(
            r"C:\Users\Yue\AppData\Roaming\Claude HUD One",
        ));

        assert!(paths.directory.ends_with("mobile-hud"));
        assert!(paths.certificate_pem.ends_with("server-cert.pem"));
        assert!(paths.private_key_pem.ends_with("server-key.pem"));
        assert!(paths.metadata_json.ends_with("server-cert-metadata.json"));
        assert!(!paths.private_key_pem.ends_with("settings.json"));
    }

    #[test]
    fn metadata_subject_alt_names_are_normalized_and_match_required_hosts() {
        let metadata = MobileHudCertificateMetadata {
            subject_alt_names: vec![
                " 192.168.31.201 ".to_string(),
                "LOCALHOST".to_string(),
                "127.0.0.1".to_string(),
            ],
            spki_fingerprint: "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_string(),
        };

        assert!(certificate_metadata_covers_subject_alt_names(
            &metadata,
            &["192.168.31.201".to_string(), "localhost".to_string()]
        ));
        assert!(!certificate_metadata_covers_subject_alt_names(
            &metadata,
            &["192.168.31.202".to_string()]
        ));
    }

    #[test]
    fn certificate_can_be_reissued_with_existing_private_key() {
        let first = generate_server_certificate(&["192.168.31.201".to_string()])
            .expect("first certificate should be generated");
        let second = generate_server_certificate_from_private_key(
            &["192.168.31.202".to_string()],
            &first.private_key_pem,
        )
        .expect("certificate should be reissued with existing key");

        assert_ne!(first.certificate_pem, second.certificate_pem);
        assert_eq!(first.spki_fingerprint, second.spki_fingerprint);
    }
}
