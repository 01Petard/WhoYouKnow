/**
 * [INPUT]: 依赖分类增删改与排序动作、圈子成员查询、编辑对话框和联系人快捷分类组件。
 * [OUTPUT]: 导出 CategoriesPage。
 * [POS]: 在分组、圈子与标签的列表之间切换，并就地补齐联系人的分类。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, ChevronUp, Folder, GripVertical, Layers, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { CircleEditor } from '../components/CircleEditor'
import { ConfirmDialog, Modal } from '../components/Modal'
import { QuickSelect } from '../components/QuickSelect'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { Circle } from '../types'
import { circleMembers } from '../util/queries'

type CategoryKind = 'tag' | 'group' | 'circle'
interface DragState { kind: CategoryKind; value: string }
interface NameEditor { kind: 'tag' | 'group'; mode: 'add' | 'rename'; original?: string; value: string }
interface Removing { kind: CategoryKind; value: string; label: string }
interface CategoryEntry {
  value: string
  name: string
  meta: string
  to?: string
  edit: () => void
}

const CATEGORY_VIEWS = [
  { kind: 'group', label: '分组', Icon: Folder },
  { kind: 'circle', label: '圈子', Icon: Layers },
  { kind: 'tag', label: '标签', Icon: Tag },
] as const

export function CategoriesPage() {
  const data = useStore((s) => s.data)
  const addTag = useStore((s) => s.addTag)
  const renameTag = useStore((s) => s.renameTag)
  const removeTag = useStore((s) => s.removeTag)
  const moveTag = useStore((s) => s.moveTag)
  const reorderTags = useStore((s) => s.reorderTags)
  const addGroup = useStore((s) => s.addGroup)
  const renameGroup = useStore((s) => s.renameGroup)
  const removeGroup = useStore((s) => s.removeGroup)
  const moveGroup = useStore((s) => s.moveGroup)
  const reorderGroups = useStore((s) => s.reorderGroups)
  const removeCircle = useStore((s) => s.removeCircle)
  const moveCircle = useStore((s) => s.moveCircle)
  const reorderCircles = useStore((s) => s.reorderCircles)
  const addToGroup = useStore((s) => s.addToGroup)
  const addTagToPerson = useStore((s) => s.addTagToPerson)
  const toast = useToast()

  const [view, setView] = useState<CategoryKind>('group')
  const [editor, setEditor] = useState<NameEditor | null>(null)
  const [fieldError, setFieldError] = useState('')
  const [removing, setRemoving] = useState<Removing | null>(null)
  const [circleEditorOpen, setCircleEditorOpen] = useState(false)
  const [editingCircle, setEditingCircle] = useState<Circle | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [over, setOver] = useState<DragState | null>(null)

  const { ungrouped, untagged, tagCounts, groupCounts } = useMemo(() => {
    const tagCounts = new Map<string, number>()
    const groupCounts = new Map<string, number>()
    for (const person of data.people) {
      for (const tag of new Set(person.tags)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      for (const group of new Set(person.groups)) groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1)
    }
    return {
      ungrouped: data.people.filter((person) => person.groups.length === 0),
      untagged: data.people.filter((person) => person.tags.length === 0),
      tagCounts,
      groupCounts,
    }
  }, [data.people])

  const selectedView = CATEGORY_VIEWS.find(({ kind }) => kind === view)!
  const counts = { group: data.groups.length, circle: data.circles.length, tag: data.tags.length }

  const openNameEditor = (next: NameEditor) => {
    setFieldError('')
    setEditor(next)
  }

  const openCircleEditor = (circle: Circle | null) => {
    setEditingCircle(circle)
    setCircleEditorOpen(true)
  }

  const entries: CategoryEntry[] = view === 'circle'
    ? data.circles.map((circle) => ({
        value: circle.id,
        name: circle.name,
        meta: `${circle.groups.length} 个分组 · ${circleMembers(data, circle).length} 人`,
        to: `/categories/circles/${circle.id}`,
        edit: () => openCircleEditor(circle),
      }))
    : (view === 'group' ? data.groups : data.tags).map((name) => ({
        value: name,
        name,
        meta: `${(view === 'group' ? groupCounts : tagCounts).get(name) ?? 0} 人`,
        to: view === 'group' ? `/categories/groups?name=${encodeURIComponent(name)}` : undefined,
        edit: () => openNameEditor({ kind: view, mode: 'rename', original: name, value: name }),
      }))

  const addCategory = () => {
    if (view === 'circle') openCircleEditor(null)
    else openNameEditor({ kind: view, mode: 'add', value: '' })
  }

  const saveEditor = () => {
    if (!editor) return
    const value = editor.value.trim()
    if (!value) {
      setFieldError('请输入名称。')
      return
    }
    const ok = editor.kind === 'tag'
      ? editor.mode === 'add' ? addTag(value) : renameTag(editor.original ?? '', value)
      : editor.mode === 'add' ? addGroup(value) : renameGroup(editor.original ?? '', value)
    if (!ok) {
      setFieldError('保存失败，请检查名称是否已存在。')
      return
    }
    toast.showAfterFileSave(editor.mode === 'add' ? '已新增' : '已重命名')
    setEditor(null)
  }

  const doRemove = () => {
    if (!removing) return
    if (removing.kind === 'circle') {
      if (!removeCircle(removing.value)) { toast.show('删除失败，请重试'); return }
      toast.showAfterFileSave('已删除圈子，分组与人物未受影响')
    } else {
      const affected = removing.kind === 'tag' ? removeTag(removing.value) : removeGroup(removing.value)
      if (affected < 0) { toast.show('删除失败，请重试'); return }
      toast.showAfterFileSave(`已删除「${removing.label}」，${affected} 人受影响，人物未删除`)
    }
    setRemoving(null)
  }

  const move = { tag: moveTag, group: moveGroup, circle: moveCircle }[view]
  const reorder = { tag: reorderTags, group: reorderGroups, circle: reorderCircles }[view]
  const drop = (target: string) => {
    if (!drag || drag.kind !== view) return
    const list = entries.map(({ value }) => value)
    const from = list.indexOf(drag.value)
    const to = list.indexOf(target)
    setDrag(null)
    setOver(null)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    reorder(list)
  }

  const dragProps = (value: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLLIElement>) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', value)
      setDrag({ kind: view, value })
    },
    onDragOver: (event: DragEvent<HTMLLIElement>) => {
      if (!drag || drag.kind !== view) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setOver({ kind: view, value })
    },
    onDrop: (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault()
      drop(value)
    },
    onDragEnd: () => { setDrag(null); setOver(null) },
  })

  const removalMessage = removing
    ? {
        group: `删除「${removing.label}」会移除联系人和圈子中的分组关联。联系人档案将保留。`,
        tag: `删除「${removing.label}」会移除联系人档案上的该标签。`,
        circle: `删除「${removing.label}」会移除此圈子。分组和联系人档案将保留。`,
      }[removing.kind]
    : ''

  const queues = [
    {
      key: 'group',
      title: '未分组',
      Icon: Folder,
      people: ungrouped,
      options: data.groups,
      label: '加入分组',
      empty: '所有联系人都已加入分组。',
      assign: (id: string, name: string) => addToGroup(name, [id]) > 0,
      message: (person: string, name: string) => `已将 ${person} 加入「${name}」`,
    },
    {
      key: 'tag',
      title: '未加标签',
      Icon: Tag,
      people: untagged,
      options: data.tags,
      label: '添加标签',
      empty: '所有联系人都已加标签。',
      assign: (id: string, name: string) => addTagToPerson(name, id),
      message: (person: string, name: string) => `已给 ${person} 添加标签「${name}」`,
    },
  ]

  return (
    <div className="content organize-page">
      <header className="page-header organize-heading">
        <h1 className="page-title">整理分类</h1>
      </header>

      <div className="organize-workspace">
        <div className="organize-picker" role="group" aria-label="分类视图">
          {CATEGORY_VIEWS.map(({ kind, label, Icon }) => (
            <button
              key={kind}
              type="button"
              className="organize-view"
              aria-pressed={view === kind}
              aria-controls="category-list"
              onClick={() => setView(kind)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
              <span className="organize-view-count tabular">{counts[kind]}</span>
            </button>
          ))}
        </div>

        <section className="card organize-list" id="category-list" aria-labelledby="category-list-title">
          <header className="organize-panel-heading">
            <div>
              <h2 id="category-list-title" className="section-title">{selectedView.label}</h2>
              {entries.length > 1 && (
                <p className="hint">{view === 'tag' ? '拖动或使用箭头排序。' : '拖动或使用箭头调整在关系网中的顺序。'}</p>
              )}
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={addCategory}>
              <Plus size={16} aria-hidden="true" /> 新增{selectedView.label}
            </button>
          </header>
          {entries.length === 0 ? (
            <div className="organize-empty">
              <selectedView.Icon size={23} strokeWidth={1.55} aria-hidden="true" />
              <p className="hint">还没有{selectedView.label}。</p>
            </div>
          ) : (
            <ul className="organize-entries">
              {entries.map(({ value, name, meta, to, edit }, index) => (
                <li
                  className={`organize-entry${over?.kind === view && over.value === value ? ' organize-entry-over' : ''}`}
                  key={value}
                  {...dragProps(value)}
                >
                  <GripVertical size={16} className="organize-grip" aria-hidden="true" />
                  <div className="organize-entry-main">
                    {to ? (
                      <Link className="organize-entry-name" to={to}>
                        <span>{name}</span><ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                    ) : <span className="organize-entry-name">{name}</span>}
                    <span className="hint tabular">{meta}</span>
                  </div>
                  <div className="organize-entry-actions" role="group" aria-label={`${name}的操作`}>
                    <div className="organize-order">
                      <button type="button" className="btn-icon" aria-label={`上移${name}`} title="上移" disabled={index === 0} onClick={() => move(value, -1)}><ChevronUp size={17} aria-hidden="true" /></button>
                      <button type="button" className="btn-icon" aria-label={`下移${name}`} title="下移" disabled={index === entries.length - 1} onClick={() => move(value, 1)}><ChevronDown size={17} aria-hidden="true" /></button>
                    </div>
                    <button type="button" className="btn-icon" aria-label={view === 'circle' ? `编辑圈子${name}` : `重命名${name}`} title={view === 'circle' ? '编辑圈子' : '重命名'} onClick={edit}><Pencil size={16} aria-hidden="true" /></button>
                    <button type="button" className="btn-icon organize-remove" aria-label={view === 'circle' ? `删除圈子${name}` : `删除${name}`} title="删除" onClick={() => setRemoving({ kind: view, value, label: name })}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="organize-queues">
        {queues.map(({ key, title, Icon, people, options, label, empty, assign, message }) => (
          <section className="card organize-queue" key={key} aria-labelledby={`organize-queue-${key}`}>
            <header className="organize-queue-heading">
              <span className="organize-section-icon"><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></span>
              <h2 className="section-title" id={`organize-queue-${key}`}>{title}</h2>
              <span className="organize-queue-count tabular">{people.length} 人</span>
            </header>
            {people.length === 0 ? (
              <p className="hint organize-queue-note">{data.people.length ? empty : '添加联系人后，可在这里补齐分类。'}</p>
            ) : (
              <>
                <ul className="organize-queue-list">
                  {people.slice(0, 10).map((person) => (
                    <li className="organize-queue-row" key={person.id}>
                      <Link to={`/person/${person.id}`}>{person.name}</Link>
                      <QuickSelect label={label} options={options} onSelect={(name) => {
                        if (assign(person.id, name)) toast.showAfterFileSave(message(person.name, name))
                        else toast.show('保存失败，请重试')
                      }} />
                    </li>
                  ))}
                </ul>
                {people.length > 10 && <p className="hint organize-queue-note">另有 {people.length - 10} 位联系人。</p>}
              </>
            )}
          </section>
        ))}
      </div>

      <Modal
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={`${editor?.mode === 'add' ? '新增' : '重命名'}${editor?.kind === 'tag' ? '标签' : '分组'}`}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setEditor(null)}>取消</button><button type="button" className="btn btn-primary" onClick={saveEditor}>保存</button></>}
      >
        <div className="field">
          <label className="field-label" htmlFor="category-name">名称</label>
          <input
            id="category-name"
            type="text"
            value={editor?.value ?? ''}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? 'category-name-error' : undefined}
            onChange={(event) => {
              const value = event.target.value
              setEditor((current) => current ? { ...current, value } : current)
              setFieldError('')
            }}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) saveEditor() }}
            autoFocus
          />
          {fieldError && <p className="field-error" id="category-name-error" role="alert">{fieldError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={`删除${removing?.kind === 'circle' ? '圈子' : removing?.kind === 'tag' ? '标签' : '分组'}`}
        message={removalMessage}
        warning="此操作无法撤销。"
        confirmLabel="删除"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={doRemove}
      />

      <CircleEditor open={circleEditorOpen} circle={editingCircle} onClose={() => setCircleEditorOpen(false)} />
    </div>
  )
}
