/**
 * [INPUT]: 依赖 react-router-dom 的 Routes/Route/Navigate；依赖 ./store/useStore 的 data/hydrated/hydrate；依赖 ./components/Layout 与 ./pages 下页面组件
 * [OUTPUT]: 默认导出 App，负责启动加载、当前用户门禁与全部路由的装配
 * [POS]: 装配人脉、联系手记等路由与启动恢复；连接恢复时触发同步，未保存时保护页面退出。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/useStore'
import { Layout, WorkspaceMenu } from './components/Layout'
import { ContactJournalPage } from './pages/ContactJournalPage'
import { ExperiencesPage } from './pages/ExperiencesPage'
import { IntroductionsPage } from './pages/IntroductionsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { CitiesPage } from './pages/CitiesPage'
import { ExchangesPage } from './pages/ExchangesPage'
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
    const reconnect = () => {
      const state = useStore.getState()
      if (state.hydrated && (state.storageKind === 'local' || state.storageError)) void state.storageSaveNow()
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = useStore.getState()
      if (!state.storageSaving && !state.storageError) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('online', reconnect)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('online', reconnect)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])

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
        <Route path="/journal" element={<ContactJournalPage />} />
        <Route path="/experiences" element={<ExperiencesPage key="list" />} />
        <Route path="/experiences/:id" element={<ExperiencesPage key="detail" />} />
        <Route path="/introductions" element={<IntroductionsPage key="list" />} />
        <Route path="/introductions/:id" element={<IntroductionsPage key="detail" />} />
        <Route path="/projects" element={<ProjectsPage key="list" />} />
        <Route path="/projects/:id" element={<ProjectsPage key="detail" />} />
        <Route path="/cities" element={<CitiesPage key="directory" />} />
        <Route path="/cities/trips/:id" element={<CitiesPage key="trip" />} />
        <Route path="/exchanges" element={<ExchangesPage key="list" />} />
        <Route path="/exchanges/:id" element={<ExchangesPage key="detail" />} />
        <Route path="/workspaces" element={<WorkspaceMenu />} />
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
