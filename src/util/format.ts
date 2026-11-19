/**
 * [INPUT]: 不导入模块，仅使用原生 Date；接收各组件与页面传入的 ISO 时间串
 * [OUTPUT]: 导出 formatDate、relativeTime、initials
 * [POS]: 展示层的日期与首字母格式化工具；只被 components 与 pages 调用，不参与数据写入或校验
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function relativeTime(iso?: string): string {
  if (!iso) return '未核实'
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return '未核实'
  const diff = Date.now() - time
  if (diff < 0) return '刚刚'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 个月前`
  return `${Math.floor(months / 12)} 年前`
}

export function initials(name: string): string {
  return name.trim().slice(0, 1) || '?'
}
