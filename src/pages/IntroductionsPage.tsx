/**
 * [INPUT]: 联系人档案、引荐记录与角色规则。保存复用状态仓库。
 * [OUTPUT]: 导出 IntroductionsPage。
 * [POS]: 提供引荐的录入、路径详情、对象关联和筛选。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import { DateField } from '../components/DateField'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { Introduction, IntroductionInput, IntroductionParty, IntroductionRole, IntroductionStatus, Person } from '../types'
import { today } from '../util/id'
import { introductionIssue, introductionPartyName, introductionRoles, introductionRoleLabels, introductionStatusLabels } from '../util/introductions'

const selfValue = 'self'
const unlistedValue = 'unlisted'
const contactValue = (id: string) => `contact:${id}`

function IntroductionEditor({ record, people, onClose, onSave }: {
  record?: Introduction
  people: Map<string, Person>
  onClose: () => void
  onSave: (input: IntroductionInput) => boolean
}) {
  const [selected, setSelected] = useState(() => Object.fromEntries(introductionRoles.map((role) => {
    const party = record?.parties[role]
    return [role, party?.kind === 'contact' ? contactValue(party.personId) : party?.kind ?? '']
  })) as Record<IntroductionRole, string>)
  const [name, setName] = useState(record?.parties.target.kind === 'unlisted' ? record.parties.target.name : '')
  const [date, setDate] = useState(record?.date ?? today())
  const [status, setStatus] = useState<IntroductionStatus>(record?.status ?? 'pending')
  const [reason, setReason] = useState(record?.reason ?? '')
  const [issue, setIssue] = useState('')
  const contacts = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  function submit(event: FormEvent) {
    event.preventDefault()
    const parties = {} as IntroductionInput['parties']
    for (const role of introductionRoles) {
      const value = selected[role]
      if (value === selfValue) parties[role] = { kind: 'self' }
      if (value === unlistedValue) parties[role] = { kind: 'unlisted', name: name.trim() }
      if (value.startsWith('contact:')) {
        const personId = value.slice('contact:'.length)
        const previous = record?.parties[role]
        const person = people.get(personId)
        if (person) parties[role] = { kind: 'contact', personId, name: person.name }
        else if (previous?.kind === 'contact' && previous.personId === personId) parties[role] = previous
      }
    }
    const input = { parties, date, reason, status }
    const error = introductionIssue(input)
    if (error) setIssue(error)
    else if (!onSave(input)) setIssue('无法保存这条引荐，请关闭表单后重试。')
  }

  return <Modal open title={record ? '编辑引荐' : '新建引荐'} onClose={onClose} footer={<>
    <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
    <button type="submit" form="introduction-editor" className="btn btn-primary">保存引荐</button>
  </>}>
    <form id="introduction-editor" className="experience-form" onSubmit={submit}>
      {introductionRoles.map((role) => {
        const previous = record?.parties[role]
        return <div className="field" key={role}>
          <label className="field-label" htmlFor={`intro-${role}`}>{introductionRoleLabels[role]}</label>
          <select className="input" id={`intro-${role}`} required value={selected[role]}
            onChange={(event) => { setSelected({ ...selected, [role]: event.target.value }); setIssue('') }}>
            <option value="">选择人物</option>
            <option value={selfValue}>我</option>
            {role === 'target' && <option value={unlistedValue}>暂存姓名</option>}
            {previous?.kind === 'contact' && !people.has(previous.personId) &&
              <option value={contactValue(previous.personId)}>{previous.name}（档案已移除）</option>}
            {contacts.map((person) => <option key={person.id} value={contactValue(person.id)}>
              {person.name}{person.groups.length ? ` · ${person.groups.join('、')}` : ''}
            </option>)}
          </select>
        </div>
      })}
      {selected.target === unlistedValue && <div className="field">
        <label className="field-label" htmlFor="intro-unlisted">对象姓名</label>
        <input id="intro-unlisted" type="text" required value={name} onChange={(event) => setName(event.target.value)} />
      </div>}
      <div className="field">
        <label className="field-label" htmlFor="intro-date">日期</label>
        <DateField id="intro-date" value={date} onChange={setDate} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="intro-status">进展</label>
        <select id="intro-status" className="input" value={status}
          onChange={(event) => setStatus(event.target.value as IntroductionStatus)}>
          {Object.entries(introductionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="intro-reason">缘由</label>
        <textarea id="intro-reason" rows={3} required value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      {issue && <p className="field-error" role="alert">{issue}</p>}
    </form>
  </Modal>
}

function PartyLabel({ party, people }: { party: IntroductionParty; people: Map<string, Person> }) {
  const name = introductionPartyName(party, people)
  if (party.kind === 'contact' && people.has(party.personId)) {
    return <Link className="text-link" to={`/person/${encodeURIComponent(party.personId)}`}>{name}</Link>
  }
  return <>{name}{party.kind !== 'self' && <span className="hint">（{party.kind === 'contact' ? '档案已移除' : '暂存姓名'}）</span>}</>
}

export function IntroductionsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((state) => state.data)
  const save = useStore((state) => state.saveIntroduction)
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState<IntroductionRole | ''>('')
  const [status, setStatus] = useState<IntroductionStatus | ''>('')
  const [search, setSearch] = useState('')
  const people = new Map(data.people.map((person) => [person.id, person]))
  const records = data.introductions ?? []
  const record = records.find((item) => item.id === id)
  const query = search.trim().toLocaleLowerCase()
  const visible = records.filter((item) => {
    if (status && item.status !== status) return false
    if (role && item.parties[role].kind !== 'self') return false
    const fields = [item.reason]
    for (const key of introductionRoles) {
      const party = item.parties[key]
      fields.push(introductionPartyName(party, people))
      if (party.kind === 'contact') fields.push(...(people.get(party.personId)?.tags ?? []))
    }
    return fields.some((field) => field.toLocaleLowerCase().includes(query))
  }).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))

  if (id && !record) return <div className="content">
    <EmptyState title="没有找到这条引荐" actionLabel="返回引荐" onAction={() => navigate('/introductions')} />
  </div>
  return <div className="content experiences-page">
    {record && <Link className="back-link" to="/introductions"><ArrowLeft size={16} aria-hidden="true" /> 引荐</Link>}
    <header className="page-header">
      <div>
        <h1 className="page-title">{record ? `认识${introductionPartyName(record.parties.target, people)}` : '引荐'}</h1>
        {record && <div className="experience-meta">
          <time dateTime={record.date}>{record.date}</time>
          <span>{introductionStatusLabels[record.status]}</span>
        </div>}
      </div>
      <button type="button" className={`btn ${record ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setEditing(true)}>
        {!record && <Plus size={16} aria-hidden="true" />}{record ? '编辑引荐' : '新建引荐'}
      </button>
    </header>
    {record ? <section className="card experience-detail" aria-label="引荐详情">
      <h2 className="section-title">引荐路径</h2>
      <dl className="introduction-path">
        {introductionRoles.map((key) => <div key={key}>
          <dt>{introductionRoleLabels[key]}</dt>
          <dd><PartyLabel party={record.parties[key]} people={people} /></dd>
        </div>)}
      </dl>
      <h2 className="section-title">缘由</h2>
      <p className="experience-note">{record.reason}</p>
      {record.parties.target.kind === 'unlisted' && <button type="button" className="btn btn-secondary"
        onClick={() => setEditing(true)}>关联对象档案</button>}
    </section> : <>
      <div className="introduction-filters">
        <input type="search" className="input" value={search} aria-label="搜索引荐" placeholder="搜索姓名、标签或缘由"
          onChange={(event) => setSearch(event.target.value)} />
        <select className="input" aria-label="按我的角色筛选" value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}>
          <option value="">我的角色不限</option>
          {introductionRoles.map((key) => <option key={key} value={key}>我是{introductionRoleLabels[key]}</option>)}
        </select>
        <select className="input" aria-label="按状态筛选" value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="">全部状态</option>
          {Object.entries(introductionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {visible.length ? <ol className="card experience-timeline">
        {visible.map((item) => <li key={item.id}>
          <Link to={`/introductions/${encodeURIComponent(item.id)}`}>
            <time dateTime={item.date}>{item.date}</time>
            <div>
              <strong>{introductionPartyName(item.parties.requester, people)}经{introductionPartyName(item.parties.introducer, people)}引荐认识{introductionPartyName(item.parties.target, people)}</strong>
              <p>{introductionStatusLabels[item.status]} · {item.reason}</p>
            </div>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </li>)}
      </ol> : <EmptyState title={query || role || status ? '没有匹配的引荐' : '还没有引荐记录'} />}
    </>}
    {editing && <IntroductionEditor record={record} people={people} onClose={() => setEditing(false)} onSave={(input) => {
      const savedId = save(input, record?.id)
      if (!savedId) return false
      setEditing(false)
      toast.showAfterFileSave('已保存引荐')
      if (!record) navigate(`/introductions/${encodeURIComponent(savedId)}`)
      return true
    }} />}
  </div>
}
