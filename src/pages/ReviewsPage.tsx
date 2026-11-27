/**
 * [INPUT]: 读取业务快照，使用年份统计、来源解析和 Markdown 导出规则。
 * [OUTPUT]: 导出 ReviewsPage。
 * [POS]: 展示年度联系来源、重新联系与可保存的回顾选编。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, FileText, Plus } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { AppData, ReviewSelection, ReviewSource } from '../types'
import { downloadText } from '../util/csv'
import { today } from '../util/id'
import { reconnectGap, reviewMarkdown, reviewSourceId, reviewSources, summarizeYear } from '../util/reviews'

const sourceTabs = ['people', 'journal', 'events', 'reconnected'] as const
type SourceTab = typeof sourceTabs[number]

function ReviewWorkspace({ data, year }: { data: AppData; year: string }) {
  const toast = useToast()
  const saveReview = useStore((state) => state.saveReview)
  const stored = data.reviews?.find((item) => item.id === year)
  const defaultTitle = `${year} 年关系回顾`
  const [title, setTitle] = useState(stored?.title ?? defaultTitle)
  const [selections, setSelections] = useState(stored?.selections ?? [])
  const [tab, setTab] = useState<SourceTab>('journal')
  const [preview, setPreview] = useState(false)
  const [issue, setIssue] = useState('')
  const stats = summarizeYear(data, year)
  const resolve = reviewSources(data)
  const selected = new Set(selections.map((item) => item.id))
  const sources: { source: ReviewSource; gap?: number }[] =
    tab === 'events' ? stats.events.map((item) => ({ source: { kind: 'experience', entryId: item.id } }))
      : tab === 'reconnected' ? stats.reconnected.map(({ person, entry, gap }) => ({
        source: { kind: 'journal', personId: person.id, entryId: entry.id }, gap,
      })) : stats.journal.map(({ person, entry }) => ({ source: { kind: 'journal', personId: person.id, entryId: entry.id } }))
  const titles = [
    ['有手记的联系人', stats.people.length],
    ['联系手记', stats.journal.length],
    ['共同经历', stats.events.length],
    ['重新联系', stats.reconnected.length],
  ] as const
  const markdown = reviewMarkdown({ id: year, title: title.trim() || defaultTitle, selections, updatedAt: '' }, resolve)

  function add(source: ReviewSource) {
    const id = reviewSourceId(source)
    setSelections((items) => items.some((item) => item.id === id) ? items
      : [...items, { id, source, comment: '', includeOriginal: false, updatedAt: new Date().toISOString() }])
  }

  function editChoice(selection: ReviewSelection, patch: Partial<Pick<ReviewSelection, 'comment' | 'includeOriginal'>>) {
    setSelections((items) => items.map((item) => item.id === selection.id
      ? { ...item, ...patch, updatedAt: new Date().toISOString() }
      : item))
  }

  return <>
    <div className="review-stats" aria-label="年度统计">
      {sourceTabs.map((key, index) => <button key={key} type="button" className="card review-stat" aria-pressed={tab === key}
        onClick={() => setTab(key)}><strong>{titles[index][1]}</strong><span>{titles[index][0]}</span></button>)}
    </div>
    <div className="review-workspace">
      <section className="card review-panel" aria-labelledby="review-sources">
        <header><h2 id="review-sources" className="section-title">{titles[sourceTabs.indexOf(tab)][0]}</h2></header>
        {tab === 'reconnected' && <p className="hint">同一联系人的相邻两条手记至少相隔 {reconnectGap} 天，且后一条在该年份。</p>}
        {tab === 'people' ? (stats.people.length ? <ul>
          {stats.people.map((person) => <li key={person.id}>
            <Link className="workspace-record-link" to={`/person/${encodeURIComponent(person.id)}#contact-history`}>{person.name}</Link>
            <span className="hint">{stats.journal.filter((item) => item.person.id === person.id).length} 条手记</span>
          </li>)}
        </ul> : <p className="hint">该年暂无有手记的联系人。</p>) : sources.length ? <ul>
          {sources.map(({ source, gap }) => {
            const resolved = resolve(source)
            if (!resolved) return null
            const isSelected = selected.has(reviewSourceId(source))
            return <li key={reviewSourceId(source)}>
              <div>
                <Link className="workspace-record-link" to={resolved.href}>{resolved.title}</Link>
                <p className="hint"><time dateTime={resolved.date}>{resolved.date}</time>{gap && ` · 相隔 ${gap} 天`}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" disabled={isSelected} onClick={() => add(source)}>
                {!isSelected && <Plus size={14} aria-hidden="true" />}{isSelected ? '已选入' : '选入回顾'}
              </button>
            </li>
          })}
        </ul> : <p className="hint">这个年份暂无此类记录。</p>}
      </section>
      <section className="card review-panel review-selection" aria-labelledby="review-selection">
        <header><h2 id="review-selection" className="section-title">回顾选编</h2></header>
        <div className="field">
          <label className="field-label" htmlFor="review-title">回顾标题</label>
          <input type="text" id="review-title" value={title} aria-invalid={Boolean(issue)}
            onChange={(event) => { setTitle(event.target.value); setIssue('') }} />
          {issue && <p className="field-error" role="alert">{issue}</p>}
        </div>
        {selections.length ? <ol className="review-choices">{selections.map((selection, index) => {
          const source = resolve(selection.source)
          return <li key={selection.id}>
            <div className="review-choice-heading">
              <div>
                {source ? <Link className="workspace-record-link" to={source.href}>{source.title}</Link> : <strong>来源已移除</strong>}
                {source && <p className="hint"><time dateTime={source.date}>{source.date}</time></p>}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelections((items) => items.filter((item) => item.id !== selection.id))}>移出</button>
            </div>
            <div className="field"><label className="field-label" htmlFor={`review-comment-${index}`}>短评 {index + 1}</label>
              <textarea rows={2} id={`review-comment-${index}`} value={selection.comment}
                onChange={(event) => editChoice(selection, { comment: event.target.value })} /></div>
            {selection.source.kind === 'journal' && source?.note && <label className="review-original">
              <input type="checkbox" checked={selection.includeOriginal}
                onChange={(event) => editChoice(selection, { includeOriginal: event.target.checked })} /> 导出时包含此条手记正文
            </label>}
          </li>
        })}</ol> : <EmptyState title="还未选入记录" description="从年度来源列表选择要写入回顾的手记或经历。" />}
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => {
            if (!title.trim()) { setIssue('请填写标题。'); return }
            if (saveReview({ id: year, title, selections })) toast.showAfterFileSave('已保存年度回顾')
            else toast.show('保存失败，请重试')
          }}>保存回顾</button>
          <button type="button" className="btn btn-secondary" onClick={() => setPreview(true)} disabled={!selections.length}>
            <FileText size={16} aria-hidden="true" /> 预览导出
          </button>
        </div>
      </section>
    </div>
    <Modal open={preview} title="Markdown 导出预览" onClose={() => setPreview(false)} wide footer={<>
      <button type="button" className="btn btn-ghost" onClick={() => setPreview(false)}>返回选编</button>
      <button type="button" className="btn btn-primary"
        onClick={() => downloadText(`关系回顾-${year}.md`, markdown, 'text/markdown;charset=utf-8')}>
        <Download size={16} aria-hidden="true" /> 下载 Markdown
      </button>
    </>}>
      <pre className="review-preview">{markdown}</pre>
    </Modal>
  </>
}

export function ReviewsPage() {
  const data = useStore((state) => state.data)
  const [params, setParams] = useSearchParams()
  const currentYear = today().slice(0, 4)
  const years = [...new Set([
    currentYear,
    ...data.people.flatMap((person) => (person.contactHistory ?? []).map((entry) => entry.date.slice(0, 4))),
    ...(data.experiences ?? []).map((item) => item.date.slice(0, 4)),
    ...(data.reviews ?? []).map((item) => item.id),
  ])].sort((a, b) => b.localeCompare(a))
  const year = years.find((item) => item === params.get('year')) ?? currentYear
  return <div className="content experiences-page">
    <header className="page-header">
      <h1 className="page-title">关系回顾</h1>
      <select className="input review-year" aria-label="回顾年份" value={year}
        onChange={(event) => setParams({ year: event.target.value })}>
        {years.map((value) => <option key={value} value={value}>{value} 年</option>)}
      </select>
    </header>
    <ReviewWorkspace key={year} data={data} year={year} />
  </div>
}
