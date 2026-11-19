/**
 * [INPUT]: 依赖浏览器 crypto.randomUUID，缺失时降级到 Math.random；不依赖业务模块
 * [OUTPUT]: 导出 uid、today
 * [POS]: 标识符与日期来源；store 创建人物、标签、分组、圈子时统一从这里取 id
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
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
