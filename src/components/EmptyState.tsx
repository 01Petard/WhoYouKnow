/**
 * [INPUT]: 依赖 react 的 ReactNode；依赖 ../util/constants 的 COPY
 * [OUTPUT]: 导出 EmptyState 组件与 EmptyCopy 常量
 * [POS]: 空态展示的原子组件，内置手账线稿插画；各页面在无数据或筛选为空时复用它，只读不写入
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import type { ReactNode } from 'react'
import { COPY } from '../util/constants'

/** 安静的手账线稿：两三个抽象人形节点由细线相连，空心圆占位，无表情/吉祥物 */
function LineArt({ broken = false }: { broken?: boolean }) {
  return (
    <svg width="144" height="120" viewBox="0 0 144 120" fill="none" aria-hidden="true" focusable="false">
      {broken ? (
        <>
          <path d="M37 62 C46 55 54 47 60 41" stroke="var(--border-default)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M84 40 C92 45 100 53 105 61" stroke="var(--border-default)" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <path d="M37 62 C47 54 62 38 72 38 C82 38 97 54 105 62" stroke="var(--border-default)" strokeWidth="1.5" strokeLinecap="round" />
      )}
      <circle cx="28" cy="70" r="9" fill="var(--bg-subtle)" stroke="var(--border-default)" strokeWidth="1.5" />
      <path d="M14 97 C14 88 20 82 28 82 C36 82 42 88 42 97" stroke="var(--border-default)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="72" cy="28" r="9" fill="var(--color-action)" />
      <path d="M58 55 C58 46 64 40 72 40 C80 40 86 46 86 55" stroke="var(--color-action)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="114" cy="70" r="9" stroke="var(--border-default)" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M100 97 C100 88 106 82 114 82 C122 82 128 88 128 97" stroke="var(--border-default)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
    </svg>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  broken?: boolean
  children?: ReactNode
}

export function EmptyState({ title, description, actionLabel, onAction, broken, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <LineArt broken={broken} />
      <p className="empty-title">{title}</p>
      {description && <p className="empty-desc">{description}</p>}
      {(actionLabel || children) && (
        <div className="empty-action">
          {actionLabel && onAction ? (
            <button type="button" className="btn btn-primary" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {children}
        </div>
      )}
    </div>
  )
}

export const EmptyCopy = COPY
