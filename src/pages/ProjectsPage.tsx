/**
 * [INPUT]: 读取项目、联系人及本地日期。项目变更通过状态仓库保存。
 * [OUTPUT]: 导出 ProjectsPage。
 * [POS]: 提供项目列表、成员与待办编辑及归档切换。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import { DateField } from '../components/DateField'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { PeopleProjectInput, Person, ProjectMember, ProjectTask } from '../types'
import { isDateOnly, uid } from '../util/id'
import { overdueTask } from '../util/projects'

function ProjectForm({ title, onClose, onSubmit, children }: {
  title: string
  onClose: () => void
  onSubmit: (fields: FormData) => string | void
  children: ReactNode
}) {
  const [issue, setIssue] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIssue(onSubmit(new FormData(event.currentTarget)) ?? '')
  }
  return <Modal open title={title} onClose={onClose} footer={<>
    <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
    <button type="submit" className="btn btn-primary" form="project-editor">保存</button>
  </>}>
    <form id="project-editor" className="experience-form" onSubmit={submit}>
      {children}
      {issue && <p className="field-error" role="alert">{issue}</p>}
    </form>
  </Modal>
}

type Editor =
  | { kind: 'project' }
  | { kind: 'member'; member?: ProjectMember }
  | { kind: 'task'; task?: ProjectTask }

function MemberFields({ member, available, name }: { member?: ProjectMember; available: Person[]; name?: string }) {
  return <>
    {member ? <p>{name}</p> : <div className="field">
      <label className="field-label" htmlFor="project-member">联系人</label>
      <select className="input" id="project-member" name="member" defaultValue="" required>
        <option value="">选择联系人</option>
        {available.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      {!available.length && <p className="hint">没有可以加入的联系人。</p>}
    </div>}
    <div className="field">
      <label className="field-label" htmlFor="project-role">项目角色</label>
      <input id="project-role" type="text" name="role" defaultValue={member?.role} />
    </div>
    <div className="field">
      <label className="field-label" htmlFor="project-progress">当前进展</label>
      <textarea id="project-progress" name="progress" rows={3} defaultValue={member?.progress} />
    </div>
  </>
}

function TaskFields({ task, members, people }: { task?: ProjectTask; members: ProjectMember[]; people: Map<string, Person> }) {
  const [date, setDate] = useState(task?.due ?? '')
  return <>
    <div className="field">
      <label className="field-label" htmlFor="project-task">待办标题</label>
      <input id="project-task" type="text" name="title" defaultValue={task?.title} required />
    </div>
    <div className="field">
      <label className="field-label" htmlFor="project-assignee">关联成员（可选）</label>
      <select id="project-assignee" className="input" name="assignee" defaultValue={task?.memberId ?? ''}>
        <option value="">无关联成员</option>
        {task?.memberId && !members.some((item) => item.id === task.memberId) &&
          <option value={task.memberId}>成员已移除</option>}
        {members.map((item) => <option key={item.id} value={item.id}>{people.get(item.id)?.name}</option>)}
      </select>
    </div>
    <div className="field">
      <label className="field-label" htmlFor="project-due">到期日（可选）</label>
      <DateField id="project-due" value={date} onChange={setDate} />
      <input type="hidden" name="due" value={date} />
    </div>
  </>
}

export function ProjectsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((state) => state.data)
  const save = useStore((state) => state.saveProject)
  const [editor, setEditor] = useState<Editor>()
  const [archived, setArchived] = useState(false)
  const [removing, setRemoving] = useState<ProjectMember>()
  const projects = data.projects ?? []
  const project = projects.find((item) => item.id === id)
  const people = new Map(data.people.map((person) => [person.id, person]))
  const memberIds = new Set(project?.members.map((item) => item.id))
  const available = data.people.filter((person) => !memberIds.has(person.id))
  const visible = projects.filter((item) => item.archived === archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function update(patch: Partial<PeopleProjectInput>): boolean {
    if (!project || !save({ ...project, ...patch }, project.id)) return false
    toast.showAfterFileSave('已保存项目')
    return true
  }

  function submit(fields: FormData): string | void {
    if (!editor) return
    const text = (key: string) => String(fields.get(key) ?? '').trim()
    const updatedAt = new Date().toISOString()
    if (editor.kind === 'project') {
      const name = text('name')
      if (!name) return '请填写项目名称。'
      const patch = { name, description: text('description') }
      if (project) {
        if (!update(patch)) return '项目保存失败，请重试。'
      } else {
        const saved = save({ ...patch, archived: false, members: [], tasks: [] })
        if (!saved) return '项目保存失败，请重试。'
        toast.showAfterFileSave('已新建项目')
        navigate(`/projects/${encodeURIComponent(saved)}`)
      }
    }
    if (project && editor.kind === 'member') {
      const updated = { id: editor.member?.id ?? text('member'), role: text('role'), progress: text('progress'), updatedAt }
      if (!updated.id) return '请选择联系人。'
      const members = editor.member
        ? project.members.map((item) => item.id === updated.id ? updated : item)
        : [...project.members, updated]
      if (!update({ members })) return '无法保存该成员，请检查联系人是否仍在目录中。'
    }
    if (project && editor.kind === 'task') {
      const title = text('title')
      const due = text('due')
      if (!title) return '请填写待办标题。'
      if (due && !isDateOnly(due)) return '请输入有效日期。'
      const previous = project.tasks.find((task) => task.id === editor.task?.id)
      if (editor.task && !previous) return '此待办已移除，请重新打开项目。'
      const updated = { id: previous?.id ?? uid(), title, due, memberId: text('assignee') || undefined, done: previous?.done ?? false, updatedAt }
      const tasks = editor.task
        ? project.tasks.map((item) => item.id === updated.id ? updated : item)
        : [...project.tasks, updated]
      if (!update({ tasks })) return '待办保存失败，请重试。'
    }
    setEditor(undefined)
  }

  if (id && !project) return <div className="content">
    <EmptyState title="没有找到这个项目" actionLabel="返回人脉项目" onAction={() => navigate('/projects')} />
  </div>
  return <div className="content experiences-page">
    {project && <Link className="back-link" to="/projects"><ArrowLeft size={16} aria-hidden="true" /> 人脉项目</Link>}
    <header className="page-header">
      <div>
        <h1 className="page-title">{project?.name ?? '人脉项目'}</h1>
        {project && <p className="hint">{project.archived ? '已归档' : '进行中'}</p>}
      </div>
      <button type="button" className={`btn ${project ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setEditor({ kind: 'project' })}>
        {!project && <Plus size={16} aria-hidden="true" />}{project ? '编辑项目' : '新建项目'}
      </button>
    </header>
    {project ? <>
      {project.description && <p className="project-description">{project.description}</p>}
      <section className="card project-section" aria-labelledby="project-members">
        <header>
          <h2 id="project-members" className="section-title">项目成员</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditor({ kind: 'member' })}>添加成员</button>
        </header>
        {project.members.length ? <ul>
          {project.members.map((member) => <li key={member.id}>
            <div>
              <Link className="project-contact" to={`/person/${encodeURIComponent(member.id)}`}>{people.get(member.id)?.name}</Link>
              {member.role && <span className="hint"> · {member.role}</span>}
              {member.progress && <p className="project-description">{member.progress}</p>}
            </div>
            <div className="row-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditor({ kind: 'member', member })}>编辑成员</button>
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setRemoving(member)}>移除成员</button>
            </div>
          </li>)}
        </ul> : <p className="hint">暂无项目成员</p>}
      </section>
      <section className="card project-section" aria-labelledby="project-tasks">
        <header>
          <h2 id="project-tasks" className="section-title">项目待办</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditor({ kind: 'task' })}>新增待办</button>
        </header>
        {[false, true].map((done) => {
          const tasks = project.tasks.filter((task) => task.done === done)
          return <div key={String(done)}>
            <h3>{done ? '已完成' : '待完成'} <span className="hint">{tasks.length}</span></h3>
            {tasks.length ? <ul>{tasks.map((task) => <li key={task.id}>
              <div>
                <label className="project-task-label">
                  <input type="checkbox" checked={task.done} onChange={(event) => {
                    const checked = event.target.checked
                    if (!update({ tasks: project.tasks.map((item) => item === task
                      ? { ...item, done: checked, updatedAt: new Date().toISOString() }
                      : item) })) toast.show('保存失败，请重试')
                  }} />
                  <strong>{task.title}</strong>
                </label>
                <div className="experience-meta">
                  {task.due && <time dateTime={task.due}>{task.due}</time>}
                  {!done && overdueTask(task.due) && <span className="text-danger">已逾期</span>}
                  {task.memberId && <span>{memberIds.has(task.memberId) ? people.get(task.memberId)?.name : '成员已移除'}</span>}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditor({ kind: 'task', task })}>编辑待办</button>
            </li>)}</ul> : <p className="hint">暂无{done ? '已完成' : '待完成'}事项</p>}
          </div>
        })}
      </section>
      <button type="button" className="btn btn-secondary" onClick={() => {
        if (!update({ archived: !project.archived })) toast.show('保存失败，请重试')
      }}>{project.archived ? '重新打开项目' : '归档项目'}</button>
    </> : <>
      <div className="row-actions project-status-filter" aria-label="项目状态">
        <button type="button" className={`btn ${archived ? 'btn-ghost' : 'btn-secondary'}`} aria-pressed={!archived} onClick={() => setArchived(false)}>进行中</button>
        <button type="button" className={`btn ${archived ? 'btn-secondary' : 'btn-ghost'}`} aria-pressed={archived} onClick={() => setArchived(true)}>已归档</button>
      </div>
      {visible.length ? <ul className="card experience-timeline project-list">
        {visible.map((item) => <li key={item.id}>
          <Link to={`/projects/${encodeURIComponent(item.id)}`}>
            <div><strong>{item.name}</strong><p>{item.members.length} 位成员 · {item.tasks.filter((task) => !task.done).length} 项待办</p></div>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </li>)}
      </ul> : <EmptyState title={archived ? '暂无归档项目' : '暂无进行中的项目'} />}
    </>}
    {editor && <ProjectForm title={editor.kind === 'project'
      ? (project ? '编辑项目' : '新建项目')
      : editor.kind === 'member' ? (editor.member ? '编辑成员' : '添加成员') : (editor.task ? '编辑待办' : '新增待办')}
      onClose={() => setEditor(undefined)} onSubmit={submit}>
      {editor.kind === 'project' && <>
        <div className="field">
          <label className="field-label" htmlFor="project-name">项目名称</label>
          <input id="project-name" type="text" name="name" defaultValue={project?.name} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="project-description">目标或说明</label>
          <textarea id="project-description" name="description" rows={3} defaultValue={project?.description} />
        </div>
      </>}
      {editor.kind === 'member' && <MemberFields member={editor.member} available={available}
        name={editor.member ? people.get(editor.member.id)?.name : undefined} />}
      {editor.kind === 'task' && project && <TaskFields task={editor.task} members={project.members} people={people} />}
    </ProjectForm>}
    <ConfirmDialog open={Boolean(removing)} title="移除项目成员"
      message={`移除「${people.get(removing?.id ?? '')?.name ?? ''}」？关联待办及其状态和日期均会保留。`}
      onClose={() => setRemoving(undefined)} confirmLabel="移除成员" destructive onConfirm={() => {
        if (!project || !removing || !update({ members: project.members.filter((item) => item.id !== removing.id) })) toast.show('移除失败，请重试')
      }} />
  </div>
}
