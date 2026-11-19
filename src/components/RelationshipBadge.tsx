/**
 * [INPUT]: 不依赖其它模块
 * [OUTPUT]: 导出 ImportantStar 组件
 * [POS]: 联系人卡片上的重要星标；当前用户已独立于 people，不再需要「我」徽章
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
export function ImportantStar({ active }: { active: boolean }) {
  return (
    <span className={active ? 'star' : 'star-off'} aria-label={active ? '重要' : undefined} title={active ? '重要' : undefined}>
      ★
    </span>
  )
}
