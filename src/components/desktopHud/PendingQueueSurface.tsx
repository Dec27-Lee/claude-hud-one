import type { CurrentSessionState, PendingQueueChoice, PendingQueueItem } from '../../app/types'
import { workspaceLabel } from './sessionFormatters'
import type { DesktopHudLanguage } from './sessionFormatters'

export type PendingQueueSurfaceItem = PendingQueueItem & {
  displayKey: string
  sourceSession?: CurrentSessionState | null
}

type PendingQueueSurfaceProps = {
  items: PendingQueueSurfaceItem[]
  actionStatusByKey?: Record<string, string | null>
  queuePosition?: number
  queueTotal?: number
  language?: DesktopHudLanguage
  onOpenTerminal?: (item: PendingQueueSurfaceItem) => void
  onDismiss?: (item: PendingQueueSurfaceItem) => void
  onChoice?: (item: PendingQueueSurfaceItem, choice: PendingQueueChoice) => void
}

type ActionBarProps = {
  item: PendingQueueSurfaceItem
  statusText?: string | null
  queueLabel?: string | null
  language: DesktopHudLanguage
  onOpenTerminal?: (item: PendingQueueSurfaceItem) => void
  onDismiss?: (item: PendingQueueSurfaceItem) => void
  onChoice?: (item: PendingQueueSurfaceItem, choice: PendingQueueChoice) => void
}

type SafeToolDetail = {
  marker: string
  tone: 'bash' | 'edit' | 'write' | 'read' | 'search' | 'default'
  title: string
  detail: string
}

const pendingCopy = {
  en: {
    expires: 'expires',
    sourceOfTruth: 'Only hides this HUD reminder; Claude Code remains the source of truth.',
    unsafeAction: 'Real action requires the HookServer/IPC safety protocol.',
    deny: 'Deny',
    dismiss: 'Dismiss',
    allowOnce: 'Allow Once',
    always: 'Always',
    terminal: 'Terminal',
    skip: 'Skip',
    submit: 'Submit',
    other: 'Other',
    typeAnswer: 'Type answer in Claude Code…',
    questionFallback: 'Review this Claude Code question in the terminal.',
    approvalFallback: 'Claude Code is requesting attention. Review it in the terminal.',
    choiceAria: 'Available Claude Code choices',
    optionAria: 'Question options',
    toolAria: 'Sanitized tool detail',
    privacyNote: 'Sanitized pending item only. Tool input, command arguments, prompt, transcript and credentials are not stored.',
    questionPrivacyNote: 'Sanitized pending item only. User prompt, question text, transcript and credentials are not stored.',
  },
  'zh-CN': {
    expires: '到期',
    sourceOfTruth: '这里只会隐藏 HUD 提醒；Claude Code 终端仍是最终处理入口。',
    unsafeAction: '真实执行需要后续 HookServer/IPC 安全协议。',
    deny: '拒绝',
    dismiss: '关闭提醒',
    allowOnce: '允许一次',
    always: '始终允许',
    terminal: '终端',
    skip: '跳过',
    submit: '提交',
    other: '其他',
    typeAnswer: '请在 Claude Code 中输入回复…',
    questionFallback: '请到终端里查看并回复这条 Claude Code 提问。',
    approvalFallback: 'Claude Code 正在请求处理，请到终端里查看。',
    choiceAria: 'Claude Code 可选处理方式',
    optionAria: '问题选项',
    toolAria: '已脱敏的工具详情',
    privacyNote: '仅保存脱敏提醒；不会保存工具输入、命令参数、提示词、转录或凭据。',
    questionPrivacyNote: '仅保存脱敏提醒；不会保存用户提示、问题原文、转录或凭据。',
  },
} satisfies Record<DesktopHudLanguage, Record<string, string>>

const choiceLabel = (choice: PendingQueueChoice, language: DesktopHudLanguage): string => {
  if (language !== 'zh-CN') return choice.label
  const labels: Record<string, string> = {
    'Review in Claude Code': '在 Claude Code 中查看',
    'Dismiss HUD reminder': '关闭 HUD 提醒',
  }
  return labels[choice.label] ?? choice.label
}

