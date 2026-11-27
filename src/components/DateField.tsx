/**
 * [INPUT]: 依赖 React 的状态与焦点钩子，以及本地日期校验。
 * [OUTPUT]: 导出 DateField。
 * [POS]: 日期字段支持手输和站内月历。可限制最晚日期。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { isDateOnly, today } from '../util/id'

export function DateField({ id, value, max, onChange, invalid, describedBy }: {
  id: string
  value: string
  max?: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  const panelId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [month, setMonth] = useState('')
  const start = new Date(`${month || today().slice(0, 7)}-01T00:00:00Z`)
  const previous = new Date(start)
  previous.setUTCMonth(start.getUTCMonth() - 1)
  const next = new Date(start)
  next.setUTCMonth(start.getUTCMonth() + 1)

  const close = () => {
    setMonth('')
    trigger.current?.focus()
  }

  return (
    <div onKeyDown={(event) => {
      if (event.key === 'Escape' && month) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }}>
      <div className="date-field-input">
        <input id={id} type="text" value={value} onChange={(event) => onChange(event.target.value)}
          placeholder="YYYY-MM-DD" aria-invalid={invalid} aria-describedby={describedBy} />
        <button ref={trigger} type="button" className="btn btn-secondary" aria-label="选择日期"
          aria-expanded={Boolean(month)} aria-controls={month ? panelId : undefined}
          onClick={() => setMonth(month ? '' : (isDateOnly(value) ? value : today()).slice(0, 7))}>
          <CalendarDays size={18} aria-hidden="true" />
        </button>
      </div>
      {month && (
        <div className="date-field-calendar" id={panelId} role="group" aria-label="日期选择">
          <div className="date-field-month">
            <button type="button" className="btn-icon" aria-label="上个月" disabled={previous.getUTCFullYear() < 1}
              onClick={() => setMonth(previous.toISOString().slice(0, 7))}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span aria-live="polite">{start.getUTCFullYear()} 年 {start.getUTCMonth() + 1} 月</span>
            <button type="button" className="btn-icon" aria-label="下个月"
              disabled={next.getUTCFullYear() > 9999 || Boolean(max && month >= max.slice(0, 7))}
              onClick={() => setMonth(next.toISOString().slice(0, 7))}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="date-field-days">
            {[...'一二三四五六日'].map((day) => <span key={day} aria-hidden="true">{day}</span>)}
            {Array.from({ length: (start.getUTCDay() + 6) % 7 }, (_, index) => <span key={index} />)}
            {Array.from({ length: new Date(next.getTime() - 86400000).getUTCDate() }, (_, index) => {
              const day = index + 1
              const date = `${month}-${String(day).padStart(2, '0')}`
              return (
                <button key={date} type="button" disabled={Boolean(max && date > max)}
                  aria-label={date} aria-pressed={date === value}
                  onClick={() => { onChange(date); close() }}>{day}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
