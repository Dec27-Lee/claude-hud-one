package com.claudehud.one.mobile

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ensureMobileHudNotificationChannels(this)
        val initialPairingLink = parseMobileHudPairingLink(intent?.dataString).getOrNull()
        setContent {
            ClaudeHudOneMobileApp(initialPairingLink = initialPairingLink, initialSnapshot = previewSnapshot())
        }
    }
}

data class MobileHudConnectionUiState(
    val phase: String = "未连接",
    val detail: String = "请在 PC 设置页生成配对链接，然后复制到这里粘贴。",
)

data class PairingSubmitOutcome(
    val message: String,
    val config: MobileHudConnectionConfig? = null,
    val snapshot: MobileHudViewModel? = null,
)

@Composable
fun ClaudeHudOneMobileApp(initialPairingLink: MobileHudPairingLink?, initialSnapshot: MobileHudViewModel) {
    var snapshot by remember { mutableStateOf(initialSnapshot) }
    var connection by remember { mutableStateOf(MobileHudConnectionUiState()) }
    val colors = darkColorScheme(
        primary = Color(0xFFFF8A3D),
        secondary = Color(0xFF6EE7F9),
        surface = Color(0xFF111827),
        background = Color(0xFF070A12),
        onPrimary = Color(0xFF1B1008),
        onSurface = Color(0xFFE5E7EB),
        onBackground = Color(0xFFE5E7EB),
    )
    MaterialTheme(colorScheme = colors) {
        Surface(modifier = Modifier.fillMaxSize(), color = colors.background) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.verticalGradient(listOf(Color(0xFF070A12), Color(0xFF101827))))
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("Claude HUD One", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("手机 HUD · 只读加密伴侣", color = Color(0xFF9CA3AF))
                CapsulePreview(connection = connection, snapshot = snapshot)
                PairingCard(
                    initialPairingLink = initialPairingLink,
                    connection = connection,
                    onConnection = { connection = it },
                    onSnapshot = { snapshot = it },
                )
                LiveHudCard(connection, snapshot)
                SessionsCard(snapshot.sessions)
                AttentionCard(snapshot.attention, snapshot.completion)
                DiagnosticsCard(snapshot)
                StatusCard(title = "隐私说明", body = "手机通知保持低敏。允许/拒绝/回答/终端跳转和原始工具数据仍只留在 PC。")
            }
        }
    }
}

@Composable
private fun PairingCard(
    initialPairingLink: MobileHudPairingLink?,
    connection: MobileHudConnectionUiState,
    onConnection: (MobileHudConnectionUiState) -> Unit,
    onSnapshot: (MobileHudViewModel) -> Unit,
) {
    var pairingInput by remember { mutableStateOf(initialPairingLink?.rawUri.orEmpty()) }
    var statusText by remember { mutableStateOf(initialPairingLink?.sanitizedSummary ?: connection.detail) }
    val scope = rememberCoroutineScope()

    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("配对", color = Color(0xFFFFB27A), fontWeight = FontWeight.Bold)
            Text("操作步骤：PC 设置页 → 移动 HUD → 启动服务 → 生成配对链接 → 复制完整配对链接 → 粘贴到下方 → 提交配对 → 回 PC 批准。", color = Color(0xFFD1D5DB))
            OutlinedTextField(
                value = pairingInput,
                onValueChange = { pairingInput = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("粘贴配对链接") },
                placeholder = { Text("claudehud://pair?host=...&port=...") },
                minLines = 2,
            )
            Button(onClick = {
                scope.launch {
                    onConnection(MobileHudConnectionUiState("提交中", "正在向 PC 发送配对请求。"))
                    statusText = "正在提交配对请求……"
                    val outcome = submitPairing(pairingInput) { state ->
                        onConnection(state)
                        statusText = state.detail
                    }
                    statusText = outcome.message
                    outcome.snapshot?.let(onSnapshot)
                    outcome.config?.let { config ->
                        connectMobileHudWebSocket(config, onConnection, onSnapshot)
                    }
                }
            }) {
                Text("提交配对请求")
            }
            Text(statusText, color = Color(0xFF9CA3AF))
        }
    }
}

