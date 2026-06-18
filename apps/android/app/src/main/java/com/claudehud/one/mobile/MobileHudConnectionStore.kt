package com.claudehud.one.mobile

import android.content.Context

private const val MOBILE_HUD_CONNECTION_PREFS = "mobile_hud_connection"
private const val KEY_HOST = "host"
private const val KEY_PORT = "port"
private const val KEY_DEVICE_ID = "device_id"
private const val KEY_SPKI = "spki_fingerprint"
private const val KEY_LAST_CONNECTED_AT = "last_connected_at"
private const val KEY_BACKGROUND_KEEP_ALIVE = "background_keep_alive"

fun saveMobileHudConnectionConfig(context: Context, config: MobileHudConnectionConfig) {
    context.getSharedPreferences(MOBILE_HUD_CONNECTION_PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_HOST, config.host)
        .putInt(KEY_PORT, config.port)
        .putString(KEY_DEVICE_ID, config.deviceId)
        .putString(KEY_SPKI, config.spkiFingerprint)
        .putLong(KEY_LAST_CONNECTED_AT, System.currentTimeMillis())
        .putBoolean(KEY_BACKGROUND_KEEP_ALIVE, true)
        .apply()
}

fun loadMobileHudConnectionConfig(context: Context): MobileHudConnectionConfig? {
    val prefs = context.getSharedPreferences(MOBILE_HUD_CONNECTION_PREFS, Context.MODE_PRIVATE)
    val host = prefs.getString(KEY_HOST, null)?.takeIf { it.isNotBlank() } ?: return null
    val deviceId = prefs.getString(KEY_DEVICE_ID, null)?.takeIf { it.isNotBlank() } ?: return null
    val spki = prefs.getString(KEY_SPKI, null)?.takeIf { isSupportedSpkiFingerprint(it) } ?: return null
    val port = prefs.getInt(KEY_PORT, -1).takeIf { it in 1024..65535 } ?: return null
    return MobileHudConnectionConfig(host = host, port = port, deviceId = deviceId, spkiFingerprint = spki)
}

fun clearMobileHudConnectionConfig(context: Context) {
    context.getSharedPreferences(MOBILE_HUD_CONNECTION_PREFS, Context.MODE_PRIVATE).edit().clear().apply()
}

fun mobileHudBackgroundKeepAliveEnabled(context: Context): Boolean =
    context.getSharedPreferences(MOBILE_HUD_CONNECTION_PREFS, Context.MODE_PRIVATE).getBoolean(KEY_BACKGROUND_KEEP_ALIVE, false)
