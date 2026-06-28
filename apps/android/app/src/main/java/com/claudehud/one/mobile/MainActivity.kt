package com.claudehud.one.mobile

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.net.ssl.SSLPeerUnverifiedException
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sin
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
    val phase: MobileHudAppPhase = MobileHudAppPhase.Unpaired,
    val title: String = "未连接",
    val detail: String = "请在 PC 设置页生成配对链接，然后复制到这里粘贴。",
    val backgroundKeepAlive: Boolean = false,
)

data class PairingSubmitOutcome(
    val message: String,
    val config: MobileHudConnectionConfig? = null,
    val snapshot: MobileHudViewModel? = null,
)

private val mainHandler = Handler(Looper.getMainLooper())

private suspend fun restoreMobileHudSnapshot(config: MobileHudConnectionConfig): Result<MobileHudViewModel> {
    var lastError: Throwable? = null
    repeat(3) { attempt ->
        val restored = withContext(Dispatchers.IO) { runCatching { loadMobileHudSnapshot(config) } }
        restored.onSuccess { return restored }
        lastError = restored.exceptionOrNull()
        delay(700L * (attempt + 1))
    }
    return Result.failure(lastError ?: IllegalStateException("Mobile HUD restore failed"))
}

private fun mobileRestoreFailureText(error: Throwable): String {
    val message = error.message.orEmpty()
    return when {
        message.contains("HTTP 401") -> "这台手机的授权已失效，请在 PC 端设备列表重新批准或删除后重新配对。"
        message.contains("pin", ignoreCase = true) || message.contains("certificate", ignoreCase = true) -> "PC 服务证书指纹不匹配。请先更新 PC 端并重启 Mobile HUD 服务；如果仍失败，再重新配对。"
        else -> "无法连接 PC Mobile HUD 服务，请确认 PC 应用正在运行且手机与 PC 在同一网络。"
    }
}

