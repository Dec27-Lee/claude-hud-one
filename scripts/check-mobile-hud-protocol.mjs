import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const protocolPath = join(root, 'schemas', 'mobile-hud', 'protocol.json')
const fixtureDir = join(root, 'schemas', 'mobile-hud', 'fixtures')
const privacyPath = join(root, 'schemas', 'hud-core', 'privacy-denylist.json')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const protocol = readJson(protocolPath)
const privacy = readJson(privacyPath)

const failures = []
const fail = (message) => failures.push(message)

const assertObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`)
    return false
  }
  return true
}

const assertString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`)
}

const assertNumber = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be a finite number`)
}

const assertBoolean = (value, label) => {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`)
}

const inspectDeniedKeys = (value, deniedKeys, label, path = label) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectDeniedKeys(item, deniedKeys, label, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  Object.entries(value).forEach(([key, child]) => {
    if (deniedKeys.includes(key)) fail(`${label} contains denied key ${path}.${key}`)
    inspectDeniedKeys(child, deniedKeys, label, `${path}.${key}`)
  })
}

const validateFixture = (fileName) => {
  const fixture = readJson(join(fixtureDir, fileName))
  const label = `schemas/mobile-hud/fixtures/${fileName}`
  if (!assertObject(fixture, label)) return
  assertString(fixture.name, `${label}.name`)
  assertString(fixture.description, `${label}.description`)
  if (!assertObject(fixture.envelope, `${label}.envelope`)) return
  if (!assertObject(fixture.envelope.payload, `${label}.envelope.payload`)) return

  const { envelope } = fixture
  const payload = envelope.payload

  if (envelope.protocolVersion !== protocol.protocolVersion) {
    fail(`${label}.envelope.protocolVersion must be ${protocol.protocolVersion}`)
  }
  if (payload.protocolVersion !== protocol.protocolVersion) {
    fail(`${label}.payload.protocolVersion must be ${protocol.protocolVersion}`)
  }
  assertString(envelope.messageId, `${label}.envelope.messageId`)
  assertNumber(envelope.seq, `${label}.envelope.seq`)
  assertString(envelope.kind, `${label}.envelope.kind`)
  assertString(envelope.sentAt, `${label}.envelope.sentAt`)
  assertNumber(payload.snapshotVersion, `${label}.payload.snapshotVersion`)
  assertString(payload.snapshotId, `${label}.payload.snapshotId`)
  assertString(payload.generatedAt, `${label}.payload.generatedAt`)

  if (payload.privacyLevel !== protocol.privacy.trustedViewPrivacyLevel) {
    fail(`${label}.payload.privacyLevel must be ${protocol.privacy.trustedViewPrivacyLevel}`)
  }

  const policy = payload.displayPolicy
  if (!assertObject(policy, `${label}.payload.displayPolicy`)) return
  assertBoolean(policy.terminalJump, `${label}.payload.displayPolicy.terminalJump`)
  assertBoolean(policy.approvalActions, `${label}.payload.displayPolicy.approvalActions`)
  assertBoolean(policy.questionActions, `${label}.payload.displayPolicy.questionActions`)
  if (policy.terminalJump !== protocol.displayPolicy.terminalJump) fail(`${label} must keep terminalJump disabled for mobile v1`)
  if (policy.approvalActions !== protocol.displayPolicy.approvalActions) fail(`${label} must keep approvalActions disabled for mobile v1`)
  if (policy.questionActions !== protocol.displayPolicy.questionActions) fail(`${label} must keep questionActions disabled for mobile v1`)

  ;(payload.notificationEvents ?? []).forEach((event, index) => {
    if (event.sensitivity !== protocol.privacy.notificationSensitivity) {
      fail(`${label}.payload.notificationEvents[${index}].sensitivity must be ${protocol.privacy.notificationSensitivity}`)
    }
  })

  inspectDeniedKeys(fixture, privacy.deniedJsonKeys ?? [], label)
  const serialized = JSON.stringify(fixture)
  ;(privacy.deniedTextMarkers ?? []).forEach((marker) => {
    if (serialized.toLowerCase().includes(String(marker).toLowerCase())) {
      fail(`${label} contains denied text marker ${marker}`)
    }
  })
}

if (protocol.name !== 'mobile-hud') fail('protocol.name must be mobile-hud')
if (protocol.protocolVersion !== 1) fail('protocol.protocolVersion must be 1')
if (protocol.privacy?.notificationSensitivity !== 'low') fail('protocol notification sensitivity must be low')
if (protocol.privacy?.trustedViewPrivacyLevel !== 'trustedAppView') fail('protocol trusted view privacy level must be trustedAppView')
if (protocol.displayPolicy?.terminalJump !== false) fail('protocol terminalJump must be false')
if (protocol.displayPolicy?.approvalActions !== false) fail('protocol approvalActions must be false')
if (protocol.displayPolicy?.questionActions !== false) fail('protocol questionActions must be false')

const fixtures = readdirSync(fixtureDir).filter((name) => name.endsWith('.json')).sort()
if (!fixtures.length) fail('schemas/mobile-hud/fixtures must contain JSON fixtures')
fixtures.forEach(validateFixture)

if (failures.length) {
  console.error('Mobile HUD protocol validation failed:')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log(`Mobile HUD protocol validation passed (${fixtures.length} fixtures).`)
