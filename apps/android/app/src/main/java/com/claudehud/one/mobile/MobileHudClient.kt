package com.claudehud.one.mobile

import java.security.MessageDigest
import java.util.UUID
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.WebSocketListener
import okhttp3.MediaType.Companion.toMediaType

@Serializable
data class MobileHudPairingClaimRequest(
    val pairingId: String,
    val token: String,
    val deviceLabel: String,
    val devicePublicKey: String,
)

@Serializable
data class MobileHudPairingClaimResponse(
    val ok: Boolean,
    val result: MobileHudPairingClaimResult? = null,
    val error: String? = null,
)

@Serializable
data class MobileHudPairingClaimResult(
    val status: String,
    val deviceId: String,
    val deviceLabel: String,
    val approved: Boolean,
    val privacyNote: String,
)

data class MobileHudConnectionConfig(
    val host: String,
    val port: Int,
    val deviceId: String,
    val spkiFingerprint: String,
) {
    val baseUrl: String = "https://$host:$port"
    val wsUrl: String = "wss://$host:$port/ws?deviceId=$deviceId"
}

@Serializable
data class MobileHudPendingIntentResolutionRequest(
    val intentId: String,
    val itemId: String? = null,
    val displayKey: String? = null,
    val sessionId: String? = null,
    val action: String,
    val choiceId: String? = null,
    val answerText: String? = null,
)

fun buildMobileHudOkHttpClient(host: String, spkiFingerprint: String): OkHttpClient {
    require(host.isNotBlank()) { "host is required" }
    val trustManager = buildPinnedSelfSignedTrustManager(spkiFingerprint)
    return OkHttpClient.Builder()
        .sslSocketFactory(pinnedSelfSignedSslSocketFactory(trustManager), trustManager)
        .build()
}

fun buildPairingClaimRequest(link: MobileHudPairingLink, deviceLabel: String, devicePublicKey: String): Pair<Request, String> {
    val bodyJson = MobileHudJson.encodeToString(
        MobileHudPairingClaimRequest(
            pairingId = link.pairingId,
            token = link.token,
            deviceLabel = deviceLabel.take(48),
            devicePublicKey = devicePublicKey,
        ),
    )
    val request = Request.Builder()
        .url("https://${link.host}:${link.port}/pairing/claim")
        .post(bodyJson.toRequestBody("application/json".toMediaType()))
        .build()
    return request to bodyJson
}

fun parsePairingClaimResponse(bodyJson: String): Result<MobileHudPairingClaimResult> = runCatching {
    val response = MobileHudJson.decodeFromString(MobileHudPairingClaimResponse.serializer(), bodyJson)
    require(response.ok) { response.error ?: "pairing request was rejected" }
    response.result ?: error("pairing response is missing device id")
}

fun connectionConfigFromPairingResult(link: MobileHudPairingLink, result: MobileHudPairingClaimResult): MobileHudConnectionConfig =
    MobileHudConnectionConfig(
        host = link.host,
        port = link.port,
        deviceId = result.deviceId,
        spkiFingerprint = link.fingerprint,
    )

fun buildMobileHudSnapshotRequest(config: MobileHudConnectionConfig): Request = Request.Builder()
    .url("${config.baseUrl}/snapshot?deviceId=${config.deviceId}")
    .get()
    .build()

fun buildMobileHudIntentSigningPayload(
    method: String,
    path: String,
    protocolVersion: Int,
    deviceId: String,
    nonce: String,
    timestampMs: Long,
    ttlMs: Long,
    idempotencyKey: String,
    bodySha256: String,
): String = """
    CLAUDE_HUD_MOBILE_INTENT_V1
    method:${method.trim().uppercase()}
    path:${path.trim()}
    protocolVersion:$protocolVersion
    deviceId:${deviceId.trim()}
    nonce:${nonce.trim()}
    timestampMs:$timestampMs
    ttlMs:$ttlMs
    idempotencyKey:${idempotencyKey.trim()}
    bodySha256:${bodySha256.trim().lowercase()}
""".trimIndent() + "\n"

fun mobileHudBodySha256Hex(body: String): String = MessageDigest
    .getInstance("SHA-256")
    .digest(body.toByteArray(Charsets.UTF_8))
    .joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }

fun buildSignedMobileHudIntentRequest(
    config: MobileHudConnectionConfig,
    bodyJson: String,
    signPayloadBase64: (ByteArray) -> String,
    path: String = "/intent/resolve",
    protocolVersion: Int = MobileHudProtocol.PROTOCOL_VERSION,
    nonce: String = UUID.randomUUID().toString(),
    timestampMs: Long = System.currentTimeMillis(),
    ttlMs: Long = 60_000,
    idempotencyKey: String = UUID.randomUUID().toString(),
): Request {
    val bodySha256 = mobileHudBodySha256Hex(bodyJson)
    val signingPayload = buildMobileHudIntentSigningPayload(
        method = "POST",
        path = path,
        protocolVersion = protocolVersion,
        deviceId = config.deviceId,
        nonce = nonce,
        timestampMs = timestampMs,
        ttlMs = ttlMs,
        idempotencyKey = idempotencyKey,
        bodySha256 = bodySha256,
    )
    val signature = signPayloadBase64(signingPayload.toByteArray(Charsets.UTF_8))
    return Request.Builder()
        .url("${config.baseUrl}$path")
        .post(bodyJson.toRequestBody("application/json".toMediaType()))
        .header("x-claude-hud-protocol-version", protocolVersion.toString())
        .header("x-claude-hud-device-id", config.deviceId)
        .header("x-claude-hud-nonce", nonce)
        .header("x-claude-hud-timestamp-ms", timestampMs.toString())
        .header("x-claude-hud-ttl-ms", ttlMs.toString())
        .header("x-claude-hud-body-sha256", bodySha256)
        .header("x-claude-hud-idempotency-key", idempotencyKey)
        .header("x-claude-hud-signature", signature)
        .build()
}

fun buildSignedPendingIntentResolveRequest(
    config: MobileHudConnectionConfig,
    resolution: MobileHudPendingIntentResolutionRequest,
    deviceKeys: MobileHudDeviceKeys = MobileHudDeviceKeys(),
): Pair<Request, String> {
    val bodyJson = MobileHudJson.encodeToString(resolution)
    return buildSignedMobileHudIntentRequest(config, bodyJson, deviceKeys::signChallengeBase64) to bodyJson
}

fun loadMobileHudSnapshot(config: MobileHudConnectionConfig): MobileHudViewModel {
    buildMobileHudOkHttpClient(config.host, config.spkiFingerprint)
        .newCall(buildMobileHudSnapshotRequest(config))
        .execute()
        .use { response ->
            require(response.isSuccessful) { "PC Mobile HUD returned HTTP ${response.code}" }
            val body = response.body?.string().orEmpty()
            return parseMobileHudEnvelope(body).payload
        }
}

fun parseMobileHudEnvelope(bodyJson: String): MobileHudEnvelope =
    MobileHudJson.decodeFromString(MobileHudEnvelope.serializer(), bodyJson)

fun openMobileHudWebSocket(config: MobileHudConnectionConfig, listener: WebSocketListener) =
    buildMobileHudOkHttpClient(config.host, config.spkiFingerprint)
        .newWebSocket(Request.Builder().url(config.wsUrl).build(), listener)