@Composable
fun ClaudeHudOneMobileApp(initialPairingLink: MobileHudPairingLink?, initialSnapshot: MobileHudViewModel) {
    val context = LocalContext.current
    var snapshot by remember { mutableStateOf(initialSnapshot) }
    var connection by remember { mutableStateOf(MobileHudConnectionUiState()) }
    var diagnosticsExpanded by remember { mutableStateOf(false) }
    val colors = darkColorScheme(
        primary = Color(0xFFFF8A3D),
        secondary = Color(0xFF6EE7F9),
        surface = Color(0xFF111827),
        background = Color(0xFF070A12),
        onPrimary = Color(0xFF1B1008),
        onSurface = Color(0xFFE5E7EB),
        onBackground = Color(0xFFE5E7EB),
    )

    LaunchedEffect(Unit) {
        val cached = loadMobileHudConnectionConfig(context)
        if (cached != null) {
            connection = MobileHudConnectionUiState(
                phase = MobileHudAppPhase.Reconnecting,
                title = "正在恢复连接",
                detail = "已找到上次连接记录，正在恢复实时 HUD。",
                backgroundKeepAlive = mobileHudBackgroundKeepAliveEnabled(context),
            )
            startMobileHudConnectionService(context, cached)
            val restored = restoreMobileHudSnapshot(cached)
            restored
                .onSuccess { restoredSnapshot ->
                    snapshot = restoredSnapshot
                    connection = MobileHudConnectionUiState(
                        phase = MobileHudAppPhase.Connected,
                        title = "已连接",
                        detail = "已使用上次配对恢复连接。",
                        backgroundKeepAlive = true,
                    )
                    connectMobileHudWebSocket(cached, { connection = it }, { snapshot = it })
                }
                .onFailure { error ->
                    connection = MobileHudConnectionUiState(
                        phase = MobileHudAppPhase.DisconnectedRecoverable,
                        title = "恢复失败",
                        detail = mobileRestoreFailureText(error),
                        backgroundKeepAlive = mobileHudBackgroundKeepAliveEnabled(context),
                    )
                }
        }
    }

    MaterialTheme(colorScheme = colors) {
        Surface(modifier = Modifier.fillMaxSize(), color = colors.background) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.verticalGradient(listOf(Color(0xFF050712), Color(0xFF0B1020), Color(0xFF101624))))
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                val pairingPhase = connection.phase == MobileHudAppPhase.Unpaired || connection.phase == MobileHudAppPhase.Pairing || connection.phase == MobileHudAppPhase.WaitingPcApproval || connection.phase == MobileHudAppPhase.Connecting
                if (pairingPhase) {
                    AppHeader(connection)
                    PairingScreen(
                        initialPairingLink = initialPairingLink,
                        connection = connection,
                        onConnection = { connection = it },
                        onSnapshot = { snapshot = it },
                        onConnected = { config ->
                            saveMobileHudConnectionConfig(context, config)
                            startMobileHudConnectionService(context, config)
                        },
                    )
                } else {
                    LiveHudScreen(
                        connection = connection,
                        snapshot = snapshot,
                        diagnosticsExpanded = diagnosticsExpanded,
                        onDiagnosticsExpandedChange = { diagnosticsExpanded = it },
                        onDisconnect = {
                            stopMobileHudConnectionService(context)
                            clearMobileHudConnectionConfig(context)
                            connection = MobileHudConnectionUiState()
                            snapshot = previewSnapshot()
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun AppHeader(connection: MobileHudConnectionUiState) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column {
            Text("Claude HUD One", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Color(0xFFF8FAFC))
            Text("手机 HUD · 只读加密伴侣", color = Color(0xFF8B95A7), style = MaterialTheme.typography.bodySmall)
        }
        StatusPill(connection.title, connection.phase)
    }
}

@Composable
private fun PairingScreen(
    initialPairingLink: MobileHudPairingLink?,
    connection: MobileHudConnectionUiState,
    onConnection: (MobileHudConnectionUiState) -> Unit,
    onSnapshot: (MobileHudViewModel) -> Unit,
    onConnected: (MobileHudConnectionConfig) -> Unit,
) {
    var pairingInput by remember { mutableStateOf(initialPairingLink?.rawUri.orEmpty()) }
    var statusText by remember { mutableStateOf(initialPairingLink?.sanitizedSummary ?: connection.detail) }
    val scope = rememberCoroutineScope()

    ConnectionHero(connection)
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xF010172A)),
        shape = RoundedCornerShape(28.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("连接到 PC", color = Color(0xFFFFB27A), fontWeight = FontWeight.Bold)
            Text("粘贴 PC 设置页生成的配对链接。手机端只读显示 Claude 状态。", color = Color(0xFFD1D5DB))
            StepRow("1", "PC 设置页启动移动 HUD")
            StepRow("2", "生成并复制完整配对链接")
            StepRow("3", "粘贴到这里，提交后回 PC 批准")
            OutlinedTextField(
                value = pairingInput,
                onValueChange = { pairingInput = it },
                enabled = connection.phase != MobileHudAppPhase.Pairing,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("粘贴配对链接") },
                placeholder = { Text("claudehud://pair?host=...&port=...") },
                minLines = 2,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = {
                    scope.launch {
                        onConnection(MobileHudConnectionUiState(MobileHudAppPhase.Pairing, "提交中", "正在向 PC 发送配对请求。"))
                        statusText = "正在提交配对请求……"
                        val outcome = submitPairing(pairingInput) { state ->
                            onConnection(state)
                            statusText = state.detail
                        }
                        statusText = outcome.message
                        outcome.snapshot?.let(onSnapshot)
                        outcome.config?.let { config ->
                            onConnected(config)
                            onConnection(MobileHudConnectionUiState(MobileHudAppPhase.Connected, "已连接", "实时 HUD 正在同步。", backgroundKeepAlive = true))
                            connectMobileHudWebSocket(config, onConnection, onSnapshot)
                            pairingInput = ""
                        }
                    }
                }) {
                    Text("提交配对请求")
                }
                TextButton(onClick = { pairingInput = "" }) { Text("清空") }
            }
            Text(statusText, color = Color(0xFF9CA3AF), style = MaterialTheme.typography.bodySmall)
        }
    }
    SafetyNote()
}

