/**
 * [INPUT]: 依赖浏览器 crypto.randomUUID，缺失时降级到 Math.random；不依赖业务模块
 * [OUTPUT]: 提供标识符生成、日历日期校验与间隔计算。
 * [POS]: 标识符与本地日历日期工具；store 创建人物、标签、分组、圈子时统一从这里取 id
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 校验本地日历日期的 YYYY-MM-DD 表示。 */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
}
