package com.claudehud.one.mobile

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileHudFixtureTest {
    private val fixtureDir: File
        get() {
            val repoRoot = System.getProperty("repoRoot") ?: error("repoRoot system property is required")
            return File(repoRoot, "schemas/mobile-hud/fixtures")
        }

    @Test
    fun parsesAllContractFixtures() {
        val files = listOf(
            "running.json",
            "multi-session.json",
            "waiting-approval.json",
            "waiting-question.json",
            "completion.json",
            "error.json",
            "connection-lost.json",
            "revoked.json",
            "unknown-enum.json",
        )

        files.forEach { name ->
            val fixture = parseMobileHudFixture(File(fixtureDir, name).readText())
            assertEquals(1, fixture.envelope.protocolVersion)
            assertEquals(1, fixture.envelope.payload.protocolVersion)
            assertTrue("snapshot id should be set for $name", fixture.envelope.payload.snapshotId.isNotBlank())
            assertFalse("mobile must not expose approval actions for $name", fixture.envelope.payload.displayPolicy.approvalActions)
            assertFalse("mobile must not expose question actions for $name", fixture.envelope.payload.displayPolicy.questionActions)
            assertFalse("mobile must not expose terminal jump for $name", fixture.envelope.payload.displayPolicy.terminalJump)
        }
    }

    @Test
    fun notificationFixturesAreLowSensitive() {
        fixtureDir.listFiles { file -> file.extension == "json" }.orEmpty().forEach { file ->
            val fixture = parseMobileHudFixture(file.readText())
            fixture.envelope.payload.notificationEvents.forEach { event ->
                assertEquals("low", event.sensitivity)
                assertFalse(event.title.contains("/"))
                assertFalse(event.body.contains("transcript", ignoreCase = true))
                assertFalse(event.body.contains("prompt", ignoreCase = true))
            }
        }
    }

    @Test
    fun fixtureJsonDoesNotContainSensitiveKeys() {
        val sensitiveKeys = listOf(
            "\"transcriptPath\"",
            "\"projectDir\"",
            "\"cwd\"",
            "\"terminal\"",
            "\"intentId\"",
            "\"allowedIntents\"",
            "\"nonce\"",
            "\"rawInput\"",
            "\"rawOutput\"",
            "\"toolInput\"",
            "\"toolResult\"",
        )
        fixtureDir.listFiles { file -> file.extension == "json" }.orEmpty().forEach { file ->
            val content = file.readText()
            sensitiveKeys.forEach { key ->
                assertFalse("${file.name} should not contain $key", content.contains(key))
            }
        }
    }

    @Test
    fun unknownEnumFixtureFallsBackAsStrings() {
        val fixture = parseMobileHudFixture(File(fixtureDir, "unknown-enum.json").readText())

        assertEquals("futureSnapshot", fixture.envelope.kind)
        assertEquals("futureTrustedView", fixture.envelope.payload.displayMode)
        assertEquals("futureStatus", fixture.envelope.payload.summary.status)
        assertEquals("futureState", fixture.envelope.payload.capsule.state)
        assertEquals("futureAttention", fixture.envelope.payload.attention.single().kind)
    }
}
