import type { SettingsState } from '../../app/types'
import type { DesktopHudConfig, DesktopHudPreset, DesktopHudZones, DesktopHudZoneKey } from '../../hud/config'
import { DEFAULT_DESKTOP_HUD_CONFIG, normalizeDesktopHudConfig } from '../../hud/config'
import { desktopDisplayItemIds, DISPLAY_ITEM_REGISTRY } from '../../hud/displayItemRegistry'
import type { HudDisplayItemId } from '../../hud/types'

type DesktopHudPanelProps = {
  config: DesktopHudConfig
  language: 'en' | 'zh-CN'
  onPatchSettings: (settings: Partial<SettingsState>) => void
}

const desktopPresets: DesktopHudPreset[] = ['one-default', 'terminal-parity', 'custom']
const defaultPages: DesktopHudConfig['defaultPage'][] = ['usage', 'cost', 'overview']
const densities: DesktopHudConfig['density'][] = ['compact', 'comfortable']
const mascotSpeeds: DesktopHudConfig['mascotSpeed'][] = ['slow', 'normal', 'fast']
const animationIntensities: DesktopHudConfig['animationIntensity'][] = ['reduced', 'normal', 'expressive']
const jumpBehaviors: DesktopHudConfig['terminalJumpBehavior'][] = ['focus', 'openCwd', 'disabled']
const zoneKeys: DesktopHudZoneKey[] = ['ticker', 'panel', 'peek', 'usagePage', 'costPage', 'overviewPage']
const configurableDesktopItems: HudDisplayItemId[] = ['model', 'contextValue', 'project', 'sessionTokens', 'usage', 'cost', 'tools', 'activity', 'git', 'addedDirs', 'agents', 'todos', 'speed', 'effortLevel']

