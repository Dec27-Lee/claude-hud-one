package com.claudehud.one.mobile

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

// Canonical protocol source: schemas/mobile-hud/protocol.json + schemas/mobile-hud/*.schema.json.
// Keep unknown fields/enums tolerant so newer desktop snapshots do not crash older mobile clients.
val MobileHudJson: Json = Json {
    ignoreUnknownKeys = true
}

@Serializable
data class MobileHudFixtureDocument(
    val name: String,
    val description: String,
    val envelope: MobileHudEnvelope,
    val androidFallback: JsonObject = JsonObject(emptyMap()),
)

@Serializable
data class MobileHudEnvelope(
    val protocolVersion: Int,
    val messageId: String,
    val seq: Long,
    val kind: String,
    val sentAt: String,
    val snapshotVersion: Long? = null,
    val payload: MobileHudViewModel,
)

@Serializable
data class MobileHudViewModel(
    val protocolVersion: Int,
    val snapshotVersion: Long,
    val snapshotId: String,
    val generatedAt: String,
    val displayMode: String,
    val privacyLevel: String,
    val summary: MobileHudSummary,
    val displayPolicy: MobileHudDisplayPolicy,
    val capsule: MobileHudCapsule,
    val sessions: List<MobileHudSessionCard> = emptyList(),
    val attention: List<MobileHudAttentionItem> = emptyList(),
    val completion: MobileHudCompletionCard? = null,
    val notificationEvents: List<MobileHudNotificationEvent> = emptyList(),
)

@Serializable
data class MobileHudSummary(
    val status: String,
    val statusText: String,
    val activeSessionCount: Int,
    val attentionCount: Int,
    val notificationCount: Int,
    val modelLabel: String? = null,
    val projectLabel: String? = null,
)

@Serializable
data class MobileHudDisplayPolicy(
    val visibleItems: List<String> = emptyList(),
    val hiddenByDesktopConfig: List<String> = emptyList(),
    val terminalJump: Boolean = false,
    val approvalActions: Boolean = false,
    val questionActions: Boolean = false,
    val notificationsEnabled: Boolean = false,
    val privacyNote: String = "",
)

@Serializable
data class MobileHudCapsule(
    val mascot: String,
    val state: String,
    val title: String,
    val statusText: String,
    val ticker: List<MobileHudDisplayItem> = emptyList(),
)

@Serializable
data class MobileHudDisplayItem(
    val id: String,
    val label: String,
    val value: String,
    val emphasis: String? = null,
)

@Serializable
data class MobileHudSessionCard(
    val sessionRef: String,
    val sessionName: String,
    val projectLabel: String,
    val activity: String,
    val statusText: String,
    val modelLabel: String? = null,
    val activeToolName: String? = null,
    val permissionMode: String? = null,
    val contextUsedPercent: Double? = null,
    val contextRemainingPercent: Double? = null,
    val contextWindowSize: Double? = null,
    val contextUsedTokens: Double? = null,
    val inputTokens: Double? = null,
    val outputTokens: Double? = null,
    val cacheCreationInputTokens: Double? = null,
    val cacheReadInputTokens: Double? = null,
    val totalCostUsd: Double? = null,
    val fiveHourUsedPercent: Double? = null,
    val sevenDayUsedPercent: Double? = null,
    val effortLevel: String? = null,
    val thinkingEnabled: Boolean? = null,
    val gitBranch: String? = null,
    val gitDirty: Boolean? = null,
    val gitAhead: Double? = null,
    val gitBehind: Double? = null,
    val addedDirSlugs: List<String>? = null,
    val addedDirsOverflowCount: Double? = null,
    val toolsCount: Double? = null,
    val toolsRunningCount: Double? = null,
    val agentsCount: Double? = null,
    val agentsRunningCount: Double? = null,
    val todosActiveCount: Double? = null,
    val todosCompletedCount: Double? = null,
    val todosTotalCount: Double? = null,
    val outputSpeed: Double? = null,
    val sessionStartedAt: String? = null,
    val lastAssistantResponseAt: String? = null,
    val updatedAt: String,
    val privacyNote: String = "",
)

@Serializable
data class MobileHudAttentionItem(
    val itemRef: String,
    val sessionRef: String,
    val kind: String,
    val status: String,
    val title: String,
    val summary: String? = null,
    val toolName: String? = null,
    val createdAt: String,
    val expiresAt: String? = null,
    val actionState: String,
    val privacyNote: String = "",
)

@Serializable
data class MobileHudCompletionCard(
    val sessionRef: String,
    val title: String,
    val body: String,
    val completedAt: String,
)

@Serializable
data class MobileHudNotificationEvent(
    val eventId: String,
    val dedupeKey: String,
    val collapseKey: String,
    val kind: String,
    val sensitivity: String,
    val title: String,
    val body: String,
    val createdAt: String,
    val source: String,
    val targetSessionRef: String? = null,
)

fun parseMobileHudFixture(content: String): MobileHudFixtureDocument =
    MobileHudJson.decodeFromString(MobileHudFixtureDocument.serializer(), content)
