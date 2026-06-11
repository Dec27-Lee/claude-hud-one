import { useEffect, useState } from 'react'
import { checkForUpdates, enableClaudeStatusLineBridge, ensureClaudeGlobalBridge, getClaudeGlobalBridgeStatus, getDiagnosticsSummary, getUpdateState, openAppDataDir, openReleasePage, removeClaudeGlobalBridgeHooks, restoreClaudeStatusLine, type ClaudeGlobalBridgeStatus, type DiagnosticsSummary, type DisplayInfo, type UpdateState } from '../../app/overlayBridge'
import type { AppLanguage, ChartStyle, CostStyle, IslandAppState, ProviderId, SettingsState, TokenCountMode } from '../../app/types'
import { displayedProviderOrder } from '../../app/types'
import { normalizeHudState } from '../../hud/normalize'
import { DesktopHudPanel } from './DesktopHudPanel'
import { TerminalHudPanel } from './TerminalHudPanel'

type SettingsViewProps = {
  state: IslandAppState
  displays: DisplayInfo[]
  onClose: () => void
  onOpenDiagnostics: () => void
  onPatchSettings: (settings: Partial<SettingsState>) => void
  onToggleProvider: (provider: ProviderId, visible: boolean) => void
  onSetChartStyle: (style: ChartStyle) => void
  onSetCostStyle: (style: CostStyle) => void
  onSetTokenCountMode: (mode: TokenCountMode) => void
  onRefreshNow: () => void
  isRefreshing: boolean
}

type UILanguage = 'en' | 'zh-CN'
type SettingsTab = 'general' | 'appearance' | 'placement' | 'terminal' | 'desktop' | 'claude' | 'updates' | 'about'

const chartStyles: ChartStyle[] = ['ring', 'bar', 'stepped', 'numeric', 'sparkline']
const costStyles: CostStyle[] = ['usd', 'value', 'tokens', 'trend']
const widthModes: SettingsState['islandWidthMode'][] = ['compact', 'notch', 'custom']
const tokenModes: TokenCountMode[] = ['all', 'billable']