@Composable
private fun ConnectionHero(connection: MobileHudConnectionUiState) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xEE05070C)), shape = RoundedCornerShape(32.dp), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(Color(0x22FF8A3D))
                    .border(1.dp, Color(0x66FF8A3D), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text("◉", color = Color(0xFFFF8A3D), fontWeight = FontWeight.Bold)
            }
            Column {
                Text(connection.title, fontWeight = FontWeight.Bold)
                Text("WSS + 指纹校验 · PC 批准后自动进入 Live HUD", color = Color(0xFF9CA3AF), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun LiveHudScreen(
    connection: MobileHudConnectionUiState,
    snapshot: MobileHudViewModel,
    diagnosticsExpanded: Boolean,
    onDiagnosticsExpandedChange: (Boolean) -> Unit,
    onDisconnect: () -> Unit,
) {
    var tickerIndex by remember(snapshot.snapshotId) { mutableStateOf(0) }
    var showAllSessions by remember(snapshot.snapshotId) { mutableStateOf(false) }
    val orderedSessions = sortedMobileSessions(snapshot.sessions)
    val focusSession = orderedSessions.getOrNull(tickerIndex % orderedSessions.size.coerceAtLeast(1))
    val activeSurface = mobileActiveSurface(snapshot)

    LaunchedEffect(snapshot.snapshotId, orderedSessions.size) {
        if (orderedSessions.size <= 1) return@LaunchedEffect
        while (true) {
            delay(4_000)
            tickerIndex = (tickerIndex + 1) % orderedSessions.size
        }
    }

    MobileHudIsland(connection, snapshot, focusSession, tickerIndex, orderedSessions.size)
    when (activeSurface) {
        MobileHudSurface.ApprovalCard, MobileHudSurface.QuestionCard -> {
            AttentionStack(snapshot.attention, activeSurface)
            SessionStack(
                sessions = snapshot.sessions,
                showAll = showAllSessions,
                onToggleShowAll = { showAllSessions = !showAllSessions },
            )
        }
        MobileHudSurface.CompletionCard -> {
            CompletionCardMobile(snapshot.completion)
            SessionStack(
                sessions = snapshot.sessions,
                showAll = showAllSessions,
                onToggleShowAll = { showAllSessions = !showAllSessions },
            )
        }
        MobileHudSurface.SessionList, MobileHudSurface.CapsuleOnly -> {
            SessionStack(
                sessions = snapshot.sessions,
                showAll = showAllSessions,
                onToggleShowAll = { showAllSessions = !showAllSessions },
            )
        }
    }
    DiagnosticsCard(snapshot, connection, diagnosticsExpanded, onDiagnosticsExpandedChange, onDisconnect)
}

@Composable
private fun MobileHudIsland(
    connection: MobileHudConnectionUiState,
    snapshot: MobileHudViewModel,
    focusSession: MobileHudSessionCard?,
    tickerIndex: Int,
    sessionCount: Int,
) {
    val hasAttention = snapshot.attention.isNotEmpty()
    val activeSurface = mobileActiveSurface(snapshot)
    val activity = focusSession?.activity ?: snapshot.summary.status
    val isActive = hasAttention || activity == "running" || connection.phase == MobileHudAppPhase.Reconnecting
    val pulse = rememberHudPulse(isActive)
    val frameColor = when (activeSurface) {
        MobileHudSurface.ApprovalCard -> Color(0xFFFFB347)
        MobileHudSurface.QuestionCard -> Color(0xFF66B3FF)
        MobileHudSurface.CompletionCard -> Color(0xFF86EFAC)
        else -> activityColor(activity)
    }
    val metrics = mobileHeroMetrics(snapshot, focusSession).take(3)
    Card(
        shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xF7050505)),
        modifier = Modifier
            .fillMaxWidth()
            .shadow(14.dp, RoundedCornerShape(26.dp), ambientColor = frameColor.copy(alpha = 0.12f), spotColor = frameColor.copy(alpha = 0.10f))
            .border(1.dp, frameColor.copy(alpha = 0.24f + pulse * 0.12f), RoundedCornerShape(26.dp)),
    ) {
        Column(
            modifier = Modifier
                .background(Brush.verticalGradient(listOf(Color(0xFF060606), Color(0xFF020202))))
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                ClawdMascot(activity = activity, alert = hasAttention, size = 42)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text(
                            "Claude",
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFFF8FAFC),
                            style = MaterialTheme.typography.titleMedium,
                            fontFamily = FontFamily.Monospace,
                        )
                        Text(
                            snapshot.summary.activeSessionCount.toString(),
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Color(0x14FFFFFF))
                                .padding(horizontal = 7.dp, vertical = 3.dp),
                            color = Color(0xFFC9D3E3),
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.ExtraBold,
                            fontFamily = FontFamily.Monospace,
                        )
                        StatusLabel(mobileActivityLabel(activity), frameColor)
                    }
                    Text(
                        mobileTickerLine(snapshot, focusSession),
                        color = Color(0xFFB8C0CE),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    when {
                        snapshot.attention.isNotEmpty() -> HotCountBadge(snapshot.attention.size)
                        sessionCount > 1 -> Badge("${tickerIndex + 1}/$sessionCount", Color(0xFF8B95A7))
                        else -> Badge("PC", Color(0xFF8B95A7))
                    }
                    Text(connection.title, color = Color(0xFF7B8495), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (metrics.isEmpty()) {
                    Text("WSS · 只读 · 低敏同步", color = Color(0xFF7B8495), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                } else {
                    metrics.forEach { metric -> MetricChip(metric.label, metric.value) }
                }
                Spacer(modifier = Modifier.weight(1f))
                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(frameColor.copy(alpha = 0.85f)))
            }
            if (connection.phase == MobileHudAppPhase.Reconnecting || connection.phase == MobileHudAppPhase.DisconnectedRecoverable) {
                Text(connection.detail, color = Color(0xFFFBBF24), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun SessionStack(
    sessions: List<MobileHudSessionCard>,
    showAll: Boolean,
    onToggleShowAll: () -> Unit,
) {
    val ordered = sortedMobileSessions(sessions)
    val visible = if (showAll) ordered else ordered.take(3)
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column {
            Text("当前会话", color = Color(0xFFD7DEE9), fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
            Text(if (sessions.size > visible.size) "${visible.size}/${sessions.size} 个" else "${sessions.size} 个", color = Color(0xFF7B8495), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
        }
        if (ordered.size > 3) {
            TextButton(onClick = onToggleShowAll) { Text(if (showAll) "收起" else "全部") }
        }
    }
    if (visible.isEmpty()) {
        CompactCard("暂无会话", "连接后这里会显示 Desktop HUD 等价会话摘要。")
        return
    }
    visible.forEach { session -> MobileSessionCard(session) }
}

@Composable
private fun MobileSessionCard(session: MobileHudSessionCard) {
    val color = activityColor(session.activity)
    val active = session.activity == "running" || session.activity == "waiting"
    val pulse = rememberHudPulse(active)
    Card(
        colors = CardDefaults.cardColors(containerColor = if (active) Color(0xF2080808) else Color(0xEE070707)),
        shape = RoundedCornerShape(15.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, if (active) color.copy(alpha = 0.20f + pulse * 0.10f) else Color(0x12FFFFFF), RoundedCornerShape(15.dp)),
    ) {
        Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height(46.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(color.copy(alpha = if (active) 0.88f else 0.42f)),
            )
            ClawdMascot(activity = session.activity, alert = session.activity == "waiting", size = 34)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp), modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        mobileSessionTitle(session),
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFFF8FAFC),
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    StatusLabel(mobileActivityLabel(session.activity), color)
                }
                Text(
                    mobileSessionTickerLine(session),
                    color = Color(0xFFB8C0CE),
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                    mobileSessionMetaChips(session).take(2).forEach { chip -> SoftChip(chip) }
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(mobileUpdatedLabel(session.updatedAt), color = Color(0xFF7B8495), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                Text("PC", color = Color(0xFF7B8495), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun AttentionStack(attention: List<MobileHudAttentionItem>, surface: MobileHudSurface) {
    val groups = mobileAttentionGroups(attention)
    if (groups.isEmpty()) return
    val accent = if (surface == MobileHudSurface.QuestionCard) Color(0xFF66B3FF) else Color(0xFFFF8A3D)
    SectionTitle("需要关注", if (attention.size > groups.sumOf { it.count }) "还有 ${attention.size - groups.sumOf { it.count }}" else "${attention.size} 条")
    groups.forEach { group ->
        val groupAccent = if (isQuestionKind(group.kind)) Color(0xFF66B3FF) else accent
        val pulse = rememberHudPulse(true)
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xF3060A12)),
            shape = RoundedCornerShape(26.dp),
            modifier = Modifier
                .fillMaxWidth()
                .shadow(18.dp, RoundedCornerShape(26.dp), ambientColor = groupAccent.copy(alpha = 0.18f), spotColor = groupAccent.copy(alpha = 0.10f))
                .border(1.dp, groupAccent.copy(alpha = 0.36f + pulse * 0.18f), RoundedCornerShape(26.dp)),
        ) {
            Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(13.dp), verticalAlignment = Alignment.Top) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Brush.radialGradient(listOf(groupAccent.copy(alpha = 0.55f), groupAccent.copy(alpha = 0.16f))))
                        .border(1.dp, groupAccent.copy(alpha = 0.45f), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(if (isQuestionKind(group.kind)) "?" else "!", color = Color(0xFFF8FAFC), fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleLarge)
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(compactMobileText(group.title, 22), color = Color(0xFFFFE2C2), fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
                        if (group.count > 1) StatusLabel("×${group.count}", groupAccent)
                    }
                    Text(compactMobileText(group.body, 52), color = Color(0xFFE7D7CA), style = MaterialTheme.typography.bodyMedium)
                    Text("手机只读 · 回 PC 处理", color = Color(0xFFB79A82), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun CompletionCardMobile(completion: MobileHudCompletionCard?) {
    if (completion == null) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0x1416A34A))
            .border(1.dp, Color(0x2A86EFAC), RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("✓", color = Color(0xFF86EFAC), fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
        Text(
            compactMobileText("刚完成 · ${completion.title}", 42).ifBlank { "刚完成一轮 · 回 PC 查看" },
            modifier = Modifier.weight(1f),
            color = Color(0xFFB7F7D4),
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun DiagnosticsCard(
    snapshot: MobileHudViewModel,
    connection: MobileHudConnectionUiState,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onDisconnect: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0x3D000000)), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("WSS · 只读 · ${connection.title}", modifier = Modifier.weight(1f), color = Color(0xFF7B8495), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis)
                TextButton(onClick = { onExpandedChange(!expanded) }) { Text(if (expanded) "收起" else "详情") }
            }
            if (expanded) {
                Text("协议 v${snapshot.protocolVersion} · 快照 ${snapshot.snapshotVersion}", color = Color(0xFFD1D5DB), style = MaterialTheme.typography.bodySmall)
                Text("后台：${if (connection.backgroundKeepAlive) "低敏常驻通知已开启" else "回到应用时自动恢复"}", color = Color(0xFFD1D5DB), style = MaterialTheme.typography.bodySmall)
                Text("隐私：不显示路径、命令、prompt 或工具内容。", color = Color(0xFFD1D5DB), style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = onDisconnect) { Text("断开并重新配对") }
            }
        }
    }
}

@Composable
private fun SafetyNote() {
    CompactCard("隐私说明", "手机通知保持低敏。允许/拒绝/回答/终端跳转和原始工具数据仍只留在 PC。")
}

@Composable
private fun StepRow(index: String, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Badge(index, Color(0xFF6EE7F9))
        Text(text, color = Color(0xFFD1D5DB), style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun SectionTitle(title: String, trailing: String?) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Color(0xFFFFB27A), fontWeight = FontWeight.Bold)
        trailing?.let { Text(it, color = Color(0xFF9CA3AF), style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun CompactCard(title: String, body: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xAA111827)), shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(title, color = Color(0xFFFFB27A), fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(6.dp))
            Text(body, color = Color(0xFFD1D5DB), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun StatusPill(label: String, phase: MobileHudAppPhase) {
    val color = when (phase) {
        MobileHudAppPhase.Connected -> Color(0xFF34D399)
        MobileHudAppPhase.Reconnecting, MobileHudAppPhase.WaitingPcApproval, MobileHudAppPhase.Pairing, MobileHudAppPhase.Connecting -> Color(0xFFFFB27A)
        MobileHudAppPhase.DisconnectedRecoverable, MobileHudAppPhase.Revoked -> Color(0xFFF87171)
        MobileHudAppPhase.Unpaired -> Color(0xFF64748B)
    }
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.16f))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(color))
        Spacer(modifier = Modifier.width(6.dp))
        Text(label, color = color, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun Badge(text: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.18f))
            .padding(horizontal = 9.dp, vertical = 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = color, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun CodeIslandFilterChip(label: String, selected: Boolean) {
    val color = if (selected) Color(0xFF4ADE80) else Color(0xFF7B8495)
    Text(
        label,
        modifier = Modifier
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) Color(0x2422C55E) else Color(0x12FFFFFF))
            .border(1.dp, color.copy(alpha = if (selected) 0.40f else 0.18f), RoundedCornerShape(9.dp))
            .padding(horizontal = 9.dp, vertical = 5.dp),
        color = color,
        style = MaterialTheme.typography.bodySmall,
        fontWeight = FontWeight.ExtraBold,
        fontFamily = FontFamily.Monospace,
    )
}

@Composable
private fun MetricChip(label: String, value: String) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color(0x1AFFFFFF))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, color = Color(0xFF94A3B8), style = MaterialTheme.typography.bodySmall)
        Text(value, color = Color(0xFFE5E7EB), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun HeroMetric(label: String, value: String) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0x18FFFFFF))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, color = Color(0xFF8B95A7), style = MaterialTheme.typography.bodySmall)
        Text(value, color = Color(0xFFF8FAFC), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun SoftChip(text: String) {
    Text(
        text,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color(0x18FFFFFF))
            .padding(horizontal = 9.dp, vertical = 5.dp),
        color = Color(0xFFD7DEE9),
        style = MaterialTheme.typography.bodySmall,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun StatusLabel(text: String, color: Color) {
    Text(
        text,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.16f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        color = color,
        style = MaterialTheme.typography.bodySmall,
        fontWeight = FontWeight.Bold,
    )
}

@Composable
private fun HotCountBadge(count: Int) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color(0x33FF8A3D))
            .padding(horizontal = 10.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("!", color = Color(0xFFFFB27A), fontWeight = FontWeight.ExtraBold)
        Text(count.toString(), color = Color(0xFFFFB27A), fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun rememberHudPulse(active: Boolean): Float {
    if (!active) return 0f
    val transition = rememberInfiniteTransition(label = "hud-pulse")
    return transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "hud-pulse-alpha",
    ).value
}

private enum class ClawdScene { Sleep, Work, Alert }

@Composable
private fun ClawdMascot(activity: String, alert: Boolean, size: Int) {
    val scene = when {
        alert || activity == "waiting" || activity == "error" -> ClawdScene.Alert
        activity == "running" -> ClawdScene.Work
        else -> ClawdScene.Sleep
    }
    val transition = rememberInfiniteTransition(label = "desktop-clawd")
    val duration = when (scene) {
        ClawdScene.Sleep -> 4500
        ClawdScene.Work -> 700
        ClawdScene.Alert -> 3500
    }
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(durationMillis = duration, easing = LinearEasing)),
        label = "desktop-clawd-phase",
    )
    val pulse = rememberHudPulse(scene != ClawdScene.Sleep)
    Canvas(
        modifier = Modifier
            .size(size.dp)
            .graphicsLayer {
                scaleX = 1f + pulse * 0.025f
                scaleY = 1f + pulse * 0.025f
            },
    ) {
        val scale = min(this.size.width, this.size.height) / 36f
        when (scene) {
            ClawdScene.Sleep -> drawClawdSleep(scale, phase)
            ClawdScene.Work -> drawClawdWork(scale, phase)
            ClawdScene.Alert -> drawClawdAlert(scale, phase, activity == "error")
        }
    }
}

