/**
 * [INPUT]: 依赖 react 的 useEffect/useRef/useState；依赖 lucide-react 的 ChevronDown
 * [OUTPUT]: 导出 QuickSelect 组件
 * [POS]: 汇总卡里的方形快捷下拉；选择后立即执行动作并关闭，不保存选中态，替代原生 select
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface QuickSelectProps {
  label: string
  options: string[]
  onSelect: (value: string) => void
}

export function QuickSelect({ label, options, onSelect }: QuickSelectProps) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom
        setDropUp(spaceBelow < 240 && rect.top > spaceBelow)
      }
    }
    setOpen((current) => !current)
  }

  return (
    <div className="quick-select" ref={wrapRef}>
      <button
        type="button"
        className="quick-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className={`quick-select-menu${dropUp ? ' quick-select-menu-up' : ''}`} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              className="quick-select-option"
              onClick={() => {
                setOpen(false)
                onSelect(option)
              }}
            >
              {option}
            </button>
          ))}
          {options.length === 0 && <p className="hint">暂无可选项</p>}
        </div>
      )}
    </div>
  )
}