export function DesktopHudPanel({ config, language, onPatchSettings }: DesktopHudPanelProps) {
  const normalizedConfig = normalizeDesktopHudConfig(config)
  const copy = language === 'zh-CN'
    ? {
        title: 'Desktop HUD',
        hint: 'CodeIsland 风格桌面 HUD V2：控制顶部 capsule、会话卡片、展开面板和后续 approval/question surface 的基础行为。Terminal HUD 使用独立配置，不受这里影响。',
        enabled: '启用 Desktop HUD',
        preset: '预设',
        defaultPage: '默认展开页',
        density: '密度',
        visibleItems: '桌面可见信息项',
        zones: '展示区域',
        behavior: '交互行为',
        motion: 'Clawd 与动效',
        reset: '恢复 Desktop HUD V2 默认配置',
        registered: '已登记桌面信息项',
        schema: '配置版本',
        presets: { 'one-default': 'CodeIsland 默认', 'terminal-parity': '对齐终端', custom: '自定义' },
        pages: { usage: '用量', cost: '成本', overview: '总览' },
        densities: { compact: '紧凑', comfortable: '舒展' },
        zonesLabels: { ticker: '顶部跑马灯', panel: '会话卡片指标', peek: 'Hover 预览', usagePage: '用量页', costPage: '成本页', overviewPage: '总览页', compact: '紧凑态' },
        speeds: { slow: '慢', normal: '正常', fast: '快' },
        intensities: { reduced: '弱化', normal: '正常', expressive: '强化' },
        jumps: { focus: '聚焦终端窗口', openCwd: '找不到则打开 cwd', disabled: '禁用' },
        hoverDelay: 'Hover 展开延迟',
        collapseDelay: '离开收起延迟',
        maxSessions: '最多显示会话',
        autoWaiting: '等待/运行时自动展开',
        autoCompletion: '完成时自动提醒',
        smartSuppress: '智能抑制打扰',
        mascotSpeed: 'Clawd 速度',
        animation: '动效强度',
        jump: '终端跳转策略',
      }
    : {
        title: 'Desktop HUD',
        hint: 'CodeIsland-style Desktop HUD V2 controls the capsule, session cards, expanded panels, and future approval/question surfaces. Terminal HUD keeps a separate config.',
        enabled: 'Enable Desktop HUD',
        preset: 'Preset',
        defaultPage: 'Default expanded page',
        density: 'Density',
        visibleItems: 'Desktop visible items',
        zones: 'Display zones',
        behavior: 'Interaction behavior',
        motion: 'Clawd and motion',
        reset: 'Reset Desktop HUD V2 defaults',
        registered: 'Registered desktop items',
        schema: 'Config version',
        presets: { 'one-default': 'CodeIsland default', 'terminal-parity': 'Terminal parity', custom: 'Custom' },
        pages: { usage: 'Usage', cost: 'Cost', overview: 'Overview' },
        densities: { compact: 'Compact', comfortable: 'Comfortable' },
        zonesLabels: { ticker: 'Capsule ticker', panel: 'Session card metrics', peek: 'Hover preview', usagePage: 'Usage page', costPage: 'Cost page', overviewPage: 'Overview page', compact: 'Compact state' },
        speeds: { slow: 'Slow', normal: 'Normal', fast: 'Fast' },
        intensities: { reduced: 'Reduced', normal: 'Normal', expressive: 'Expressive' },
        jumps: { focus: 'Focus terminal window', openCwd: 'Open cwd fallback', disabled: 'Disabled' },
        hoverDelay: 'Hover expand delay',
        collapseDelay: 'Leave collapse delay',
        maxSessions: 'Max visible sessions',
        autoWaiting: 'Auto expand on waiting/running',
        autoCompletion: 'Auto notify on completion',
        smartSuppress: 'Smart suppress distractions',
        mascotSpeed: 'Clawd speed',
        animation: 'Animation intensity',
        jump: 'Terminal jump behavior',
      }

  const patchDesktopHud = (patch: Partial<DesktopHudConfig>): void => {
    onPatchSettings({ desktopHud: normalizeDesktopHudConfig({ ...normalizedConfig, ...patch, visibleItems: { ...normalizedConfig.visibleItems, ...patch.visibleItems }, zones: { ...normalizedConfig.zones, ...patch.zones }, itemOptions: { ...normalizedConfig.itemOptions, ...patch.itemOptions } }) })
  }

  const toggleItem = (item: HudDisplayItemId, enabled: boolean): void => {
    patchDesktopHud({ visibleItems: { [item]: enabled } })
  }

  const toggleZoneItem = (zone: DesktopHudZoneKey, item: HudDisplayItemId, enabled: boolean): void => {
    const current = normalizedConfig.zones[zone]
    const next = enabled
      ? Array.from(new Set([...current, item]))
      : current.filter((value) => value !== item)
    patchDesktopHud({ zones: { ...normalizedConfig.zones, [zone]: next } as DesktopHudZones })
  }

  return (
    <div className="settings-tab-panel" role="tabpanel">
      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.title}</h3>
          <p>{copy.hint}</p>
        </div>
        <label className="setting-check setting-check--inline">
          <input type="checkbox" checked={normalizedConfig.enabled} onChange={(event) => patchDesktopHud({ enabled: event.currentTarget.checked })} />
          <span>{copy.enabled}</span>
        </label>
        <div className="setting-group">
          <span className="setting-row__label">{copy.preset}</span>
          <div className="option-group option-group--wide">
            {desktopPresets.map((preset) => (
              <button key={preset} className={normalizedConfig.preset === preset ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ preset })}>{copy.presets[preset]}</button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.defaultPage}</span>
          <div className="option-group option-group--wide">
            {defaultPages.map((defaultPage) => (
              <button key={defaultPage} className={normalizedConfig.defaultPage === defaultPage ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ defaultPage })}>{copy.pages[defaultPage]}</button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.density}</span>
          <div className="option-group option-group--wide">
            {densities.map((density) => (
              <button key={density} className={normalizedConfig.density === density ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ density })}>{copy.densities[density]}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.behavior}</h3>
        </div>
        <div className="settings-check-grid settings-check-grid--compact">
          <label className="setting-check"><input type="checkbox" checked={normalizedConfig.autoExpandOnWaiting} onChange={(event) => patchDesktopHud({ autoExpandOnWaiting: event.currentTarget.checked })} /><span>{copy.autoWaiting}</span></label>
          <label className="setting-check"><input type="checkbox" checked={normalizedConfig.autoExpandOnCompletion} onChange={(event) => patchDesktopHud({ autoExpandOnCompletion: event.currentTarget.checked })} /><span>{copy.autoCompletion}</span></label>
          <label className="setting-check"><input type="checkbox" checked={normalizedConfig.smartSuppress} onChange={(event) => patchDesktopHud({ smartSuppress: event.currentTarget.checked })} /><span>{copy.smartSuppress}</span></label>
        </div>
        <div className="setting-slider">
          <div className="setting-slider__head"><span>{copy.hoverDelay}</span><strong>{normalizedConfig.hoverDelayMs}ms</strong></div>
          <input type="range" min="0" max="2000" step="50" value={normalizedConfig.hoverDelayMs} onChange={(event) => patchDesktopHud({ hoverDelayMs: Number(event.currentTarget.value) })} />
        </div>
        <div className="setting-slider">
          <div className="setting-slider__head"><span>{copy.collapseDelay}</span><strong>{normalizedConfig.collapseDelayMs}ms</strong></div>
          <input type="range" min="0" max="2000" step="50" value={normalizedConfig.collapseDelayMs} onChange={(event) => patchDesktopHud({ collapseDelayMs: Number(event.currentTarget.value) })} />
        </div>
        <div className="setting-slider">
          <div className="setting-slider__head"><span>{copy.maxSessions}</span><strong>{normalizedConfig.maxVisibleSessions}</strong></div>
          <input type="range" min="1" max="12" step="1" value={normalizedConfig.maxVisibleSessions} onChange={(event) => patchDesktopHud({ maxVisibleSessions: Number(event.currentTarget.value) })} />
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.motion}</h3>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.mascotSpeed}</span>
          <div className="option-group option-group--wide">
            {mascotSpeeds.map((mascotSpeed) => <button key={mascotSpeed} className={normalizedConfig.mascotSpeed === mascotSpeed ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ mascotSpeed })}>{copy.speeds[mascotSpeed]}</button>)}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.animation}</span>
          <div className="option-group option-group--wide">
            {animationIntensities.map((animationIntensity) => <button key={animationIntensity} className={normalizedConfig.animationIntensity === animationIntensity ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ animationIntensity })}>{copy.intensities[animationIntensity]}</button>)}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.jump}</span>
          <div className="option-group option-group--wide">
            {jumpBehaviors.map((terminalJumpBehavior) => <button key={terminalJumpBehavior} className={normalizedConfig.terminalJumpBehavior === terminalJumpBehavior ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ terminalJumpBehavior })}>{copy.jumps[terminalJumpBehavior]}</button>)}
          </div>
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>Desktop HUD parity matrix</h3>
          <p>{copy.hint}</p>
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.visibleItems}</h3>
        </div>
        <div className="settings-check-grid settings-check-grid--compact">
          {configurableDesktopItems.map((item) => (
            <label className="setting-check" key={item}>
              <input type="checkbox" checked={normalizedConfig.visibleItems[item] === true} onChange={(event) => toggleItem(item, event.currentTarget.checked)} />
              <span>{DISPLAY_ITEM_REGISTRY[item]?.label ?? item}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.zones}</h3>
        </div>
        <div className="desktop-zone-grid">
          {zoneKeys.map((zone) => (
            <div className="desktop-zone-card" key={zone}>
              <strong>{copy.zonesLabels[zone]}</strong>
              <div className="desktop-zone-card__items">
                {configurableDesktopItems.map((item) => (
                  <label className="setting-check" key={`${zone}-${item}`}>
                    <input type="checkbox" checked={normalizedConfig.zones[zone].includes(item)} onChange={(event) => toggleZoneItem(zone, item, event.currentTarget.checked)} />
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
        <button className="secondary-button" onClick={() => patchDesktopHud(DEFAULT_DESKTOP_HUD_CONFIG)}>{copy.reset}</button>
      </section>
    </div>
  )
}