private fun DrawScope.drawClawdSleep(scale: Float, phase: Float) {
    val body = Color(0xFFD99A82)
    val eye = Color(0xFF050505)
    val breath = ((sin(phase * 2f * PI).toFloat() + 1f) / 2f)
    val y = -1.1f * breath
    clawdOval(2f, 31f, 32f, 3f, Color.Black.copy(alpha = 0.32f + breath * 0.08f), scale)
    clawdRect(6f, 17f + y, 22f, 10f + breath * 1.6f, body, scale)
    clawdRect(3f, 22f + y, 3f, 4f, body.copy(alpha = 0.82f), scale)
    clawdRect(28f, 22f + y, 3f, 4f, body.copy(alpha = 0.82f), scale)
    clawdRect(12f, 26f + y, 2f, 4f, body, scale)
    clawdRect(23f, 26f + y, 2f, 4f, body, scale)
    clawdRect(13f, 22f + y - breath, 5f, 2f, eye, scale)
    clawdRect(22f, 22f + y - breath, 5f, 2f, eye, scale)
    drawPixelZ(29f + breath * 2f, 6f - breath * 7f, 0.78f - breath * 0.35f, scale)
    drawPixelZ(24f + breath * 1.2f, 3f - breath * 5f, 0.55f - breath * 0.20f, scale)
}

