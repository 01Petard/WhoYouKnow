/**
 * [INPUT]: 依赖 ../components 的 CircleEditor/ConfirmDialog/EmptyState/useToast/Avatar；依赖 ../store/useStore 的 data/removeCircle；依赖 ../util/queries 的 circleMembers；依赖 react-router-dom 的 useParams
 * [OUTPUT]: 导出 CircleDetailPage 组件
 * [POS]: 单个圈子的成员视图与编辑/删除入口；成员全由 circleMembers 从分组派生，路由 /categories/circles/:id，从 CategoriesPage 进入
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { CircleEditor } from '../components/CircleEditor'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Avatar } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import { circleMembers } from '../util/queries'

/**
 * 圈子详情页：成员由圈子包含的分组自动汇总，按人物去重后平铺展示。
 * 这里不提供「加人」入口——加人应该加到分组，圈子只决定聚合哪些分组。
 */
export function CircleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((s) => s.data)
  const removeCircle = useStore((s) => s.removeCircle)
  const [editorOpen, setEditorOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const circle = data.circles.find((c) => c.id === id)
  const members = useMemo(() => (circle ? circleMembers(data, circle) : []), [data, circle])
  const circleGroups = useMemo(() => new Set(circle?.groups ?? []), [circle])

  if (!circle) {
    return (
      <div className="content">
        <button type="button" className="back-link" onClick={() => navigate('/categories')}>
          <ArrowLeft size={16} aria-hidden="true" /> 返回整理分类
        </button>
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <EmptyState
            title="圈子不存在"
            description="这个圈子可能已被删除，请回到圈子列表查看。"
            actionLabel="返回整理分类"
            onAction={() => navigate('/categories')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <button type="button" className="back-link" onClick={() => navigate('/categories')}>
        <ArrowLeft size={16} aria-hidden="true" /> 返回整理分类
      </button>

      <div className="page-header" style={{ marginTop: 'var(--sp-3)' }}>
        <h1 className="page-title">{circle.name}</h1>
        <span className="page-count tabular">{members.length} 位成员</span>
      </div>

      <p className="hint" style={{ marginBottom: 'var(--sp-3)' }}>
        成员由圈子包含的分组自动汇总；要给圈子加人，请把人加入对应分组。
      </p>

      <div className="tag-chips" style={{ marginBottom: 'var(--sp-4)' }}>
        <span className="hint">包含分组：</span>
        {circle.groups.map((group) => (
          <button
            key={group}
            type="button"
            className="tag-chip tag-chip-link"
            onClick={() => navigate(`/categories/groups?name=${encodeURIComponent(group)}`)}
          >
            {group}
          </button>
        ))}
        {circle.groups.length === 0 && <span className="hint">尚未选择分组，圈子里还没有人</span>}
        {members.length > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorOpen(true)}>
            <Pencil size={15} aria-hidden="true" /> 编辑分组
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState
          title="这个圈子还没有成员"
          description="把联系人加入圈子包含的分组（如 高中、大学），他们会自动出现在这里。"
          actionLabel="编辑分组"
          onAction={() => setEditorOpen(true)}
        />
      ) : (
        <div className="card">
          {members.map((person) => (
            <div className="member-row" key={person.id}>
              <Avatar person={person} small />
              <div className="member-body">
                <button type="button" className="link-row" style={{ minHeight: 0, padding: 0 }} onClick={() => navigate(`/person/${person.id}`)}>
                  <span className="list-item-title">{person.name}</span>
                </button>
                <div style={{ marginTop: 4, display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  {person.groups
                    .filter((group) => circleGroups.has(group))
                    .map((group) => (
                      <span className="hint" key={group}>{group}</span>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="spacer-md" />
      <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmRemove(true)}>
        <Trash2 size={16} aria-hidden="true" /> 删除圈子
      </button>

      <CircleEditor open={editorOpen} circle={circle} onClose={() => setEditorOpen(false)} />

      <ConfirmDialog
        open={confirmRemove}
        title="删除圈子"
        message={`删除圈子「${circle.name}」只移除这层归类，圈子包含的分组与人物都不受影响。`}
        confirmLabel="删除"
        destructive
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          if (!removeCircle(circle.id)) {
            toast.show('删除失败，请重试')
            return
          }
          toast.show(`已删除圈子「${circle.name}」`)
          navigate('/categories', { replace: true })
        }}
      />
    </div>
  )
}
