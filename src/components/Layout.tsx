/**
 * [INPUT]: 依赖 react-router-dom 的 Link/Outlet/useLocation/useNavigate；依赖 lucide-react 图标；依赖 ../store/useStore 的 storageSaving/storageError/storageNotice；依赖 ./Alert 与 ./Logo
 * [OUTPUT]: 导出 Layout 组件
 * [POS]: 应用外壳与主导航（侧栏 + 底部 tabbar）的唯一实现；五项导航为人脉/关系网/我的信息/整理分类/系统设置
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FolderCog, Network, Settings, UserRound, Users } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Alert } from './Alert'
import { Logo } from './Logo'

const NAV = [
  { to: '/people', label: '人脉', Icon: Users },
  { to: '/network', label: '关系网', Icon: Network },
  { to: '/profile', label: '我的信息', Icon: UserRound },
  { to: '/categories', label: '整理分类', Icon: FolderCog },
  { to: '/settings', label: '系统设置', Icon: Settings },
] as const

function isSectionActive(pathname: string, to: string): boolean {
  if (to === '/people') return pathname.startsWith('/people') || pathname.startsWith('/person')
  return pathname.startsWith(to)
}

function parentOf(pathname: string): string | null {
  if (pathname.startsWith('/person')) return '/people'
  if (pathname.startsWith('/network/')) return '/network'
  if (pathname === '/profile/edit') return '/profile'
  if (pathname.startsWith('/categories/groups') || pathname.startsWith('/categories/circles')) return '/categories'
  return null
}

export function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const storageSaving = useStore((s) => s.storageSaving)
  const storageError = useStore((s) => s.storageError)
  const storageNotice = useStore((s) => s.storageNotice)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const parent = parentOf(window.location.pathname)
      if (parent) navigate(parent)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Logo size={28} /></span>
          <span className="brand-copy">
            <span className="brand-name">WhoYouKnow</span>
            <span className="brand-tagline">你的人脉</span>
          </span>
        </div>
        <nav className="sidebar-nav" aria-label="主导航">
          {NAV.map(({ to, label, Icon }) => {
            const active = isSectionActive(pathname, to)
            return (
              <Link
                key={to}
                to={to}
                className="sidebar-item"
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>
        <p className="sidebar-foot">Every connection counts.</p>
      </aside>

      <main className="main-area" id="main-content" tabIndex={-1}>
        {storageSaving && (
          <p className="hint" role="status" style={{ padding: 'var(--sp-2) var(--page-gutter) 0' }}>正在保存改动…</p>
        )}
        {(storageError || storageNotice) && (
          <div style={{ padding: 'var(--sp-4) var(--page-gutter) 0' }}>
            <Alert tone={storageError ? 'danger' : 'info'}>
              {storageNotice ?? '保存失败，数据仍在当前页面。'}
              {storageError && <> <Link to="/settings">前往系统设置重试</Link></>}
            </Alert>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="主导航">
        {NAV.map(({ to, label, Icon }) => {
          const active = isSectionActive(pathname, to)
          return (
            <Link
              key={to}
              to={to}
              className="tabbar-item"
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
