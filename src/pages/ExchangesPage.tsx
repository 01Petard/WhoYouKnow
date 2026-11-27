/**
 * [INPUT]: 读取联系人和往来记录。状态变更通过工作台仓库落盘。
 * [OUTPUT]: 导出 ExchangesPage。
 * [POS]: 分列待办、实际往来与取消历史，使用原编号完成待办。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import { DateField } from '../components/DateField'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { Exchange, ExchangeDirection, ExchangeInput, ExchangeKind, ExchangeStatus, Person } from '../types'
import { exchangeDirectionLabels, exchangeKindLabels, exchangeStatusLabels } from '../util/exchanges'
import { isDateOnly, today } from '../util/id'

function ExchangeEditor({ item, format, people, personFilter, onClose, onSave }: {
  item?: Exchange
  format: 'todo' | 'occurred' | 'finish'
  people: Map<string, Person>
  personFilter: string
  onClose: () => void
  onSave: (input: ExchangeInput) => boolean
}) {
  const [personId, setPersonId] = useState(item?.personId ?? personFilter)
  const [kind, setKind] = useState<ExchangeKind>(item?.kind ?? 'help')
  const [direction, setDirection] = useState<ExchangeDirection>(item?.direction ?? (format === 'todo' ? 'given' : 'received'))
  const [content, setContent] = useState(item?.content ?? '')
  const [date, setDate] = useState(format === 'todo' ? item?.plannedDate ?? '' : item?.phase.status === 'occurred' ? item.phase.date : today())
  const [issue, setIssue] = useState('')
  const actual = format !== 'todo'
  const title = format === 'finish' ? '确认完成' : item ? '编辑往来' : actual ? '记一条往来' : '添加待办'

  function submit(event: FormEvent) {
    event.preventDefault()
    const input = { personId, kind, direction, content: content.trim() }
    if (!input.personId || !input.content) { setIssue('请选择联系人并填写内容。'); return }
    if (actual && (!isDateOnly(date) || date > today())) { setIssue('请输入今天或更早的实际日期。'); return }
    if (!actual && date && !isDateOnly(date)) { setIssue('请输入有效的计划日期。'); return }
    const phase: ExchangeInput['phase'] = actual ? { status: 'occurred', date } : { status: 'todo' }
    if (!onSave({ ...input, plannedDate: actual ? item?.plannedDate ?? '' : date, phase })) {
      setIssue('无法保存，请重新打开此记录后重试。')
    }
  }
  return <Modal open title={title} onClose={onClose} footer={<>
    <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
    <button type="submit" form="exchange-editor" className="btn btn-primary">{format === 'finish' ? '确认完成' : '保存'}</button>
  </>}>
    <form id="exchange-editor" className="experience-form" onSubmit={submit}>
      {format !== 'finish' ? <>
        <div className="field">
          <label className="field-label" htmlFor="exchange-person">联系人</label>
          <select id="exchange-person" className="input" required value={personId}
            onChange={(event) => setPersonId(event.target.value)}>
            <option value="">选择联系人</option>
            {item && !people.has(item.personId) && <option value={item.personId}>{item.personName}（档案已移除）</option>}
            {[...people.values()].map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </div>
        <div className="exchange-form-options">
          <div className="field"><label className="field-label" htmlFor="exchange-kind">类别</label>
            <select className="input" id="exchange-kind" value={kind} onChange={(event) => setKind(event.target.value as ExchangeKind)}>
              {Object.entries(exchangeKindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="field"><label className="field-label" htmlFor="exchange-direction">方向</label>
            <select className="input" id="exchange-direction" value={direction} onChange={(event) => setDirection(event.target.value as ExchangeDirection)}>
              {Object.entries(exchangeDirectionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label className="field-label" htmlFor="exchange-content">内容</label>
          <textarea id="exchange-content" rows={3} value={content} required onChange={(event) => setContent(event.target.value)} />
        </div>
      </> : <p className="experience-note">{item?.content}</p>}
      <div className="field">
        <label className="field-label" htmlFor="exchange-date">{actual ? '实际日期' : '计划日期（可选）'}</label>
        <DateField id="exchange-date" value={date} max={actual ? today() : undefined}
          invalid={Boolean(issue && issue.includes('日期'))} onChange={(value) => { setDate(value); setIssue('') }} />
      </div>
      {issue && <p className="field-error" role="alert">{issue}</p>}
    </form>
  </Modal>
}

const tabs = ['todo', 'occurred', 'cancelled'] as const
const exchangeDate = (item: Exchange) => item.phase.status === 'occurred' ? item.phase.date : item.plannedDate

export function ExchangesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const data = useStore((state) => state.data)
  const save = useStore((state) => state.saveExchange)
  const remove = useStore((state) => state.deleteExchange)
  const [editing, setEditing] = useState<'todo' | 'occurred' | 'finish'>()
  const [deleting, setDeleting] = useState(false)
  const [kind, setKind] = useState('')
  const [direction, setDirection] = useState('')
  const tab = tabs.find((key) => key === params.get('status')) ?? 'todo'
  const personFilter = params.get('person') ?? ''
  const exchanges = data.exchanges ?? []
  const people = new Map(data.people.map((person) => [person.id, person]))
  const item = exchanges.find((record) => record.id === id)
  const contactList = new Map(exchanges.map((record) => [record.personId, record.personName]))
  for (const person of data.people) contactList.set(person.id, person.name)
  const visible = exchanges.filter((record) => record.phase.status === tab
    && (!personFilter || record.personId === personFilter)
    && (!kind || record.kind === kind)
    && (!direction || record.direction === direction)).sort((a, b) => {
    const dateA = exchangeDate(a)
    const dateB = exchangeDate(b)
    const order = tab === 'todo' ? (dateA || '9999').localeCompare(dateB || '9999') : dateB.localeCompare(dateA)
    return order || b.updatedAt.localeCompare(a.updatedAt)
  })

  function setFilter(nextTab: ExchangeStatus, nextPerson: string) {
    setParams({ status: nextTab, ...(nextPerson ? { person: nextPerson } : {}) })
  }

  function changePending(status: 'todo' | 'cancelled') {
    if (item && save({ ...item, phase: { status } }, item.id)) toast.showAfterFileSave(status === 'todo' ? '已重新打开待办' : '已取消待办')
    else toast.show('保存失败，请重试')
  }

  if (id && !item) return <div className="content">
    <EmptyState title="没有找到这条往来" actionLabel="返回礼尚往来" onAction={() => navigate('/exchanges')} />
  </div>
  const itemPerson = item ? people.get(item.personId) : undefined
  const back = `/exchanges?status=${item?.phase.status ?? 'todo'}${personFilter ? `&person=${encodeURIComponent(personFilter)}` : ''}`
  return <div className="content experiences-page">
    {item && <Link className="back-link" to={back}><ArrowLeft size={16} aria-hidden="true" /> 礼尚往来</Link>}
    <header className="page-header">
      <div><h1 className="page-title">{item ? exchangeKindLabels[item.kind] + '往来' : '礼尚往来'}</h1>
        {item && <p className="hint">{exchangeStatusLabels[item.phase.status]} · {exchangeDirectionLabels[item.direction]}</p>}
      </div>
      {!item ? <div className="row-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setEditing('occurred')}>记一条往来</button>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('todo')}><Plus size={16} aria-hidden="true" /> 添加待办</button>
      </div> : item.phase.status !== 'cancelled' && <button type="button" className="btn btn-secondary"
        onClick={() => setEditing(item.phase.status === 'todo' ? 'todo' : 'occurred')}>编辑往来</button>}
    </header>
    {item ? <>
      <section className="card experience-detail" aria-label="往来详情">
        <div className="experience-meta">
          {itemPerson ? <Link className="project-contact" to={`/person/${encodeURIComponent(item.personId)}`}>{itemPerson.name}</Link>
            : <span>{item.personName}（档案已移除）</span>}
          {exchangeDate(item) && <span>{item.phase.status === 'occurred' ? '实际日期' : '计划日期'} <time dateTime={exchangeDate(item)}>{exchangeDate(item)}</time></span>}
        </div>
        <p className="experience-note">{item.content}</p>
      </section>
      <div className="row-actions">
        {item.phase.status === 'todo' && <>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('finish')}>标记完成</button>
          <button type="button" className="btn btn-secondary" onClick={() => changePending('cancelled')}>取消待办</button>
        </>}
        {item.phase.status === 'cancelled' && <button type="button" className="btn btn-secondary" onClick={() => changePending('todo')}>重新打开待办</button>}
        {item.phase.status === 'occurred' && <button type="button" className="btn btn-ghost text-danger" onClick={() => setDeleting(true)}>删除往来</button>}
      </div>
      <ConfirmDialog open={deleting} title="删除往来" message="删除这条往来记录？此操作不可撤销。" destructive
        confirmLabel="删除往来" onClose={() => setDeleting(false)} onConfirm={() => {
          if (remove(item.id)) {
            toast.showAfterFileSave('已删除往来')
            navigate(back, { replace: true })
          } else toast.show('删除失败，请重试')
        }} />
    </> : <>
      <div className="row-actions project-status-filter" aria-label="往来状态">
        {tabs.map((key) => <button key={key} type="button" className={`btn ${key === tab ? 'btn-secondary' : 'btn-ghost'}`}
          aria-pressed={key === tab} onClick={() => setFilter(key, personFilter)}>{exchangeStatusLabels[key]}</button>)}
      </div>
      <div className="exchange-filters">
        <select className="input" aria-label="按联系人筛选" value={personFilter} onChange={(event) => setFilter(tab, event.target.value)}>
          <option value="">全部联系人</option>
          {[...contactList].map(([value, name]) => <option key={value} value={value}>{name}{!people.has(value) ? '（档案已移除）' : ''}</option>)}
        </select>
        <select className="input" aria-label="按往来类别筛选" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">全部类别</option>
          {Object.entries(exchangeKindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className="input" aria-label="按方向筛选" value={direction} onChange={(event) => setDirection(event.target.value)}>
          <option value="">全部方向</option>
          {Object.entries(exchangeDirectionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      {visible.length ? <ul className="card experience-timeline">
        {visible.map((record) => <li key={record.id}><Link to={`/exchanges/${encodeURIComponent(record.id)}${personFilter ? `?person=${encodeURIComponent(personFilter)}` : ''}`}>
          <time dateTime={exchangeDate(record) || undefined}>{exchangeDate(record) || '未定日期'}</time>
          <div><strong>{record.content}</strong>
            <p>{people.get(record.personId)?.name ?? `${record.personName}（档案已移除）`} · {exchangeDirectionLabels[record.direction]}{exchangeKindLabels[record.kind]}</p>
          </div>
          <ChevronRight size={18} aria-hidden="true" />
        </Link></li>)}
      </ul> : <EmptyState title="这个筛选下暂无往来" />}
    </>}
    {editing && <ExchangeEditor format={editing} item={item} people={people} personFilter={people.has(personFilter) ? personFilter : ''}
      onClose={() => setEditing(undefined)} onSave={(input) => {
        const saved = save(input, item?.id)
        if (!saved) return false
        setEditing(undefined)
        toast.showAfterFileSave(editing === 'finish' ? '已完成待办' : '已保存往来')
        if (!item) navigate(`/exchanges/${encodeURIComponent(saved)}${personFilter ? `?person=${encodeURIComponent(personFilter)}` : ''}`)
        return true
      }} />}
  </div>
}
