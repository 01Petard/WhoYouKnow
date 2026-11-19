/**
 * [INPUT]: 依赖 react 的 hooks/useId/ReactNode；依赖 react-dom 的 createPortal；依赖 lucide-react 的 X
 * [OUTPUT]: 导出 Modal 与 ConfirmDialog 组件
 * [POS]: 弹窗与确认框的唯一实现，负责 portal 挂载、焦点陷阱与 Esc 关闭；CircleEditor、TagsPage、PersonDetailPage 等复用
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE =
  'input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  role?: 'dialog' | 'alertdialog'
  showClose?: boolean
}

export function Modal({ open, onClose, title, children, footer, wide, role = 'dialog', showClose = true }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const returnRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    returnRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.getClientRects().length > 0,
      )
      if (nodes.length === 0) {
        event.preventDefault()
        return
      }
      const head = nodes[0]
      const tail = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault()
        tail.focus()
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault()
        head.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      returnRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current()
      }}
    >
      <div
        ref={panelRef}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          {showClose && (
            <button type="button" className="btn-icon" aria-label="关闭" onClick={closeRef.current}>
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  message: string
  warning?: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** 确认弹窗：role=alertdialog，危险后果用警示块，危险按钮文案明确 */
export function ConfirmDialog({
  open,
  title,
  message,
  warning,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      role="alertdialog"
      showClose={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
      {warning && (
        <div className="alert alert-danger" role="note" style={{ marginTop: 'var(--sp-3)' }}>
          {warning}
        </div>
      )}
    </Modal>
  )
}
