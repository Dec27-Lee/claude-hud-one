package com.claudehud.one.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileHudPresentationTest {
    @Test
    fun compactMobileTextRemovesUuidNoise() {
        val value = compactMobileText("Claude Code active 7a026df6-f2f7-4d0a-a30e-4ac8c8bd54c4", 32)

        assertFalse(value.contains("7a026df6"))
        assertTrue(value.length <= 33)
    }

    @Test
    fun prioritizedSessionsPreferWaitingAndRunning() {
        val sessions = listOf(
            session("idle", "idle session", "2026-06-18T10:00:00Z"),
            session("running", "running session", "2026-06-18T09:00:00Z"),
            session("waiting", "waiting session", "2026-06-18T08:00:00Z"),
            session("active", "active session", "2026-06-18T11:00:00Z"),
        )

        val result = prioritizedMobileSessions(sessions, 3)

        assertEquals(listOf("waiting session", "running session", "active session"), result.map { it.sessionName })
    }

    @Test
    fun attentionGroupsAggregateRepeatedRequests() {
        val groups = mobileAttentionGroups(
            listOf(
                attention("approval", "PowerShell", "s1"),
                attention("approval", "PowerShell", "s1"),
                attention("question", null, "s2"),
            ),
        )

        assertEquals(2, groups.size)
        assertEquals("PowerShell 需要授权", groups[0].title)
        assertEquals(2, groups[0].count)
        assertTrue(groups[0].body.contains("2 条类似提醒"))
    }

    private fun session(activity: String, name: String, updatedAt: String) = MobileHudSessionCard(
        sessionRef = name,
        sessionName = name,
        projectLabel = "Claude HUD One",
        activity = activity,
        statusText = "$name status",
        updatedAt = updatedAt,
    )

    private fun attention(kind: String, toolName: String?, sessionRef: String) = MobileHudAttentionItem(
        itemRef = "$kind-$sessionRef-${toolName.orEmpty()}",
        sessionRef = sessionRef,
        kind = kind,
        status = "pending",
        title = "Claude Code needs attention",
        summary = "Review it in PC",
        toolName = toolName,
        createdAt = "2026-06-18T10:00:00Z",
        actionState = "readOnly",
    )
}
