/**
 * [INPUT]: 读取事件与联系人。通过状态仓库写入事件，复用日期字段与弹窗。
 * [OUTPUT]: 导出 ExperiencesPage。
 * [POS]: 显示事件时间线、事件详情及参与人编辑入口。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, MapPin, Plus } from 'lucide-react'
import { DateField } from '../components/DateField'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { Experience, ExperienceInput, Person } from '../types'
import { isDateOnly, today } from '../util/id'
import { newestExperiences } from '../util/experiences'

function ExperienceEditor({ item, people, onClose, onSave }: {
  item?: Experience
  people: Person[]
  onClose: () => void
  onSave: (input: ExperienceInput) => boolean
}) {
  const [draft, setDraft] = useState<ExperienceInput>(item ?? {
    title: '', date: today(), place: '', note: '', participantIds: [],
  })
  const [search, setSearch] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const selectedIds = draft.participantIds.filter((id) => peopleById.has(id))
  const matches = people.filter((person) => person.name.toLowerCase().includes(search.trim().toLowerCase()))
  const missingTitle = submitted && !draft.title.trim()
  const invalidDate = submitted && !isDateOnly(draft.date)
  const missingPeople = submitted && !item && selectedIds.length === 0

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!draft.title.trim() || !isDateOnly(draft.date) || (!item && selectedIds.length === 0)) return
    if (!onSave({ ...draft, participantIds: selectedIds })) setError('无法保存这条经历，请关闭表单后重试。')
  }

  return (
    <Modal open title={item ? '编辑经历' : '新建经历'} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
      <button type="submit" form="experience-editor" className="btn btn-primary">保存经历</button>
    </>}>
      <form id="experience-editor" className="experience-form" noValidate onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor="experience-title">标题</label>
          <input id="experience-title" type="text" value={draft.title} required aria-invalid={missingTitle}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          {missingTitle && <p className="field-error" role="alert">请填写标题。</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="experience-date">发生日期</label>
          <DateField id="experience-date" value={draft.date} invalid={invalidDate}
            describedBy={invalidDate ? 'experience-date-error' : undefined}
            onChange={(date) => setDraft({ ...draft, date })} />
          {invalidDate && <p id="experience-date-error" className="field-error" role="alert">请输入有效日期。</p>}
        </div>
        <fieldset className="experience-picker field">
          <legend className="field-label">参与人 <span className="hint">已选 {selectedIds.length} 人</span></legend>
          {selectedIds.length > 0 && <div className="tag-chips">
            {selectedIds.map((id) => <button key={id} type="button" className="tag-chip tag-chip-link"
              aria-label={`移除 ${peopleById.get(id)?.name}`}
              onClick={() => setDraft({ ...draft, participantIds: selectedIds.filter((value) => value !== id) })}>
              {peopleById.get(id)?.name} ×
            </button>)}
          </div>}
          <input type="search" className="input" aria-label="搜索参与人" placeholder="搜索联系人" value={search}
            onChange={(event) => setSearch(event.target.value)} />
          {matches.length ? <div className="experience-picker-options">
            {matches.map((person) => <label key={person.id}>
              <input type="checkbox" checked={selectedIds.includes(person.id)}
                onChange={(event) => setDraft({ ...draft, participantIds: event.target.checked
                  ? [...selectedIds, person.id]
                  : selectedIds.filter((id) => id !== person.id) })} />
              <span>{person.name}{person.groups.length > 0 && <small>{person.groups.join(' · ')}</small>}</span>
            </label>)}
          </div> : <p className="hint">{people.length ? '没有匹配的联系人' : '请先在人脉页添加联系人'}</p>}
          {missingPeople && <p className="field-error" role="alert">请选择至少一位联系人。</p>}
        </fieldset>
        <div className="field">
          <label className="field-label" htmlFor="experience-place">地点（可选）</label>
          <input id="experience-place" type="text" value={draft.place}
            onChange={(event) => setDraft({ ...draft, place: event.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="experience-note">备注（可选）</label>
          <textarea id="experience-note" rows={3} value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}

export function ExperiencesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((state) => state.data)
  const saveExperience = useStore((state) => state.saveExperience)
  const deleteExperience = useStore((state) => state.deleteExperience)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const peopleById = new Map(data.people.map((person) => [person.id, person]))
  const items = data.experiences ?? []
  const item = items.find((record) => record.id === id)
  const query = search.trim().toLowerCase()
  const visible = newestExperiences(items.filter((record) => [
    record.title, record.place, record.note, ...record.participantIds.map((key) => peopleById.get(key)?.name ?? ''),
  ].some((value) => value.toLowerCase().includes(query))))

  if (id && !item) return <div className="content">
    <EmptyState title="没有找到这条经历" actionLabel="返回共同经历" onAction={() => navigate('/experiences')} />
  </div>

  return (
    <div className="content experiences-page">
      {item && <Link className="back-link" to="/experiences"><ArrowLeft size={16} aria-hidden="true" /> 共同经历</Link>}
      <header className="page-header">
        <div>
          <h1 className="page-title">{item?.title ?? '共同经历'}</h1>
          {item && <div className="experience-meta">
            <time dateTime={item.date}>{item.date}</time>
            {item.place && <span><MapPin size={15} aria-hidden="true" />{item.place}</span>}
          </div>}
        </div>
        <button type="button" className={`btn ${item ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setEditing(true)}>
          {!item && <Plus size={16} aria-hidden="true" />}{item ? '编辑经历' : '新建经历'}
        </button>
      </header>
      {item ? <>
        <section className="card experience-detail" aria-label="经历详情">
          <h2 className="section-title">参与人</h2>
          {item.participantIds.length ? <ul className="experience-people">
            {item.participantIds.map((key) => <li key={key}>
              <Link className="tag-chip tag-chip-link" to={`/person/${encodeURIComponent(key)}`}>{peopleById.get(key)?.name}</Link>
            </li>)}
          </ul> : <p className="hint">暂无参与人</p>}
          {item.note && <><h2 className="section-title">备注</h2><p className="experience-note">{item.note}</p></>}
        </section>
        <button type="button" className="btn btn-ghost text-danger" onClick={() => setDeleting(true)}>删除经历</button>
        <ConfirmDialog open={deleting} title="删除经历" message={`删除「${item.title}」，并从参与人的档案中移除此经历？此操作不可撤销。`}
          onClose={() => setDeleting(false)} confirmLabel="删除经历" destructive onConfirm={() => {
            if (deleteExperience(item.id)) {
              toast.showAfterFileSave('已删除经历')
              navigate('/experiences', { replace: true })
            } else toast.show('删除失败，请重试')
          }} />
      </> : <>
        <input type="search" className="input experience-search" aria-label="搜索共同经历" placeholder="搜索标题、地点、备注或参与人"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        {visible.length ? <ol className="card experience-timeline">
          {visible.map((record) => <li key={record.id}>
            <Link to={`/experiences/${encodeURIComponent(record.id)}`}>
              <time dateTime={record.date}>{record.date}</time>
              <div>
                <strong>{record.title}</strong>
                <p>{[record.place, record.participantIds.map((key) => peopleById.get(key)?.name).filter(Boolean).join('、') || '暂无参与人'].filter(Boolean).join(' · ')}</p>
              </div>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>)}
        </ol> : <EmptyState title={query ? '没有匹配的经历' : '还没有共同经历'}
          description={query ? undefined : '记录一次聚会、旅行或合作，就能在参与人的档案里回看。'} />}
      </>}
      {editing && <ExperienceEditor item={item} people={data.people} onClose={() => setEditing(false)} onSave={(input) => {
        const savedId = saveExperience(input, item?.id)
        if (!savedId) return false
        setEditing(false)
        toast.showAfterFileSave('已保存经历')
        if (!item) {
          setSearch('')
          navigate(`/experiences/${encodeURIComponent(savedId)}`)
        }
        return true
      }} />}
    </div>
  )
}
