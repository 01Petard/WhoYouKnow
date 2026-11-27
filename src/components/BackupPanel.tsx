/**
 * [INPUT]: 依赖 JSON 备份校验、存储恢复和确认对话框。
 * [OUTPUT]: 提供设置页和首次启动共用的备份恢复入口。
 * [POS]: 选择、预览和确认备份；持久化完成后才报告恢复结果。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileJson, Upload } from 'lucide-react'
import { Alert } from './Alert'
import { ConfirmDialog } from './Modal'
import { useToast } from './Toast'
import { useStore } from '../store/useStore'
import { makeBackup, readJsonFile, validateBackup, type ValidationResult } from '../util/backup'
import { DATA_VERSION, COPY } from '../util/constants'
import { downloadText } from '../util/csv'
import { formatDate } from '../util/format'

export function BackupPanel({ setup = false }: { setup?: boolean }) {
  const data = useStore((state) => state.data)
  const restoreData = useStore((state) => state.restoreData)
  const navigate = useNavigate()
  const toast = useToast()
  const jsonInput = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<Extract<ValidationResult, { ok: true }> | null>(null)
  const [restoreError, setRestoreError] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const exportJson = () => {
    downloadText('linkmap-backup.json', JSON.stringify(makeBackup(data), null, 2), 'application/json;charset=utf-8')
    toast.show('已导出 JSON 完整备份')
  }

  const handleJsonFile = async (file?: File) => {
    if (!file) return
    setBackup(null)
    setRestoreError('')
    try {
      const parsed = await readJsonFile(file)
      const checked = validateBackup(parsed)
      if (!checked.ok) {
        setRestoreError(checked.reason)
        return
      }
      setBackup(checked)
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : '文件读取失败')
    }
  }

  const doRestore = async () => {
    if (!backup || restoring) return
    setRestoring(true)
    setRestoreError('')
    const result = await restoreData(backup.data)
    setRestoring(false)
    if (!result?.ok) {
      setRestoreError(result?.notice ?? '恢复失败，请重试')
      return
    }
    setBackup(null)
    if (result.kind === 'file') toast.show(`已恢复 ${result.data.people.length} 位联系人`)
    if (result.data.me) navigate('/people', { replace: setup })
  }

  return (
    <>
      <section className={setup ? undefined : "settings-data-section"} aria-label="备份与恢复">
        {!setup && (
          <>
            <div className="settings-data-head">
              <span className="settings-data-icon"><FileJson size={20} aria-hidden="true" /></span>
              <div>
                <h2>备份与恢复</h2>
                <p className="hint">完整备份包含联系人、我的信息、分类和工作台记录。恢复会整体替换当前数据。</p>
              </div>
            </div>

            <div className="settings-data-row">
              <div className="settings-data-copy">
                <h3>导出 JSON 备份</h3>
                <p className="hint">下载 JSON 文件，可保存到任意位置，或迁移到其他设备。</p>
              </div>
              <div className="settings-data-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={exportJson}>
                  <Download size={16} aria-hidden="true" /> 导出 JSON
                </button>
              </div>
            </div>
          </>
        )}
        <div className="settings-data-row">
          <div className="settings-data-copy">
            {setup ? <h2>从备份恢复</h2> : <h3>从备份恢复</h3>}
            <p className="hint">先校验结构与版本，确认后覆盖当前数据。</p>
          </div>
          <div className="settings-data-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => jsonInput.current?.click()} disabled={restoring}>
              <Upload size={16} aria-hidden="true" /> 选择 JSON
            </button>
            <input
              ref={jsonInput}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="JSON 备份文件"
              onChange={(e) => { void handleJsonFile(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>
        </div>

        {restoring && <p className="hint" role="status">正在恢复备份…</p>}
        {restoreError && <Alert tone="danger">{restoreError}</Alert>}

        {backup && (
          <div className="settings-preview">
            <p className="tabular">备份日期：{backup.exportedAt ? formatDate(backup.exportedAt) : '未提供'}</p>
            <p className="tabular" style={{ marginTop: 4 }}>
              {backup.data.people.length} 位联系人 · 版本 {backup.data.version}
            </p>
            <p className="hint" style={{ marginTop: 4 }}>校验结果：通过（当前应用版本 {DATA_VERSION}）</p>
            <div className="row-actions" style={{ marginTop: 'var(--sp-3)' }}>
              {!setup && <button type="button" className="btn btn-secondary btn-sm" onClick={exportJson}>先导出当前数据</button>}
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmRestore(true)} disabled={restoring}>恢复并覆盖</button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmRestore}
        title="恢复备份"
        message={COPY.restoreDialog}
        warning="此操作将覆盖当前全部数据，且不可撤销。"
        confirmLabel="恢复并覆盖"
        destructive
        onClose={() => setConfirmRestore(false)}
        onConfirm={() => { void doRestore() }}
      />
    </>
  )
}
