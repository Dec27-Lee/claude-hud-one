package com.claudehud.one.mobile

import java.io.File
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileHudFixtureTest {
    private val repoRoot: File
        get() = File(System.getProperty("repoRoot") ?: error("repoRoot system property is required"))

    private val fixtureDir: File
        get() = File(repoRoot, "schemas/mobile-hud/fixtures")

    private val protocolFile: File
        get() = File(repoRoot, "schemas/mobile-hud/protocol.json")

    @Test
    fun protocolMetadataKeepsMobileV1ReadOnlyAndLowSensitive() {
        val protocol = MobileHudJson.parseToJsonElement(protocolFile.readText()).jsonObject
        val privacy = protocol.getValue("privacy").jsonObject
        val displayPolicy = protocol.getValue("displayPolicy").jsonObject
        val security = protocol.getValue("security").jsonObject

        assertEquals(MobileHudProtocol.PROTOCOL_VERSION, protocol.getValue("protocolVersion").jsonPrimitive.int)
        assertEquals(MobileHudProtocol.TRUSTED_VIEW_PRIVACY_LEVEL, privacy.getValue("trustedViewPrivacyLevel").jsonPrimitive.content)
        assertEquals(MobileHudProtocol.NOTIFICATION_SENSITIVITY, privacy.getValue("notificationSensitivity").jsonPrimitive.content)
        assertEquals(MobileHudProtocol.MOBILE_EXECUTION_ROLE, privacy.getValue("mobileExecutionRole").jsonPrimitive.content)
        assertEquals(MobileHudProtocol.TRANSPORT, security.getValue("transport").jsonPrimitive.content)
        assertFalse(MobileHudProtocol.TERMINAL_JUMP)
        assertFalse(MobileHudProtocol.APPROVAL_ACTIONS)
        assertFalse(MobileHudProtocol.QUESTION_ACTIONS)
        assertFalse(MobileHudProtocol.DEVICE_ID_IS_CREDENTIAL)
        assertFalse(displayPolicy.getValue("terminalJump").jsonPrimitive.boolean)
        assertFalse(displayPolicy.getValue("approvalActions").jsonPrimitive.boolean)
        assertFalse(displayPolicy.getValue("questionActions").jsonPrimitive.boolean)
        assertFalse(security.getValue("deviceIdIsCredential").jsonPrimitive.boolean)
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
        val sensitiveKeys = MobileHudProtocol.DENIED_JSON_KEYS.map { "\"$it\"" }
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