private fun DrawScope.drawClawdWork(scale: Float, phase: Float) {
    val body = Color(0xFFD99A82)
    val eye = Color(0xFF050505)
    val keyboard = Color(0xFF616F80)
    val key = Color(0xFF99A8B8)
    val hi = Color(0xFFFFFFFF)
    val lift = -1.8f * ((sin(phase * 2f * PI).toFloat() + 1f) / 2f)
    val leftTap = ((sin(phase * 8f * PI).toFloat() + 1f) / 2f)
    val rightTap = ((sin(phase * 10f * PI + 1.2f).toFloat() + 1f) / 2f)

    clawdOval(8f, 31f, 18f, 3f, Color.Black.copy(alpha = 0.30f - lift * 0.03f), scale)
    clawdRect(9f, 7f + lift, 20f, 15f, body, scale)
    clawdRect(11f, 21f + lift, 2f, 5f, body, scale)
    clawdRect(25f, 21f + lift, 2f, 5f, body, scale)
    clawdRect(13f, 12f + lift, 2f, 4f, eye, scale)
    clawdRect(24f, 12f + lift, 2f, 4f, eye, scale)
    rotate(-12f - 36f * leftTap, pivot = Offset(9f * scale, (17f + lift) * scale)) {
        clawdRect(6f, 16f + lift, 4f, 4f, body.copy(alpha = 0.86f), scale)
    }
    rotate(12f + 36f * rightTap, pivot = Offset(29f * scale, (17f + lift) * scale)) {
        clawdRect(28f, 16f + lift, 4f, 4f, body.copy(alpha = 0.86f), scale)
    }
    clawdRect(3f, 25f, 30f, 9f, keyboard, scale)
    for (row in 0 until 3) {
        for (column in 0 until 6) {
            val index = row * 6 + column
            val isLeft = index == 0 || index == 7 || index == 14
            val isRight = index == 3 || index == 10 || index == 17
            val pressed = (isLeft && leftTap > 0.55f) || (isRight && rightTap > 0.55f)
            clawdRect(5f + column * 4.4f, 26.4f + row * 2.2f, 3.0f, 1.4f, if (pressed) hi else key, scale)
        }
    }
}

