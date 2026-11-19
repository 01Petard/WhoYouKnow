/**
 * [INPUT]: 依赖 ../components 的 Alert/ConfirmDialog/useToast；依赖 ../store/useStore 的 data/importPeople/restoreData；依赖 ../util/backup 的校验与读取；依赖 ../util/csv 的解析与导出；依赖 ../util/constants/format
 * [OUTPUT]: 导出 DataPanel 组件
 * [POS]: 系统设置中的 JSON/CSV 文件面板；同名增量更新、与「我的信息」同名行自动跳过、JSON 整体恢复
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react'
import { Alert } from '../components/Alert'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import { DATA_VERSION } from '../util/constants'
import { makeBackup, readJsonFile, readTextFile, validateBackup, type ValidationResult } from '../util/backup'
import { parseCsv, parsePeopleRows, peopleCsv, templateCsv, downloadText, type CsvParseOutcome } from '../util/csv'
import { formatDate } from '../util/format'
import { COPY } from '../util/constants'

export function DataPanel() {
  const data = useStore((s) => s.data)
  const importPeople = useStore((s) => s.importPeople)
  const restoreData = useStore((s) => s.restoreData)
  const navigate = useNavigate()
  const toast = useToast()
  const csvInput = useRef<HTMLInputElement>(null)
  const jsonInput = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  const [outcome, setOutcome] = useState<CsvParseOutcome | null>(null)
  const [csvFatal, setCsvFatal] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [importing, setImporting] = useState(false)
  const [showImportLoading, setShowImportLoading] = useState(false)
  const [showParseLoading, setShowParseLoading] = useState(false)

  const [backup, setBackup] = useState<Extract<ValidationResult, { ok: true }> | null>(null)
  const [restoreError, setRestoreError] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (!importing) { setShowImportLoading(false); return }
    const timer = window.setTimeout(() => setShowImportLoading(true), 300)
    return () => window.clearTimeout(timer)
  }, [importing])

  useEffect(() => {
    if (!parsing) { setShowParseLoading(false); return }
    const timer = window.setTimeout(() => setShowParseLoading(true), 300)
    return () => window.clearTimeout(timer)
  }, [parsing])

  const exportCsvPeople = () => {
    toast.show('正在生成文件…')
    downloadText('linkmap-people.csv', peopleCsv(data))
    toast.show('已导出人物 CSV')
  }

  const exportJson = () => {
    toast.show('正在生成文件…')
    downloadText('linkmap-backup.json', JSON.stringify(makeBackup(data), null, 2), 'application/json;charset=utf-8')
    toast.show('已导出 JSON 完整备份')
  }

  const handleCsvFile = async (file?: File) => {
    if (!file) return
    cancelled.current = false
    setCsvFatal([])
    setOutcome(null)
    setProgress({ current: 0, total: 0 })
    setParsing(true)
    try {
      const text = await readTextFile(file)
      const rows = parseCsv(text)
      for (let i = 0; i < rows.length; i += 50) {
        if (cancelled.current) return
        setProgress({ current: Math.min(i + 50, rows.length), total: rows.length })
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      }
      if (cancelled.current) return
      const result = parsePeopleRows(rows, data.people)
      setOutcome(result)
      if (result.errors.length) {
        setCsvFatal(result.errors.map((e) => `第 ${e.row} 行：${e.reason}`))
      }
    } catch (error) {
      setCsvFatal([error instanceof Error ? error.message : '文件读取失败'])
    } finally {
      setParsing(false)
    }
  }

  const selfName = data.me?.name.trim() ?? ''
  const allRows = outcome?.rows ?? []
  const selfRows = selfName ? allRows.filter((row) => row.name.trim() === selfName) : []
  const importable = selfName ? allRows.filter((row) => row.name.trim() !== selfName) : allRows
  const willImport = importable
  const duplicateRows = willImport.filter((row) => row.duplicateWith)
  const duplicateNames = [...new Set(duplicateRows.map((row) => row.name))]
  const addedCount = willImport.length - duplicateRows.length
  const existingGroups = new Set(data.groups)
  const newGroups = [...new Set(willImport.flatMap((row) => row.groups))].filter((group) => !existingGroups.has(group))

  const doImport = async () => {
    if (!outcome || importing) return
    setImporting(true)
    setCsvFatal([])
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    const result = importPeople(importable)
    setImporting(false)
    if (!result) {
      setCsvFatal(['写入失败，已整体回滚，原有数据未改变。请检查项目文件权限后重试。'])
      return
    }
    toast.show(
      `成功新增 ${result.added} 人，增量更新 ${result.merged} 人${selfRows.length ? `，跳过本人 ${selfRows.length} 行` : ''}`,
    )
    navigate('/people')
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

  const doRestore = () => {
    if (!backup) return
    setRestoring(true)
    const ok = restoreData(backup.data)
    setRestoring(false)
    setConfirmRestore(false)
    if (!ok) {
      setRestoreError('恢复失败，已整体回滚，原有数据未改变。请检查项目文件权限后重试。')
      return
    }
    toast.show(`已恢复 ${backup.data.people.length} 位联系人`)
    navigate('/people')
  }

  return (
    <>
      <section className="settings-data-section">
        <div className="settings-data-head">
          <span className="settings-data-icon"><FileJson size={20} aria-hidden="true" /></span>
          <div>
            <h2>备份与恢复</h2>
            <p className="hint">完整备份包含联系人、我的信息、分组、圈子与标签；恢复会整体替换当前数据。</p>
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

        <div className="settings-data-row">
          <div className="settings-data-copy">
            <h3>从 JSON 恢复</h3>
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
              aria-label="选择 JSON 备份文件"
              onChange={(e) => { void handleJsonFile(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>
        </div>

        {restoreError && <Alert tone="danger">{restoreError}</Alert>}

        {backup && (
          <div className="settings-preview">
            <p className="tabular">备份日期：{backup.exportedAt ? formatDate(backup.exportedAt) : '未提供'}</p>
            <p className="tabular" style={{ marginTop: 4 }}>
              {backup.data.people.length} 位联系人 · 版本 {backup.data.version}
            </p>
            <p className="hint" style={{ marginTop: 4 }}>校验结果：通过（当前应用版本 {DATA_VERSION}）</p>
            <div className="row-actions" style={{ marginTop: 'var(--sp-3)' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={exportJson}>先导出当前数据</button>
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmRestore(true)}>恢复并覆盖</button>
            </div>
          </div>
        )}
      </section>

      <section className="settings-data-section">
        <div className="settings-data-head">
          <span className="settings-data-icon"><FileSpreadsheet size={20} aria-hidden="true" /></span>
          <div>
            <h2>联系人信息</h2>
            <p className="hint">仅处理联系人字段；分组不存在时自动创建；与「我的信息」同名的行会自动跳过。</p>
          </div>
        </div>

        <div className="settings-data-row">
          <div className="settings-data-copy">
            <h3>导出联系人表格</h3>
            <p className="hint">UTF-8 BOM，可直接用 Excel 打开。</p>
          </div>
          <div className="settings-data-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsvPeople}>
              <Download size={16} aria-hidden="true" /> 导出 CSV
            </button>
          </div>
        </div>

        <div className="settings-data-row">
          <div className="settings-data-copy">
            <h3>下载表格模板</h3>
            <p className="hint">姓名必填；标签与分组可用「，」「|」「、」「；」分隔多个值。</p>
          </div>
          <div className="settings-data-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText('linkmap-import-template.csv', templateCsv())}>
              <Download size={16} aria-hidden="true" /> 下载模板
            </button>
          </div>
        </div>

        <div className="settings-data-row">
          <div className="settings-data-copy">
            <h3>从表格导入</h3>
            <p className="hint">同名联系人按姓名增量更新：只补充空白字段并合并标签/分组，不覆盖已有内容。</p>
          </div>
          <div className="settings-data-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => csvInput.current?.click()} disabled={parsing || importing}>
              <Upload size={16} aria-hidden="true" /> 选择 CSV
            </button>
            <input
              ref={csvInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="选择 CSV 文件"
              onChange={(e) => { void handleCsvFile(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>
        </div>

        {parsing && showParseLoading && (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <p className="hint tabular">
              {progress.total >= 100 && progress.total > 0
                ? `正在解析第 ${progress.current} / ${progress.total} 行`
                : '正在解析文件…'}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelled.current = true; setParsing(false) }}>
              取消
            </button>
          </div>
        )}

        {csvFatal.length > 0 && (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <Alert tone="danger">
              <div>
                <strong>导入未执行，请修正后重试。</strong>
                <ul style={{ marginTop: 6 }}>
                  {csvFatal.slice(0, 20).map((message, index) => <li key={index}>{message}</li>)}
                  {csvFatal.length > 20 && <li>……另有 {csvFatal.length - 20} 条</li>}
                </ul>
              </div>
            </Alert>
          </div>
        )}

        {outcome && csvFatal.length === 0 && (
          <div className="settings-preview">
            <p className="tabular">
              将新增 <strong>{addedCount}</strong> 人 · 增量更新 <strong>{duplicateRows.length}</strong> 人 · 格式错误{' '}
              <strong>{outcome.errors.length}</strong> 行
            </p>
            {selfRows.length > 0 && (
              <p className="hint" style={{ marginTop: 6 }}>
                已跳过与「我的信息」同名的 {selfRows.length} 行：
                {[...new Set(selfRows.map((row) => row.name))].slice(0, 8).join('、')}
              </p>
            )}
            {newGroups.length > 0 && (
              <p className="hint" style={{ marginTop: 6 }}>
                将自动新建 {newGroups.length} 个分组：{newGroups.slice(0, 8).join('、')}
                {newGroups.length > 8 ? ` 等 ${newGroups.length} 个` : ''}
              </p>
            )}
            {duplicateRows.length > 0 && (
              <>
                <div className="split-line" />
                <div className="panel-section-title">同名联系人将增量更新（已有信息不覆盖）</div>
                <p className="hint">
                  {duplicateNames.slice(0, 10).join('、')}
                  {duplicateNames.length > 10 ? ` 等 ${duplicateNames.length} 人` : ''}
                </p>
                <p className="field-hint">只补充空白字段，标签与分组取并集；已有信息不被覆盖。</p>
              </>
            )}
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 'var(--sp-3)' }} disabled={willImport.length === 0 || importing} onClick={doImport}>
              {showImportLoading ? '导入中…' : `导入 ${willImport.length} 人`}
            </button>
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
        onConfirm={doRestore}
      />
    </>
  )
}
