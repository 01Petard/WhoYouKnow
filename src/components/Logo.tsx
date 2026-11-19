/**
 * [INPUT]: 不依赖其它模块
 * [OUTPUT]: 导出 Logo 组件
 * [POS]: WhoYouKnow 品牌标记的唯一内联实现；与 public/logo.svg 同构，用于侧栏与选择自己页
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="17" fill="#325B8F" />
      <g stroke="#FBFAF9" strokeWidth="2" strokeLinecap="round" opacity="0.58">
        <path d="M32 32 L32 13" />
        <path d="M32 32 L50 22" />
        <path d="M32 32 L50 45" />
        <path d="M32 32 L14 45" />
        <path d="M32 32 L14 22" />
      </g>
      <circle cx="32" cy="32" r="6" fill="#FBFAF9" />
      <circle cx="32" cy="13" r="3.6" fill="#FBFAF9" />
      <circle cx="50" cy="22" r="3.6" fill="#FBFAF9" />
      <circle cx="50" cy="45" r="3.6" fill="#FBFAF9" />
      <circle cx="14" cy="45" r="3.6" fill="#FBFAF9" />
      <circle cx="14" cy="22" r="3.6" fill="#FBFAF9" />
    </svg>
  )
}
