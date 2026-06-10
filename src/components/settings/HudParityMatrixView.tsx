import { DISPLAY_ITEM_REGISTRY } from '../../hud/displayItemRegistry'
import type { HudParityMatrixRow, HudParityStatus } from '../../hud/types'

type HudParityMatrixViewProps = {
  rows: HudParityMatrixRow[]
  surface: 'terminal' | 'desktop'
  language: 'en' | 'zh-CN'
}

const statusLabel = (status: HudParityStatus, language: 'en' | 'zh-CN'): string => {
  const labels = language === 'zh-CN'
    ? { ready: '已覆盖', partial: '部分', planned: '计划', blocked: '阻塞' }
    : { ready: 'ready', partial: 'partial', planned: 'planned', blocked: 'blocked' }
  return labels[status]
}

const surfaceStatus = (row: HudParityMatrixRow, surface: 'terminal' | 'desktop'): HudParityStatus => surface === 'terminal' ? row.terminalStatus : row.desktopStatus

export function HudParityMatrixView({ rows, surface, language }: HudParityMatrixViewProps) {
  const copy = language === 'zh-CN'
    ? { item: '信息项', status: '状态', source: '来源', notes: '说明' }
    : { item: 'Item', status: 'Status', source: 'Source', notes: 'Notes' }

  return (
    <div className="hud-parity-table" role="table" aria-label="HUD parity matrix">
      <div className="hud-parity-table__row hud-parity-table__row--head" role="row">
        <span role="columnheader">{copy.item}</span>
        <span role="columnheader">{copy.status}</span>
        <span role="columnheader">{copy.source}</span>
        <span role="columnheader">{copy.notes}</span>
      </div>
      {rows.map((row) => {
        const definition = DISPLAY_ITEM_REGISTRY[row.item]
        const status = surfaceStatus(row, surface)
        return (
          <div className="hud-parity-table__row" role="row" key={`${surface}-${row.item}`}>
            <strong role="cell">{definition?.label ?? row.item}</strong>
            <span role="cell"><span className={`hud-parity-status hud-parity-status--${status}`}>{statusLabel(status, language)}</span></span>
            <span role="cell">{row.source}</span>
            <span role="cell">{row.notes}</span>
          </div>
        )
      })}
    </div>
  )
}