const localizedSummary = (item: PendingQueueSurfaceItem, language: DesktopHudLanguage): string | null => {
  if (!item.summary) return null
  if (language !== 'zh-CN') return item.summary
  const summaries: Record<string, string> = {
    'Claude Code is requesting permission to run a tool. Review the request in the terminal.': 'Claude Code 正在请求运行工具，请在终端里查看这次请求。',
    'A Claude Code session is waiting for your response. Review it in the terminal.': '有一个 Claude Code 会话正在等待你的回复，请到终端里处理。',
    'Claude Code is requesting attention. Review it in the terminal.': 'Claude Code 需要你处理，请到终端里查看。',
  }
  return summaries[item.summary] ?? item.summary
}

const localizedTitle = (item: PendingQueueSurfaceItem, language: DesktopHudLanguage): string => {
  if (language !== 'zh-CN') return item.title
  if (item.kind === 'approval') return `需要授权：${item.toolName ?? '工具'}`
  if (item.title === 'Claude Code needs attention') return 'Claude Code 需要处理'
  return item.title
}

const localizedStatus = (statusText: string | null | undefined, language: DesktopHudLanguage): string | null => {
  if (!statusText || language !== 'zh-CN') return statusText ?? null
  if (/program not found/i.test(statusText)) return '未找到 Windows Terminal（wt.exe）。请安装 Windows Terminal，或把 wt.exe 加入 PATH。'
  if (/Opening Windows Terminal/i.test(statusText)) return '正在打开 Windows Terminal…'
  if (/Terminal jump is unavailable in browser preview/i.test(statusText)) return '浏览器预览中无法跳转终端。'
  if (/No linked Claude Code session/i.test(statusText)) return '没有关联的 Claude Code 会话。'
  return statusText
}

