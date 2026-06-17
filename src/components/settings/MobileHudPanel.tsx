import { useEffect, useState } from 'react'
import { approveMobileHudDevice, createMobileHudPairingOffer, loadMobileHudDeviceRegistry, loadMobileHudServiceStatus, restartMobileHudService, revokeMobileHudDevice, startMobileHudService, stopMobileHudService, type MobileHudDeviceRegistry, type MobileHudPairingOffer, type MobileHudServiceStatus } from '../../app/mobileHudBridge'
import type { SettingsState } from '../../app/types'
import type { MobileHudConfig, MobileHudPreset, MobileHudSectionKey, MobileHudSections } from '../../hud/config'
import { DEFAULT_MOBILE_HUD_CONFIG, normalizeMobileHudConfig } from '../../hud/config'
import { DISPLAY_ITEM_REGISTRY, desktopDisplayItemIds } from '../../hud/displayItemRegistry'
import type { HudDisplayItemId } from '../../hud/types'

type MobileHudPanelProps = {
  config: MobileHudConfig
  language: 'en' | 'zh-CN'
  onPatchSettings: (settings: Partial<SettingsState>) => void
}

const mobilePresets: MobileHudPreset[] = ['mobile-default', 'minimal', 'custom']
const mobileDensities: MobileHudConfig['density'][] = ['compact', 'comfortable']
const sectionKeys: MobileHudSectionKey[] = ['capsule', 'live', 'sessions', 'attention', 'diagnostics']
const configurableMobileItems: HudDisplayItemId[] = ['activity', 'project', 'model', 'tools', 'contextValue', 'sessionTokens', 'usage', 'cost', 'git', 'addedDirs', 'agents', 'todos', 'speed', 'effortLevel']

