package com.claudehud.one.mobile

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

private const val MOBILE_HUD_CONNECTION_NOTIFICATION_ID = 27431
private const val ACTION_START = "com.claudehud.one.mobile.START_CONNECTION"
private const val ACTION_STOP = "com.claudehud.one.mobile.STOP_CONNECTION"
private const val EXTRA_HOST = "host"
private const val EXTRA_PORT = "port"
private const val EXTRA_DEVICE_ID = "deviceId"
private const val EXTRA_SPKI = "spkiFingerprint"

class MobileHudConnectionService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var config: MobileHudConnectionConfig? = null
    private var webSocket: WebSocket? = null
    private var reconnectAttempt = 0
    private var manuallyStopped = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureMobileHudNotificationChannels(this)
        if (intent?.action == ACTION_STOP) {
            manuallyStopped = true
            webSocket?.close(1000, "user stopped")
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val nextConfig = configFromIntent(intent) ?: loadMobileHudConnectionConfig(this)
        if (nextConfig == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        manuallyStopped = false
        config = nextConfig
        saveMobileHudConnectionConfig(this, nextConfig)
        startForeground(MOBILE_HUD_CONNECTION_NOTIFICATION_ID, connectionNotification("后台同步已开启", "正在保持与 PC 的低敏加密连接。"))
        connect()
        return START_STICKY
    }

    override fun onDestroy() {
        webSocket?.close(1000, "service destroyed")
        handler.removeCallbacksAndMessages(null)
        webSocket = null
        super.onDestroy()
    }

    private fun connect() {
        val current = config ?: return
        webSocket?.cancel()
        webSocket = openMobileHudWebSocket(
            current,
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    reconnectAttempt = 0
                    startForeground(MOBILE_HUD_CONNECTION_NOTIFICATION_ID, connectionNotification("Claude HUD One 已连接", "正在同步 Claude Code 低敏状态。"))
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    runCatching { parseMobileHudEnvelope(text) }
                    startForeground(MOBILE_HUD_CONNECTION_NOTIFICATION_ID, connectionNotification("Claude HUD One 已连接", "实时 HUD 正在后台同步。"))
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    if (!manuallyStopped) scheduleReconnect("正在恢复连接", "PC 暂时不可达，正在自动重试。")
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    if (!manuallyStopped) scheduleReconnect("连接已暂停", "正在等待 PC 恢复。")
                }
            },
        )
    }

    private fun scheduleReconnect(title: String, body: String) {
        startForeground(MOBILE_HUD_CONNECTION_NOTIFICATION_ID, connectionNotification(title, body))
        val delays = listOf(0L, 2_000L, 5_000L, 10_000L, 30_000L)
        val delay = delays.getOrElse(reconnectAttempt) { 30_000L }
        reconnectAttempt += 1
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({ connect() }, delay)
    }

    private fun connectionNotification(title: String, body: String): Notification = NotificationCompat.Builder(this, MOBILE_HUD_CONNECTION_CHANNEL)
        .setSmallIcon(android.R.drawable.stat_notify_sync)
        .setContentTitle(title)
        .setContentText(body)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        .build()

    private fun configFromIntent(intent: Intent?): MobileHudConnectionConfig? {
        if (intent == null) return null
        val host = intent.getStringExtra(EXTRA_HOST)?.takeIf { it.isNotBlank() } ?: return null
        val port = intent.getIntExtra(EXTRA_PORT, -1).takeIf { it in 1024..65535 } ?: return null
        val deviceId = intent.getStringExtra(EXTRA_DEVICE_ID)?.takeIf { it.isNotBlank() } ?: return null
        val spki = intent.getStringExtra(EXTRA_SPKI)?.takeIf { isSupportedSpkiFingerprint(it) } ?: return null
        return MobileHudConnectionConfig(host, port, deviceId, spki)
    }
}

fun startMobileHudConnectionService(context: Context, config: MobileHudConnectionConfig) {
    val intent = Intent(context, MobileHudConnectionService::class.java)
        .setAction(ACTION_START)
        .putExtra(EXTRA_HOST, config.host)
        .putExtra(EXTRA_PORT, config.port)
        .putExtra(EXTRA_DEVICE_ID, config.deviceId)
        .putExtra(EXTRA_SPKI, config.spkiFingerprint)
    ContextCompat.startForegroundService(context, intent)
}

fun stopMobileHudConnectionService(context: Context) {
    val intent = Intent(context, MobileHudConnectionService::class.java).setAction(ACTION_STOP)
    ContextCompat.startForegroundService(context, intent)
}
