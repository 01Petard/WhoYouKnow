/**
 * [INPUT]: 依赖 React 的焦点与状态钩子、lucide-react 的 ChevronDown 与 Check。
 * [OUTPUT]: 导出 Dropdown 和 QuickSelect。
 * [POS]: 统一筛选、表单和分类快捷入口的下拉交互。单选关闭，多选保留面板。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

interface DropdownProps<T extends string> {
  id?: string
  label: string
  display: string
  options: readonly { value: T; label: string; checked?: boolean }[]
  onSelect: (value: T) => void
  multiple?: boolean
  field?: boolean
}

export function Dropdown<T extends string>({
  id, label, display, options, onSelect, multiple = false, field = false,
}: DropdownProps<T>) {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  return (
    <div
      className={field ? 'quick-select dropdown-field' : 'quick-select'}
      ref={wrapRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={field ? 'input quick-select-btn' : 'quick-select-btn'}
        aria-label={label === display ? label : `${label}：${display}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          const rect = wrapRef.current?.getBoundingClientRect()
          if (!open && rect) {
            const spaceBelow = window.innerHeight - rect.bottom
            setDropUp(spaceBelow < 240 && rect.top > spaceBelow)
          }
          setOpen(!open)
        }}
      >
        <span>{display}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className={`quick-select-menu${dropUp ? ' quick-select-menu-up' : ''}`} role="group" aria-label={label}>
          {options.map(({ value, label: optionLabel, checked }) => (
            <button
              key={value}
              type="button"
              aria-pressed={checked}
              className="quick-select-option"
              onClick={() => {
                if (!multiple) {
                  setOpen(false)
                  triggerRef.current?.focus()
                }
                onSelect(value)
              }}
            >
              <span>{optionLabel}</span>
              {checked && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          {options.length === 0 && <p className="hint">暂无可选项</p>}
        </div>
      )}
    </div>
  )
}

export function QuickSelect({ label, options, onSelect }: {
  label: string
  options: string[]
  onSelect: (value: string) => void
}) {
  return <Dropdown label={label} display={label} options={options.map((value) => ({ value, label: value }))} onSelect={onSelect} />
}