private fun DrawScope.drawClawdAlert(scale: Float, phase: Float, error: Boolean) {
    val body = Color(0xFFD99A82)
    val eye = Color(0xFF050505)
    val alert = if (error) Color(0xFFEF4444) else Color(0xFFFF3D00)
    val activeWindow = if (phase < 0.62f) 1f - phase / 0.62f else 0f
    val jump = -8.5f * abs(sin(phase * 5f * PI).toFloat()) * activeWindow
    val arm = 12f + 42f * activeWindow

    drawCircle(alert.copy(alpha = 0.12f + activeWindow * 0.10f), radius = 12f * scale, center = Offset(19f * scale, 18f * scale))
    clawdOval(8f, 31f, 18f, 3f, Color.Black.copy(alpha = 0.18f + 0.28f * (1f - activeWindow)), scale)
    clawdRect(9f, 11f + jump, 20f, 14f, body, scale)
    clawdRect(11f, 24f + jump, 2f, 7f, body, scale)
    clawdRect(25f, 24f + jump, 2f, 7f, body, scale)
    clawdRect(13f, 15f + jump, 2f, 4f, eye, scale)
    clawdRect(24f, 15f + jump, 2f, 4f, eye, scale)
    rotate(arm, pivot = Offset(9f * scale, (18f + jump) * scale)) {
        clawdRect(5f, 18f + jump, 4f, 4f, body.copy(alpha = 0.86f), scale)
    }
    rotate(-arm, pivot = Offset(29f * scale, (18f + jump) * scale)) {
        clawdRect(29f, 18f + jump, 4f, 4f, body.copy(alpha = 0.86f), scale)
    }
    if (activeWindow > 0.05f) {
        clawdRect(29f, 3f, 3f, 8f, alert, scale)
        clawdRect(29f, 13f, 3f, 3f, alert, scale)
    }
}

