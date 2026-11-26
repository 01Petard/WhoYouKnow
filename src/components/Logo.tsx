/**
 * [INPUT]: 读取 public/logo.svg 的品牌图标。
 * [OUTPUT]: 导出 Logo。
 * [POS]: 应用导航、欢迎页与书签共用同一品牌图形。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
export function Logo({ size = 28 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="" aria-hidden="true" />
}
