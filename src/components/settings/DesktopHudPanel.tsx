import type { SettingsState } from '../../app/types'
import type { DesktopHudConfig, DesktopHudPreset } from '../../hud/config'
import { desktopDisplayItemIds, DISPLAY_ITEM_REGISTRY } from '../../hud/displayItemRegistry'
import { fieldSchemaBySurface } from '../../hud/fieldSchema'
import { parityRowsForItems, paritySummary, TERMINAL_HUD_PARITY_MATRIX } from '../../hud/parityMatrix'
import type { HudDisplayItemId } from '../../hud/types'
import { HudParityMatrixView } from './HudParityMatrixView'

type DesktopHudPanelProps = {
  config: DesktopHudConfig
  language: 'en' | 'zh-CN'
  onPatchSettings: (settings: Partial<SettingsState>) => void
}

const desktopPresets: DesktopHudPreset[] = ['one-default', 'terminal-parity', 'custom']
const defaultPages: DesktopHudConfig['defaultPage'][] = ['usage', 'cost', 'overview']
const configurableDesktopItems: HudDisplayItemId[] = ['model', 'contextValue', 'project', 'sessionTokens', 'usage', 'cost', 'tools', 'activity', 'git', 'addedDirs', 'agents', 'todos', 'speed', 'effortLevel']

export function DesktopHudPanel({ config, language, onPatchSettings }: DesktopHudPanelProps) {
  const copy = language === 'zh-CN'
    ? {
        title: 'Desktop HUD',
        hint: '桌面悬浮窗从固定 UI 走向可配置展示项。Phase 0 先登记 item registry、默认布局和可见性开关。',
        enabled: '启用 Desktop HUD',
        preset: '预设',
        defaultPage: '默认展开页',
        visibleItems: '桌面可见信息项',
        registry: '已登记桌面信息项',
        fields: '首批配置字段',
        parity: 'Desktop HUD parity matrix',
        summary: '覆盖摘要',
        ready: '已覆盖',
        partial: '部分',
        planned: '计划',
        blocked: '阻塞',
        presets: { 'one-default': 'One 默认', 'terminal-parity': '对齐终端', custom: '自定义' },
        pages: { usage: '用量', cost: '成本', overview: '总览' },
      }
    : {
        title: 'Desktop HUD',
        hint: 'Desktop floating HUD is moving from fixed UI to configurable display items. Phase 0 adds item registry, default layout, and visibility toggles.',
        enabled: 'Enable Desktop HUD',
        preset: 'Preset',
        defaultPage: 'Default expanded page',
        visibleItems: 'Desktop visible items',
        registry: 'Registered desktop items',
        fields: 'First config fields',
        parity: 'Desktop HUD parity matrix',
        summary: 'Coverage summary',
        ready: 'ready',
        partial: 'partial',
        planned: 'planned',
        blocked: 'blocked',
        presets: { 'one-default': 'One default', 'terminal-parity': 'Terminal parity', custom: 'Custom' },
        pages: { usage: 'Usage', cost: 'Cost', overview: 'Overview' },
      }
  const summary = paritySummary('desktop')
  const desktopFields = fieldSchemaBySurface('desktop')
  const desktopParityRows = parityRowsForItems(configurableDesktopItems).length > 0
    ? parityRowsForItems(configurableDesktopItems)
    : TERMINAL_HUD_PARITY_MATRIX

  const patchDesktopHud = (patch: Partial<DesktopHudConfig>): void => {
    onPatchSettings({ desktopHud: { ...config, ...patch, visibleItems: { ...config.visibleItems, ...patch.visibleItems } } })
  }

  const toggleItem = (item: HudDisplayItemId, enabled: boolean): void => {
    patchDesktopHud({ visibleItems: { [item]: enabled } })
  }

  return (
    <div className="settings-tab-panel" role="tabpanel">
      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.title}</h3>
          <p>{copy.hint}</p>
        </div>
        <label className="setting-check setting-check--inline">
          <input type="checkbox" checked={config.enabled} onChange={(event) => patchDesktopHud({ enabled: event.currentTarget.checked })} />
          <span>{copy.enabled}</span>
        </label>
        <div className="setting-group">
          <span className="setting-row__label">{copy.preset}</span>
          <div className="option-group option-group--wide">
            {desktopPresets.map((preset) => (
              <button key={preset} className={config.preset === preset ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ preset })}>{copy.presets[preset]}</button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.defaultPage}</span>
          <div className="option-group option-group--wide">
            {defaultPages.map((defaultPage) => (
              <button key={defaultPage} className={config.defaultPage === defaultPage ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchDesktopHud({ defaultPage })}>{copy.pages[defaultPage]}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.visibleItems}</h3>
        </div>
        <div className="settings-check-grid settings-check-grid--compact">
          {configurableDesktopItems.map((item) => (
            <label className="setting-check" key={item}>
              <input type="checkbox" checked={config.visibleItems[item] === true} onChange={(event) => toggleItem(item, event.currentTarget.checked)} />
              <span>{DISPLAY_ITEM_REGISTRY[item]?.label ?? item}</span>
            </label>
          ))}
        </div>
        <div className="diagnostics-grid diagnostics-grid--compact">
          <span>{copy.registry}</span><strong>{desktopDisplayItemIds().length}</strong>
          <span>{copy.fields}</span><strong>{desktopFields.length}</strong>
          <span>{copy.summary}</span><strong>{copy.ready} {summary.ready} · {copy.partial} {summary.partial} · {copy.planned} {summary.planned} · {copy.blocked} {summary.blocked}</strong>
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.parity}</h3>
        </div>
        <HudParityMatrixView rows={desktopParityRows} surface="desktop" language={language} />
      </section>
    </div>
  )
}