export function MobileHudPanel({ config, language, onPatchSettings }: MobileHudPanelProps) {
  const normalizedConfig = normalizeMobileHudConfig(config)
  const copy = language === 'zh-CN'
    ? {
        title: 'Mobile HUD',
        hint: 'Android 手机 HUD 一期配置地基：先保存 Wi-Fi 局域网、WSS pinning、通知低敏和只读展示策略；真实配对服务会在后续 Phase 1A 接入。',
        enabled: '启用 Mobile HUD',
        preset: '预设',
        density: '密度',
        connection: '连接与配对',
        security: '安全策略',
        notifications: '手机通知',
        visibleItems: '手机可见信息项',
        sections: '手机页面区域',
        readOnly: '一期只读：不允许 allow / deny / answer / terminal jump',
        reset: '恢复 Mobile HUD 默认配置',
        schema: '配置版本',
        registered: '可映射信息项',
        port: '默认端口',
        autoStart: '随应用自动启动服务',
        requireConfirm: 'PC 端确认新设备',
        pairingTtl: '配对 Token 有效期',
        transport: '传输加密',
        deviceSigning: '设备签名',
        reconnect: '重连策略',
        lowPrivacy: '通知低敏：不显示项目路径、命令、prompt、tool input/result',
        presets: { 'mobile-default': '一期默认', minimal: '最小展示', custom: '自定义' },
        densities: { compact: '紧凑', comfortable: '舒展' },
        transports: { wssSpkiPinning: 'WSS + SPKI pinning', noiseAead: 'Noise/ECDH/AEAD 备选' },
        signing: { p256Ecdsa: 'P-256 ECDSA', applicationKey: '应用层密钥' },
        reconnectPolicies: { foregroundOnly: '仅前台重连', backgroundWhenAllowed: '允许时后台重连' },
        sectionLabels: { capsule: '顶部 Capsule', live: 'Live HUD', sessions: 'Sessions', attention: 'Attention', diagnostics: 'Diagnostics' },
        notificationLabels: { enabled: '启用通知', attention: '等待处理', completion: '任务完成', errors: '错误', connection: '连接变化' },
        service: 'PC Mobile HUD 服务',
        serviceHint: 'Phase 1A 本机 WSS 服务控制：先用于自动化 health/snapshot/WebSocket 验证，配对与设备注册随后接入。',
        refresh: '刷新状态',
        start: '启动服务',
        stop: '停止服务',
        restart: '重启服务',
        phase: '状态',
        endpoint: '端点',
        fingerprint: 'SPKI 指纹',
        clients: '连接数',
        unavailable: '浏览器预览中不可用',
        hidden: '未生成',
        pairing: '配对与设备',
        pairingHint: '生成一次性配对载荷；界面只显示脱敏提示，不直接打印完整 token 或 fingerprint。',
        createPairing: '生成配对链接',
        copyPairing: '复制完整配对链接到手机',
        copiedPairing: '已复制，请在手机 APP 的“粘贴配对链接”中粘贴',
        pairingSteps: '步骤：1. 先点“启动服务”；2. 点“生成配对链接”；3. 点“复制完整配对链接到手机”；4. 打开手机 APP 粘贴并提交；5. 这里批准新设备。',
        noPairingYet: '还没有配对链接。请先启动服务并生成配对链接。',
        expires: '过期时间',
        tokenHint: 'Token 提示',
        fingerprintHint: '指纹提示',
        pending: '待配对',
        devices: '已注册设备',
        noDevices: '暂无设备',
        approve: '批准',
        revoke: '撤销',
      }
    : {
        title: 'Mobile HUD',
        hint: 'Android Mobile HUD Phase 1 foundation: stores Wi-Fi LAN, WSS pinning, low-sensitive notifications, and read-only display policy before the real pairing service lands in Phase 1A.',
        enabled: 'Enable Mobile HUD',
        preset: 'Preset',
        density: 'Density',
        connection: 'Connection and pairing',
        security: 'Security policy',
        notifications: 'Phone notifications',
        visibleItems: 'Mobile visible items',
        sections: 'Mobile sections',
        readOnly: 'Phase 1 is read-only: no allow / deny / answer / terminal jump',
        reset: 'Reset Mobile HUD defaults',
        schema: 'Config version',
        registered: 'Mappable items',
        port: 'Default port',
        autoStart: 'Auto-start service with app',
        requireConfirm: 'Require PC confirmation for new devices',
        pairingTtl: 'Pairing token TTL',
        transport: 'Transport encryption',
        deviceSigning: 'Device signing',
        reconnect: 'Reconnect policy',
        lowPrivacy: 'Low-sensitive notifications: no project paths, commands, prompts, tool input/results',
        presets: { 'mobile-default': 'Phase 1 default', minimal: 'Minimal', custom: 'Custom' },
        densities: { compact: 'Compact', comfortable: 'Comfortable' },
        transports: { wssSpkiPinning: 'WSS + SPKI pinning', noiseAead: 'Noise/ECDH/AEAD fallback' },
        signing: { p256Ecdsa: 'P-256 ECDSA', applicationKey: 'Application key' },
        reconnectPolicies: { foregroundOnly: 'Foreground only', backgroundWhenAllowed: 'Background when allowed' },
        sectionLabels: { capsule: 'Capsule', live: 'Live HUD', sessions: 'Sessions', attention: 'Attention', diagnostics: 'Diagnostics' },
        notificationLabels: { enabled: 'Enable notifications', attention: 'Attention waiting', completion: 'Completion', errors: 'Errors', connection: 'Connection changes' },
        service: 'PC Mobile HUD service',
        serviceHint: 'Phase 1A local WSS service controls for automated health/snapshot/WebSocket validation before pairing and device registry land.',
        refresh: 'Refresh status',
        start: 'Start service',
        stop: 'Stop service',
        restart: 'Restart service',
        phase: 'Phase',
        endpoint: 'Endpoint',
        fingerprint: 'SPKI fingerprint',
        clients: 'Clients',
        unavailable: 'Unavailable in browser preview',
        hidden: 'Not generated',
        pairing: 'Pairing and devices',
        pairingHint: 'Creates a one-time pairing payload. The panel only shows sanitized hints and never prints the full token or fingerprint.',
        createPairing: 'Create pairing link',
        copyPairing: 'Copy full pairing link to phone',
        copiedPairing: 'Copied. Paste it into the phone app.',
        pairingSteps: 'Steps: 1. Start service. 2. Create pairing link. 3. Copy full pairing link to phone. 4. Paste and submit in the phone app. 5. Approve the new device here.',
        noPairingYet: 'No pairing link yet. Start the service and create a pairing link first.',
        expires: 'Expires',
        tokenHint: 'Token hint',
        fingerprintHint: 'Fingerprint hint',
        pending: 'Pending pairings',
        devices: 'Registered devices',
        noDevices: 'No devices yet',
        approve: 'Approve',
        revoke: 'Revoke',
      }

  const [serviceStatus, setServiceStatus] = useState<MobileHudServiceStatus | null>(null)
  const [serviceBusy, setServiceBusy] = useState(false)
  const [pairingOffer, setPairingOffer] = useState<MobileHudPairingOffer | null>(null)
  const [pairingCopied, setPairingCopied] = useState(false)
  const [deviceRegistry, setDeviceRegistry] = useState<MobileHudDeviceRegistry | null>(null)

  const refreshDeviceRegistry = async (): Promise<void> => {
    const registry = await loadMobileHudDeviceRegistry()
    setDeviceRegistry(registry)
  }

  const refreshServiceStatus = async (): Promise<void> => {
    const status = await loadMobileHudServiceStatus()
    setServiceStatus(status)
    await refreshDeviceRegistry()
  }

  const runServiceAction = async (action: () => Promise<MobileHudServiceStatus | null>): Promise<void> => {
    setServiceBusy(true)
    const status = await action()
    if (status) setServiceStatus(status)
    setServiceBusy(false)
  }

  const createPairingOffer = async (): Promise<void> => {
    setServiceBusy(true)
    const offer = await createMobileHudPairingOffer()
    if (offer) {
      setPairingOffer(offer)
      setPairingCopied(false)
      await refreshServiceStatus()
    }
    setServiceBusy(false)
  }

  const copyPairingLink = async (): Promise<void> => {
    if (!pairingOffer?.deeplink) return
    try {
      await navigator.clipboard.writeText(pairingOffer.deeplink)
      setPairingCopied(true)
    } catch (error) {
      console.warn('Failed to copy Mobile HUD pairing link', error)
    }
  }

  const runDeviceAction = async (action: () => Promise<MobileHudDeviceRegistry | null>): Promise<void> => {
    setServiceBusy(true)
    const registry = await action()
    if (registry) setDeviceRegistry(registry)
    setServiceBusy(false)
  }

  useEffect(() => {
    void refreshServiceStatus()
  }, [])

  const phaseLabel = serviceStatus?.phase ?? copy.unavailable
  const endpointLabel = serviceStatus?.wsUrl ?? serviceStatus?.baseUrl ?? copy.hidden
  const fingerprintLabel = serviceStatus?.serverFingerprint ?? copy.hidden

  const patchMobileHud = (patch: Partial<MobileHudConfig>): void => {
    onPatchSettings({
      mobileHud: normalizeMobileHudConfig({
        ...normalizedConfig,
        ...patch,
        connection: { ...normalizedConfig.connection, ...patch.connection },
        security: { ...normalizedConfig.security, ...patch.security },
        notifications: { ...normalizedConfig.notifications, ...patch.notifications },
        visibleItems: { ...normalizedConfig.visibleItems, ...patch.visibleItems },
        sections: { ...normalizedConfig.sections, ...patch.sections },
      }),
    })
  }

  const toggleItem = (item: HudDisplayItemId, enabled: boolean): void => {
    patchMobileHud({ visibleItems: { [item]: enabled } })
  }

  const toggleSectionItem = (section: MobileHudSectionKey, item: HudDisplayItemId, enabled: boolean): void => {
    const current = normalizedConfig.sections[section]
    const next = enabled
      ? Array.from(new Set([...current, item]))
      : current.filter((value) => value !== item)
    patchMobileHud({ sections: { ...normalizedConfig.sections, [section]: next } as MobileHudSections })
  }

  return (
    <div className="settings-tab-panel" role="tabpanel">
      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.title}</h3>
          <p>{copy.hint}</p>
        </div>
        <label className="setting-check setting-check--inline">
          <input type="checkbox" checked={normalizedConfig.enabled} onChange={(event) => patchMobileHud({ enabled: event.currentTarget.checked })} />
          <span>{copy.enabled}</span>
        </label>
        <p className="settings-note">{copy.readOnly}</p>
        <div className="setting-group">
          <span className="setting-row__label">{copy.preset}</span>
          <div className="option-group option-group--wide">
            {mobilePresets.map((preset) => (
              <button key={preset} className={normalizedConfig.preset === preset ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchMobileHud({ preset })}>{copy.presets[preset]}</button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.density}</span>
          <div className="option-group option-group--wide">
            {mobileDensities.map((density) => (
              <button key={density} className={normalizedConfig.density === density ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchMobileHud({ density })}>{copy.densities[density]}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.service}</h3>
          <p>{copy.serviceHint}</p>
        </div>
        <div className="diagnostics-grid diagnostics-grid--compact">
          <span>{copy.phase}</span><strong>{phaseLabel}</strong>
          <span>{copy.endpoint}</span><strong>{endpointLabel}</strong>
          <span>{copy.fingerprint}</span><strong>{fingerprintLabel}</strong>
          <span>{copy.clients}</span><strong>{serviceStatus?.connectedClients ?? 0}</strong>
        </div>
        {serviceStatus?.lastError ? <p className="settings-note settings-note--warning">{serviceStatus.lastError}</p> : null}
        <div className="settings-actions">
          <button className="secondary-button" disabled={serviceBusy} onClick={() => void refreshServiceStatus()}>{copy.refresh}</button>
          <button className="secondary-button" disabled={serviceBusy} onClick={() => void runServiceAction(startMobileHudService)}>{copy.start}</button>
          <button className="secondary-button" disabled={serviceBusy} onClick={() => void runServiceAction(stopMobileHudService)}>{copy.stop}</button>
          <button className="secondary-button" disabled={serviceBusy} onClick={() => void runServiceAction(restartMobileHudService)}>{copy.restart}</button>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.pairing}</h3>
          <p>{copy.pairingHint}</p>
          <p>{copy.pairingSteps}</p>
        </div>
        <div className="settings-actions">
          <button className="secondary-button" disabled={serviceBusy} onClick={() => void createPairingOffer()}>{copy.createPairing}</button>
          <button className="secondary-button" disabled={serviceBusy || !pairingOffer?.deeplink} onClick={() => void copyPairingLink()}>{copy.copyPairing}</button>
        </div>
        {pairingOffer?.deeplink ? (
          <p className="settings-note">{pairingCopied ? copy.copiedPairing : `${pairingOffer.host}:${pairingOffer.port} · ${pairingOffer.tokenHint} · ${pairingOffer.fingerprintHint}`}</p>
        ) : <p className="settings-note">{copy.noPairingYet}</p>}
        <div className="diagnostics-grid diagnostics-grid--compact">
          <span>{copy.pending}</span><strong>{deviceRegistry?.pendingPairings.length ?? 0}</strong>
          <span>{copy.devices}</span><strong>{deviceRegistry?.devices.length ?? 0}</strong>
          <span>{copy.expires}</span><strong>{pairingOffer?.expiresAt ?? copy.hidden}</strong>
          <span>{copy.tokenHint}</span><strong>{pairingOffer?.tokenHint ?? copy.hidden}</strong>
          <span>{copy.fingerprintHint}</span><strong>{pairingOffer?.fingerprintHint ?? copy.hidden}</strong>
        </div>
        {deviceRegistry?.devices.length ? (
          <div className="settings-check-grid settings-check-grid--compact">
            {deviceRegistry.devices.map((device) => (
              <div className="settings-note" key={device.deviceId}>
                <span>{device.deviceLabel} · {device.revoked ? 'revoked' : device.approved ? 'approved' : 'pending'}</span>
                <div className="settings-actions">
                  <button className="secondary-button" disabled={serviceBusy || device.revoked || device.approved} onClick={() => void runDeviceAction(() => approveMobileHudDevice(device.deviceId))}>{copy.approve}</button>
                  <button className="secondary-button" disabled={serviceBusy || device.revoked} onClick={() => void runDeviceAction(() => revokeMobileHudDevice(device.deviceId))}>{copy.revoke}</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="settings-note">{copy.noDevices}</p>}
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.connection}</h3>
        </div>
        <div className="setting-slider">
          <div className="setting-slider__head"><span>{copy.port}</span><strong>{normalizedConfig.connection.port}</strong></div>
          <input type="range" min="20000" max="40000" step="1" value={normalizedConfig.connection.port} onChange={(event) => patchMobileHud({ connection: { ...normalizedConfig.connection, port: Number(event.currentTarget.value) } })} />
        </div>
        <div className="settings-check-grid settings-check-grid--compact">
          <label className="setting-check"><input type="checkbox" checked={normalizedConfig.connection.autoStart} onChange={(event) => patchMobileHud({ connection: { ...normalizedConfig.connection, autoStart: event.currentTarget.checked } })} /><span>{copy.autoStart}</span></label>
          <label className="setting-check"><input type="checkbox" checked={normalizedConfig.connection.requirePcConfirmation} onChange={(event) => patchMobileHud({ connection: { ...normalizedConfig.connection, requirePcConfirmation: event.currentTarget.checked } })} /><span>{copy.requireConfirm}</span></label>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.security}</h3>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.transport}</span>
          <div className="option-group option-group--wide">
            {(['wssSpkiPinning', 'noiseAead'] as MobileHudConfig['security']['transport'][]).map((transport) => (
              <button key={transport} className={normalizedConfig.security.transport === transport ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchMobileHud({ security: { ...normalizedConfig.security, transport } })}>{copy.transports[transport]}</button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.deviceSigning}</span>
          <div className="option-group option-group--wide">
            {(['p256Ecdsa', 'applicationKey'] as MobileHudConfig['security']['deviceSigning'][]).map((deviceSigning) => (
              <button key={deviceSigning} className={normalizedConfig.security.deviceSigning === deviceSigning ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchMobileHud({ security: { ...normalizedConfig.security, deviceSigning } })}>{copy.signing[deviceSigning]}</button>
            ))}
          </div>
        </div>
        <div className="setting-slider">
          <div className="setting-slider__head"><span>{copy.pairingTtl}</span><strong>{normalizedConfig.security.pairingTokenTtlSeconds}s</strong></div>
          <input type="range" min="15" max="300" step="15" value={normalizedConfig.security.pairingTokenTtlSeconds} onChange={(event) => patchMobileHud({ security: { ...normalizedConfig.security, pairingTokenTtlSeconds: Number(event.currentTarget.value) } })} />
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.reconnect}</span>
          <div className="option-group option-group--wide">
            {(['foregroundOnly', 'backgroundWhenAllowed'] as MobileHudConfig['security']['reconnectPolicy'][]).map((reconnectPolicy) => (
              <button key={reconnectPolicy} className={normalizedConfig.security.reconnectPolicy === reconnectPolicy ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchMobileHud({ security: { ...normalizedConfig.security, reconnectPolicy } })}>{copy.reconnectPolicies[reconnectPolicy]}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.notifications}</h3>
          <p>{copy.lowPrivacy}</p>
        </div>
        <div className="settings-check-grid settings-check-grid--compact">
          {(['enabled', 'attention', 'completion', 'errors', 'connection'] as const).map((key) => (
            <label className="setting-check" key={key}>
              <input type="checkbox" checked={normalizedConfig.notifications[key]} onChange={(event) => patchMobileHud({ notifications: { ...normalizedConfig.notifications, [key]: event.currentTarget.checked } })} />
              <span>{copy.notificationLabels[key]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.visibleItems}</h3>
        </div>
        <div className="settings-check-grid settings-check-grid--compact">
          {configurableMobileItems.map((item) => (
            <label className="setting-check" key={item}>
              <input type="checkbox" checked={normalizedConfig.visibleItems[item] === true} onChange={(event) => toggleItem(item, event.currentTarget.checked)} />
              <span>{DISPLAY_ITEM_REGISTRY[item]?.label ?? item}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.sections}</h3>
        </div>
        <div className="desktop-zone-grid">
          {sectionKeys.map((section) => (
            <div className="desktop-zone-card" key={section}>
              <strong>{copy.sectionLabels[section]}</strong>
              <div className="desktop-zone-card__items">
                {configurableMobileItems.map((item) => (
                  <label className="setting-check" key={`${section}-${item}`}>
                    <input type="checkbox" checked={normalizedConfig.sections[section].includes(item)} onChange={(event) => toggleSectionItem(section, item, event.currentTarget.checked)} />
                    <span>{DISPLAY_ITEM_REGISTRY[item]?.label ?? item}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="diagnostics-grid diagnostics-grid--compact">
          <span>{copy.schema}</span><strong>v{normalizedConfig.version}</strong>
          <span>{copy.registered}</span><strong>{desktopDisplayItemIds().length}</strong>
        </div>
        <button className="secondary-button" onClick={() => patchMobileHud(DEFAULT_MOBILE_HUD_CONFIG)}>{copy.reset}</button>
      </section>
    </div>
  )
}
