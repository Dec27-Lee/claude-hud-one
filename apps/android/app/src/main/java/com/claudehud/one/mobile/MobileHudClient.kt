package com.claudehud.one.mobile

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
