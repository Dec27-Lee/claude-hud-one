package com.claudehud.one.mobile

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import android.util.Base64

private const val ANDROID_KEYSTORE = "AndroidKeyStore"
private const val DEVICE_KEY_ALIAS = "claude_hud_one_mobile_device_p256"

class MobileHudDeviceKeys(private val alias: String = DEVICE_KEY_ALIAS) {
    fun ensurePublicKeyBase64(): String {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!keyStore.containsAlias(alias)) {
            val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
            val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build()
            generator.initialize(spec)
            generator.generateKeyPair()
        }
        return keyStore.getCertificate(alias).publicKey.toBase64()
    }

    fun signChallengeBase64(challenge: ByteArray): String {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val privateKey = keyStore.getKey(alias, null)
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey as java.security.PrivateKey)
        signature.update(challenge)
        return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
    }
}

private fun PublicKey.toBase64(): String = Base64.encodeToString(encoded, Base64.NO_WRAP)
