/**
 * [INPUT]: 依赖 react-router-dom 的 useNavigate/useParams；依赖 lucide-react 的 Pencil/Star/Trash2；依赖 ../components 的 ConfirmDialog/EmptyState/useToast/Avatar；依赖 ../store/useStore 的 data/deletePerson/setImportance；依赖 ../util/queries 的 circlesOfPerson
 * [OUTPUT]: 导出 PersonDetailPage 组件
 * [POS]: 联系人详情；people 只含联系人，当前用户不在其中；展示资料、分组/圈子与编辑/删除；路由 /person/:id
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Star, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Avatar } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import { COPY } from '../util/constants'
import { circlesOfPerson } from '../util/queries'

export function PersonDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((s) => s.data)
  const deletePerson = useStore((s) => s.deletePerson)
  const setImportance = useStore((s) => s.setImportance)
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

  return (
    <div className="content">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>← 返回</button>

      <div className="card" style={{ marginTop: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
          <Avatar person={person} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {person.name}
            </h1>
            <p className="hint" style={{ marginTop: 4 }}>
              {person.groups.length ? `分组：${person.groups.join('、')}` : '尚未加入分组'}
            </p>
          </div>
          <button
            type="button"
            className="btn-icon"
            aria-label={person.important ? '取消重要标记' : '标为重要'}
            onClick={() => setImportance(person.id, !person.important)}
          >
            <Star size={20} fill={person.important ? 'var(--marker-important-fill)' : 'none'} aria-hidden="true" />
          </button>
        </div>

        {(person.tags.length > 0 || person.groups.length > 0 || personCircles.length > 0) && (
          <div className="tag-chips" style={{ marginTop: 'var(--sp-3)' }}>
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
        )}

        <div className="details-grid" style={{ marginTop: 'var(--sp-4)' }}>
          <p className="hint">认识渠道：{person.channel || '未填写'}</p>
          <p className="hint">认识时间：{person.metAt || '未填写'}</p>
          <p className="hint">生日：{person.birthday || '未填写'}</p>
          <p className="hint">性别：{person.gender || '未填写'}</p>
        </div>
        {person.note && <p className="hint" style={{ marginTop: 'var(--sp-3)' }}>备注：{person.note}</p>}

        <div className="row-actions" style={{ marginTop: 'var(--sp-4)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/person/${person.id}/edit`)}>
            <Pencil size={16} aria-hidden="true" /> 编辑资料
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/person/new')}>
            继续添加
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setPendingDeletePerson(true)}>
            <Trash2 size={16} aria-hidden="true" /> 删除
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
        <h2 className="section-title" style={{ fontSize: 'var(--fs-h3)' }}>关系</h2>
        <p className="hint" style={{ marginTop: 'var(--sp-2)' }}>
          所有人默认与你相识。联系人的归类由分组、圈子与标签维护，系统不保存联系人彼此之间的关系。
        </p>
      </div>

      <ConfirmDialog
        open={pendingDeletePerson}
        title="删除人物"
        message={COPY.deletePersonDialog(person.name)}
        confirmLabel="删除"
        destructive
        onClose={() => setPendingDeletePerson(false)}
        onConfirm={() => {
          if (!deletePerson(person.id)) { toast.show('删除失败，请重试'); return }
          toast.show(`已删除 ${person.name}`)
          navigate('/people', { replace: true })
        }}
      />
    </div>
  )
}
