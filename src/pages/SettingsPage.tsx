/**
 * [INPUT]: 依赖 react 的 useEffect/useState；依赖 lucide-react 的 FileJson/RefreshCw/Save；依赖 ../components 的 Alert/useToast；依赖 ../store/useStore 的 storageKind/storageError/storageNotice/storageSaveNow/storageReload；依赖 ../util/storage 的 DATA_FILE_PATH；依赖 ./DataPanel
 * [OUTPUT]: 导出 SettingsPage 组件
 * [POS]: 「系统设置」页面；顶部数据文件状态卡 + JSON/CSV 文件导入导出；路由 /settings
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useEffect, useState } from 'react'
import { FileJson, RefreshCw, Save } from 'lucide-react'
import { Alert } from '../components/Alert'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import { DATA_FILE_PATH } from '../util/storage'
import { DataPanel } from './DataPanel'

export function SettingsPage() {
  const storageKind = useStore((s) => s.storageKind)
  const storageError = useStore((s) => s.storageError)
  const storageNotice = useStore((s) => s.storageNotice)
  const storageSaveNow = useStore((s) => s.storageSaveNow)
  const storageReload = useStore((s) => s.storageReload)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [dataFile, setDataFile] = useState(DATA_FILE_PATH)

  useEffect(() => {
    let active = true
    fetch('/api/config', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (active && typeof config?.dataFile === 'string') setDataFile(config.dataFile)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const save = async () => {
    setBusy(true)
    const ok = await storageSaveNow()
    setBusy(false)
    toast.show(ok ? '已写入项目数据文件' : '保存失败，请检查项目文件权限')
  }

  const reload = async () => {
    setBusy(true)
    const ok = await storageReload()
    setBusy(false)
    toast.show(ok ? '已重新读取项目数据文件' : '读取失败，数据文件不存在或格式错误')
  }

  return (
    <div className="content">
      <div className="page-header">
        <h1 className="page-title">系统设置</h1>
        <span className="page-count">数据与文件</span>
      </div>

      <section className="settings-hero">
        <div className="settings-hero-icon"><FileJson size={24} aria-hidden="true" /></div>
        <div className="settings-hero-body">
          <div className="settings-hero-title">
            <h2>数据文件</h2>
            <code className="settings-path">{dataFile}</code>
          </div>
          <p className="hint">所有改动会自动写入这个文件；使用 JSON / CSV 文件进行备份与迁移。</p>
          {storageNotice && <p className="hint">{storageNotice}</p>}
        </div>
        <div className="settings-hero-side">
          <span className={`settings-status${storageKind === 'file' ? ' settings-status-active' : ''}`}>
            <i className="settings-dot" aria-hidden="true" />
            {storageKind === 'file' ? '项目文件' : '浏览器回退'}
          </span>
          <div className="row-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={reload} disabled={busy}>
              <RefreshCw size={15} aria-hidden="true" /> 重新读取
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              <Save size={15} aria-hidden="true" /> 立即保存
            </button>
          </div>
        </div>
      </section>

      {storageError && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="danger">保存失败，数据未能写入项目文件。请检查文件权限或运行环境。</Alert>
        </div>
      )}

      <DataPanel />
    </div>
  )
}
