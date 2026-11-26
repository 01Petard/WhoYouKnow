/**
 * [INPUT]: 依赖 React 子节点、Lucide 图标与共享空态文案
 * [OUTPUT]: 导出 EmptyState 组件与 EmptyCopy 常量
 * [POS]: 为无数据和无搜索结果提供统一的状态及后续操作
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { BookUser, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { COPY } from '../util/constants'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  broken?: boolean
  children?: ReactNode
}

export function EmptyState({ title, description, actionLabel, onAction, broken, children }: EmptyStateProps) {
  const Icon = broken ? SearchX : BookUser
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={24} strokeWidth={1.65} aria-hidden="true" /></span>
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
