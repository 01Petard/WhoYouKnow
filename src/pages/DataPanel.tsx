/**
 * [INPUT]: 依赖 ../components 的 Alert/BackupPanel/useToast；依赖 ../store/useStore 的 data/importPeople；依赖 ../util/backup 读取 CSV 文件；依赖 ../util/csv 的解析与导出；CSV 预览按表头匹配
 * [OUTPUT]: 导出 DataPanel 组件
 * [POS]: 并列展示备份恢复与 CSV 操作。CSV 导入先预览，再按姓名增量写入。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Alert } from '../components/Alert'
import { BackupPanel } from '../components/BackupPanel'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import { readTextFile } from '../util/backup'
import { parseCsv, parsePeopleRows, peopleCsv, templateCsv, downloadText, type CsvParseOutcome } from '../util/csv'

export function DataPanel() {
  const data = useStore((s) => s.data)
  const importPeople = useStore((s) => s.importPeople)
  const navigate = useNavigate()
  const toast = useToast()
  const csvInput = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  const [outcome, setOutcome] = useState<CsvParseOutcome | null>(null)
  const [csvFatal, setCsvFatal] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [importing, setImporting] = useState(false)
  const [showImportLoading, setShowImportLoading] = useState(false)
  const [showParseLoading, setShowParseLoading] = useState(false)

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
    downloadText('linkmap-people.csv', peopleCsv(data))
    toast.show('已导出人物 CSV')
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
    const saved = result ? await useStore.getState().storageSettled() : undefined
    setImporting(false)
    if (!result) {
      setCsvFatal(['当前有恢复操作正在进行，请稍后重试。'])
      return
    }
    if (!saved?.ok) {
      setOutcome(null)
      return
    }
    if (saved.kind === 'file' && !saved.notice) {
      toast.show(`成功新增 ${result.added} 人，增量更新 ${result.merged} 人${selfRows.length ? `，跳过本人 ${selfRows.length} 行` : ''}`)
    }
    navigate('/people')
  }

  return (
    <div className="settings-data-grid">
      <BackupPanel />
      <section className="settings-data-section" aria-labelledby="csv-settings-heading">
        <div className="settings-data-head">
          <span className="settings-data-icon"><FileSpreadsheet size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <div>
            <h2 id="csv-settings-heading">联系人表格</h2>
            <p className="hint">按姓名匹配联系人。与「我的信息」同名的行会跳过。</p>
          </div>
        </div>

        <div className="settings-data-row">
          <div className="settings-data-copy">
            <h3>导出联系人表格</h3>
            <p className="hint">可用 Excel 打开，适合查看或整理联系人。</p>
          </div>
          <div className="settings-data-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsvPeople}>
              <Download size={16} aria-hidden="true" /> 导出 CSV
            </button>
          </div>
        </div>

        <div className="settings-data-row">
          <div className="settings-data-copy">
            <h3>从表格导入</h3>
            <p className="hint">补充同名联系人的空白字段。多个标签或分组可用「|」分隔。</p>
            <button
              type="button"
              className="settings-template"
              onClick={() => downloadText('linkmap-import-template.csv', templateCsv())}
            >
              <Download size={13} aria-hidden="true" /> 下载模板
            </button>
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
          <div className="settings-preview settings-import-progress">
            <div>
              <p className="hint tabular" role="status">
                {progress.total >= 100
                  ? `正在解析第 ${progress.current} / ${progress.total} 行`
                  : '正在解析文件…'}
              </p>
              <progress
                aria-label="CSV 解析进度"
                max={progress.total || undefined}
                value={progress.total >= 100 ? progress.current : undefined}
              />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelled.current = true; setParsing(false) }}>
              取消
            </button>
          </div>
        )}

        {csvFatal.length > 0 && (
          <div className="settings-import-errors">
            <Alert tone="danger">
              <div>
                <strong>导入未执行，请修正后重试。</strong>
                <ul>
                  {csvFatal.slice(0, 20).map((message, index) => <li key={index}>{message}</li>)}
                  {csvFatal.length > 20 && <li>……另有 {csvFatal.length - 20} 条</li>}
                </ul>
              </div>
            </Alert>
          </div>
        )}

        {outcome && csvFatal.length === 0 && (
          <div className="settings-preview">
            <dl className="settings-import-totals">
              <div><dt>将新增</dt><dd className="tabular">{addedCount} 人</dd></div>
              <div><dt>增量更新</dt><dd className="tabular">{duplicateRows.length} 人</dd></div>
              <div><dt>格式错误</dt><dd className="tabular">{outcome.errors.length} 行</dd></div>
            </dl>
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
    </div>
  )
}
