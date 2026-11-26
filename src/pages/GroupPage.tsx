/**
 * [INPUT]: 依赖联系人、分组与圈子数据，以及成员选择和确认组件。
 * [OUTPUT]: 导出 GroupPage 组件
 * [POS]: 按查询参数 name 展示分组成员和所属圈子。支持批量加入和单人移出。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Folder, Layers, Plus, Search, UserRoundMinus } from 'lucide-react'
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
    <div className="content collection-page">
      <Link className="back-link collection-back" to="/categories">
        <ArrowLeft size={16} aria-hidden="true" /> 返回整理分类
      </Link>

      <header className="page-header collection-heading">
        <div className="collection-identity">
          <span className="collection-icon"><Folder size={25} strokeWidth={1.65} aria-hidden="true" /></span>
          <div className="collection-title">
            <h1 className="page-title">{name}</h1>
            <p className="page-count tabular">分组 · {members.length} 位成员</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          <Plus size={17} aria-hidden="true" /> 添加成员
        </button>
      </header>

      <div className="collection-workspace">
        <section className="card collection-members" aria-labelledby="group-members-title">
          <header className="collection-panel-heading">
            <h2 className="section-title" id="group-members-title">成员</h2>
          </header>
          {members.length === 0 ? (
            <EmptyState title="这个分组还没有成员" description="可以从已有联系人中添加成员。" />
          ) : (
            <ul className="collection-list">
              {members.map((person) => (
                <li className="collection-member" key={person.id}>
                  <Link className="collection-person" to={`/person/${person.id}`}>
                    <Avatar person={person} small />
                    <span className="collection-person-text">
                      <span>{person.name}</span>
                      {person.channel && <span className="hint">{person.channel}</span>}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="btn-icon organize-remove"
                    aria-label={`将${person.name}移出分组${name}`}
                    title="移出分组"
                    onClick={() => setPendingRemove(person.id)}
                  >
                    <UserRoundMinus size={17} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card collection-related" aria-labelledby="group-circles-title">
          <header className="collection-panel-heading">
            <Layers size={18} strokeWidth={1.65} aria-hidden="true" />
            <h2 className="section-title" id="group-circles-title">所属圈子</h2>
          </header>
          {circles.length ? (
            <ul className="collection-related-list">
              {circles.map((circle) => (
                <li key={circle.id}>
                  <Link to={`/categories/circles/${circle.id}`}>
                    <span>{circle.name}</span><ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint collection-related-empty">暂无圈子包含此分组。</p>
          )}
        </section>
      </div>

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
        <div className="search-field collection-search">
          <Search size={18} aria-hidden="true" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索联系人" aria-label="搜索联系人" />
        </div>
        <div className="collection-candidates">
          {nonMembers.map((person) => (
            <button
              key={person.id}
              type="button"
              className="candidate-row"
              aria-pressed={selected.includes(person.id)}
              onClick={() => toggle(person.id)}
            >
              <Avatar person={person} small />
              <span>{person.name}</span>
              {selected.includes(person.id) && <Check size={17} aria-hidden="true" />}
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
        message={pendingRemove ? `将「${data.people.find((p) => p.id === pendingRemove)?.name ?? ''}」移出分组「${name}」？联系人档案将保留。` : ''}
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
