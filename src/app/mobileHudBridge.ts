import { invoke } from '@tauri-apps/api/core'

export type MobileHudSecurityPreview = {
  transport: 'wssSpkiPinning' | string
  deviceSigning: 'p256Ecdsa' | string
  certificateDirectory: string
  certificatePemPath: string
  privateKeyPemPath: string
  sampleSpkiFingerprint: string
  sampleCertificatePemBytes: number
  privateKeyGenerated: boolean
  privateKeyExposed: boolean
}

export type MobileHudSnapshotEnvelope = {
  protocolVersion: number
  messageId: string
  seq: number
  kind: 'snapshot' | string
  sentAt: string
  snapshotVersion?: number
  payload: unknown
}

export type MobileHudServicePhase = 'disabled' | 'starting' | 'listening' | 'pairing' | 'connected' | 'failed' | 'stopping'

export type MobileHudServiceStatus = {
  phase: MobileHudServicePhase | string
  enabled: boolean
  host: string
  port: number
  baseUrl?: string | null
  wsUrl?: string | null
  transport: string
  serverFingerprint?: string | null
  certificatePemPath?: string | null
  lastError?: string | null
  connectedClients: number
  privacyNote: string
}

export type MobileHudPairingOffer = {
  pairingId: string
  host: string
  port: number
  expiresAt: string
  ttlSeconds: number
  deeplink: string
  qrPayload: string
  tokenHint: string
  fingerprintHint: string
  requirePcConfirmation: boolean
  privacyNote: string
}

export type MobileHudDeviceRecord = {
  deviceId: string
  deviceLabel: string
  publicKeyHash: string
  approved: boolean
  revoked: boolean
  registeredAt: string
  lastSeenAt?: string | null
}

export type MobileHudDeviceRegistry = {
  version: number
  pendingPairings: unknown[]
  devices: MobileHudDeviceRecord[]
}

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const loadMobileHudSnapshot = async (): Promise<MobileHudSnapshotEnvelope | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudSnapshotEnvelope>('get_mobile_hud_snapshot')
  } catch (error) {
    console.warn('Failed to load Mobile HUD snapshot', error)
    return null
  }
}

export const loadMobileHudSecurityPreview = async (): Promise<MobileHudSecurityPreview | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudSecurityPreview>('get_mobile_hud_security_preview')
  } catch (error) {
    console.warn('Failed to load Mobile HUD security preview', error)
    return null
  }
}

export const loadMobileHudServiceStatus = async (): Promise<MobileHudServiceStatus | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudServiceStatus>('get_mobile_hud_service_status')
  } catch (error) {
    console.warn('Failed to load Mobile HUD service status', error)
    return null
  }
}

export const startMobileHudService = async (): Promise<MobileHudServiceStatus | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudServiceStatus>('start_mobile_hud_service')
  } catch (error) {
    console.warn('Failed to start Mobile HUD service', error)
    return null
  }
}

export const stopMobileHudService = async (): Promise<MobileHudServiceStatus | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudServiceStatus>('stop_mobile_hud_service')
  } catch (error) {
    console.warn('Failed to stop Mobile HUD service', error)
    return null
  }
}

export const restartMobileHudService = async (): Promise<MobileHudServiceStatus | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudServiceStatus>('restart_mobile_hud_service')
  } catch (error) {
    console.warn('Failed to restart Mobile HUD service', error)
    return null
  }
}

export const createMobileHudPairingOffer = async (): Promise<MobileHudPairingOffer | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudPairingOffer>('create_mobile_hud_pairing_offer')
  } catch (error) {
    console.warn('Failed to create Mobile HUD pairing offer', error)
    return null
  }
}

export const loadMobileHudDeviceRegistry = async (): Promise<MobileHudDeviceRegistry | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudDeviceRegistry>('get_mobile_hud_device_registry')
  } catch (error) {
    console.warn('Failed to load Mobile HUD device registry', error)
    return null
  }
}

export const approveMobileHudDevice = async (deviceId: string): Promise<MobileHudDeviceRegistry | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudDeviceRegistry>('approve_mobile_hud_device', { deviceId })
  } catch (error) {
    console.warn('Failed to approve Mobile HUD device', error)
    return null
  }
}

export const revokeMobileHudDevice = async (deviceId: string): Promise<MobileHudDeviceRegistry | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudDeviceRegistry>('revoke_mobile_hud_device', { deviceId })
  } catch (error) {
    console.warn('Failed to revoke Mobile HUD device', error)
    return null
  }
}

export const deleteMobileHudDevice = async (deviceId: string): Promise<MobileHudDeviceRegistry | null> => {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<MobileHudDeviceRegistry>('delete_mobile_hud_device', { deviceId })
  } catch (error) {
    console.warn('Failed to delete Mobile HUD device', error)
    return null
  }
}
