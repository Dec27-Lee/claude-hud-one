package com.claudehud.one.mobile

enum class MobileHudAppPhase {
    Unpaired,
    Pairing,
    WaitingPcApproval,
    Connecting,
    Connected,
    Reconnecting,
    DisconnectedRecoverable,
    Revoked,
}

enum class MobileHudSurface {
    CapsuleOnly,
    SessionList,
    ApprovalCard,
    QuestionCard,
    CompletionCard,
}

data class MobileAttentionGroup(
    val kind: String,
    val toolName: String?,
    val title: String,
    val body: String,
    val count: Int,
)

data class MobileHudMetric(
    val label: String,
    val value: String,
)

fun compactMobileText(value: String?, maxLength: Int = 36): String {
    val normalized = value
        ?.replace(Regex("[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}"), "…")
        ?.replace(Regex("\\s+"), " ")
        ?.trim()
        .orEmpty()
    if (normalized.length <= maxLength) return normalized
    return normalized.take(maxLength).trimEnd() + "…"
}

fun isApprovalKind(kind: String): Boolean = kind == "approval" || kind == "waitingApproval"

fun isQuestionKind(kind: String): Boolean = kind == "question" || kind == "waitingQuestion"

fun mobileActivityLabel(activity: String): String = when (activity) {
    "running" -> "运行中"
    "waiting" -> "等待中"
    "active" -> "活跃"
    "idle" -> "空闲"
    "error" -> "异常"
    else -> "未知"
}

fun mobileActivityRank(activity: String): Int = when (activity) {
    "waiting" -> 0
    "running" -> 1
    "error" -> 2
    "active" -> 3
    "idle" -> 4
    else -> 5
}

fun prioritizedMobileSessions(sessions: List<MobileHudSessionCard>, limit: Int = 3): List<MobileHudSessionCard> = sessions
    .sortedWith(compareBy<MobileHudSessionCard> { mobileActivityRank(it.activity) }.thenByDescending { it.updatedAt })
    .take(limit.coerceAtLeast(1))

fun sortedMobileSessions(sessions: List<MobileHudSessionCard>): List<MobileHudSessionCard> = sessions
    .sortedWith(compareBy<MobileHudSessionCard> { mobileActivityRank(it.activity) }.thenByDescending { it.updatedAt })

fun mobileActiveSurface(snapshot: MobileHudViewModel): MobileHudSurface {
    if (snapshot.attention.any { isApprovalKind(it.kind) }) return MobileHudSurface.ApprovalCard
    if (snapshot.attention.any { isQuestionKind(it.kind) }) return MobileHudSurface.QuestionCard
    if (snapshot.completion != null) return MobileHudSurface.CompletionCard
    return if (snapshot.sessions.isNotEmpty()) MobileHudSurface.SessionList else MobileHudSurface.CapsuleOnly
}

fun mobileAttentionGroups(attention: List<MobileHudAttentionItem>, limit: Int = 2): List<MobileAttentionGroup> {
    return attention
        .filter { item -> item.status != "resolved" && item.status != "dismissed" }
        .groupBy { item -> listOf(item.kind, item.toolName.orEmpty(), item.sessionRef).joinToString("|") }
        .values
        .map { items ->
            val first = items.first()
            val title = when {
                isApprovalKind(first.kind) && !first.toolName.isNullOrBlank() -> "${shortMobileToolName(first.toolName)} 需要授权"
                isApprovalKind(first.kind) -> "Claude Code 需要授权"
                isQuestionKind(first.kind) -> "Claude 正在等待回复"
                else -> compactMobileText(first.title, 24).ifBlank { "Claude Code 需要处理" }
            }
            val summary = when {
                isApprovalKind(first.kind) -> "请回 PC 终端确认工具权限"
                isQuestionKind(first.kind) -> "请回 PC 回复 Claude Code"
                else -> compactMobileText(first.summary ?: first.title, 34).ifBlank { "请回 PC 查看" }
            }
            MobileAttentionGroup(
                kind = first.kind,
                toolName = first.toolName,
                title = title,
                body = if (items.size > 1) "${items.size} 条类似提醒 · $summary" else "$summary · 只读",
                count = items.size,
            )
        }
        .sortedWith(compareBy<MobileAttentionGroup> { if (isApprovalKind(it.kind)) 0 else if (isQuestionKind(it.kind)) 1 else 2 }.thenByDescending { it.count })
        .take(limit.coerceAtLeast(1))
}

