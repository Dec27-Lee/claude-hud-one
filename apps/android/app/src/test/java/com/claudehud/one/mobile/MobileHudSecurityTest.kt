package com.claudehud.one.mobile

import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.Principal
import java.security.PublicKey
import java.security.cert.X509Certificate
import java.util.Date
import javax.net.ssl.SSLPeerUnverifiedException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import okhttp3.CertificatePinner

class MobileHudSecurityTest {
    @Test
    fun validatesOkHttpSpkiFingerprintFormat() {
        assertTrue(isSupportedSpkiFingerprint("sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="))
        assertFalse(isSupportedSpkiFingerprint("sha1/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="))
        assertFalse(isSupportedSpkiFingerprint("sha256/not-base64"))
    }

    @Test
    fun certificatePinnerAcceptsMatchingSpkiAndRejectsMismatch() {
        val host = "192.168.1.23"
        val certificate = fakeCertificate()
        val matchingPin = CertificatePinner.pin(certificate)
        val pinner = buildMobileHudCertificatePinner(host, matchingPin)

        pinner.check(host, listOf(certificate))

        val otherCertificate = fakeCertificate()
        assertThrows(SSLPeerUnverifiedException::class.java) {
            pinner.check(host, listOf(otherCertificate))
        }
    }

    @Test
    fun pinnedSelfSignedTrustManagerAllowsOnlyPinnedSpki() {
        val certificate = fakeCertificate()
        val matchingPin = spkiFingerprintForCertificate(certificate)
        val trustManager = buildPinnedSelfSignedTrustManager(matchingPin)

        trustManager.checkServerTrusted(arrayOf(certificate), "ECDHE_ECDSA")

        val otherCertificate = fakeCertificate()
        assertThrows(java.security.cert.CertificateException::class.java) {
            trustManager.checkServerTrusted(arrayOf(otherCertificate), "ECDHE_ECDSA")
        }
    }

    private fun fakeCertificate(): X509Certificate {
        val keyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
        return object : X509Certificate() {
            override fun getPublicKey(): PublicKey = keyPair.public
            override fun checkValidity() = Unit
            override fun checkValidity(date: Date?) = Unit
            override fun getVersion(): Int = 3
            override fun getSerialNumber(): BigInteger = BigInteger.ONE
            override fun getIssuerDN(): Principal = Principal { "CN=Claude HUD One Test" }
            override fun getSubjectDN(): Principal = Principal { "CN=Claude HUD One Test" }
            override fun getNotBefore(): Date = Date(0)
            override fun getNotAfter(): Date = Date(Long.MAX_VALUE)
            override fun getTBSCertificate(): ByteArray = ByteArray(0)
            override fun getSignature(): ByteArray = ByteArray(0)
            override fun getSigAlgName(): String = "none"
            override fun getSigAlgOID(): String = "0.0"
            override fun getSigAlgParams(): ByteArray? = null
            override fun getIssuerUniqueID(): BooleanArray? = null
            override fun getSubjectUniqueID(): BooleanArray? = null
            override fun getKeyUsage(): BooleanArray? = null
            override fun getBasicConstraints(): Int = -1
            override fun getEncoded(): ByteArray = ByteArray(0)
            override fun verify(key: PublicKey?) = Unit
            override fun verify(key: PublicKey?, sigProvider: String?) = Unit
            override fun toString(): String = "FakeMobileHudCertificate"
            override fun hasUnsupportedCriticalExtension(): Boolean = false
            override fun getCriticalExtensionOIDs(): MutableSet<String>? = null
            override fun getNonCriticalExtensionOIDs(): MutableSet<String>? = null
            override fun getExtensionValue(oid: String?): ByteArray? = null
        }
    }
}