private suspend fun submitPairing(
    rawLink: String,
    onConnection: suspend (MobileHudConnectionUiState) -> Unit,
): PairingSubmitOutcome = withContext(Dispatchers.IO) {
    val link = parseMobileHudPairingLink(rawLink).getOrElse { error ->
        return@withContext PairingSubmitOutcome("配对链接无效：${error.message ?: "请重新从 PC 复制完整链接"}")
    }
    runCatching {
        val publicKey = MobileHudDeviceKeys().ensurePublicKeyBase64()
        val (request, _) = buildPairingClaimRequest(link, "Android 手机", publicKey)
        val client = buildMobileHudOkHttpClient(link.host, link.fingerprint)
        client.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                return@withContext PairingSubmitOutcome("配对请求失败：HTTP ${response.code}。请确认 PC 服务已启动、手机和 PC 在同一 Wi-Fi、配对链接未过期。")
            }
            val result = parsePairingClaimResponse(body).getOrElse { error ->
                return@withContext PairingSubmitOutcome("配对响应无效：${error.message ?: "缺少设备编号"}。请重新生成配对链接再试。")
            }
            val config = connectionConfigFromPairingResult(link, result)
            if (!result.approved) {
                withContext(Dispatchers.Main) {
                    onConnection(MobileHudConnectionUiState("等待 PC 批准", "已提交配对请求。请回到 PC 设置页批准新设备，手机会自动等待连接。"))
                }
            }
            val snapshot = waitForApprovedSnapshot(client, config, onConnection)
                ?: return@withContext PairingSubmitOutcome(
                    message = "已提交配对请求，但还没有等到 PC 批准。请确认 PC 上点了“批准”，然后在手机上再次点“提交配对请求”。",
                    config = config,
                )
            PairingSubmitOutcome(
                message = "已连接 PC，实时 HUD 已开始同步。",
                config = config,
                snapshot = snapshot,
            )
        }
    }.getOrElse { error ->
        PairingSubmitOutcome("配对请求失败：${error.message ?: "网络不可达"}。请确认 PC 服务已启动、两台设备在同一网络，或重新生成配对链接。")
    }
}

private suspend fun waitForApprovedSnapshot(
    client: okhttp3.OkHttpClient,
    config: MobileHudConnectionConfig,
    onConnection: suspend (MobileHudConnectionUiState) -> Unit,
): MobileHudViewModel? {
    repeat(45) { attempt ->
        val response = runCatching { client.newCall(buildMobileHudSnapshotRequest(config)).execute() }.getOrNull()
        response?.use {
            if (it.isSuccessful) {
                val body = it.body?.string().orEmpty()
                val snapshot = runCatching { parseMobileHudEnvelope(body).payload }.getOrNull()
                if (snapshot != null) {
                    withContext(Dispatchers.Main) {
                        onConnection(MobileHudConnectionUiState("已连接", "PC 已批准，正在同步实时 HUD。"))
                    }
                    return snapshot
                }
            }
        }
        if (attempt == 0 || attempt % 5 == 4) {
            withContext(Dispatchers.Main) {
                onConnection(MobileHudConnectionUiState("等待 PC 批准", "已提交配对请求，等待 PC 批准后自动连接。"))
            }
        }
        delay(2_000)
    }
    return null
}

private val mainHandler = Handler(Looper.getMainLooper())

private fun postConnection(onConnection: (MobileHudConnectionUiState) -> Unit, state: MobileHudConnectionUiState) {
    mainHandler.post { onConnection(state) }
}

private fun postSnapshot(onSnapshot: (MobileHudViewModel) -> Unit, snapshot: MobileHudViewModel) {
    mainHandler.post { onSnapshot(snapshot) }
}

private fun connectMobileHudWebSocket(
    config: MobileHudConnectionConfig,
    onConnection: (MobileHudConnectionUiState) -> Unit,
    onSnapshot: (MobileHudViewModel) -> Unit,
) {
    openMobileHudWebSocket(
        config,
        object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                postConnection(onConnection, MobileHudConnectionUiState("已连接", "加密实时通道已建立。"))
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val snapshot = runCatching { parseMobileHudEnvelope(text).payload }.getOrNull()
                if (snapshot != null) {
                    postSnapshot(onSnapshot, snapshot)
                    postConnection(onConnection, MobileHudConnectionUiState("已连接", "实时 HUD 正在同步。"))
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                postConnection(onConnection, MobileHudConnectionUiState("连接中断", "实时通道断开：${t.message ?: "请确认 PC 服务仍在运行"}。"))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                postConnection(onConnection, MobileHudConnectionUiState("已断开", "PC 实时通道已关闭。"))
            }
        },
    )
}

@Composable
private fun CapsulePreview(connection: MobileHudConnectionUiState, snapshot: MobileHudViewModel) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xEE05070C)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("▣", color = Color(0xFFFF8A3D), fontWeight = FontWeight.Bold)
            Column {
                Text(connection.phase, fontWeight = FontWeight.Bold)
                Text(snapshot.capsule.statusText, color = Color(0xFF9CA3AF))
            }
        }
    }
}