fun mobileStatusHeadline(snapshot: MobileHudViewModel): String {
    val waiting = snapshot.attention.firstOrNull()
    if (waiting != null) {
        return when {
            isApprovalKind(waiting.kind) -> "需要 PC 授权"
            isQuestionKind(waiting.kind) -> "等待你回复"
            else -> "需要处理"
        }
    }
    val session = prioritizedMobileSessions(snapshot.sessions, 1).firstOrNull()
    return when (session?.activity) {
        "running" -> "Claude 正在运行"
        "waiting" -> "Claude 正在等待"
        "error" -> "Claude 需要帮助"
        "active" -> "Claude 正在活动"
        "idle" -> "Claude 已空闲"
        else -> localizedStatusText(snapshot.summary.statusText).ifBlank { "Claude HUD One" }
    }
}

fun mobileSessionTitle(session: MobileHudSessionCard, fallbackIndex: Int = 1): String {
    val preferred = listOf(session.projectLabel, session.sessionName).firstOrNull { value ->
        val compact = compactMobileText(value, 28)
        compact.isNotBlank() && compact != "…" && compact != "..."
    }
    val name = compactMobileText(preferred, 22).ifBlank { "Claude 会话 $fallbackIndex" }
    val sessionName = compactMobileText(session.sessionName, 12)
    return if (sessionName.isNotBlank() && sessionName != name && !sessionName.contains("…")) "$name $sessionName" else name
}

fun mobileUpdatedLabel(value: String?): String {
    if (value.isNullOrBlank() || value == "preview") return "刚刚"
    if (value.startsWith("2026-")) return "今天"
    return compactMobileText(value, 8).ifBlank { "刚刚" }
}

fun mobileTickerLine(snapshot: MobileHudViewModel, focusSession: MobileHudSessionCard? = sortedMobileSessions(snapshot.sessions).firstOrNull()): String {
    val sessionLine = focusSession?.let { mobileSessionTickerLine(it) }.orEmpty()
    if (sessionLine.isNotBlank()) return sessionLine
    val items = snapshot.capsule.ticker
        .take(4)
        .mapNotNull { item -> mobileDisplayItemText(item) }
    if (items.isNotEmpty()) return items.joinToString(" · ")
    return localizedStatusText(snapshot.summary.statusText).ifBlank { "实时 HUD 正在同步" }
}

fun mobileHeroMetrics(snapshot: MobileHudViewModel, focusSession: MobileHudSessionCard? = sortedMobileSessions(snapshot.sessions).firstOrNull()): List<MobileHudMetric> {
    val metrics = mutableListOf<MobileHudMetric>()
    metrics += MobileHudMetric("会话", snapshot.summary.activeSessionCount.toString())
    if (snapshot.summary.attentionCount > 0) metrics += MobileHudMetric("关注", snapshot.summary.attentionCount.toString())
    focusSession?.activeToolName?.let { metrics += MobileHudMetric("工具", shortMobileToolName(it)) }
    focusSession?.contextUsedTokens?.let { metrics += MobileHudMetric("上下文", compactMobileTokens(it)) }
    focusSession?.todosTotalCount?.takeIf { it > 0.0 }?.let { total ->
        metrics += MobileHudMetric("待办", "${focusSession.todosCompletedCount?.toInt() ?: 0}/${total.toInt()}")
    }
    focusSession?.agentsCount?.takeIf { it > 0.0 }?.let { metrics += MobileHudMetric("代理", it.toInt().toString()) }
    if (metrics.size < 3) {
        snapshot.summary.modelLabel?.let { metrics += MobileHudMetric("模型", compactMobileText(it, 9)) }
    }
    return metrics.take(4)
}