const expiryLabel = (iso: string | null | undefined, language: DesktopHudLanguage): string | null => {
  if (!iso) return null
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return null
  return `${pendingCopy[language].expires} ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const choiceKind = (choice: PendingQueueChoice): NonNullable<PendingQueueChoice['kind']> => choice.kind ?? 'dismiss'

const toolDetail = (item: PendingQueueSurfaceItem, language: DesktopHudLanguage): SafeToolDetail => {
  const zh = language === 'zh-CN'
  switch (item.toolName) {
    case 'Bash':
      return {
        marker: '$',
        tone: 'bash',
        title: zh ? '命令请求' : 'Command request',
        detail: zh ? '命令文本和参数保留在 Claude Code 中；请打开终端查看准确命令。' : 'Command text and arguments stay in Claude Code. Open terminal to review the exact command.',
      }
    case 'Edit':
    case 'MultiEdit':
      return {
        marker: item.toolName === 'Edit' ? '±' : '≡',
        tone: 'edit',
        title: zh ? '文件编辑请求' : 'File edit request',
        detail: zh ? 'HUD 不保存 diff 内容；允许前请在 Claude Code 中查看 old/new text。' : 'Diff content is redacted from the HUD. Review old/new text in Claude Code before allowing.',
      }
    case 'Write':
      return {
        marker: '+',
        tone: 'write',
        title: zh ? '文件写入请求' : 'File write request',
        detail: zh ? 'HUD 不保存文件内容预览；请在终端里核对目标和内容。' : 'File content preview is not stored in the HUD. Review the target and content in the terminal.',
      }
    case 'Read':
      return {
        marker: '↗',
        tone: 'read',
        title: zh ? '文件读取请求' : 'File read request',
        detail: zh ? '路径和行号参数保留在 Claude Code 中；HUD 只显示脱敏提醒。' : 'Path and line arguments are kept in Claude Code; this HUD only shows a sanitized reminder.',
      }
    case 'Grep':
    case 'Glob':
      return {
        marker: item.toolName === 'Grep' ? '/' : '*',
        tone: 'search',
        title: zh ? `${item.toolName} 搜索请求` : `${item.toolName} request`,
        detail: zh ? '搜索 pattern 和路径在这里已脱敏；请在 Claude Code 中查看。' : 'Search pattern and path details are redacted here. Review them in Claude Code.',
      }
    default:
      return {
        marker: '•',
        tone: 'default',
        title: zh ? `${item.toolName ?? '工具'} 请求` : `${item.toolName ?? 'Tool'} request`,
        detail: zh ? '工具输入已从 HUD 中脱敏；Claude Code 终端仍是最终信息源。' : 'Tool input is redacted from the HUD. Claude Code remains the source of truth.',
      }
  }
}

function ChoiceList({ item, language, onDismiss, onChoice }: {
  item: PendingQueueSurfaceItem
  language: DesktopHudLanguage
  onDismiss?: (item: PendingQueueSurfaceItem) => void
  onChoice?: (item: PendingQueueSurfaceItem, choice: PendingQueueChoice) => void
}) {
  const copy = pendingCopy[language]
  const choices = item.choices?.filter((choice) => choice.label.trim().length > 0 && choiceKind(choice) !== 'answer') ?? []
  if (choices.length === 0) return null

  return (
    <div className="codeisland-choice-list" aria-label={copy.choiceAria}>
      {choices.map((choice) => {
        const kind = choiceKind(choice)
        const safeLocalDismiss = kind === 'dismiss'
        return (
          <button
            className={`codeisland-choice codeisland-choice--${kind}`}
            type="button"
            key={choice.id}
            disabled={!safeLocalDismiss}
            title={safeLocalDismiss ? copy.sourceOfTruth : copy.unsafeAction}
            onClick={() => {
              onChoice?.(item, choice)
              if (safeLocalDismiss) onDismiss?.(item)
            }}
          >
            {choiceLabel(choice, language)}
          </button>
        )
      })}
    </div>
  )
}

function ApprovalToolDetailView({ item, language }: { item: PendingQueueSurfaceItem; language: DesktopHudLanguage }) {
  const detail = toolDetail(item, language)
  const context = item.cwdSlug ?? item.projectSlug ?? (item.sourceSession ? workspaceLabel(item.sourceSession) : null)
  const copy = pendingCopy[language]

  return (
    <div className={`codeisland-tool-detail codeisland-tool-detail--${detail.tone}`} aria-label={copy.toolAria}>
      <div className="codeisland-tool-detail__line">
        <span className="codeisland-tool-detail__marker">{detail.marker}</span>
        <strong>{detail.title}</strong>
      </div>
      <p>{localizedSummary(item, language) ?? detail.detail}</p>
      {context ? <span className="codeisland-tool-detail__path">{context}</span> : null}
      <em>{copy.privacyNote}</em>
    </div>
  )
}

function QuestionOptions({ item, language, onChoice }: {
  item: PendingQueueSurfaceItem
  language: DesktopHudLanguage
  onChoice?: (item: PendingQueueSurfaceItem, choice: PendingQueueChoice) => void
}) {
  const copy = pendingCopy[language]
  const answerChoices = item.choices?.filter((choice) => choice.label.trim().length > 0 && choiceKind(choice) === 'answer') ?? []
  if (answerChoices.length === 0) return null

  return (
    <div className="codeisland-question-options" aria-label={copy.optionAria}>
      {answerChoices.map((choice, index) => (
        <button
          className="codeisland-question-option"
          type="button"
          key={choice.id}
          disabled
          title={copy.unsafeAction}
          onClick={() => onChoice?.(item, choice)}
        >
          <span className="codeisland-question-option__arrow"> </span>
          <span className="codeisland-question-option__index">{index + 1}.</span>
          <span>{choiceLabel(choice, language)}</span>
        </button>
      ))}
      <button className="codeisland-question-option" type="button" disabled title={copy.unsafeAction}>
        <span className="codeisland-question-option__arrow"> </span>
        <span className="codeisland-question-option__index">…</span>
        <span>{copy.other}</span>
      </button>
    </div>
  )
}

function ApprovalBar({ item, statusText, queueLabel, language, onOpenTerminal, onDismiss, onChoice }: ActionBarProps) {
  const copy = pendingCopy[language]
  const terminalAvailable = Boolean(item.sourceSession?.terminal?.cwd ?? item.sourceSession?.projectDir)
  const tool = item.toolName ?? (language === 'zh-CN' ? '工具' : 'Tool')
  const project = item.sourceSession ? workspaceLabel(item.sourceSession) : item.projectSlug

  return (
    <article className="codeisland-action-bar codeisland-action-bar--approval" key={item.displayKey}>
      <header className="codeisland-action-bar__header" onClick={() => onOpenTerminal?.(item)}>
        <span className="codeisland-action-bar__mark">!</span>
        <strong>{tool}</strong>
        {project ? <span>{project}</span> : null}
        {queueLabel ? <span className="codeisland-action-bar__queue">{queueLabel}</span> : null}
        {expiryLabel(item.expiresAt, language) ? <em>{expiryLabel(item.expiresAt, language)}</em> : null}
      </header>
      <ApprovalToolDetailView item={item} language={language} />
      <ChoiceList item={item} language={language} onDismiss={onDismiss} onChoice={onChoice} />
      {localizedStatus(statusText, language) ? <span className="codeisland-action-bar__status">{localizedStatus(statusText, language)}</span> : null}
      <div className="codeisland-action-bar__buttons">
        <button className="pixel-button pixel-button--danger" type="button" disabled title={copy.unsafeAction}>{copy.deny}</button>
        <button className="pixel-button pixel-button--muted" type="button" onClick={() => onDismiss?.(item)}>{copy.dismiss}</button>
        <button className="pixel-button pixel-button--success" type="button" disabled title={copy.unsafeAction}>{copy.allowOnce}</button>
        <button className="pixel-button pixel-button--primary" type="button" disabled title={copy.unsafeAction}>{copy.always}</button>
        <button className="pixel-button pixel-button--muted" type="button" disabled={!terminalAvailable || !onOpenTerminal} onClick={() => onOpenTerminal?.(item)}>{copy.terminal}</button>
      </div>
    </article>
  )
}

function QuestionBar({ item, statusText, queueLabel, language, onOpenTerminal, onDismiss, onChoice }: ActionBarProps) {
  const copy = pendingCopy[language]
  const terminalAvailable = Boolean(item.sourceSession?.terminal?.cwd ?? item.sourceSession?.projectDir)
  const project = item.sourceSession ? workspaceLabel(item.sourceSession) : item.projectSlug
  const hasAnswerOptions = Boolean(item.choices?.some((choice) => choiceKind(choice) === 'answer'))

  return (
    <article className="codeisland-action-bar codeisland-action-bar--question" key={item.displayKey}>
      <header className="codeisland-action-bar__header">
        <span className="codeisland-action-bar__mark">?</span>
        <strong>{localizedTitle(item, language)}</strong>
        {project ? <span>{project}</span> : null}
        {queueLabel ? <span className="codeisland-action-bar__queue">{queueLabel}</span> : null}
        {expiryLabel(item.expiresAt, language) ? <em>{expiryLabel(item.expiresAt, language)}</em> : null}
      </header>
      <div className="codeisland-action-bar__question" onClick={() => onOpenTerminal?.(item)} role="button" tabIndex={0}>
        {localizedSummary(item, language) ?? copy.questionFallback}
      </div>
      <QuestionOptions item={item} language={language} onChoice={onChoice} />
      {!hasAnswerOptions ? (
        <div className="codeisland-action-bar__input" onClick={() => onOpenTerminal?.(item)} role="button" tabIndex={0}>
          <span>&gt;</span>
          <p>{copy.typeAnswer}</p>
        </div>
      ) : null}
      <ChoiceList item={item} language={language} onDismiss={onDismiss} onChoice={onChoice} />
      {localizedStatus(statusText, language) ? <span className="codeisland-action-bar__status">{localizedStatus(statusText, language)}</span> : null}
      <div className="codeisland-action-bar__buttons">
        <button className="pixel-button pixel-button--muted" type="button" onClick={() => onDismiss?.(item)}>{copy.skip}</button>
        <button className="pixel-button pixel-button--success" type="button" disabled title={copy.unsafeAction}>{copy.submit}</button>
        <button className="pixel-button pixel-button--muted" type="button" disabled={!terminalAvailable || !onOpenTerminal} onClick={() => onOpenTerminal?.(item)}>{copy.terminal}</button>
      </div>
    </article>
  )
}

export function PendingQueueSurface({ items, actionStatusByKey = {}, queuePosition = 1, queueTotal = items.length, language = 'en', onOpenTerminal, onDismiss, onChoice }: PendingQueueSurfaceProps) {
  if (items.length === 0) return null

  const queueLabel = queueTotal > 1 ? `${Math.min(queuePosition, queueTotal)}/${queueTotal}` : null
  const ariaLabel = language === 'zh-CN' ? 'Claude Code 授权或问题面板' : 'Claude Code approval or question surface'

  return (
    <div className="codeisland-action-surface" aria-label={ariaLabel}>
      {items.slice(0, 1).map((item) => item.kind === 'approval'
        ? <ApprovalBar item={item} statusText={actionStatusByKey[item.displayKey]} queueLabel={queueLabel} language={language} onOpenTerminal={onOpenTerminal} onDismiss={onDismiss} onChoice={onChoice} key={item.displayKey} />
        : <QuestionBar item={item} statusText={actionStatusByKey[item.displayKey]} queueLabel={queueLabel} language={language} onOpenTerminal={onOpenTerminal} onDismiss={onDismiss} onChoice={onChoice} key={item.displayKey} />)}
    </div>
  )
}