const settingsMessages = {
  en: {
    kicker: 'Settings',
    title: 'Claude HUD One',
    subtitle: 'Tune the island, connect Claude Code safely, and keep diagnostics local.',
    close: 'Close settings',
    tabs: {
      general: 'General',
      appearance: 'Appearance',
      placement: 'Placement',
      terminal: 'Terminal HUD',
      desktop: 'Desktop HUD',
      claude: 'Claude',
      updates: 'Updates',
      about: 'About',
    },
    preferences: 'General',
    preferencesHint: 'Choose language, startup behavior, refresh cadence, and window behavior.',
    language: 'Interface language',
    languageHint: 'Preview immediately; saved settings keep it for next launch.',
    languageOptions: { auto: 'System', en: 'English', 'zh-CN': '简体中文' },
    launchAtLogin: 'Launch at login',
    alwaysShowUsage: 'Always show usage',
    lowPowerMode: 'Low power mode',
    fullscreenAvoidance: 'Hide on fullscreen apps',
    refreshInterval: 'Refresh interval',
    appearance: 'Appearance',
    appearanceHint: 'Control island width, usage chart, and cost display style.',
    islandWidth: 'Island width',
    chartStyle: 'Usage chart',
    costStyle: 'Cost display',
    widthModes: { compact: 'Compact', notch: 'Notch', custom: 'Custom' },
    chartStyles: { ring: 'Ring', bar: 'Bar', stepped: 'Stepped', numeric: 'Numeric', sparkline: 'Sparkline' },
    costStyles: { usd: 'USD', value: 'Value', tokens: 'Tokens', trend: 'Trend' },
    placement: 'Placement',
    placementHint: 'Pick a display, top offset, or reset a manually dragged position.',
    targetDisplay: 'Target display',
    auto: 'Auto',
    primaryDisplay: 'Primary display',
    primary: 'primary',
    topOffset: 'Top offset',
    dragPosition: 'Drag position',
    displayDefault: 'Display default',
    dragTip: 'Long-press the island capsule, then drag to move it. The dropped position is saved automatically.',
    resetPosition: 'Reset to target display',
    alertsProviders: 'Alerts & providers',
    alertsProvidersHint: 'Choose alert thresholds and visible local providers.',
    enableUsageAlerts: 'Enable usage alerts',
    warningThreshold: 'Warning threshold',
    criticalThreshold: 'Critical threshold',
    tokenMode: 'Token mode',
    tokenModes: { all: 'All tokens', billable: 'Billable only' },
    noPlan: 'No plan',
    claudeCompatibility: 'Claude Code Bridge',
    claudeCompatibilityHint: 'Claude HUD One owns Claude Code statusLine and hooks so the built-in Terminal HUD and Desktop HUD share one bridge.',
    mode: 'Ownership mode',
    installed: 'Installed',
    settings: 'Settings',
    bridgeScript: 'Bridge script',
    statusLineOwner: 'StatusLine owner',
    enhancedCapture: 'StatusLine owner',
    currentStatusLine: 'Current statusLine',
    hooks: 'Hooks',
    upstreamSaved: 'Diagnostic upstream backup',
    upstreamCommand: 'Backup command',
    lastBackup: 'Last backup',
    loadingCompatibility: 'Claude settings compatibility status is loading.',
    checkSettings: 'Check settings',
    installHooksOnly: 'Install / repair bridge owner',
    enableEnhanced: 'Repair statusLine owner',
    restoreStatusLine: 'Remove Claude HUD One statusLine',
    removeHooks: 'Remove Claude HUD One hooks',
    updates: 'Updates',
    updatesHint: 'Manual update metadata for the current local build.',
    version: 'Version',
    channel: 'Channel',
    status: 'Status',
    configured: 'Configured',
    canCheck: 'Can check',
    lastCheck: 'Last check',
    endpoint: 'Endpoint',
    manualUpdate: 'Manual update',
    releasePage: 'Release page',
    errorCode: 'Error code',
    loadingUpdater: 'Updater status is loading.',
    checkUpdates: 'Check for updates',
    openReleasePage: 'Open release page',
    diagnostics: 'About / Diagnostics',
    diagnosticsHint: 'Local-first, no telemetry by default. Diagnostics show counts and paths only; prompts, transcripts, tool results, and credentials are never displayed.',
    sessionSource: 'Session source',
    project: 'Project',
    events: 'Events',
    tools: 'Tools',
    lastActivity: 'Last activity',
    appData: 'App data',
    settingsFile: 'Settings file',
    usageCache: 'Usage cache',
    claudeProjects: 'Claude projects',
    loadingDiagnostics: 'Diagnostics summary is loading.',
    refreshNow: 'Refresh now',
    refreshing: 'Refreshing…',
    openClaudeLogs: 'Open Claude logs',
    openAppData: 'Open app data',
    yes: 'yes',
    no: 'no',
    none: 'none',
    never: 'never',
    notLoaded: 'not loaded',
    notConfigured: 'not configured',
    noneThisRun: 'none this run',
    available: 'available',
    notAvailable: 'not available',
    owner: {
      claudeHudOne: 'Claude HUD One Terminal HUD',
      claudeHudPlus: 'Claude HUD Plus',
      claudeHud: 'Claude HUD',
      custom: 'Custom statusLine',
      none: 'none',
      notLoaded: 'not loaded',
    },
    modes: {
      owner: 'Claude HUD One owner',
      hooksOnly: 'hooks-only fallback',
      multiplexer: 'legacy multiplexer',
      statuslineOnly: 'statusLine owner only',
      notInstalled: 'not installed',
      notLoaded: 'not loaded',
    },
  },
  'zh-CN': {
    kicker: '设置',
    title: 'Claude HUD One',
    subtitle: '调整动态岛外观、安全接入 Claude Code，并保持诊断本地优先。',
    close: '关闭设置',
    tabs: {
      general: '通用',
      appearance: '外观',
      placement: '位置',
      terminal: '终端 HUD',
      desktop: '桌面 HUD',
      claude: 'Claude',
      updates: '更新',
      about: '关于',
    },
    preferences: '通用设置',
    preferencesHint: '设置语言、开机启动、刷新频率和窗口行为。',
    language: '界面语言',
    languageHint: '切换后立即预览界面语言，保存后下次继续生效。',
    languageOptions: { auto: '跟随系统', en: 'English', 'zh-CN': '简体中文' },
    launchAtLogin: '开机自动启动',
    alwaysShowUsage: '始终显示用量',
    lowPowerMode: '低功耗模式',
    fullscreenAvoidance: '全屏应用时隐藏',
    refreshInterval: '刷新频率',
    appearance: '外观',
    appearanceHint: '调整动态岛宽度、用量图表和成本展示方式。',
    islandWidth: '动态岛宽度',
    chartStyle: '用量图表',
    costStyle: '成本展示',
    widthModes: { compact: '紧凑', notch: '灵动岛', custom: '自定义' },
    chartStyles: { ring: '环形', bar: '柱状', stepped: '阶梯', numeric: '数字', sparkline: '趋势线' },
    costStyles: { usd: '美元', value: '金额', tokens: 'Token', trend: '趋势' },
    placement: '位置',
    placementHint: '选择显示器、顶部偏移，或重置手动拖拽后的位置。',
    targetDisplay: '目标显示器',
    auto: '自动',
    primaryDisplay: '主显示器',
    primary: '主屏',
    topOffset: '顶部偏移',
    dragPosition: '拖拽位置',
    displayDefault: '使用显示器默认位置',
    dragTip: '长按动态岛胶囊后拖动即可移动，松手后会自动保存位置。',
    resetPosition: '重置为显示器默认位置',
    alertsProviders: '提醒与数据源',
    alertsProvidersHint: '设置用量提醒阈值，并选择可见的本地 provider。',
    enableUsageAlerts: '启用用量提醒',
    warningThreshold: '警告阈值',
    criticalThreshold: '严重阈值',
    tokenMode: 'Token 口径',
    tokenModes: { all: '全部 Token', billable: '仅计费 Token' },
    noPlan: '无套餐',
    claudeCompatibility: 'Claude Code Bridge',
    claudeCompatibilityHint: 'Claude HUD One 作为 Claude Code statusLine 与 hooks owner，内置 Terminal HUD 和桌面 HUD 共用同一个 bridge。',
    mode: '接管模式',
    installed: '已安装',
    settings: 'Settings 文件',
    bridgeScript: 'Bridge 脚本',
    statusLineOwner: 'StatusLine 归属',
    enhancedCapture: 'StatusLine owner',
    currentStatusLine: '当前 statusLine',
    hooks: 'Hooks',
    upstreamSaved: '诊断备份',
    upstreamCommand: '备份命令',
    lastBackup: '最近备份',
    loadingCompatibility: '正在读取 Claude settings 兼容状态。',
    checkSettings: '检查 settings',
    installHooksOnly: '安装 / 修复 Bridge owner',
    enableEnhanced: '修复 statusLine owner',
    restoreStatusLine: '移除 Claude HUD One statusLine',
    removeHooks: '移除 Claude HUD One hooks',
    updates: '更新',
    updatesHint: '当前本地构建的手动更新信息。',
    version: '版本',
    channel: '通道',
    status: '状态',
    configured: '已配置',
    canCheck: '可检查',
    lastCheck: '上次检查',
    endpoint: '端点',
    manualUpdate: '手动更新',
    releasePage: '发布页',
    errorCode: '错误码',
    loadingUpdater: '正在读取更新状态。',
    checkUpdates: '检查更新',
    openReleasePage: '打开发布页',
    diagnostics: '关于 / 诊断',
    diagnosticsHint: '本地优先，默认无遥测。诊断只展示数量和路径，不展示 prompt、transcript、tool result 或凭据。',
    sessionSource: '会话来源',
    project: '项目',
    events: '事件',
    tools: '工具',
    lastActivity: '最近活动',
    appData: 'App data',
    settingsFile: 'Settings 文件',
    usageCache: '用量缓存',
    claudeProjects: 'Claude projects',
    loadingDiagnostics: '正在读取诊断摘要。',
    refreshNow: '立即刷新',
    refreshing: '刷新中…',
    openClaudeLogs: '打开 Claude 日志',
    openAppData: '打开 App data',
    yes: '是',
    no: '否',
    none: '无',
    never: '从未',
    notLoaded: '未加载',
    notConfigured: '未配置',
    noneThisRun: '本次无备份',
    available: '可用',
    notAvailable: '不可用',
    owner: {
      claudeHudOne: 'Claude HUD One Terminal HUD',
      claudeHudPlus: 'Claude HUD Plus',
      claudeHud: 'Claude HUD',
      custom: '自定义 statusLine',
      none: '无',
      notLoaded: '未加载',
    },
    modes: {
      owner: 'Claude HUD One owner',
      hooksOnly: 'hooks-only fallback',
      multiplexer: '旧版 multiplexer',
      statuslineOnly: '仅 statusLine owner',
      notInstalled: '未安装',
      notLoaded: '未加载',
    },
  },
} as const