fun mobileSessionTickerLine(session: MobileHudSessionCard): String {
    val parts = listOfNotNull(
        mobileActivityLabel(session.activity),
        session.activeToolName?.let { "工具 ${shortMobileToolName(it)}" } ?: localizedStatusText(session.statusText).takeIf { it.isNotBlank() },
        compactMobileText(session.projectLabel, 14).takeIf { it.isNotBlank() },
        session.gitBranch?.let { "git ${compactMobileText(it + if (session.gitDirty == true) "*" else "", 14)}" },
    )
    return parts.take(3).joinToString(" · ")
}

fun mobileSessionMetaChips(session: MobileHudSessionCard): List<String> {
    val chips = mutableListOf<String>()
    session.activeToolName?.let { chips += "工具 ${shortMobileToolName(it)}" }
    session.modelLabel?.let { chips += "模型 ${compactMobileText(it, 8)}" }
    session.contextUsedTokens?.let { chips += "ctx ${compactMobileTokens(it)}" }
        ?: session.contextUsedPercent?.let { chips += "ctx ${it.toInt()}%" }
    session.toolsCount?.takeIf { it > 0.0 }?.let { chips += "tools ${it.toInt()}" }
    session.agentsCount?.takeIf { it > 0.0 }?.let { chips += "agents ${it.toInt()}" }
    session.todosTotalCount?.takeIf { it > 0.0 }?.let { chips += "todo ${session.todosCompletedCount?.toInt() ?: 0}/${it.toInt()}" }
    session.gitBranch?.let { chips += "git ${compactMobileText(it + if (session.gitDirty == true) "*" else "", 10)}" }
    session.effortLevel?.let { chips += "effort $it" }
    chips += mobileUpdatedLabel(session.updatedAt)
    return chips.take(5)
}

private fun mobileDisplayItemText(item: MobileHudDisplayItem): String? {
    val value = localizedTickerValue(item.id.ifBlank { item.label }, item.value)
    if (value.isBlank()) return null
    return "${localizedTickerLabel(item.label.ifBlank { item.id })} $value"
}

private fun localizedTickerLabel(label: String): String = when (label.lowercase()) {
    "activity" -> "活动"
    "model" -> "模型"
    "context", "contextvalue" -> "上下文"
    "tokens", "sessiontokens" -> "会话"
    "usage" -> "用量"
    "cost" -> "成本"
    "project" -> "项目"
    "tools" -> "工具"
    "git" -> "Git"
    "addeddirs", "dirs" -> "目录"
    "agents" -> "代理"
    "todos" -> "待办"
    "speed" -> "速度"
    "effort", "effortlevel" -> "强度"
    else -> label
}

private fun localizedTickerValue(label: String, value: String): String {
    val lower = label.lowercase()
    if (lower == "activity") return localizedStatusText(value)
    if (lower == "tools") return value.replace("Tool ", "工具 ")
    if (lower == "project") return compactMobileText(value, 18)
    return compactMobileText(value, 20)
}

private fun localizedStatusText(value: String?): String {
    val text = value.orEmpty()
    val toolRunning = Regex("^Tool running: (.+)$").find(text)
    if (toolRunning != null) return "工具运行中：${shortMobileToolName(toolRunning.groupValues[1])}"
    val toolFinished = Regex("^Tool finished: (.+)$").find(text)
    if (toolFinished != null) return "工具已完成：${shortMobileToolName(toolFinished.groupValues[1])}"
    return when (text) {
        "Generating response" -> "正在生成回复"
        "Tool running" -> "工具运行中"
        "Tool finished" -> "工具已完成"
        "Needs attention" -> "需要处理"
        "Waiting for user" -> "等待用户"
        "Run failed" -> "运行失败"
        "Claude Code active" -> "Claude 活动中"
        else -> compactMobileText(text, 48)
    }
}

private fun compactMobileTokens(tokens: Double): String = when {
    tokens < 1_000 -> tokens.toInt().toString()
    tokens < 10_000 -> "%.1fK".format(tokens / 1_000.0)
    tokens < 1_000_000 -> "${(tokens / 1_000.0).toInt()}K"
    else -> "%.1fM".format(tokens / 1_000_000.0)
}

private fun shortMobileToolName(value: String?): String {
    val raw = value.orEmpty().removePrefix("mcp__")
    val parts = raw.split("__")
    return compactMobileText(parts.lastOrNull().orEmpty().ifBlank { raw }, 14)
}
