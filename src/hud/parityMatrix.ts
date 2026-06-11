import type { HudDisplayItemId, HudParityMatrixRow, HudParityStatus } from './types'

export const TERMINAL_HUD_PARITY_MATRIX: HudParityMatrixRow[] = [
  { item: 'model', terminalStatus: 'ready', desktopStatus: 'partial', source: 'shared', notes: 'Terminal maps to HUD Plus model row item; Desktop can use modelLabel when bridge provides it.' },
  { item: 'contextBar', terminalStatus: 'ready', desktopStatus: 'planned', source: 'hud-plus', notes: 'Terminal supports the HUD Plus context bar. Desktop needs a compact meter.' },
  { item: 'contextValue', terminalStatus: 'ready', desktopStatus: 'partial', source: 'shared', notes: 'Bridge exposes context tokens/percent; Desktop currently prefers K-token labels.' },
  { item: 'project', terminalStatus: 'ready', desktopStatus: 'ready', source: 'shared', notes: 'Both surfaces can use projectSlug/projectDir.' },
  { item: 'git', terminalStatus: 'ready', desktopStatus: 'partial', source: 'hud-plus', notes: 'Bridge collects branch/dirty/ahead/behind with a short git timeout; Desktop can show a configurable ticker/panel chip.' },
  { item: 'addedDirs', terminalStatus: 'ready', desktopStatus: 'partial', source: 'hud-plus', notes: 'Bridge stores basename-only added dirs for terminal and configurable desktop slots.' },
  { item: 'sessionTokens', terminalStatus: 'ready', desktopStatus: 'partial', source: 'shared', notes: 'Bridge exposes token breakdown; Desktop has metrics but no configurable token row yet.' },
  { item: 'usage', terminalStatus: 'ready', desktopStatus: 'ready', source: 'shared', notes: 'Desktop already has UsageView; Terminal config mirrors HUD Plus usage controls.' },
  { item: 'promptCache', terminalStatus: 'ready', desktopStatus: 'planned', source: 'hud-plus', notes: 'Terminal renderer can use lastAssistantResponseAt when Claude Code provides it; full transcript-derived parity remains planned.' },
  { item: 'memory', terminalStatus: 'ready', desktopStatus: 'planned', source: 'hud-plus', notes: 'Memory usage provider is not implemented in Claude HUD One yet.' },
  { item: 'environment', terminalStatus: 'ready', desktopStatus: 'planned', source: 'hud-plus', notes: 'CLAUDE.md/rules/MCP/hooks counts are planned for diagnostics projection.' },
  { item: 'tools', terminalStatus: 'ready', desktopStatus: 'partial', source: 'shared', notes: 'Desktop can show active sanitized tool name; full statistics are planned.' },
  { item: 'agents', terminalStatus: 'ready', desktopStatus: 'partial', source: 'hud-plus', notes: 'Bridge stores sanitized aggregate/running counts when available; desktop can render them as configurable chips.' },
  { item: 'todos', terminalStatus: 'ready', desktopStatus: 'partial', source: 'hud-plus', notes: 'Bridge stores sanitized aggregate counts when available; desktop can render them as configurable chips.' },
  { item: 'activity', terminalStatus: 'ready', desktopStatus: 'partial', source: 'shared', notes: 'Terminal uses HUD Plus style auto activity summaries for tools, agents, todos and warnings.' },
  { item: 'sessionTime', terminalStatus: 'ready', desktopStatus: 'planned', source: 'hud-plus', notes: 'Bridge projects session start/last response timestamps when available; Desktop visual is still planned.' },
  { item: 'customLine', terminalStatus: 'ready', desktopStatus: 'planned', source: 'hud-plus', notes: 'Desktop custom text slots are planned.' },
  { item: 'cost', terminalStatus: 'partial', desktopStatus: 'ready', source: 'shared', notes: 'HUD Plus supports cost as a display flag; Desktop already has CostView.' },
  { item: 'effortLevel', terminalStatus: 'ready', desktopStatus: 'partial', source: 'shared', notes: 'Bridge stores sanitized effort/thinking fields; Desktop needs a configurable chip.' },
]

export const paritySummary = (surface: 'terminal' | 'desktop'): Record<HudParityStatus, number> => {
  return TERMINAL_HUD_PARITY_MATRIX.reduce<Record<HudParityStatus, number>>((summary, row) => {
    const status = surface === 'terminal' ? row.terminalStatus : row.desktopStatus
    summary[status] += 1
    return summary
  }, { ready: 0, partial: 0, planned: 0, blocked: 0 })
}

export const parityRowsForItems = (items: HudDisplayItemId[]): HudParityMatrixRow[] => {
  const itemSet = new Set(items)
  return TERMINAL_HUD_PARITY_MATRIX.filter((row) => itemSet.has(row.item))
}
