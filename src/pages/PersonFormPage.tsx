/**
 * [INPUT]: 依赖 ../components/Toast 的 useToast；依赖 ../store/useStore 的 data/addPerson/updatePerson/updateMe；依赖 ../types 的 Gender/PersonInput；依赖 react-router-dom 的 useLocation/useNavigate/useParams
 * [OUTPUT]: 导出 PersonFormPage 组件
 * [POS]: 新建与编辑共用的表单页；/profile/edit 编辑当前用户资料，其余按路径结尾 /edit 判定人物编辑；可就地新增标签与分组草稿
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { Gender, PersonInput } from '../types'

const emptyForm: PersonInput = {
  name: '',
  gender: undefined,
  birthday: '',
  channel: '',
  metAt: '',
  note: '',
  tags: [],
  groups: [],
}

export function PersonFormPage() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const isMe = pathname === '/profile/edit'
  const isEdit = pathname.endsWith('/edit')
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((s) => s.data)
  const addPerson = useStore((s) => s.addPerson)
  const updatePerson = useStore((s) => s.updatePerson)
  const updateMe = useStore((s) => s.updateMe)

  const existing = isMe ? data.me : data.people.find((p) => p.id === id)
  const [form, setForm] = useState<PersonInput>(() =>
    isEdit && existing
      ? {
          name: existing.name,
          gender: existing.gender,
          birthday: existing.birthday ?? '',
          channel: existing.channel,
          metAt: existing.metAt,
          note: existing.note,
          tags: [...existing.tags],
          groups: [...existing.groups],
        }
      : emptyForm,
  )
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if ((isEdit || isMe) && !existing) {
      toast.show(isMe ? '还没有我的信息' : '未找到这个人')
      navigate(isMe ? '/profile' : '/people', { replace: true })
    }
  }, [isEdit, isMe, existing, navigate, toast])

  // 桌面端自动聚焦姓名，移动端不自动聚焦（避免键盘遮挡）
  useEffect(() => {
    if (!isEdit && window.matchMedia('(min-width: 1024px)').matches) nameRef.current?.focus()
  }, [isEdit])

  const duplicateCount = useMemo(() => {
    if (isMe) return 0
    const name = form.name.trim()
    if (!name) return 0
    return data.people.filter((p) => p.name.trim() === name && p.id !== id).length
  }, [data.people, form.name, id, isMe])

  const setField = <K extends keyof PersonInput>(key: K, value: PersonInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'name') setError('')
  }

  const toggleVocab = (key: 'tags' | 'groups', value: string) => {
    const current = form[key] ?? []
    setForm((prev) => ({
      ...prev,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    }))
  }

  const addVocab = (key: 'tags' | 'groups') => {
    const setter = key === 'tags' ? setNewTag : setNewGroup
    const value = setter === setNewTag ? newTag : newGroup
    const clean = value.trim()
    if (!clean) return
    setForm((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), clean] }))
    setter('')
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('请填写姓名')
      nameRef.current?.focus()
      return
    }
    if (isMe) {
      if (!updateMe(form)) {
        toast.show('保存失败，数据未写入，请重试')
        return
      }
      toast.showAfterFileSave('已保存我的信息')
      navigate('/profile', { replace: true })
      return
    }
    if (isEdit && id) {
      if (!updatePerson(id, form)) {
        toast.show('保存失败，数据未写入，请重试')
        return
      }
      toast.showAfterFileSave(`已保存 ${form.name.trim()}`)
      navigate(`/person/${id}`, { replace: true })
      return
    }
    const ok = addPerson(form)
    if (!ok) {
      toast.show('保存失败，数据未写入，请重试')
      return
    }
    toast.showAfterFileSave(`已添加 ${form.name.trim()}`)
    const allPeople = useStore.getState().data.people
    const added = allPeople[allPeople.length - 1]
    if (added) navigate(`/person/${added.id}`, { replace: true })
  }

  return (
    <div className="content">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        ← 返回
      </button>
      <div className="page-header" style={{ marginTop: 'var(--sp-3)' }}>
        <h1 className="page-title">{isMe ? '编辑我的信息' : isEdit ? '编辑人物' : '添加人物'}</h1>
      </div>

      <form onSubmit={submit} noValidate>
        <div className="card">
          <div className="field">
            <label className="field-label" htmlFor="person-name">
              姓名/备注名<span className="field-required">*</span>
            </label>
            <input
              ref={nameRef}
              id="person-name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="输入姓名或你记住的备注名"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'name-error' : duplicateCount ? 'name-duplicate' : undefined}
              autoComplete="off"
            />
            {error && (
              <p className="field-error" id="name-error" role="alert">
                {error}
              </p>
            )}
            {!error && duplicateCount > 0 && (
              <p className="field-hint" id="name-duplicate">
                已有 {duplicateCount} 位同名的人 ·{' '}
                <button
                  type="button"
                  className="link-inline"
                  onClick={() => navigate('/people')}
                >
                  查看
                </button>
              </p>
            )}
          </div>

          <button type="button" className="collapsible-head" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            更多信息（可选）
            <ChevronDown size={18} aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
          </button>

          {expanded && (
            <div style={{ paddingTop: 'var(--sp-4)' }}>
              <div className="field">
                <label className="field-label" htmlFor="person-gender">性别</label>
                <select
                  id="person-gender"
                  value={form.gender ?? ''}
                  onChange={(e) => setField('gender', (e.target.value || undefined) as Gender | undefined)}
                >
                  <option value="">不填写</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="person-birthday">生日</label>
                <input id="person-birthday" type="date" value={form.birthday ?? ''} onChange={(e) => setField('birthday', e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="person-channel">认识渠道</label>
                <input id="person-channel" type="text" value={form.channel ?? ''} onChange={(e) => setField('channel', e.target.value)} placeholder="如 同事、聚会" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="person-metat">认识时间</label>
                <input id="person-metat" type="text" value={form.metAt ?? ''} onChange={(e) => setField('metAt', e.target.value)} placeholder="如 2026-11" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="person-note">备注</label>
                <textarea id="person-note" value={form.note ?? ''} onChange={(e) => setField('note', e.target.value)} placeholder="记下你想记住的事" />
              </div>

              <div className="field">
                <span className="field-label">标签</span>
                <div className="tag-chips">
                  {data.tags.map((tag) => (
                    <button key={tag} type="button" className={`tag-chip${form.tags?.includes(tag) ? ' tag-chip-selected' : ''}`} aria-pressed={form.tags?.includes(tag)} onClick={() => toggleVocab('tags', tag)}>
                      {tag}
                    </button>
                  ))}
                  {[...(form.tags ?? [])].filter((t) => !data.tags.includes(t)).map((tag) => (
                    <button key={tag} type="button" className="tag-chip tag-chip-selected" aria-pressed="true" onClick={() => toggleVocab('tags', tag)}>
                      {tag} ×
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                  <input className="input" type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVocab('tags') } }} placeholder="新标签，回车添加" aria-label="新标签名称" />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addVocab('tags')}>添加</button>
                </div>
              </div>

              <div className="field">
                <span className="field-label">分组</span>
                <div className="tag-chips">
                  {data.groups.map((group) => (
                    <button key={group} type="button" className={`tag-chip${form.groups?.includes(group) ? ' tag-chip-selected' : ''}`} aria-pressed={form.groups?.includes(group)} onClick={() => toggleVocab('groups', group)}>
                      {group}
                    </button>
                  ))}
                  {[...(form.groups ?? [])].filter((g) => !data.groups.includes(g)).map((group) => (
                    <button key={group} type="button" className="tag-chip tag-chip-selected" aria-pressed="true" onClick={() => toggleVocab('groups', group)}>
                      {group} ×
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                  <input className="input" type="text" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVocab('groups') } }} placeholder="新分组，回车添加" aria-label="新分组名称" />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addVocab('groups')}>添加</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="spacer-md" />
        <button type="submit" className="btn btn-primary btn-block">
          保存
        </button>
      </form>
    </div>
  )
}
