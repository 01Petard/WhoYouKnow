/**
 * [INPUT]: 依赖 react-router-dom 的 Routes/Route/Navigate；依赖 ./store/useStore 的 data/hydrated/hydrate；依赖 ./components/Layout 与 ./pages 下页面组件
 * [OUTPUT]: 默认导出 App，负责启动加载、当前用户门禁与全部路由的装配
 * [POS]: 路由表与 self 门禁的唯一来源；未选择当前用户时只渲染 SelfSetupPage，页面组件不自行注册路由
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/useStore'
import { Layout } from './components/Layout'
import { PeoplePage } from './pages/PeoplePage'
import { PersonFormPage } from './pages/PersonFormPage'
import { PersonDetailPage } from './pages/PersonDetailPage'
import { NetworkPage } from './pages/NetworkPage'
import { ProfilePage } from './pages/ProfilePage'
import { CategoriesPage } from './pages/CategoriesPage'
import { SettingsPage } from './pages/SettingsPage'
import { GroupPage } from './pages/GroupPage'
import { CircleDetailPage } from './pages/CircleDetailPage'
import { SelfSetupPage } from './pages/SelfSetupPage'

export default function App() {
  const data = useStore((s) => s.data)
  const hydrated = useStore((s) => s.hydrated)
  const hydrate = useStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <div className="boot-mark" aria-hidden="true" />
        <p>正在读取本机数据…</p>
      </div>
    )
  }

  if (!data.me) return <SelfSetupPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/people" replace />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/person/new" element={<PersonFormPage />} />
        <Route path="/person/:id" element={<PersonDetailPage />} />
        <Route path="/person/:id/edit" element={<PersonFormPage />} />

        <Route path="/network" element={<NetworkPage />} />

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<PersonFormPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/groups" element={<GroupPage />} />
        <Route path="/categories/circles/:id" element={<CircleDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/people" replace />} />
      </Route>
    </Routes>
  )
}
