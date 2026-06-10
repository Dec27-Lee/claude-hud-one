import { useEffect, useMemo, useState } from 'react'
import type { SettingsState } from '../../app/types'
import { DEFAULT_TERMINAL_HUD_CONFIG, mergeTerminalHudConfig, type TerminalHudConfig, type TerminalHudPreset } from '../../hud/config'
import type { HudDisplayItemId, NormalizedHudState } from '../../hud/types'
import { fieldSchemaBySurface } from '../../hud/fieldSchema'
import { paritySummary, TERMINAL_HUD_PARITY_MATRIX } from '../../hud/parityMatrix'
import { DISPLAY_ITEM_REGISTRY, terminalDisplayItemIds } from '../../hud/displayItemRegistry'
import { renderTerminalHudPreviewLines } from '../../hud/terminalRenderer'
import { HudParityMatrixView } from './HudParityMatrixView'

type TerminalHudPanelProps = {
  config: TerminalHudConfig
  language: 'en' | 'zh-CN'
  previewState: NormalizedHudState
  onPatchSettings: (settings: Partial<SettingsState>) => void
}

const terminalPresets: TerminalHudPreset[] = ['hud-plus-default', 'minimal', 'custom']
const rowOverflowModes: TerminalHudConfig['rowOverflow'][] = ['truncate', 'wrap']
const contextValueModes: TerminalHudConfig['display']['contextValue'][] = ['both', 'percent', 'tokens', 'remaining']
const usageValueModes: TerminalHudConfig['display']['usageValue'][] = ['percent', 'remaining']
const addedDirsLayouts: TerminalHudConfig['display']['addedDirsLayout'][] = ['inline', 'line']
const modelFormatModes: TerminalHudConfig['display']['modelFormat'][] = ['full', 'compact', 'short']
const timeFormatModes: TerminalHudConfig['display']['timeFormat'][] = ['relative', 'absolute', 'both']
const activityModes: TerminalHudConfig['activityLine']['mode'][] = ['auto', 'details', 'summary']
const toolNameFormats: TerminalHudConfig['activityLine']['toolNameFormat'][] = ['short', 'full']
type TerminalHudDisplayBooleanKey = {
  [Key in keyof TerminalHudConfig['display']]: TerminalHudConfig['display'][Key] extends boolean ? Key : never
}[keyof TerminalHudConfig['display']]
const displaySwitches = [
  'showModel',
  'showProject',
  'showAddedDirs',
  'showContextBar',
  'showConfigCounts',
  'showSessionTokens',
  'showTokenBreakdown',
  'showUsage',
  'usageBarEnabled',
  'showResetLabel',
  'usageCompact',
  'showTools',
  'showAgents',
  'showTodos',
  'showPromptCache',
  'showMemoryUsage',
  'showEnvironment',
  'showCost',
  'showDuration',
  'showSpeed',
  'showOutputStyle',
  'showSessionName',
  'showClaudeCodeVersion',
  'showEffortLevel',
  'showSessionStartDate',
  'showLastResponseAt',
] as const satisfies readonly TerminalHudDisplayBooleanKey[]
type TerminalHudDisplaySwitchKey = (typeof displaySwitches)[number]
type TerminalHudColorKey = Exclude<keyof TerminalHudConfig['colors'], 'barFilled' | 'barEmpty' | 'contextBands' | 'usageBands'>
const colorKeys: TerminalHudColorKey[] = ['model', 'project', 'context', 'usage', 'usageWarning', 'warning', 'critical', 'git', 'gitBranch', 'label', 'labelTitle', 'labelValue', 'custom']
const barKeys: Array<'barFilled' | 'barEmpty'> = ['barFilled', 'barEmpty']

