package com.claudehud.one.mobile

import java.security.MessageDigest
import java.util.Base64
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import okhttp3.CertificatePinner

private val spkiFingerprintPattern = Regex("^sha256/[A-Za-z0-9+/]{43}=$")

fun isSupportedSpkiFingerprint(value: String): Boolean = spkiFingerprintPattern.matches(value)

fun buildMobileHudCertificatePinner(host: String, spkiFingerprint: String): CertificatePinner {
    require(host.isNotBlank()) { "host is required" }
    require(isSupportedSpkiFingerprint(spkiFingerprint)) { "SPKI fingerprint must use OkHttp sha256/<base64> format" }
    return CertificatePinner.Builder()
        .add(host, spkiFingerprint)
        .build()
}

fun buildPinnedSelfSignedTrustManager(spkiFingerprint: String): X509TrustManager {
    require(isSupportedSpkiFingerprint(spkiFingerprint)) { "SPKI fingerprint must use OkHttp sha256/<base64> format" }
    return object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit

        override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
            val certificate = chain?.firstOrNull() ?: throw java.security.cert.CertificateException("server certificate is required")
            val actual = spkiFingerprintForCertificate(certificate)
            if (actual != spkiFingerprint) {
                throw java.security.cert.CertificateException("SPKI fingerprint mismatch")
            }
        }

        override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
    }
}

fun pinnedSelfSignedSslSocketFactory(trustManager: X509TrustManager): SSLSocketFactory {
    val context = SSLContext.getInstance("TLS")
    context.init(null, arrayOf<TrustManager>(trustManager), null)
    return context.socketFactory
}

fun spkiFingerprintForCertificate(certificate: X509Certificate): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(certificate.publicKey.encoded)
    return "sha256/${Base64.getEncoder().encodeToString(digest)}"
}
