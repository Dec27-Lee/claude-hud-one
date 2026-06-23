export {
  MOBILE_HUD_DENIED_JSON_KEYS,
  MOBILE_HUD_DENIED_TEXT_MARKERS,
  MOBILE_HUD_PROTOCOL,
  type MobileHudProtocolVersion,
} from './mobileHud.generated'

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
  publicKeyDerB64?: string | null
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
