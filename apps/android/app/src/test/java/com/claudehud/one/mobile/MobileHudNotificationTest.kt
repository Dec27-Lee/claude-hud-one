package com.claudehud.one.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class MobileHudNotificationTest {
    @Test
    fun lowSensitiveNotificationTextStripsSensitiveFragments() {
        val event = MobileHudNotificationEvent(
            eventId = "event_fixture",
            dedupeKey = "dedupe_fixture",
            collapseKey = "attention",
            kind = "waitingAttention",
            sensitivity = "low",
            title = "Claude needs attention / secret/path",
            body = "prompt transcript cwd toolInput token=secret fp=secret",
            createdAt = "2026-06-17T09:00:00Z",
            source = "test",
        )

        val text = lowSensitiveNotificationText(event)

        assertEquals(MOBILE_HUD_ATTENTION_CHANNEL, text.channelId)
        listOf("/", "prompt", "transcript", "cwd", "toolInput", "token=", "fp=").forEach { sensitive ->
            assertFalse(text.title.contains(sensitive, ignoreCase = true))
            assertFalse(text.body.contains(sensitive, ignoreCase = true))
        }
    }
}
