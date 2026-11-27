/**
 * [INPUT]: 读取联系人、分类、手记、共同经历和引荐。复用 DateField 选择联系日期。通过状态仓库写入联系标记和事务目录状态。
 * [OUTPUT]: 导出 PersonDetailPage。
 * [POS]: 将联系人档案分成联系活动与资料。共同经历和引荐回链指向原记录。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { DateField } from '../components/DateField'
import { ContactHistory } from '../components/ContactHistory'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Avatar } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import { latestContactDate } from '../util/contactJournal'
import { today } from '../util/id'
import { COPY } from '../util/constants'
import { circlesOfPerson } from '../util/queries'
import { newestExperiences } from '../util/experiences'
import { introductionRoles, introductionRoleLabels } from '../util/introductions'

export function PersonDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((s) => s.data)
  const deletePerson = useStore((s) => s.deletePerson)
  const setLastContact = useStore((s) => s.setLastContact)
  const setPractical = useStore((s) => s.setPractical)
  const setImportance = useStore((s) => s.setImportance)
  const [contactDate, setContactDate] = useState<string | null>(null)
  const [contactError, setContactError] = useState('')
  const dateEditor = useRef<HTMLDetailsElement>(null)
  const [pendingDeletePerson, setPendingDeletePerson] = useState(false)

  const person = data.people.find((p) => p.id === id)
  const personCircles = useMemo(
    () => (person ? circlesOfPerson(data, person) : []),
    [data, person],
  )

  if (!person) {
    return (
      <div className="content">
        <EmptyState title="没有找到这个人" actionLabel="返回人脉" onAction={() => navigate('/people')} />
      </div>
    )
  }

  const currentDate = today()
  const dateInput = contactDate ?? person.lastContactAt ?? ''

  function recordContact(date?: string) {
    if (!setLastContact(id, date)) {
      setContactError('请选择今天或更早的有效日期，或稍后重试。')
      if (dateEditor.current) dateEditor.current.open = true
      return
    }
    setContactDate(null)
    setContactError('')
  }

  const lastContact = latestContactDate(person)
  const experiences = newestExperiences((data.experiences ?? []).filter((item) => item.participantIds.includes(id)))
  const introductions = (data.introductions ?? []).flatMap((item) => {
    const role = introductionRoles.find((key) => {
      const party = item.parties[key]
      return party.kind === 'contact' && party.personId === id
    })
    return role ? [{ item, role }] : []
  }).sort((a, b) => b.item.date.localeCompare(a.item.date))
  const deleteMessage = person.contactHistory?.length
    ? `删除「${person.name}」及其 ${person.contactHistory.length} 条联系手记？此操作不可撤销。`
    : COPY.deletePersonDialog(person.name)

  return (
    <div className="content contact-profile">
      <button type="button" className="back-link contact-profile-back"
        onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/people')}>
        <ArrowLeft size={16} aria-hidden="true" /> 返回
      </button>

      <header className="contact-profile-header">
        <Avatar person={person} />
        <div className="contact-profile-name">
          <h1 className="page-title">{person.name}</h1>
          {(person.practical || person.important) && (
            <p className="contact-profile-subtitle">
              {person.practical && <span>事务联系人</span>}
              {person.important && <span className="contact-profile-marker">重要联系人</span>}
            </p>
          )}
        </div>
        <div className="contact-profile-actions">
          <button type="button" className="btn-icon contact-profile-star"
            aria-label={person.important ? '取消重要标记' : '标为重要'} aria-pressed={Boolean(person.important)}
            title={person.important ? '取消重要标记' : '标为重要'}
            onClick={() => setImportance(person.id, !person.important)}>
            <Star size={19} fill={person.important ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/person/${encodeURIComponent(person.id)}/edit`)}>
            <Pencil size={16} aria-hidden="true" /> 编辑资料
          </button>
        </div>
      </header>

      <div className="contact-profile-grid">
        <div className="contact-profile-activity card">
          <section className="contact-profile-recent" aria-labelledby="contact-log-heading">
            <div className="contact-profile-recent-row">
              <span className="contact-profile-clock"><CalendarClock size={23} strokeWidth={1.65} aria-hidden="true" /></span>
              <div className="contact-profile-recent-date">
                <h2 id="contact-log-heading">上次联系</h2>
                {lastContact ? <time className="tabular" dateTime={lastContact}>{lastContact}</time> : <strong>未记录</strong>}
              </div>
              <button type="button" className="btn btn-primary btn-sm" disabled={person.lastContactAt === currentDate}
                onClick={() => recordContact(currentDate)}>记录今天</button>
            </div>
            <details className="contact-profile-date-editor" ref={dateEditor}>
              <summary>手动调整日期</summary>
              <form onSubmit={(event) => {
                event.preventDefault()
                if (dateInput) recordContact(dateInput)
              }}>
                <div className="field">
                  <label className="field-label" htmlFor="last-contact-date">手动标记日期</label>
                  <DateField id="last-contact-date" max={currentDate} value={dateInput}
                    onChange={(date) => { setContactDate(date); setContactError('') }}
                    invalid={Boolean(contactError)} describedBy={contactError ? 'last-contact-error' : undefined} />
                  {contactError && <p className="field-error" id="last-contact-error" role="alert">{contactError}</p>}
                </div>
                <div className="row-actions">
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={!dateInput || dateInput === person.lastContactAt}>保存日期</button>
                  {person.lastContactAt && <button type="button" className="btn btn-ghost btn-sm" onClick={() => recordContact()}>清除手动标记</button>}
                </div>
              </form>
            </details>
          </section>
          <ContactHistory person={person} key={id} />
          {experiences.length > 0 && <section className="experience-backlinks" aria-labelledby="person-experiences">
            <h2 className="section-title" id="person-experiences">共同经历</h2>
            <ul className="experience-people">
              {experiences.map((item) => <li key={item.id}>
                <time dateTime={item.date}>{item.date}</time>
                <Link className="text-link" to={`/experiences/${encodeURIComponent(item.id)}`}>{item.title}</Link>
              </li>)}
            </ul>
          </section>}
          {introductions.length > 0 && <section className="experience-backlinks" aria-labelledby="person-introductions">
            <h2 className="section-title" id="person-introductions">引荐</h2>
            <ul className="experience-people">
              {introductions.map(({ item, role }) => <li key={item.id}>
                <time dateTime={item.date}>{item.date}</time>
                <Link className="text-link" to={`/introductions/${encodeURIComponent(item.id)}`}>{item.reason}</Link>
                <span className="hint"> · {introductionRoleLabels[role]}</span>
              </li>)}
            </ul>
          </section>}
        </div>

        <div className="card contact-profile-info">
          <section aria-labelledby="person-details-heading">
            <h2 id="person-details-heading" className="section-title">基本资料</h2>
            <dl className="contact-profile-fields">
              <div><dt>认识渠道</dt><dd>{person.channel || '未填写'}</dd></div>
              <div><dt>认识时间</dt><dd>{person.metAt || '未填写'}</dd></div>
              <div><dt>生日</dt><dd>{person.birthday || '未填写'}</dd></div>
              <div><dt>性别</dt><dd>{person.gender || '未填写'}</dd></div>
            </dl>
          </section>
          <section className="contact-profile-info-section" aria-labelledby="person-note-heading">
            <h2 id="person-note-heading" className="section-title">备注</h2>
            {person.note ? <p className="contact-profile-note">{person.note}</p> : <p className="hint">暂无备注</p>}
          </section>
          <section className="contact-profile-info-section" aria-labelledby="person-categories-heading">
            <h2 id="person-categories-heading" className="section-title">分类</h2>
            <dl className="contact-profile-fields contact-profile-classification">
              <div><dt>目录</dt><dd>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  const practical = !person.practical
                  if (setPractical(person.id, practical)) {
                    toast.showAfterFileSave(practical ? '已移入事务联系人' : '已移回社交联系人')
                  } else {
                    toast.show('保存失败，请重试')
                  }
                }}>
                  {person.practical ? '移回社交联系人' : '移入事务联系人'}
                </button>
              </dd></div>
              <div><dt>分组</dt><dd className="tag-chips">
                {person.groups.length ? person.groups.map((group) => (
                  <button type="button" className="tag-chip tag-chip-link" key={group}
                    aria-label={`查看分组${group}的成员`} onClick={() => navigate(`/categories/groups?name=${encodeURIComponent(group)}`)}>{group}</button>
                )) : <span className="hint">未分组</span>}
              </dd></div>
              <div><dt>圈子</dt><dd className="tag-chips">
                {personCircles.length ? personCircles.map((circle) => (
                  <button type="button" className="tag-chip tag-chip-link" key={circle.id}
                    aria-label={`查看圈子${circle.name}的成员`} onClick={() => navigate(`/categories/circles/${encodeURIComponent(circle.id)}`)}>{circle.name}</button>
                )) : <span className="hint">未加入圈子</span>}
              </dd></div>
              <div><dt>标签</dt><dd className="tag-chips">
                {person.tags.length ? person.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>) : <span className="hint">未添加标签</span>}
              </dd></div>
            </dl>
          </section>
        </div>
      </div>

      <footer className="person-workspace-footer">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/person/new')}>
          <Plus size={16} aria-hidden="true" /> 继续添加
        </button>
        <button type="button" className="btn btn-ghost text-danger" onClick={() => setPendingDeletePerson(true)}>
          <Trash2 size={16} aria-hidden="true" /> 删除
        </button>
      </footer>

      <ConfirmDialog
        open={pendingDeletePerson}
        title="删除人物"
        message={deleteMessage
          + (experiences.length ? ` 将从 ${experiences.length} 条共同经历移除此参与人，经历仍会保留。` : '')
          + (introductions.length ? ` ${introductions.length} 条引荐将保留，并标记该档案已移除。` : '')}
        confirmLabel="删除"
        destructive
        onClose={() => setPendingDeletePerson(false)}
        onConfirm={() => {
          if (!deletePerson(person.id)) { toast.show('删除失败，请重试'); return }
          toast.showAfterFileSave(`已删除 ${person.name}`)
          navigate('/people', { replace: true })
        }}
      />
    </div>
  )
}
