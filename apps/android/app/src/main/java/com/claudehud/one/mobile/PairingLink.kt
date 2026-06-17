package com.claudehud.one.mobile

import java.net.URLDecoder
import java.nio.charset.StandardCharsets

private val hostPattern = Regex("^[A-Za-z0-9._-]{1,253}$")

data class MobileHudPairingLink(
    val host: String,
    val port: Int,
    val pairingId: String,
    val token: String,
    val fingerprint: String,
    val expires: String,
    val rawUri: String,
) {
    val sanitizedSummary: String
        get() = "PC $host:$port · token hidden · fingerprint hidden · expires $expires"
}

fun parseMobileHudPairingLink(rawUri: String?): Result<MobileHudPairingLink> = runCatching {
    require(!rawUri.isNullOrBlank()) { "Pairing link is empty" }
    require(rawUri.startsWith("claudehud://pair")) { "Unsupported pairing link" }
    val params = parseQuery(rawUri.substringAfter('?', missingDelimiterValue = ""))
    val host = params.getValue("host")
    val port = params.getValue("port").toInt()
    val pairingId = params.getValue("pairingId")
    val token = params.getValue("token")
    val fingerprint = params.getValue("fp")
    val expires = params.getValue("expires")

    require(hostPattern.matches(host)) { "Invalid host" }
    require(port in 1024..65535) { "Invalid port" }
    require(pairingId.length in 8..128) { "Invalid pairing id" }
    require(token.length in 8..256) { "Invalid token" }
    require(isSupportedSpkiFingerprint(fingerprint)) { "Invalid SPKI fingerprint" }
    require(expires.isNotBlank()) { "Invalid expiry" }

    MobileHudPairingLink(host, port, pairingId, token, fingerprint, expires, rawUri)
}

fun safePairingSummary(rawUri: String?): String? = parseMobileHudPairingLink(rawUri).getOrNull()?.sanitizedSummary

private fun parseQuery(query: String): Map<String, String> = query
    .split('&')
    .filter { it.isNotBlank() }
    .mapNotNull { part ->
        val index = part.indexOf('=')
        if (index <= 0) null else decode(part.substring(0, index)) to decode(part.substring(index + 1))
    }
    .toMap()

private fun decode(value: String): String = URLDecoder.decode(value, StandardCharsets.UTF_8.name())