type SettingsCopy = (typeof settingsMessages)[UILanguage]

const resolveLanguage = (language: AppLanguage): UILanguage => {
  if (language === 'zh-CN' || language === 'en') return language

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh-CN'
  }

  return 'en'
}

const formatExists = (exists: boolean | undefined, copy: SettingsCopy): string => exists ? copy.yes : copy.no
const yesNo = (value: boolean | undefined, copy: SettingsCopy): string => value ? copy.yes : copy.no
const fallbackText = (value: string | null | undefined, fallback: string): string => value && value.trim().length > 0 ? value : fallback

const ownerLabel = (owner: string | undefined, copy: SettingsCopy): string => {
  switch (owner) {
    case 'claude-hud-one': return copy.owner.claudeHudOne
    case 'claude-hud-plus': return copy.owner.claudeHudPlus
    case 'claude-hud': return copy.owner.claudeHud
    case 'custom': return copy.owner.custom
    case 'none': return copy.owner.none
    default: return copy.owner.notLoaded
  }
}
const modeLabel = (mode: string | undefined, copy: SettingsCopy): string => {
  switch (mode) {
    case 'owner': return copy.modes.owner
    case 'hooks-only': return copy.modes.hooksOnly
    case 'multiplexer': return copy.modes.multiplexer
    case 'statusline-only':
    case 'statusline-owner': return copy.modes.statuslineOnly
    case 'not-installed': return copy.modes.notInstalled
    default: return copy.modes.notLoaded
  }
}

