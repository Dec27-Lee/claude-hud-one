package com.claudehud.one.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingLinkSanitizerTest {
    private val fingerprint = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

    @Test
    fun hidesPairingTokenAndFingerprintFromDisplaySummary() {
        val summary = safePairingSummary(
            "claudehud://pair?host=192.168.1.23&port=27431&pairingId=pair_fixture&token=one_time_secret&fp=sha256%2FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%3D&expires=2026-06-17T09%3A00%3A00Z",
        ) ?: error("summary expected")

        assertTrue(summary.contains("192.168.1.23:27431"))
        assertTrue(summary.contains("token hidden"))
        assertTrue(summary.contains("fingerprint hidden"))
        assertFalse(summary.contains("one_time_secret"))
        assertFalse(summary.contains(fingerprint))
        assertFalse(summary.contains("pairingId"))
        assertFalse(summary.contains("fp="))
    }

    @Test
    fun parsesAndValidatesPairingLinkFields() {
        val link = parseMobileHudPairingLink(
            "claudehud://pair?host=pc.local&port=27431&pairingId=pair_fixture&token=one_time_secret&fp=sha256%2FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%3D&expires=2026-06-17T09%3A00%3A00Z",
        ).getOrThrow()

        assertEquals("pc.local", link.host)
        assertEquals(27431, link.port)
        assertEquals("pair_fixture", link.pairingId)
        assertEquals("one_time_secret", link.token)
        assertEquals(fingerprint, link.fingerprint)
    }

    @Test
    fun rejectsInvalidPairingLinks() {
        assertTrue(parseMobileHudPairingLink("claudehud://pair?host=pc.local&port=80&pairingId=x&token=y&fp=$fingerprint&expires=x").isFailure)
        assertTrue(parseMobileHudPairingLink("claudehud://pair?host=pc.local&port=27431&pairingId=pair_fixture&token=one_time_secret&fp=sha256_fixture&expires=x").isFailure)
    }

    @Test
    fun ignoresNonPairingLinks() {
        assertNull(safePairingSummary(null))
        assertNull(safePairingSummary("https://example.com"))
    }
}
