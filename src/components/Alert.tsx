/**
 * [INPUT]: 依赖 lucide-react 的 AlertCircle/Info/TriangleAlert；依赖 react 的 ReactNode
 * [OUTPUT]: 导出 Alert 组件
 * [POS]: 全应用统一的提示条原子组件，按 tone 选择图标与 aria role；Layout、弹窗与各页面复用它，自身不持有状态
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { AlertCircle, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'info' | 'warning' | 'danger'

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const Icon = tone === 'danger' ? AlertCircle : tone === 'warning' ? TriangleAlert : Info
  return (
    <div className={`alert${tone === 'info' ? '' : ` alert-${tone}`}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon size={17} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
