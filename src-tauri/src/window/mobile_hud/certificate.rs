use std::{env, path::PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use rcgen::generate_simple_self_signed;
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudCertificatePaths {
    pub directory: PathBuf,
    pub certificate_pem: PathBuf,
    pub private_key_pem: PathBuf,
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
        directory,
    }
}

pub fn generate_server_certificate(subject_alt_names: &[String]) -> Result<MobileHudServerCertificate, String> {
    let names = if subject_alt_names.is_empty() {
        vec!["claude-hud-one.local".to_string()]
    } else {
        subject_alt_names
            .iter()
            .map(|name| name.trim())
            .filter(|name| !name.is_empty())
            .map(ToString::to_string)
            .collect::<Vec<_>>()
    };
    let names = if names.is_empty() {
        vec!["claude-hud-one.local".to_string()]
    } else {
        names
    };

    let certified = generate_simple_self_signed(names).map_err(|error| error.to_string())?;
    let spki_der = certified.key_pair.public_key_der();

    Ok(MobileHudServerCertificate {
        certificate_pem: certified.cert.pem(),
        private_key_pem: certified.key_pair.serialize_pem(),
        spki_fingerprint: spki_fingerprint_sha256(spki_der.as_ref()),
    })
}

pub fn spki_fingerprint_sha256(spki_der: &[u8]) -> String {
    let digest = Sha256::digest(spki_der);
    format!("sha256/{}", BASE64_STANDARD.encode(digest))
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
        assert!(!certificate.certificate_pem.contains(&certificate.private_key_pem));
    }

    #[test]
    fn certificate_paths_keep_private_key_out_of_settings_json() {
        let paths = certificate_paths_for_root(PathBuf::from(r"C:\Users\Yue\AppData\Roaming\Claude HUD One"));

        assert!(paths.directory.ends_with("mobile-hud"));
        assert!(paths.certificate_pem.ends_with("server-cert.pem"));
        assert!(paths.private_key_pem.ends_with("server-key.pem"));
        assert!(!paths.private_key_pem.ends_with("settings.json"));
    }
}
