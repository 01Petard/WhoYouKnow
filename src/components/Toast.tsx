/**
 * [INPUT]: 依赖 react 的 createContext/useContext/hooks；依赖 lucide-react 的 CheckCircle2；依赖 store 的保存结果；依赖 ../util/constants 的 TOAST_MS/TOAST_UNDO_MS
 * [OUTPUT]: 导出 ToastProvider 与 useToast
 * [POS]: 全局轻提示上下文的唯一实现，支持操作反馈、保存成功提示与撤销；在 main.tsx 包裹应用，页面经 useToast 调用
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { TOAST_MS, TOAST_UNDO_MS } from '../util/constants'

interface ToastOptions {
  duration?: number
  undoLabel?: string
  onUndo?: () => void
}

interface ToastItem extends Required<Pick<ToastOptions, 'duration'>> {
  id: string
  message: string
  undoLabel?: string
  onUndo?: () => void
}

interface ToastApi {
  showAfterFileSave: (message: string) => void
  show: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const duration = options.duration ?? (options.onUndo ? TOAST_UNDO_MS : TOAST_MS)
      setItems((list) => [...list.slice(-2), { id, message, duration, undoLabel: options.undoLabel, onUndo: options.onUndo }])
      const timer = window.setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const showAfterFileSave = useCallback((message: string) => {
    void useStore.getState().storageSettled().then((result) => {
      if (result?.ok && result.kind === 'file' && !result.notice) show(message)
    })
  }, [show])

  const api = useMemo(() => ({ show, showAfterFileSave }), [show, showAfterFileSave])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div className="toast" key={item.id}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span className="toast-message">{item.message}</span>
            {item.onUndo && (
              <button
                type="button"
                className="toast-undo"
                onClick={() => {
                  item.onUndo?.()
                  dismiss(item.id)
                }}
              >
                {item.undoLabel ?? '撤销'}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}
