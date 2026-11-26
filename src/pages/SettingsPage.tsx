/**
 * [INPUT]: 依赖 react 的 useEffect/useState；依赖 lucide-react 的 Database/RefreshCw/Save；依赖 ../components 的 useToast；依赖 ../store/useStore 的 storageKind/storageSaving/storageSaveNow/storageReload；依赖 ../util/storage 的 DATA_FILE_PATH；依赖 ./DataPanel
 * [OUTPUT]: 导出 SettingsPage 组件
 * [POS]: 展示数据文件路径和状态。文件操作独立于 JSON 备份和 CSV 导入导出。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect, useState } from 'react'
import { Database, RefreshCw, Save } from 'lucide-react'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import { DATA_FILE_PATH } from '../util/storage'
import { DataPanel } from './DataPanel'

export function SettingsPage() {
  const storageKind = useStore((s) => s.storageKind)
  const storageSaving = useStore((s) => s.storageSaving)
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
    const result = await storageSaveNow()
    setBusy(false)
    if (result.ok && result.kind === 'file' && !result.notice) toast.show('已写入项目数据文件')
  }

  const reload = async () => {
    setBusy(true)
    const ok = await storageReload()
    setBusy(false)
    if (ok) toast.show('已重新读取项目数据文件')
  }

  return (
    <div className="content settings-page">
      <header className="page-header organize-heading">
        <h1 className="page-title">系统设置</h1>
      </header>

      <section className="card storage-panel" aria-labelledby="storage-heading">
        <header className="storage-panel-header">
          <span className="organize-section-icon"><Database size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <h2 className="section-title" id="storage-heading">数据文件</h2>
          <span className={`storage-panel-status${storageKind === 'file' && !storageSaving ? ' storage-panel-status-active' : ''}`}>
            <span className="storage-panel-dot" aria-hidden="true" />
            {storageSaving ? '保存中' : storageKind === 'file' ? '项目文件' : '浏览器回退'}
          </span>
        </header>
        <div className="storage-panel-body">
          <dl className="storage-panel-location">
            <dt className="hint">文件位置</dt>
            <dd><code>{dataFile}</code></dd>
          </dl>
          <div className="row-actions storage-panel-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={reload} disabled={busy || storageSaving}>
              <RefreshCw size={15} aria-hidden="true" /> 重新读取
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || storageSaving}>
              <Save size={15} aria-hidden="true" /> 立即保存
            </button>
          </div>
        </div>
      </section>

      <DataPanel />
    </div>
  )
}
