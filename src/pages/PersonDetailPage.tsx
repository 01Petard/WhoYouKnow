/**
 * [INPUT]: 依赖 react-router-dom 的 useNavigate/useParams；依赖 lucide-react 的 ArrowLeft/CalendarClock/Pencil/Plus/Star/Trash2；依赖 ../components 的 ConfirmDialog/EmptyState/useToast/Avatar；依赖 ../store/useStore 的 data/deletePerson/setImportance/setLastContact；依赖 ../util/queries 的 circlesOfPerson
 * [OUTPUT]: 导出 PersonDetailPage 组件
 * [POS]: 联系人详情；people 只含联系人，当前用户不在其中；资料与联系记录分区；提供联系手记入口；分类链接指向对应成员页，编辑与删除使用既有入口；路由 /person/:id
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Pencil, Plus, Star, Trash2 } from 'lucide-react'
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

export function PersonDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((s) => s.data)
  const deletePerson = useStore((s) => s.deletePerson)
  const setLastContact = useStore((s) => s.setLastContact)
  const setImportance = useStore((s) => s.setImportance)
  const [contactDate, setContactDate] = useState<string | null>(null)
  const [contactError, setContactError] = useState('')
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
      return
    }
    setContactDate(null)
    setContactError('')
  }

  const hasCategories = person.tags.length > 0 || person.groups.length > 0 || personCircles.length > 0

  return (
    <div className="content person-workspace">
      <button type="button" className="back-link person-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} aria-hidden="true" /> 返回
      </button>

      <header className="person-identity">
        <Avatar person={person} />
        <div className="person-identity-copy">
          <h1 className="page-title">{person.name}</h1>
        </div>
        <div className="person-identity-actions">
          <button
            type="button"
            className="btn-icon person-important"
            aria-label={person.important ? '取消重要标记' : '标为重要'}
            aria-pressed={Boolean(person.important)}
            title={person.important ? '取消重要标记' : '标为重要'}
            onClick={() => setImportance(person.id, !person.important)}
          >
            <Star size={19} fill={person.important ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/person/${person.id}/edit`)}>
            <Pencil size={16} aria-hidden="true" /> 编辑资料
          </button>
        </div>
      </header>

      <div className="person-workspace-grid">
        <section className="card person-panel" aria-labelledby="person-details-heading">
          <h2 id="person-details-heading" className="section-title">基本资料</h2>
          <dl className="person-facts">
            <div><dt>认识渠道</dt><dd>{person.channel || '未填写'}</dd></div>
            <div><dt>认识时间</dt><dd>{person.metAt || '未填写'}</dd></div>
            <div><dt>生日</dt><dd>{person.birthday || '未填写'}</dd></div>
            <div><dt>性别</dt><dd>{person.gender || '未填写'}</dd></div>
          </dl>
          <div className="person-note">
            <h3>备注</h3>
            <p>{person.note || '暂无备注'}</p>
          </div>
        </section>

        <div className="person-workspace-aside">
          <section className="card person-panel person-contact-panel" aria-labelledby="contact-log-heading">
            <h2 id="contact-log-heading" className="section-title">联系记录</h2>
            <div className="person-contact-current">
              <span className="person-contact-icon"><CalendarClock size={21} strokeWidth={1.7} aria-hidden="true" /></span>
              <p className="person-contact-date tabular">
                <span>上次联系：</span><strong>{latestContactDate(person) ?? '未记录'}</strong>
              </p>
            </div>
            <form onSubmit={(event) => {
              event.preventDefault()
              if (dateInput) recordContact(dateInput)
            }}>
              <div className="field">
                <label className="field-label" htmlFor="last-contact-date">手动标记日期</label>
                <input
                  id="last-contact-date"
                  type="date"
                  max={currentDate}
                  value={dateInput}
                  onChange={(event) => { setContactDate(event.target.value); setContactError('') }}
                  aria-invalid={Boolean(contactError)}
                  aria-describedby={contactError ? 'last-contact-error' : undefined}
                />
                {contactError && <p className="field-error" id="last-contact-error" role="alert">{contactError}</p>}
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-primary btn-sm" disabled={person.lastContactAt === currentDate} onClick={() => recordContact(currentDate)}>记录今天</button>
                <button type="submit" className="btn btn-secondary btn-sm" disabled={!dateInput || dateInput === person.lastContactAt}>保存日期</button>
                {person.lastContactAt && <button type="button" className="btn btn-ghost btn-sm" onClick={() => recordContact()}>清除手动标记</button>}
              </div>
            </form>
          </section>

          <section className="card person-panel" aria-labelledby="person-categories-heading">
            <h2 id="person-categories-heading" className="section-title">分类</h2>
            {hasCategories ? (
              <div className="tag-chips person-categories">
                {person.tags.map((tag) => <span className="tag-chip" key={`tag-${tag}`}>标签 · {tag}</span>)}
                {person.groups.map((group) => (
                  <button
                    type="button"
                    className="tag-chip tag-chip-link"
                    key={`group-${group}`}
                    aria-label={`查看分组${group}的成员`}
                    onClick={() => navigate(`/categories/groups?name=${encodeURIComponent(group)}`)}
                  >
                    分组 · {group}
                  </button>
                ))}
                {personCircles.map((circle) => (
                  <button
                    type="button"
                    className="tag-chip tag-chip-link"
                    key={`circle-${circle.id}`}
                    aria-label={`查看圈子${circle.name}的成员`}
                    onClick={() => navigate(`/categories/circles/${circle.id}`)}
                  >
                    圈子 · {circle.name}
                  </button>
                ))}
              </div>
            ) : <p className="hint person-categories">尚未添加分组、圈子或标签</p>}
          </section>
        </div>
      </div>

      <ContactHistory person={person} key={id} />

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
        message={person.contactHistory?.length ? `删除「${person.name}」及其 ${person.contactHistory.length} 条联系手记？此操作不可撤销。` : COPY.deletePersonDialog(person.name)}
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