@Composable
private fun LiveHudCard(connection: MobileHudConnectionUiState, snapshot: MobileHudViewModel) {
    StatusCard(
        title = "实时 HUD",
        body = buildString {
            append(connection.detail)
            if (snapshot.capsule.ticker.isNotEmpty()) {
                append("\n")
                append(snapshot.capsule.ticker.joinToString(" · ") { "${it.label}: ${it.value}" })
            }
        },
    )
}

@Composable
private fun SessionsCard(sessions: List<MobileHudSessionCard>) {
    StatusCard(
        title = "会话",
        body = if (sessions.isEmpty()) {
            "配对后会显示 Desktop HUD 等价会话信息。"
        } else {
            sessions.joinToString("\n") { session -> "${session.sessionName} · ${session.activity} · ${session.statusText}" }
        },
    )
}

@Composable
private fun AttentionCard(attention: List<MobileHudAttentionItem>, completion: MobileHudCompletionCard?) {
    StatusCard(
        title = "需要关注",
        body = when {
            attention.isNotEmpty() -> attention.joinToString("\n") { item -> "${item.title} · 只读 · ${item.summary.orEmpty()}" }
            completion != null -> "${completion.title} · ${completion.body}"
            else -> "手机端不提供允许/拒绝/回答按钮，只显示低敏提醒。"
        },
    )
}

@Composable
private fun DiagnosticsCard(snapshot: MobileHudViewModel) {
    StatusCard(
        title = "诊断",
        body = "协议 v${snapshot.protocolVersion} · 快照 ${snapshot.snapshotVersion} · 通知 ${snapshot.notificationEvents.size} · ${snapshot.privacyLevel}",
    )
}

@Composable
private fun StatusCard(title: String, body: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, color = Color(0xFFFFB27A), fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(6.dp))
            Text(body, color = Color(0xFFD1D5DB))
        }
    }
}

private fun previewSnapshot(): MobileHudViewModel = MobileHudViewModel(
    protocolVersion = 1,
    snapshotVersion = 1,
    snapshotId = "preview",
    generatedAt = "preview",
    displayMode = "trustedAppView",
    privacyLevel = "trustedAppView",
    summary = MobileHudSummary(
        status = "waiting",
        statusText = "等待加密连接 PC。",
        activeSessionCount = 1,
        attentionCount = 1,
        notificationCount = 1,
        modelLabel = "Claude",
        projectLabel = "Claude HUD One",
    ),
    displayPolicy = MobileHudDisplayPolicy(
        visibleItems = listOf("activity", "model", "contextValue", "usage", "cost"),
        terminalJump = false,
        approvalActions = false,
        questionActions = false,
        notificationsEnabled = true,
        privacyNote = "只读手机 DTO 预览。",
    ),
    capsule = MobileHudCapsule(
        mascot = "clawd",
        state = "alert",
        title = "Claude HUD One",
        statusText = "配对后会显示实时状态。",
        ticker = listOf(
            MobileHudDisplayItem(id = "activity", label = "活动", value = "等待"),
            MobileHudDisplayItem(id = "model", label = "模型", value = "Claude"),
        ),
    ),
    sessions = listOf(
        MobileHudSessionCard(
            sessionRef = "preview-session",
            sessionName = "Desktop HUD 会话",
            projectLabel = "Claude HUD One",
            activity = "waiting",
            statusText = "配对后这里会流式显示 Desktop HUD 等价快照。",
            modelLabel = "Claude",
            updatedAt = "preview",
            privacyNote = "不显示路径、prompt、命令或原始工具数据。",
        ),
    ),
    attention = listOf(
        MobileHudAttentionItem(
            itemRef = "preview-attention",
            sessionRef = "preview-session",
            kind = "waitingApproval",
            status = "pending",
            title = "PC 端需要处理",
            summary = "请在 PC 上打开 Claude HUD One 查看请求。",
            createdAt = "preview",
            actionState = "readOnly",
            privacyNote = "手机端不提供 allow/deny/answer。",
        ),
    ),
    completion = null,
    notificationEvents = listOf(
        MobileHudNotificationEvent(
            eventId = "preview-notification",
            dedupeKey = "preview",
            collapseKey = "attention",
            kind = "waitingApproval",
            sensitivity = "low",
            title = "Claude 需要关注",
            body = "打开手机 HUD 查看低敏状态。",
            createdAt = "preview",
            source = "preview",
        ),
    ),
)
