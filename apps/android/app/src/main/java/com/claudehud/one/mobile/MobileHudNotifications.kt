package com.claudehud.one.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

const val MOBILE_HUD_ATTENTION_CHANNEL = "mobile_hud_attention"
const val MOBILE_HUD_TASK_STATUS_CHANNEL = "mobile_hud_task_status"
const val MOBILE_HUD_CONNECTION_CHANNEL = "mobile_hud_connection"

data class MobileHudNotificationText(
    val channelId: String,
    val title: String,
    val body: String,
)

fun ensureMobileHudNotificationChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val channels = listOf(
        NotificationChannel(MOBILE_HUD_ATTENTION_CHANNEL, "Claude HUD attention", NotificationManager.IMPORTANCE_HIGH),
        NotificationChannel(MOBILE_HUD_TASK_STATUS_CHANNEL, "Claude HUD task status", NotificationManager.IMPORTANCE_DEFAULT),
        NotificationChannel(MOBILE_HUD_CONNECTION_CHANNEL, "Claude HUD connection", NotificationManager.IMPORTANCE_LOW),
    )
    channels.forEach { channel ->
        channel.lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
        channel.setShowBadge(false)
    }
    manager.createNotificationChannels(channels)
}

fun lowSensitiveNotificationText(event: MobileHudNotificationEvent): MobileHudNotificationText {
    val channel = when (event.kind) {
        "approval", "question", "waitingApproval", "waitingQuestion", "waitingAttention", "attention" -> MOBILE_HUD_ATTENTION_CHANNEL
        "completion" -> MOBILE_HUD_TASK_STATUS_CHANNEL
        "connectionLost", "connectionRestored" -> MOBILE_HUD_CONNECTION_CHANNEL
        else -> MOBILE_HUD_TASK_STATUS_CHANNEL
    }
    return MobileHudNotificationText(
        channelId = channel,
        title = sanitizeNotificationLine(event.title.ifBlank { "Claude HUD One" }),
        body = sanitizeNotificationLine(event.body.ifBlank { "Open Mobile HUD for the latest status." }),
    )
}

private fun sanitizeNotificationLine(value: String): String {
    val blocked = listOf("transcript", "projectDir", "cwd", "toolInput", "toolResult", "prompt", "token=", "fp=", "\\", "/")
    val sanitized = blocked.fold(value) { current, blockedValue ->
        current.replace(blockedValue, "…", ignoreCase = true)
    }
    return sanitized.take(96)
}