private fun DrawScope.clawdRect(x: Float, y: Float, width: Float, height: Float, color: Color, scale: Float) {
    drawRect(color = color, topLeft = Offset(x * scale, y * scale), size = Size(width * scale, height * scale))
}

private fun DrawScope.clawdOval(x: Float, y: Float, width: Float, height: Float, color: Color, scale: Float) {
    drawOval(color = color, topLeft = Offset(x * scale, y * scale), size = Size(width * scale, height * scale))
}

private fun DrawScope.drawPixelZ(x: Float, y: Float, alpha: Float, scale: Float) {
    val color = Color.White.copy(alpha = alpha.coerceIn(0f, 0.82f))
    clawdRect(x, y, 5f, 1f, color, scale)
    clawdRect(x + 3f, y + 1f, 2f, 1f, color, scale)
    clawdRect(x + 2f, y + 2f, 2f, 1f, color, scale)
    clawdRect(x, y + 3f, 5f, 1f, color, scale)
}

@Composable
private fun ActivityDot(activity: String) {
    Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(activityColor(activity)))
}

private fun activityColor(activity: String): Color = when (activity) {
    "running" -> Color(0xFF4ADE80)
    "waiting" -> Color(0xFFFFB347)
    "error" -> Color(0xFFF87171)
    "active" -> Color(0xFF6EE7F9)
    else -> Color(0xFF64748B)
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
                    onConnection(MobileHudConnectionUiState(MobileHudAppPhase.WaitingPcApproval, "等待 PC 批准", "已提交。请回 PC 批准这台手机。"))
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
        PairingSubmitOutcome(pairingFailureMessage(error))
    }
}

