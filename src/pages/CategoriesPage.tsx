/**
 * [INPUT]: 依赖 react 的 useState/DragEvent；依赖 lucide-react 图标；依赖 ../components 的 CircleEditor/ConfirmDialog/Modal/useToast；依赖 ../store/useStore 的标签/分组/圈子增删改与排序动作；依赖 ../util/queries 的 circleMembers
 * [OUTPUT]: 导出 CategoriesPage 组件
 * [POS]: 「整理分类」页面；标签、分组、圈子三栏并列，支持按钮排序与拖拽排序，减少页面跳转与留白
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, FolderCog, GripVertical, Layers, Pencil, Plus, Tag, Trash2, Users } from 'lucide-react'
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
  const navigate = useNavigate()
  const ungrouped = data.people.filter((person) => person.groups.length === 0)
  const untagged = data.people.filter((person) => person.tags.length === 0)

  const [editor, setEditor] = useState<NameEditor | null>(null)
  const [removing, setRemoving] = useState<Removing | null>(null)
  const [circleEditorOpen, setCircleEditorOpen] = useState(false)
  const [editingCircle, setEditingCircle] = useState<Circle | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [over, setOver] = useState<DragState | null>(null)

  const tagCount = (name: string) => data.people.filter((p) => p.tags.includes(name)).length
  const groupCount = (name: string) => data.people.filter((p) => p.groups.includes(name)).length

  const saveEditor = () => {
    if (!editor) return
    const value = editor.value.trim()
    const ok = editor.kind === 'tag'
      ? editor.mode === 'add' ? addTag(value) : renameTag(editor.original ?? '', value)
      : editor.mode === 'add' ? addGroup(value) : renameGroup(editor.original ?? '', value)
    if (!ok) { toast.show('名称为空或已存在'); return }
    toast.show(editor.mode === 'add' ? '已新增' : '已重命名')
    setEditor(null)
  }

  const doRemove = () => {
    if (!removing) return
    if (removing.kind === 'circle') {
      if (!removeCircle(removing.value)) { toast.show('删除失败，请重试'); return }
      toast.show('已删除圈子，分组与人物未受影响')
    } else {
      const affected = removing.kind === 'tag' ? removeTag(removing.value) : removeGroup(removing.value)
      if (affected < 0) { toast.show('删除失败，请重试'); return }
      toast.show(`已删除「${removing.label}」，${affected} 人受影响，人物未删除`)
    }
    setRemoving(null)
  }

  const drop = (kind: CategoryKind, target: string) => {
    if (!drag || drag.kind !== kind) return
    const list = kind === 'tag' ? data.tags : kind === 'group' ? data.groups : data.circles.map((circle) => circle.id)
    const from = list.indexOf(drag.value)
    const to = list.indexOf(target)
    setDrag(null)
    setOver(null)
    if (from < 0 || to < 0 || from === to) return
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    if (kind === 'tag') reorderTags(next)
    else if (kind === 'group') reorderGroups(next)
    else reorderCircles(next)
  }

  const dragProps = (kind: CategoryKind, value: string) => ({
    draggable: true,
    onDragStart: () => setDrag({ kind, value }),
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!drag || drag.kind !== kind) return
      event.preventDefault()
      setOver({ kind, value })
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      drop(kind, value)
    },
    onDragEnd: () => { setDrag(null); setOver(null) },
  })

  const rowClass = (kind: CategoryKind, value: string) =>
    `category-row${over?.kind === kind && over.value === value ? ' category-row-over' : ''}`

  return (
    <div className="content">
      <div className="page-header"><h1 className="page-title">整理分类</h1></div>
      <p className="hint" style={{ marginTop: 'calc(-1 * var(--sp-3))', marginBottom: 'var(--sp-3)' }}>
        拖动左侧手柄或使用上下按钮调整顺序；分组与圈子的顺序会影响关系网。
      </p>
      <div className="category-grid">
        <section className="card category-card">
          <div className="category-head">
            <span className="category-title"><Tag size={16} aria-hidden="true" /> 标签<span className="page-count tabular">{data.tags.length}</span></span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditor({ kind: 'tag', mode: 'add', value: '' })}>
              <Plus size={15} aria-hidden="true" /> 新增
            </button>
          </div>
          {data.tags.length === 0 ? <p className="hint">还没有标签。</p> : data.tags.map((name, index) => (
            <div className={rowClass('tag', name)} key={name} {...dragProps('tag', name)}>
              <GripVertical size={15} className="category-grip" aria-hidden="true" />
              <span className="category-name">{name}</span>
              <span className="category-meta tabular">{tagCount(name)} 人</span>
              <div className="category-actions">
                <button type="button" className="btn-icon" aria-label={`上移${name}`} disabled={index === 0} onClick={() => moveTag(name, -1)}><ChevronUp size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`下移${name}`} disabled={index === data.tags.length - 1} onClick={() => moveTag(name, 1)}><ChevronDown size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`重命名${name}`} onClick={() => setEditor({ kind: 'tag', mode: 'rename', original: name, value: name })}><Pencil size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`删除${name}`} onClick={() => setRemoving({ kind: 'tag', value: name, label: name })}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </div>
          ))}
        </section>

        <section className="card category-card">
          <div className="category-head">
            <span className="category-title"><FolderCog size={16} aria-hidden="true" /> 分组<span className="page-count tabular">{data.groups.length}</span></span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditor({ kind: 'group', mode: 'add', value: '' })}>
              <Plus size={15} aria-hidden="true" /> 新增
            </button>
          </div>
          {data.groups.length === 0 ? <p className="hint">还没有分组。</p> : data.groups.map((name, index) => (
            <div className={rowClass('group', name)} key={name} {...dragProps('group', name)}>
              <GripVertical size={15} className="category-grip" aria-hidden="true" />
              <button type="button" className="category-name category-link" onClick={() => navigate(`/categories/groups?name=${encodeURIComponent(name)}`)}>{name}</button>
              <span className="category-meta tabular">{groupCount(name)} 人</span>
              <div className="category-actions">
                <button type="button" className="btn-icon" aria-label={`上移${name}`} disabled={index === 0} onClick={() => moveGroup(name, -1)}><ChevronUp size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`下移${name}`} disabled={index === data.groups.length - 1} onClick={() => moveGroup(name, 1)}><ChevronDown size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`重命名${name}`} onClick={() => setEditor({ kind: 'group', mode: 'rename', original: name, value: name })}><Pencil size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`删除${name}`} onClick={() => setRemoving({ kind: 'group', value: name, label: name })}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </div>
          ))}
        </section>

        <section className="card category-card">
          <div className="category-head">
            <span className="category-title"><Layers size={16} aria-hidden="true" /> 圈子<span className="page-count tabular">{data.circles.length}</span></span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingCircle(null); setCircleEditorOpen(true) }}>
              <Plus size={15} aria-hidden="true" /> 新增
            </button>
          </div>
          {data.circles.length === 0 ? <p className="hint">还没有圈子。</p> : data.circles.map((circle, index) => (
            <div className={rowClass('circle', circle.id)} key={circle.id} {...dragProps('circle', circle.id)}>
              <GripVertical size={15} className="category-grip" aria-hidden="true" />
              <div className="category-body">
                <button type="button" className="category-name category-link" onClick={() => navigate(`/categories/circles/${circle.id}`)}>{circle.name}</button>
                <span className="hint">{circle.groups.length} 个分组 · {circleMembers(data, circle).length} 人</span>
              </div>
              <div className="category-actions">
                <button type="button" className="btn-icon" aria-label={`上移${circle.name}`} disabled={index === 0} onClick={() => moveCircle(circle.id, -1)}><ChevronUp size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`下移${circle.name}`} disabled={index === data.circles.length - 1} onClick={() => moveCircle(circle.id, 1)}><ChevronDown size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`编辑圈子${circle.name}`} onClick={() => { setEditingCircle(circle); setCircleEditorOpen(true) }}><Pencil size={16} aria-hidden="true" /></button>
                <button type="button" className="btn-icon" aria-label={`删除圈子${circle.name}`} onClick={() => setRemoving({ kind: 'circle', value: circle.id, label: circle.name })}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="card gap-card">
        <div className="gap-column">
          <div className="category-head">
            <span className="category-title"><Users size={16} aria-hidden="true" /> 未分组<span className="page-count tabular">{ungrouped.length}</span></span>
          </div>
          {ungrouped.length === 0 ? (
            <p className="hint">所有联系人都已加入分组。</p>
          ) : (
            <div className="gap-list">
              {ungrouped.slice(0, 10).map((person) => (
                <div className="gap-row" key={person.id}>
                  <button type="button" className="category-name category-link" onClick={() => navigate(`/person/${person.id}`)}>{person.name}</button>
                  <QuickSelect
                    label="加入分组…"
                    options={data.groups}
                    onSelect={(group) => {
                      if (addToGroup(group, [person.id]) > 0) toast.show(`已将 ${person.name} 加入「${group}」`)
                      else toast.show('加入失败，请重试')
                    }}
                  />
                </div>
              ))}
              {ungrouped.length > 10 && <p className="hint">另有 {ungrouped.length - 10} 位…</p>}
            </div>
          )}
        </div>
        <div className="gap-column">
          <div className="category-head">
            <span className="category-title"><Tag size={16} aria-hidden="true" /> 未加标签<span className="page-count tabular">{untagged.length}</span></span>
          </div>
          {untagged.length === 0 ? (
            <p className="hint">所有联系人都已加标签。</p>
          ) : (
            <div className="gap-list">
              {untagged.slice(0, 10).map((person) => (
                <div className="gap-row" key={person.id}>
                  <button type="button" className="category-name category-link" onClick={() => navigate(`/person/${person.id}`)}>{person.name}</button>
                  <QuickSelect
                    label="添加标签…"
                    options={data.tags}
                    onSelect={(tag) => {
                      if (addTagToPerson(tag, person.id)) toast.show(`已给 ${person.name} 添加标签「${tag}」`)
                      else toast.show('添加失败，请重试')
                    }}
                  />
                </div>
              ))}
              {untagged.length > 10 && <p className="hint">另有 {untagged.length - 10} 位…</p>}
            </div>
          )}
        </div>
      </section>

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
            onChange={(e) => setEditor((current) => current ? { ...current, value: e.target.value } : current)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEditor() }}
            autoFocus
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={`删除${removing?.kind === 'circle' ? '圈子' : removing?.kind === 'tag' ? '标签' : '分组'}`}
        message={removing ? `删除「${removing.label}」不会删除人物本身。` : ''}
        confirmLabel="删除"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={doRemove}
      />

      <CircleEditor open={circleEditorOpen} circle={editingCircle} onClose={() => setCircleEditorOpen(false)} />
    </div>
  )
}
