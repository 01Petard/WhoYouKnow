/**
 * [INPUT]: 依赖路由匹配、存储状态、品牌图标与联系人头像。
 * [OUTPUT]: 导出 Layout。
 * [POS]: 在桌面侧栏和移动端底部导航提供相同入口，并在页面上方显示保存状态。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookUser, ChevronRight, Folders, Network, Settings, UserRound } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Alert } from './Alert'
import { Logo } from './Logo'
import { Avatar } from './PersonCard'

const NAV = [
  { to: '/people', label: '人脉', Icon: BookUser },
  { to: '/network', label: '关系网', Icon: Network },
  { to: '/categories', label: '整理分类', Icon: Folders },
  { to: '/settings', label: '系统设置', Icon: Settings },
] as const

const PROFILE = { to: '/profile', label: '我的信息', Icon: UserRound } as const

function isSectionActive(pathname: string, to: string): boolean {
  if (to === '/people') return pathname === '/people' || pathname.startsWith('/person/')
  return pathname === to || pathname.startsWith(`${to}/`)
}

function parentOf(pathname: string): string | null {
  if (pathname.startsWith('/person/')) return '/people'
  if (pathname === '/profile/edit') return '/profile'
  if (pathname.startsWith('/categories/groups') || pathname.startsWith('/categories/circles')) return '/categories'
  return null
}

export function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const me = useStore((state) => state.data.me)
  const storageSaving = useStore((state) => state.storageSaving)
  const storageError = useStore((state) => state.storageError)
  const storageNotice = useStore((state) => state.storageNotice)
  const profileActive = isSectionActive(pathname, PROFILE.to)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const parent = parentOf(pathname)
      if (parent) navigate(parent)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate, pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <Link to="/people" className="brand" aria-label="WhoYouKnow 首页">
          <Logo size={38} />
          <span className="brand-name">WhoYouKnow</span>
        </Link>
        <nav className="sidebar-nav" aria-label="主导航">
          <div className="sidebar-links">
            {NAV.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                className="sidebar-item"
                aria-current={isSectionActive(pathname, to) ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
          <Link
            to={PROFILE.to}
            className="sidebar-profile"
            aria-label={PROFILE.label}
            aria-current={profileActive ? 'page' : undefined}
          >
            {me ? <Avatar person={me} small /> : <UserRound size={20} aria-hidden="true" />}
            <span className="sidebar-profile-copy">
              <strong>{me?.name ?? PROFILE.label}</strong>
              {me && <span>{PROFILE.label}</span>}
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </aside>

      <header className="mobile-bar">
        <Link to="/people" className="brand" aria-label="WhoYouKnow 首页">
          <Logo size={32} />
          <span className="brand-name">WhoYouKnow</span>
        </Link>
      </header>

      <main className="main-area" id="main-content" tabIndex={-1}>
        {(storageSaving || storageError || storageNotice) && (
          <div className="shell-notice">
            {storageSaving ? (
              <p className="hint" role="status">正在保存改动…</p>
            ) : (
              <Alert tone={storageError ? 'danger' : 'info'}>
                {storageNotice ?? '保存失败，数据仍在当前页面。'}
                {storageError && <> <Link to="/settings">前往系统设置重试</Link></>}
              </Alert>
            )}
          </div>
        )}
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="主导航">
        {[...NAV, PROFILE].map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="tabbar-item"
            aria-current={isSectionActive(pathname, to) ? 'page' : undefined}
          >
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
