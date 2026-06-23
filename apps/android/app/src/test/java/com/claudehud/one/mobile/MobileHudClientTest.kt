package com.claudehud.one.mobile

import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileHudClientTest {
    private val link = MobileHudPairingLink(
        host = "192.168.1.23",
        port = 27431,
        pairingId = "pair_fixture",
        token = "one_time_secret",
        fingerprint = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        expires = "2026-06-17T09:00:00Z",
        rawUri = "claudehud://pair?host=192.168.1.23&port=27431&pairingId=pair_fixture&token=one_time_secret&fp=sha256%2FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%3D&expires=2026-06-17T09%3A00%3A00Z",
    )

    @Test
    fun pairingClaimRequestTargetsEncryptedPcEndpoint() {
        val (request, bodyJson) = buildPairingClaimRequest(link, "Pixel 8 Pro", "public_key_fixture")

        assertTrue(request.url.toString().startsWith("https://192.168.1.23:27431/pairing/claim"))
        assertTrue(bodyJson.contains("pair_fixture"))
        assertTrue(bodyJson.contains("one_time_secret"))
        assertTrue(bodyJson.contains("public_key_fixture"))
    }

    @Test
    fun parsesPairingClaimDeviceIdAndBuildsConnectionConfig() {
        val result = parsePairingClaimResponse(
            """
            {
              "ok": true,
              "result": {
                "status": "pendingPcConfirmation",
                "deviceId": "device_fixture",
                "deviceLabel": "Android 手机",
                "approved": false,
                "privacyNote": "token hidden"
              }
            }
            """.trimIndent(),
        ).getOrThrow()
        val config = connectionConfigFromPairingResult(link, result)

        assertEquals("device_fixture", result.deviceId)
        assertFalse(result.approved)
        assertEquals("https://192.168.1.23:27431", config.baseUrl)
        assertEquals("wss://192.168.1.23:27431/ws?deviceId=device_fixture", config.wsUrl)
    }

    @Test
    fun snapshotRequestUsesAuthorizedDeviceIdWithoutPairingSecrets() {
        val config = MobileHudConnectionConfig(
            host = "192.168.1.23",
            port = 27431,
            deviceId = "device_fixture",
            spkiFingerprint = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        )
        val request = buildMobileHudSnapshotRequest(config)

        assertEquals("https://192.168.1.23:27431/snapshot?deviceId=device_fixture", request.url.toString())
        assertFalse(request.url.toString().contains("token="))
        assertFalse(request.url.toString().contains("fp="))
    }

    @Test
    fun signedIntentRequestUsesHeadersWithoutQuerySecrets() {
        val config = MobileHudConnectionConfig(
            host = "192.168.1.23",
            port = 27431,
            deviceId = "device_fixture",
            spkiFingerprint = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        )
        val bodyJson = MobileHudJson.encodeToString(
            MobileHudPendingIntentResolutionRequest(
                intentId = "intent_fixture",
                action = "dismiss",
            ),
        )
        val request = buildSignedMobileHudIntentRequest(
            config = config,
            bodyJson = bodyJson,
            signPayloadBase64 = { payload -> "signature:${payload.size}" },
            nonce = "nonce_fixture",
            timestampMs = 1_000,
            ttlMs = 60_000,
            idempotencyKey = "idem_fixture",
        )

        assertEquals("https://192.168.1.23:27431/intent/resolve", request.url.toString())
        assertEquals("device_fixture", request.header("x-claude-hud-device-id"))
        assertEquals("nonce_fixture", request.header("x-claude-hud-nonce"))
        assertEquals("idem_fixture", request.header("x-claude-hud-idempotency-key"))
        assertTrue(request.header("x-claude-hud-body-sha256")!!.matches(Regex("[0-9a-f]{64}")))
        assertFalse(request.url.toString().contains("nonce="))
        assertFalse(request.url.toString().contains("signature="))
    }

    @Test
    fun webSocketConfigUsesWssAndDeviceIdQuery() {
        val config = MobileHudConnectionConfig(
            host = "192.168.1.23",
            port = 27431,
            deviceId = "device_fixture",
            spkiFingerprint = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        )

        assertTrue(config.wsUrl.startsWith("wss://"))
        assertTrue(config.wsUrl.contains("deviceId=device_fixture"))
        assertFalse(config.wsUrl.contains("token="))
    }
}
