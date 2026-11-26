/**
 * [INPUT]: 依赖 ../components 的 Modal/ConfirmDialog/EmptyState/useToast/Avatar；依赖 ../store/useStore 的 data/addToGroup/removeFromGroup；依赖 react-router-dom 的 useSearchParams
 * [OUTPUT]: 导出 GroupPage 组件
 * [POS]: 单个分组的成员管理页，负责批量加人与单人移出，分组名取自 query 参数 name；路由 /categories/groups，从 CategoriesPage 进入
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { ConfirmDialog, Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Avatar } from '../components/PersonCard'
import { useStore } from '../store/useStore'

/**
 * 分组详情页：查看某分组的成员、从已有联系人批量加入、移除成员。
 * 分组名通过 query 参数 name 传入；分组不存在时给出明确提示。
 */
export function GroupPage() {
  const [params] = useSearchParams()
  const name = params.get('name') ?? ''
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((s) => s.data)
  const addToGroup = useStore((s) => s.addToGroup)
  const removeFromGroup = useStore((s) => s.removeFromGroup)

  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)

  const exists = data.groups.includes(name)
  const members = useMemo(
    () => data.people.filter((p) => p.groups.includes(name)).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [data.people, name],
  )
  // 该分组被哪些圈子包含（圈子由分组派生，这里只读展示）
  const circles = useMemo(() => data.circles.filter((c) => c.groups.includes(name)), [data.circles, name])
  const nonMembers = useMemo(
    () =>
      data.people
        .filter((p) => !p.groups.includes(name) && p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [data.people, name, search],
  )

  const openAdd = () => {
    setSelected([])
    setSearch('')
    setAddOpen(true)
  }

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const confirmAdd = () => {
    const count = addToGroup(name, selected)
    setAddOpen(false)
    if (count === 0) {
      toast.show(selected.length ? '添加失败，请重试' : '未选择成员')
      return
    }
    toast.showAfterFileSave(`已将 ${count} 人加入「${name}」`)
  }

  if (!exists) {
    return (
      <div className="content">
        <button type="button" className="back-link" onClick={() => navigate('/categories')}>
          <ArrowLeft size={16} aria-hidden="true" /> 返回
        </button>
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <EmptyState
            title="分组不存在"
            description={name ? `没有找到名为「${name}」的分组，可能已被删除或重命名。` : '未指定要查看的分组。'}
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
        <h1 className="page-title">{name}</h1>
        <span className="page-count tabular">{members.length} 位成员</span>
      </div>

      <p className="hint" style={{ marginBottom: 'var(--sp-3)' }}>
        分组是系统内部的整理方式，不属于人物原始数据；把分组加入圈子即可获得更高一层的归类。
      </p>

      {circles.length > 0 && (
        <div className="tag-chips" style={{ marginBottom: 'var(--sp-4)' }}>
          <span className="hint">所属圈子：</span>
          {circles.map((circle) => (
            <button
              key={circle.id}
              type="button"
              className="tag-chip tag-chip-link"
              onClick={() => navigate(`/categories/circles/${circle.id}`)}
            >
              {circle.name}
            </button>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          title="这个分组还没有成员"
          description="从已有联系人中添加成员，一个人可以同时属于多个分组。"
          actionLabel="添加成员"
          onAction={openAdd}
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
              </div>
              <button
                type="button"
                className="btn-icon"
                aria-label={`将${person.name}移出分组${name}`}
                onClick={() => setPendingRemove(person.id)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {members.length > 0 && (
        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 'var(--sp-4)' }} onClick={openAdd}>
          <Plus size={18} aria-hidden="true" /> 从联系人中添加成员
        </button>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={`添加成员到「${name}」`}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>取消</button>
            <button type="button" className="btn btn-primary" disabled={selected.length === 0} onClick={confirmAdd}>
              加入{selected.length ? ` ${selected.length} 人` : ''}
            </button>
          </>
        }
      >
        <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
          <Search size={18} aria-hidden="true" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索联系人" aria-label="搜索联系人" />
        </div>
        <div style={{ maxHeight: '42vh', overflowY: 'auto' }}>
          {nonMembers.map((person) => (
            <button
              key={person.id}
              type="button"
              className="candidate-row"
              aria-pressed={selected.includes(person.id)}
              onClick={() => toggle(person.id)}
              style={selected.includes(person.id) ? { background: 'var(--color-primary-100)' } : undefined}
            >
              <Avatar person={person} small />
              <span style={{ flex: 1 }}>{person.name}</span>
              {selected.includes(person.id) && <UserRound size={16} aria-hidden="true" />}
            </button>
          ))}
          {nonMembers.length === 0 && (
            <p className="hint">{search.trim() ? '没有匹配的人' : '所有联系人都已在此分组中，或还没有联系人'}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="移出分组"
        message={pendingRemove ? `将「${data.people.find((p) => p.id === pendingRemove)?.name ?? ''}」移出分组「${name}」？人物本身不会被删除。` : ''}
        confirmLabel="移出"
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (!pendingRemove) return
          if (!removeFromGroup(name, pendingRemove)) { toast.show('操作失败，请重试'); return }
          setPendingRemove(null)
          toast.showAfterFileSave('已移出分组')
        }}
      />
    </div>
  )
}
