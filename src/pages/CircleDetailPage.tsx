/**
 * [INPUT]: 依赖圈子成员查询、联系人和圈子数据，以及圈子编辑与删除组件。
 * [OUTPUT]: 导出 CircleDetailPage 组件
 * [POS]: 按路由 ID 展示圈子、成员来源和包含的分组。成员从分组派生。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Folder, Layers, Pencil, Trash2 } from 'lucide-react'
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
    <div className="content collection-page">
      <Link className="back-link collection-back" to="/categories">
        <ArrowLeft size={16} aria-hidden="true" /> 返回整理分类
      </Link>

      <header className="page-header collection-heading">
        <div className="collection-identity">
          <span className="collection-icon"><Layers size={25} strokeWidth={1.65} aria-hidden="true" /></span>
          <div className="collection-title">
            <h1 className="page-title">{circle.name}</h1>
            <p className="page-count tabular">圈子 · {members.length} 位成员</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditorOpen(true)}>
          <Pencil size={16} aria-hidden="true" /> 编辑分组
        </button>
      </header>

      <div className="collection-workspace">
        <section className="card collection-members" aria-labelledby="circle-members-title">
          <header className="collection-panel-heading">
            <h2 className="section-title" id="circle-members-title">成员</h2>
            <p className="hint">包含的分组有新成员时，这里会自动更新。</p>
          </header>
          {members.length === 0 ? (
            <EmptyState title="这个圈子还没有成员" description={circle.groups.length > 0
              ? '把联系人加入任一包含的分组，他们就会出现在这里。'
              : '请先选择要纳入圈子的分组。'} />
          ) : (
            <ul className="collection-list">
              {members.map((person) => (
                <li className="collection-member" key={person.id}>
                  <Link className="collection-person" to={`/person/${person.id}`}>
                    <Avatar person={person} small />
                    <span className="collection-person-text">
                      <span>{person.name}</span>
                      <span className="hint">{person.groups.filter((group) => circleGroups.has(group)).join('、')}</span>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="collection-aside">
          <section className="card collection-related" aria-labelledby="circle-groups-title">
            <header className="collection-panel-heading">
              <Folder size={18} strokeWidth={1.65} aria-hidden="true" />
              <h2 className="section-title" id="circle-groups-title">包含分组</h2>
            </header>
            {circle.groups.length ? (
              <ul className="collection-related-list">
                {circle.groups.map((group) => (
                  <li key={group}>
                    <Link to={`/categories/groups?name=${encodeURIComponent(group)}`}>
                      <span>{group}</span><ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint collection-related-empty">尚未选择分组。</p>
            )}
          </section>
          <button type="button" className="btn btn-ghost collection-delete" onClick={() => setConfirmRemove(true)}>
            <Trash2 size={16} aria-hidden="true" /> 删除圈子
          </button>
        </div>
      </div>

      <CircleEditor open={editorOpen} circle={circle} onClose={() => setEditorOpen(false)} />

      <ConfirmDialog
        open={confirmRemove}
        title="删除圈子"
        message={`删除「${circle.name}」会移除此圈子。分组和联系人档案将保留。`}
        warning="此操作无法撤销。"
        confirmLabel="删除"
        destructive
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          if (!removeCircle(circle.id)) {
            toast.show('删除失败，请重试')
            return
          }
          toast.showAfterFileSave(`已删除圈子「${circle.name}」`)
          navigate('/categories', { replace: true })
        }}
      />
    </div>
  )
}