const toTargetDisplay = (value: string, displays: DisplayInfo[]): SettingsState['targetDisplay'] => {
  if (value === 'auto' || value === 'primary') return value
  const display = displays.find((item) => item.id === value)
  return { id: value, label: display?.name ?? value }
}

const displayLabel = (display: DisplayInfo, copy: SettingsCopy): string => {
  const suffix = display.isPrimary ? ` · ${copy.primary}` : ''
  return `${display.name}${suffix} · ${display.workArea.width}×${display.workArea.height} @${display.scaleFactor}x`
}

const settingsTabs = (copy: SettingsCopy): Array<{ id: SettingsTab; label: string }> => [
  { id: 'general', label: copy.tabs.general },
  { id: 'appearance', label: copy.tabs.appearance },
  { id: 'placement', label: copy.tabs.placement },
  { id: 'terminal', label: copy.tabs.terminal },
  { id: 'desktop', label: copy.tabs.desktop },
  { id: 'claude', label: copy.tabs.claude },
  { id: 'updates', label: copy.tabs.updates },
  { id: 'about', label: copy.tabs.about },
]

export function SettingsView({ state, displays, onClose, onOpenDiagnostics, onPatchSettings, onToggleProvider, onSetChartStyle, onSetCostStyle, onSetTokenCountMode, onRefreshNow, isRefreshing }: SettingsViewProps) {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null)
  const [globalBridge, setGlobalBridge] = useState<ClaudeGlobalBridgeStatus | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const uiLanguage = resolveLanguage(state.settings.language)
  const copy = settingsMessages[uiLanguage]
  const normalizedHudState = normalizeHudState(state)

  useEffect(() => {
    let cancelled = false
    void getUpdateState().then((nextState) => {
      if (!cancelled) setUpdateState(nextState)
    })
    void getDiagnosticsSummary().then((nextSummary) => {
      if (!cancelled) setDiagnostics(nextSummary)
    })
    void getClaudeGlobalBridgeStatus().then((nextStatus) => {
      if (!cancelled) setGlobalBridge(nextStatus)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleCheckForUpdates = async (): Promise<void> => {
    setUpdateState(await checkForUpdates())
  }

  const handleOpenAppData = async (): Promise<void> => {
    await openAppDataDir()
    setDiagnostics(await getDiagnosticsSummary())
  }

  const handleOpenReleasePage = async (): Promise<void> => {
    await openReleasePage()
  }

  const handleRefreshGlobalBridge = async (): Promise<void> => {
    const nextStatus = await getClaudeGlobalBridgeStatus()
    if (nextStatus) setGlobalBridge(nextStatus)
  }

  const handleInstallGlobalBridge = async (): Promise<void> => {
    const nextStatus = await ensureClaudeGlobalBridge()
    if (nextStatus) setGlobalBridge(nextStatus)
  }

  const handleEnableEnhancedBridge = async (): Promise<void> => {
    const nextStatus = await enableClaudeStatusLineBridge()
    if (nextStatus) setGlobalBridge(nextStatus)
  }

  const handleRestoreStatusLine = async (): Promise<void> => {
    const nextStatus = await restoreClaudeStatusLine()
    if (nextStatus) setGlobalBridge(nextStatus)
  }

  const handleRemoveGlobalHooks = async (): Promise<void> => {
    const nextStatus = await removeClaudeGlobalBridgeHooks()
    if (nextStatus) setGlobalBridge(nextStatus)
  }

  const hookEventCount = globalBridge?.hookEventsInstalled?.length ?? 0
  const targetDisplayValue = typeof state.settings.targetDisplay === 'string' ? state.settings.targetDisplay : state.settings.targetDisplay.id

  return (
    <aside className="settings-window settings-window--tabs">
      <header className="settings-hero settings-hero--tabs">
        <button className="icon-button settings-back" onClick={onClose} aria-label={copy.close}>‹</button>
        <div className="settings-hero__copy">
          <span className="section-kicker">{copy.kicker}</span>
          <h2>{copy.title}</h2>
        </div>
        <button className="icon-button settings-close" onClick={onClose} aria-label={copy.close}>×</button>
      </header>

      <nav className="settings-tab-list" role="tablist" aria-label={copy.kicker}>
        {settingsTabs(copy).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'settings-tab settings-tab--active' : 'settings-tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {activeTab === 'general' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.language}</h3>
                <p>{copy.languageHint}</p>
              </div>
              <div className="option-group option-group--language" role="group" aria-label={copy.language}>
                {(['zh-CN', 'en', 'auto'] as AppLanguage[]).map((language) => (
                  <button key={language} className={state.settings.language === language ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => onPatchSettings({ language })}>{copy.languageOptions[language]}</button>
                ))}
              </div>
            </section>

            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.preferences}</h3>
                <p>{copy.preferencesHint}</p>
              </div>
              <div className="settings-check-grid settings-check-grid--compact">
                <label className="setting-check"><input type="checkbox" checked={state.settings.launchAtLogin} onChange={(event) => onPatchSettings({ launchAtLogin: event.currentTarget.checked })} /> <span>{copy.launchAtLogin}</span></label>
                <label className="setting-check"><input type="checkbox" checked={state.settings.alwaysShowUsage} onChange={(event) => onPatchSettings({ alwaysShowUsage: event.currentTarget.checked })} /> <span>{copy.alwaysShowUsage}</span></label>
                <label className="setting-check"><input type="checkbox" checked={state.settings.lowPowerMode} onChange={(event) => onPatchSettings({ lowPowerMode: event.currentTarget.checked })} /> <span>{copy.lowPowerMode}</span></label>
                <label className="setting-check"><input type="checkbox" checked={state.settings.fullscreenAvoidance} onChange={(event) => onPatchSettings({ fullscreenAvoidance: event.currentTarget.checked })} /> <span>{copy.fullscreenAvoidance}</span></label>
              </div>
            </section>

            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.refreshInterval}</h3>
              </div>
              <div className="option-group">
                {[5, 15, 30].map((minutes) => (
                  <button key={minutes} className={state.settings.refreshIntervalMinutes === minutes ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => onPatchSettings({ refreshIntervalMinutes: minutes as 5 | 15 | 30 })}>{minutes}m</button>
                ))}
              </div>
            </section>

            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.alertsProviders}</h3>
                <p>{copy.alertsProvidersHint}</p>
              </div>
              <label className="setting-check setting-check--inline"><input type="checkbox" checked={state.settings.alertsEnabled} onChange={(event) => onPatchSettings({ alertsEnabled: event.currentTarget.checked })} /> <span>{copy.enableUsageAlerts}</span></label>
              <div className="setting-slider">
                <div className="setting-slider__head"><span>{copy.warningThreshold}</span><strong>{state.settings.warningThreshold}%</strong></div>
                <input type="range" min="40" max="95" value={state.settings.warningThreshold} onChange={(event) => onPatchSettings({ warningThreshold: Number(event.currentTarget.value) })} />
              </div>
              <div className="setting-slider">
                <div className="setting-slider__head"><span>{copy.criticalThreshold}</span><strong>{state.settings.criticalThreshold}%</strong></div>
                <input type="range" min="60" max="100" value={state.settings.criticalThreshold} onChange={(event) => onPatchSettings({ criticalThreshold: Number(event.currentTarget.value) })} />
              </div>
              <div className="settings-check-grid settings-check-grid--compact">
                {displayedProviderOrder.map((providerId) => {
                  const provider = state.providers[providerId]
                  return <label className="setting-check" key={providerId}><input type="checkbox" checked={provider.visible} onChange={(event) => onToggleProvider(providerId, event.currentTarget.checked)} /> <span>{provider.name} · {provider.plan ?? copy.noPlan} · {provider.lastUpdatedLabel}</span></label>
                })}
              </div>
              <div className="setting-group">
                <span className="setting-row__label">{copy.tokenMode}</span>
                <div className="option-group">
                  {tokenModes.map((mode) => (
                    <button key={mode} className={state.settings.tokenCountMode === mode ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => onSetTokenCountMode(mode)}>{copy.tokenModes[mode]}</button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'appearance' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.appearance}</h3>
                <p>{copy.appearanceHint}</p>
              </div>
              <div className="setting-group">
                <span className="setting-row__label">{copy.islandWidth}</span>
                <div className="option-group option-group--wide">
                  {widthModes.map((mode) => <button key={mode} className={state.settings.islandWidthMode === mode ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => onPatchSettings({ islandWidthMode: mode })}>{copy.widthModes[mode]}</button>)}
                </div>
              </div>
              <div className="setting-group">
                <span className="setting-row__label">{copy.chartStyle}</span>
                <div className="option-group option-group--wide">
                  {chartStyles.map((style) => <button key={style} className={state.settings.chartStyle === style ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => onSetChartStyle(style)}>{copy.chartStyles[style]}</button>)}
                </div>
              </div>
              <div className="setting-group">
                <span className="setting-row__label">{copy.costStyle}</span>
                <div className="option-group option-group--wide">
                  {costStyles.map((style) => <button key={style} className={state.settings.costStyle === style ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => onSetCostStyle(style)}>{copy.costStyles[style]}</button>)}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'placement' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.placement}</h3>
                <p>{copy.placementHint}</p>
              </div>
              <label className="setting-row setting-row--stacked">
                <span className="setting-row__label">{copy.targetDisplay}</span>
                <select value={targetDisplayValue} onChange={(event) => onPatchSettings({ targetDisplay: toTargetDisplay(event.currentTarget.value, displays) })}>
                  <option value="auto">{copy.auto}</option>
                  <option value="primary">{copy.primaryDisplay}</option>
                  {displays.map((display) => (
                    <option value={display.id} key={display.id}>{displayLabel(display, copy)}</option>
                  ))}
                </select>
              </label>
              <div className="setting-slider">
                <div className="setting-slider__head"><span>{copy.topOffset}</span><strong>{state.settings.topOffsetPx}px</strong></div>
                <input type="range" min="0" max="120" value={state.settings.topOffsetPx} onChange={(event) => onPatchSettings({ topOffsetPx: Number(event.currentTarget.value) })} />
              </div>
              <div className="placement-hint">
                <span>{copy.dragPosition}</span>
                <strong>{state.settings.overlayPosition ? `${state.settings.overlayPosition.x}, ${state.settings.overlayPosition.y}` : copy.displayDefault}</strong>
              </div>
              <p className="settings-note">{copy.dragTip}</p>
              {state.settings.overlayPosition ? <button className="secondary-button" onClick={() => onPatchSettings({ overlayPosition: null })}>{copy.resetPosition}</button> : null}
            </section>
          </div>
        ) : null}

        {activeTab === 'terminal' ? <TerminalHudPanel config={state.settings.terminalHud} language={uiLanguage} previewState={normalizedHudState} claudeContextWindowSize={globalBridge?.contextWindowSizeEnv ?? null} onPatchSettings={onPatchSettings} /> : null}

        {activeTab === 'desktop' ? <DesktopHudPanel config={state.settings.desktopHud} language={uiLanguage} onPatchSettings={onPatchSettings} /> : null}

        {activeTab === 'claude' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.claudeCompatibility}</h3>
                <p>{copy.claudeCompatibilityHint}</p>
              </div>
              <div className="diagnostics-grid diagnostics-grid--compact">
                <span>{copy.mode}</span><strong>{modeLabel(globalBridge?.compatibilityMode, copy)}</strong>
                <span>{copy.installed}</span><strong>{yesNo(globalBridge?.installed, copy)}</strong>
                <span>{copy.settings}</span><strong title={globalBridge?.settingsPath ?? undefined}>{fallbackText(globalBridge?.settingsPath, copy.notLoaded)}</strong>
                <span>{copy.bridgeScript}</span><strong title={globalBridge?.bridgePath ?? undefined}>{fallbackText(globalBridge?.bridgePath, copy.notLoaded)}</strong>
                <span>{copy.statusLineOwner}</span><strong>{ownerLabel(globalBridge?.statusLineOwner, copy)}</strong>
                <span>{copy.enhancedCapture}</span><strong>{globalBridge?.enhancedCaptureEnabled ? copy.available : copy.notAvailable}</strong>
                <span>{copy.currentStatusLine}</span><strong title={globalBridge?.statusLineCommand ?? undefined}>{fallbackText(globalBridge?.statusLineCommand, copy.none)}</strong>
                <span>{copy.hooks}</span><strong>{globalBridge ? `${hookEventCount}/7` : copy.notLoaded}</strong>
                <span>{copy.upstreamSaved}</span><strong>{yesNo(globalBridge?.upstreamStatusLineSaved, copy)}</strong>
                <span>{copy.upstreamCommand}</span><strong title={globalBridge?.upstreamStatusLineCommand ?? undefined}>{fallbackText(globalBridge?.upstreamStatusLineCommand, copy.none)}</strong>
                <span>{copy.lastBackup}</span><strong title={globalBridge?.backupPath ?? undefined}>{fallbackText(globalBridge?.backupPath, copy.noneThisRun)}</strong>
              </div>
              <p className="settings-note">{globalBridge?.message ?? copy.loadingCompatibility}</p>
              <div className="settings-actions settings-actions--grid">
                <button className="secondary-button" onClick={() => void handleRefreshGlobalBridge()}>{copy.checkSettings}</button>
                <button className="secondary-button" onClick={() => void handleInstallGlobalBridge()}>{copy.installHooksOnly}</button>
                <button className="secondary-button" onClick={() => void handleEnableEnhancedBridge()}>{copy.enableEnhanced}</button>
                <button className="secondary-button" disabled={!globalBridge?.canRestoreStatusLine} onClick={() => void handleRestoreStatusLine()}>{copy.restoreStatusLine}</button>
                <button className="secondary-button" disabled={hookEventCount === 0} onClick={() => void handleRemoveGlobalHooks()}>{copy.removeHooks}</button>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'updates' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.updates}</h3>
                <p>{copy.updatesHint}</p>
              </div>
              <div className="diagnostics-grid diagnostics-grid--compact">
                <span>{copy.version}</span><strong>{updateState?.currentVersion ?? '0.1.0'}</strong>
                <span>{copy.channel}</span><strong>{updateState?.channel ?? 'stable'}</strong>
                <span>{copy.status}</span><strong>{updateState?.status ?? copy.notLoaded}</strong>
                <span>{copy.configured}</span><strong>{yesNo(updateState?.configured, copy)}</strong>
                <span>{copy.canCheck}</span><strong>{yesNo(updateState?.canCheck, copy)}</strong>
                <span>{copy.lastCheck}</span><strong>{updateState?.lastCheckedAt ?? copy.never}</strong>
                <span>{copy.endpoint}</span><strong>{updateState?.endpoint ?? copy.notConfigured}</strong>
                <span>{copy.manualUpdate}</span><strong>{updateState?.manualUpdateAvailable ? copy.available : copy.notAvailable}</strong>
                <span>{copy.releasePage}</span><strong title={updateState?.releasePageUrl ?? undefined}>{updateState?.releasePageUrl ?? copy.notConfigured}</strong>
                <span>{copy.errorCode}</span><strong>{updateState?.errorCode ?? copy.none}</strong>
              </div>
              <p className="settings-note">{updateState?.message ?? copy.loadingUpdater}</p>
              <div className="settings-actions settings-actions--grid">
                <button className="secondary-button" disabled={updateState?.canCheck === false} onClick={() => void handleCheckForUpdates()}>{copy.checkUpdates}</button>
                <button className="secondary-button" disabled={!updateState?.manualUpdateAvailable} onClick={() => void handleOpenReleasePage()}>{copy.openReleasePage}</button>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'about' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <section className="settings-section settings-section--flat">
              <div className="settings-section__heading">
                <h3>{copy.diagnostics}</h3>
                <p>{copy.diagnosticsHint}</p>
              </div>
              <div className="diagnostics-grid diagnostics-grid--compact">
                <span>{copy.sessionSource}</span><strong>{state.currentSession.mode} · {state.currentSession.sourceLabel}</strong>
                <span>{copy.project}</span><strong>{state.currentSession.projectSlug}</strong>
                <span>{copy.events}</span><strong>{state.currentSession.totalEventCount.toLocaleString()} total · {state.currentSession.assistantEventCount.toLocaleString()} assistant · {state.currentSession.userEventCount.toLocaleString()} user</strong>
                <span>{copy.tools}</span><strong>{state.currentSession.toolCallRecordCount.toLocaleString()} records · {state.currentSession.toolResultFileCount.toLocaleString()} result files</strong>
                <span>{copy.lastActivity}</span><strong>{state.currentSession.lastEventLabel}</strong>
                <span>{copy.appData}</span><strong title={diagnostics?.appDataDir ?? undefined}>{diagnostics?.appDataDir ?? copy.notLoaded}</strong>
                <span>{copy.settingsFile}</span><strong title={diagnostics?.settingsPath ?? undefined}>{formatExists(diagnostics?.settingsExists, copy)}</strong>
                <span>{copy.usageCache}</span><strong title={diagnostics?.usageCachePath ?? undefined}>{formatExists(diagnostics?.usageCacheExists, copy)}</strong>
                <span>{copy.claudeProjects}</span><strong title={diagnostics?.claudeProjectsRoot ?? undefined}>{formatExists(diagnostics?.claudeProjectsRootExists, copy)}</strong>
              </div>
              <p className="settings-note">{diagnostics?.privacyNote ?? copy.loadingDiagnostics}</p>
              <div className="settings-actions settings-actions--grid">
                <button className="secondary-button" onClick={onRefreshNow} disabled={isRefreshing}>{isRefreshing ? copy.refreshing : copy.refreshNow}</button>
                <button className="secondary-button" onClick={onOpenDiagnostics}>{copy.openClaudeLogs}</button>
                <button className="secondary-button" onClick={() => void handleOpenAppData()}>{copy.openAppData}</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