private fun pairingFailureMessage(error: Throwable): String {
    val detail = error.message.orEmpty()
    val hostnameMismatch = error is SSLPeerUnverifiedException
        || (detail.contains("hostname", ignoreCase = true) && detail.contains("not verified", ignoreCase = true))
    return if (hostnameMismatch) {
        "配对请求失败：PC 服务证书和当前配对地址不一致。请在 PC 设置页重启移动 HUD 服务并重新生成配对链接，再粘贴到手机。"
    } else {
        "配对请求失败：${detail.ifBlank { "网络不可达" }}。请确认 PC 服务已启动、两台设备在同一网络，或重新生成配对链接。"
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
                        onConnection(MobileHudConnectionUiState(MobileHudAppPhase.Connected, "已连接", "实时 HUD 正在同步。", backgroundKeepAlive = true))
                    }
                    return snapshot
                }
            }
        }
        if (attempt == 0 || attempt % 5 == 4) {
            withContext(Dispatchers.Main) {
                onConnection(MobileHudConnectionUiState(MobileHudAppPhase.WaitingPcApproval, "等待 PC 批准", "已提交配对请求，等待 PC 批准后自动连接。"))
            }
        }
        delay(2_000)
    }
    return null
}

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
                postConnection(onConnection, MobileHudConnectionUiState(MobileHudAppPhase.Connected, "已连接", "加密实时通道已建立。", backgroundKeepAlive = true))
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val snapshot = runCatching { parseMobileHudEnvelope(text).payload }.getOrNull()
                if (snapshot != null) {
                    postSnapshot(onSnapshot, snapshot)
                    postConnection(onConnection, MobileHudConnectionUiState(MobileHudAppPhase.Connected, "已连接", "实时 HUD 正在同步。", backgroundKeepAlive = true))
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                postConnection(onConnection, MobileHudConnectionUiState(MobileHudAppPhase.Reconnecting, "正在重连", "正在恢复连接，继续显示最后一次状态。", backgroundKeepAlive = true))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                postConnection(onConnection, MobileHudConnectionUiState(MobileHudAppPhase.DisconnectedRecoverable, "已断开", "PC 暂时不可达，正在重试。", backgroundKeepAlive = true))
            }
        },
    )
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
        activeSessionCount = 0,
        attentionCount = 0,
        notificationCount = 0,
        modelLabel = "Claude",
        projectLabel = null,
    ),
    displayPolicy = MobileHudDisplayPolicy(
        visibleItems = listOf("activity", "project", "tools", "model", "contextValue", "sessionTokens", "usage", "cost", "git", "addedDirs", "agents", "todos", "speed", "effortLevel"),
        terminalJump = false,
        approvalActions = false,
        questionActions = false,
        notificationsEnabled = true,
        privacyNote = "只读手机 DTO 预览。",
    ),
    capsule = MobileHudCapsule(
        mascot = "clawd",
        state = "idle",
        title = "Claude HUD One",
        statusText = "连接后会显示实时状态。",
        ticker = emptyList(),
    ),
    sessions = emptyList(),
    attention = emptyList(),
    completion = null,
    notificationEvents = emptyList(),
)