const presetPatch = (preset: TerminalHudPreset): Partial<TerminalHudConfig> => {
  if (preset === 'minimal') {
    return {
      preset,
      rows: [['model', 'contextValue'], ['activity']],
      display: {
        ...DEFAULT_TERMINAL_HUD_CONFIG.display,
        showAddedDirs: false,
        showContextBar: false,
        showSessionTokens: false,
        showAgents: false,
        showTodos: false,
      },
    }
  }
  if (preset === 'hud-plus-default') {
    return { ...DEFAULT_TERMINAL_HUD_CONFIG, preset }
  }
  return { preset }
}

export function TerminalHudPanel({ config, language, previewState, onPatchSettings }: TerminalHudPanelProps) {
  const copy = language === 'zh-CN'
    ? {
        title: 'Terminal HUD',
        hint: '内置 Claude HUD Plus 的终端 statusLine 能力。当前已支持安全预览、基础 rows builder、JSON validate 和 owner bridge 输出。',
        enabled: '启用 Terminal HUD',
        preset: '预设',
        rowOverflow: '行溢出策略',
        rows: 'Rows builder',
        switches: '常用信息项开关',
        advanced: 'HUD Plus 颗粒度配置',
        preview: '终端预览',
        registry: '已登记终端信息项',
        fields: '首批配置字段',
        parity: 'Terminal HUD parity matrix',
        summary: '覆盖摘要',
        ready: '已覆盖',
        partial: '部分',
        planned: '计划',
        blocked: '阻塞',
        addRow: '新增行',
        removeRow: '删除行',
        addItem: '添加 item',
        removeItem: '移除',
        colors: 'Color Workbench',
        barChars: '进度条字符',
        diagnostics: '诊断',
        rowsConfigured: '已配置行数',
        itemsConfigured: '已配置 item',
        unknownItems: '未知 item',
        previewLines: '预览行数',
        json: 'JSON / Validate',
        applyJson: '验证并应用 JSON',
        resetDefault: '重置默认',
        jsonValid: 'JSON 有效，可应用。',
        jsonInvalid: 'JSON 无效',
        jsonChanged: '当前草稿与已保存配置不同。',
        presets: { 'hud-plus-default': 'HUD Plus 默认', minimal: '极简', custom: '自定义' },
        overflow: { truncate: '截断', wrap: '换行' },
      }
    : {
        title: 'Terminal HUD',
        hint: 'Built-in Claude HUD Plus compatible terminal statusLine. This panel now supports safe preview, a basic rows builder, JSON validation, and owner bridge output.',
        enabled: 'Enable Terminal HUD',
        preset: 'Preset',
        rowOverflow: 'Row overflow',
        rows: 'Rows builder',
        switches: 'Common item switches',
        advanced: 'HUD Plus granular controls',
        preview: 'Terminal preview',
        registry: 'Registered terminal items',
        fields: 'First config fields',
        parity: 'Terminal HUD parity matrix',
        summary: 'Coverage summary',
        ready: 'ready',
        partial: 'partial',
        planned: 'planned',
        blocked: 'blocked',
        addRow: 'Add row',
        removeRow: 'Remove row',
        addItem: 'Add item',
        removeItem: 'Remove',
        colors: 'Color Workbench',
        barChars: 'Bar characters',
        diagnostics: 'Diagnostics',
        rowsConfigured: 'Configured rows',
        itemsConfigured: 'Configured items',
        unknownItems: 'Unknown items',
        previewLines: 'Preview lines',
        json: 'JSON / Validate',
        applyJson: 'Validate and apply JSON',
        resetDefault: 'Reset default',
        jsonValid: 'JSON is valid and ready to apply.',
        jsonInvalid: 'Invalid JSON',
        jsonChanged: 'Draft differs from saved config.',
        presets: { 'hud-plus-default': 'HUD Plus default', minimal: 'Minimal', custom: 'Custom' },
        overflow: { truncate: 'Truncate', wrap: 'Wrap' },
      }
  const terminalItems = useMemo(() => terminalDisplayItemIds(), [])
  const terminalItemSet = useMemo(() => new Set(terminalItems), [terminalItems])
  const summary = paritySummary('terminal')
  const terminalFields = fieldSchemaBySurface('terminal')
  const previewLines = renderTerminalHudPreviewLines(previewState, config)
  const configuredItemCount = config.rows.reduce((count, row) => count + row.length, 0)
  const unknownItems = Array.from(new Set(config.rows.flat().filter((item) => !terminalItemSet.has(item))))
  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(config, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    setJsonDraft(JSON.stringify(config, null, 2))
    setJsonError(null)
  }, [config])

  const displayLabel = (key: TerminalHudDisplaySwitchKey): string => {
    const labels = language === 'zh-CN'
      ? {
          showModel: '模型',
          showProject: '项目',
          showAddedDirs: '附加目录',
          showContextBar: '上下文进度条',
          showConfigCounts: '配置计数',
          showSessionTokens: '会话 tokens',
          showTokenBreakdown: 'Token 明细',
          showUsage: '用量',
          usageBarEnabled: '用量进度条',
          showResetLabel: '重置时间',
          usageCompact: '紧凑用量',
          showTools: '工具',
          showAgents: '子代理',
          showTodos: '任务',
          showPromptCache: 'Prompt cache',
          showMemoryUsage: '内存',
          showEnvironment: '环境',
          showCost: '成本',
          showDuration: '耗时',
          showSpeed: '速度',
          showOutputStyle: '输出风格',
          showSessionName: '会话名',
          showClaudeCodeVersion: 'Claude Code 版本',
          showEffortLevel: '思考强度',
          showSessionStartDate: '会话开始时间',
          showLastResponseAt: '最后回复时间',
        }
      : {
          showModel: 'Model',
          showProject: 'Project',
          showAddedDirs: 'Added dirs',
          showContextBar: 'Context bar',
          showConfigCounts: 'Config counts',
          showSessionTokens: 'Session tokens',
          showTokenBreakdown: 'Token breakdown',
          showUsage: 'Usage',
          usageBarEnabled: 'Usage bar',
          showResetLabel: 'Reset labels',
          usageCompact: 'Compact usage',
          showTools: 'Tools',
          showAgents: 'Agents',
          showTodos: 'Todos',
          showPromptCache: 'Prompt cache',
          showMemoryUsage: 'Memory',
          showEnvironment: 'Environment',
          showCost: 'Cost',
          showDuration: 'Duration',
          showSpeed: 'Speed',
          showOutputStyle: 'Output style',
          showSessionName: 'Session name',
          showClaudeCodeVersion: 'Claude Code version',
          showEffortLevel: 'Effort level',
          showSessionStartDate: 'Session start',
          showLastResponseAt: 'Last response',
        }
    return labels[key] ?? key
  }

  const colorLabel = (key: keyof TerminalHudConfig['colors']): string => {
    const labels = language === 'zh-CN'
      ? { model: '模型', project: '项目', context: '上下文', usage: '用量', usageWarning: '用量警告', warning: '警告', critical: '严重', git: 'Git', gitBranch: 'Git 分支', label: '标签', labelTitle: '标签标题', labelValue: '标签值', custom: '自定义', barFilled: '填充', barEmpty: '空位' }
      : { model: 'Model', project: 'Project', context: 'Context', usage: 'Usage', usageWarning: 'Usage warning', warning: 'Warning', critical: 'Critical', git: 'Git', gitBranch: 'Git branch', label: 'Label', labelTitle: 'Label title', labelValue: 'Label value', custom: 'Custom', barFilled: 'Filled', barEmpty: 'Empty' }
    return labels[key as keyof typeof labels] ?? key
  }

  const patchTerminalHud = (patch: Partial<TerminalHudConfig>): void => {
    onPatchSettings({ terminalHud: mergeTerminalHudConfig(config, patch) })
  }

  const replaceTerminalHud = (nextConfig: Partial<TerminalHudConfig>): void => {
    onPatchSettings({ terminalHud: mergeTerminalHudConfig(DEFAULT_TERMINAL_HUD_CONFIG, nextConfig) })
  }

  const patchDisplay = (display: Partial<TerminalHudConfig['display']>): void => {
    patchTerminalHud({ display: { ...config.display, ...display } })
  }

  const patchColors = (colors: Partial<TerminalHudConfig['colors']>): void => {
    patchTerminalHud({ colors: { ...config.colors, ...colors } })
  }

  const patchActivityLine = (activityLine: Partial<TerminalHudConfig['activityLine']>): void => {
    patchTerminalHud({ activityLine: { ...config.activityLine, ...activityLine } })
  }

  const patchGitStatus = (gitStatus: Partial<TerminalHudConfig['gitStatus']>): void => {
    patchTerminalHud({ gitStatus: { ...config.gitStatus, ...gitStatus } })
  }

  const colorValue = (key: TerminalHudColorKey): string => String(config.colors[key] ?? '')

  const addRow = (): void => patchTerminalHud({ rows: [...config.rows, ['activity']] })
  const removeRow = (rowIndex: number): void => patchTerminalHud({ rows: config.rows.filter((_, index) => index !== rowIndex) })
  const addItemToRow = (rowIndex: number, item: HudDisplayItemId): void => {
    const rows = config.rows.map((row, index) => index === rowIndex && !row.includes(item) ? [...row, item] : row)
    patchTerminalHud({ rows })
  }
  const removeItemFromRow = (rowIndex: number, itemIndex: number): void => {
    const rows = config.rows
      .map((row, index) => index === rowIndex ? row.filter((_, innerIndex) => innerIndex !== itemIndex) : row)
      .filter((row) => row.length > 0)
    patchTerminalHud({ rows: rows.length ? rows : DEFAULT_TERMINAL_HUD_CONFIG.rows })
  }

  const validateJsonDraft = (): Partial<TerminalHudConfig> | null => {
    try {
      const parsed = JSON.parse(jsonDraft) as Partial<TerminalHudConfig>
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Config must be an object')
      if (parsed.rows && (!Array.isArray(parsed.rows) || parsed.rows.some((row) => !Array.isArray(row)))) throw new Error('rows must be an array of arrays')
      if (parsed.rows) {
        const unknown = parsed.rows.flat().filter((item) => typeof item !== 'string' || !terminalItemSet.has(item as HudDisplayItemId))
        if (unknown.length) throw new Error(`unknown row items: ${Array.from(new Set(unknown)).join(', ')}`)
      }
      if (parsed.display && (typeof parsed.display !== 'object' || Array.isArray(parsed.display))) throw new Error('display must be an object')
      if (parsed.colors && (typeof parsed.colors !== 'object' || Array.isArray(parsed.colors))) throw new Error('colors must be an object')
      setJsonError(null)
      return parsed
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : String(error))
      return null
    }
  }

  const applyJsonDraft = (): void => {
    const parsed = validateJsonDraft()
    if (parsed) replaceTerminalHud(parsed)
  }

  const draftChanged = jsonDraft.trim() !== JSON.stringify(config, null, 2).trim()

  return (
    <div className="settings-tab-panel" role="tabpanel">
      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.title}</h3>
          <p>{copy.hint}</p>
        </div>
        <label className="setting-check setting-check--inline">
          <input type="checkbox" checked={config.enabled} onChange={(event) => patchTerminalHud({ enabled: event.currentTarget.checked })} />
          <span>{copy.enabled}</span>
        </label>
        <div className="setting-group">
          <span className="setting-row__label">{copy.preset}</span>
          <div className="option-group option-group--wide">
            {terminalPresets.map((preset) => (
              <button key={preset} className={config.preset === preset ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchTerminalHud(presetPatch(preset))}>{copy.presets[preset]}</button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.rowOverflow}</span>
          <div className="option-group option-group--wide">
            {rowOverflowModes.map((rowOverflow) => (
              <button key={rowOverflow} className={config.rowOverflow === rowOverflow ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchTerminalHud({ rowOverflow })}>{copy.overflow[rowOverflow]}</button>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.switches}</span>
          <div className="settings-check-grid settings-check-grid--compact">
            {displaySwitches.map((key) => (
              <label className="setting-check" key={key}>
                <input type="checkbox" checked={config.display[key] === true} onChange={(event) => patchDisplay({ [key]: event.currentTarget.checked })} />
                <span>{displayLabel(key)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.advanced}</span>
          <div className="settings-check-grid settings-check-grid--compact">
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">contextValue</span>
              <select value={config.display.contextValue} onChange={(event) => patchDisplay({ contextValue: event.currentTarget.value as TerminalHudConfig['display']['contextValue'] })}>
                {contextValueModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">usageValue</span>
              <select value={config.display.usageValue} onChange={(event) => patchDisplay({ usageValue: event.currentTarget.value as TerminalHudConfig['display']['usageValue'] })}>
                {usageValueModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">addedDirsLayout</span>
              <select value={config.display.addedDirsLayout} onChange={(event) => patchDisplay({ addedDirsLayout: event.currentTarget.value as TerminalHudConfig['display']['addedDirsLayout'] })}>
                {addedDirsLayouts.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">modelFormat</span>
              <select value={config.display.modelFormat} onChange={(event) => patchDisplay({ modelFormat: event.currentTarget.value as TerminalHudConfig['display']['modelFormat'] })}>
                {modelFormatModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">timeFormat</span>
              <select value={config.display.timeFormat} onChange={(event) => patchDisplay({ timeFormat: event.currentTarget.value as TerminalHudConfig['display']['timeFormat'] })}>
                {timeFormatModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">activityLine.mode</span>
              <select value={config.activityLine.mode} onChange={(event) => patchActivityLine({ mode: event.currentTarget.value as TerminalHudConfig['activityLine']['mode'] })}>
                {activityModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">toolNameFormat</span>
              <select value={config.activityLine.toolNameFormat} onChange={(event) => patchActivityLine({ toolNameFormat: event.currentTarget.value as TerminalHudConfig['activityLine']['toolNameFormat'] })}>
                {toolNameFormats.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">modelOverride</span>
              <input value={config.display.modelOverride} onChange={(event) => patchDisplay({ modelOverride: event.currentTarget.value })} />
            </label>
            <label className="setting-check">
              <input type="checkbox" checked={config.gitStatus.enabled} onChange={(event) => patchGitStatus({ enabled: event.currentTarget.checked })} />
              <span>gitStatus.enabled</span>
            </label>
            <label className="setting-check">
              <input type="checkbox" checked={config.gitStatus.showDirty} onChange={(event) => patchGitStatus({ showDirty: event.currentTarget.checked })} />
              <span>gitStatus.showDirty</span>
            </label>
            <label className="setting-check">
              <input type="checkbox" checked={config.gitStatus.showAheadBehind} onChange={(event) => patchGitStatus({ showAheadBehind: event.currentTarget.checked })} />
              <span>gitStatus.showAheadBehind</span>
            </label>
            <label className="setting-check">
              <input type="checkbox" checked={config.gitStatus.showFileStats} onChange={(event) => patchGitStatus({ showFileStats: event.currentTarget.checked })} />
              <span>gitStatus.showFileStats</span>
            </label>
          </div>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.colors}</h3>
        </div>
        <div className="terminal-color-grid">
          {colorKeys.map((key) => (
            <label className="terminal-color-field" key={key}>
              <span>{colorLabel(key)}</span>
              <input value={colorValue(key)} placeholder="#22D3EE / brightBlue / 208" onChange={(event) => patchColors({ [key]: event.currentTarget.value })} />
            </label>
          ))}
        </div>
        <div className="setting-group">
          <span className="setting-row__label">{copy.barChars}</span>
          <div className="settings-check-grid settings-check-grid--compact">
            {barKeys.map((key) => (
              <label className="setting-row setting-row--stacked" key={key}>
                <span className="setting-row__label">{colorLabel(key)}</span>
                <input className="terminal-char-input" value={config.colors[key]} maxLength={2} onChange={(event) => patchColors({ [key]: event.currentTarget.value.slice(0, 2) })} />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.preview}</h3>
        </div>
        <pre className="terminal-preview" aria-label="Terminal HUD preview">{previewLines.join('\n')}</pre>
      </section>

      <section className="settings-section settings-section--flat">
        <div className="settings-section__heading">
          <h3>{copy.diagnostics}</h3>
        </div>
        <div className="diagnostics-grid diagnostics-grid--compact">
          <span>{copy.rowsConfigured}</span><strong>{config.rows.length}</strong>
          <span>{copy.itemsConfigured}</span><strong>{configuredItemCount}</strong>
          <span>{copy.unknownItems}</span><strong>{unknownItems.length ? unknownItems.join(', ') : '0'}</strong>
          <span>{copy.previewLines}</span><strong>{previewLines.length}</strong>
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.rows}</h3>
        </div>
        <div className="terminal-row-builder">
          {config.rows.map((row, rowIndex) => (
            <div className="terminal-row-builder__row" key={`${rowIndex}-${row.join('-')}`}>
              <strong>row {rowIndex + 1}</strong>
              <div className="terminal-row-builder__items">
                {row.map((item, itemIndex) => (
                  <button className="terminal-item-chip" key={`${item}-${itemIndex}`} onClick={() => removeItemFromRow(rowIndex, itemIndex)} aria-label={`${copy.removeItem} ${item}`}>
                    {DISPLAY_ITEM_REGISTRY[item]?.label ?? item} ×
                  </button>
                ))}
              </div>
              <select value="" aria-label={`${copy.addItem} row ${rowIndex + 1}`} onChange={(event) => {
                if (event.currentTarget.value) addItemToRow(rowIndex, event.currentTarget.value as HudDisplayItemId)
              }}>
                <option value="">{copy.addItem}</option>
                {terminalItems.map((item) => <option key={item} value={item}>{DISPLAY_ITEM_REGISTRY[item]?.label ?? item}</option>)}
              </select>
              <button className="secondary-button" onClick={() => removeRow(rowIndex)}>{copy.removeRow}</button>
            </div>
          ))}
        </div>
        <button className="secondary-button" onClick={addRow}>{copy.addRow}</button>
        <div className="diagnostics-grid diagnostics-grid--compact">
          <span>{copy.registry}</span><strong>{terminalItems.length}</strong>
          <span>{copy.fields}</span><strong>{terminalFields.length}</strong>
          <span>{copy.summary}</span><strong>{copy.ready} {summary.ready} · {copy.partial} {summary.partial} · {copy.planned} {summary.planned} · {copy.blocked} {summary.blocked}</strong>
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.json}</h3>
        </div>
        <textarea className="terminal-json-editor" value={jsonDraft} onChange={(event) => setJsonDraft(event.currentTarget.value)} spellCheck={false} aria-label="Terminal HUD JSON editor" />
        <p className="settings-note">{jsonError ? `${copy.jsonInvalid}: ${jsonError}` : draftChanged ? copy.jsonChanged : copy.jsonValid}</p>
        <div className="settings-actions settings-actions--grid">
          <button className="secondary-button" onClick={applyJsonDraft}>{copy.applyJson}</button>
          <button className="secondary-button" onClick={() => replaceTerminalHud(DEFAULT_TERMINAL_HUD_CONFIG)}>{copy.resetDefault}</button>
        </div>
      </section>

      <section className="settings-section settings-section--flat settings-section--wide">
        <div className="settings-section__heading">
          <h3>{copy.parity}</h3>
        </div>
        <HudParityMatrixView rows={TERMINAL_HUD_PARITY_MATRIX} surface="terminal" language={language} />
      </section>
    </div>
  )
}
