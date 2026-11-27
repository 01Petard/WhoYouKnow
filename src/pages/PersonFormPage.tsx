/**
 * [INPUT]: 依赖 ../components/Modal 的 Modal、DateField 与 Dropdown；依赖 ../components/Toast 的 useToast；依赖 ../store/useStore 的 data/addPerson/updatePerson/updateMe；依赖 ../types 的 Gender/PersonInput；依赖 react-router-dom 的 useLocation/useNavigate/useParams
 * [OUTPUT]: 导出 PersonFormPage 组件
 * [POS]: 新建与编辑共用的表单页；/profile/edit 编辑当前用户资料，其余按路径结尾 /edit 判定人物编辑；新建时选择联系人目录。基本资料直接显示可选字段，分类独立分区，可就地新增标签与分组草稿。新建遇到同名时，可新增或更新指定联系人。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { DateField } from '../components/DateField'
import { Dropdown } from '../components/QuickSelect'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import { isDateOnly } from '../util/id'
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
          avatar: existing.avatar,
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
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [birthdayError, setBirthdayError] = useState(false)
  const [error, setError] = useState('')
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

  const duplicates = useMemo(() => {
    if (isMe) return []
    const name = form.name.trim()
    if (!name) return []
    return data.people.filter((p) => p.name.trim() === name && p.id !== id)
  }, [data.people, form.name, id, isMe])

  const duplicateCount = duplicates.length

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
    if (form.birthday && !isDateOnly(form.birthday) && form.birthday !== existing?.birthday) {
      setBirthdayError(true)
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
    if (duplicateCount > 0) {
      setConfirmDuplicate(true)
      return
    }
    saveNewPerson()
  }

  const saveNewPerson = () => {
    setConfirmDuplicate(false)
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

  const saveExistingPerson = (personId: string) => {
    const person = useStore.getState().data.people.find((item) => (
      item.id === personId && item.name.trim() === form.name.trim()
    ))
    if (!person) {
      setConfirmDuplicate(false)
      toast.show('该同名联系人已变更，请重新保存')
      return
    }

    if (!updatePerson(person.id, {
      name: person.name,
      avatar: person.avatar,
      gender: form.gender ?? person.gender,
      birthday: form.birthday || person.birthday,
      channel: form.channel?.trim() || person.channel,
      metAt: form.metAt?.trim() || person.metAt,
      note: form.note?.trim() || person.note,
      groups: [...new Set([...person.groups, ...(form.groups ?? [])])],
      tags: [...new Set([...person.tags, ...(form.tags ?? [])])],
    })) {
      toast.show('保存失败，数据未写入，请重试')
      return
    }

    setConfirmDuplicate(false)
    toast.showAfterFileSave(`已更新 ${person.name}`)
    navigate(`/person/${encodeURIComponent(person.id)}`, { replace: true })
  }

  const returnTo = isMe ? '/profile' : isEdit ? `/person/${id}` : '/people'

  return (
    <div className="content person-workspace person-form-page">
      <button type="button" className="back-link person-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} aria-hidden="true" /> 返回
      </button>
      <div className="page-header">
        <h1 className="page-title">{isMe ? '编辑我的信息' : isEdit ? '编辑人物' : '添加人物'}</h1>
      </div>

      <form onSubmit={submit} noValidate>
        <div className="person-workspace-grid">
          <section className="card person-panel person-form-panel" aria-labelledby="person-form-basics">
            <h2 className="section-title" id="person-form-basics">基本资料</h2>
            <div className="field">
              <label className="field-label" htmlFor="person-name">
                姓名/备注名<span className="field-required" aria-hidden="true">*</span>
              </label>
              <input
                ref={nameRef}
                id="person-name"
                type="text"
                required
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="输入姓名或你记住的备注名"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'name-error' : isEdit && duplicateCount ? 'name-duplicate' : undefined}
                autoComplete="off"
              />
              {error && <p className="field-error" id="name-error" role="alert">{error}</p>}
              {!error && isEdit && duplicateCount > 0 && (
                <p className="field-hint" id="name-duplicate">
                  已有 {duplicateCount} 位同名的人 ·{' '}
                  <button type="button" className="link-inline" onClick={() => navigate('/people')}>查看</button>
                </p>
              )}
            </div>

            {!isEdit && !isMe && (
              <div className="field">
                <label className="field-label" htmlFor="person-directory">联系人目录</label>
                <Dropdown
                  id="person-directory"
                  label="联系人目录"
                  display={form.practical ? '事务联系人' : '社交联系人'}
                  options={[
                    { value: 'social', label: '社交联系人', checked: !form.practical },
                    { value: 'practical', label: '事务联系人', checked: Boolean(form.practical) },
                  ]}
                  onSelect={(value) => setField('practical', value === 'practical')}
                  field
                />
              </div>
            )}

            <div className="person-form-more">
              <div className="field">
                <label className="field-label" htmlFor="person-gender">性别</label>
                <Dropdown<Gender | ''>
                  id="person-gender"
                  label="性别"
                  display={form.gender ?? '不填写'}
                  options={[
                    { value: '', label: '不填写', checked: !form.gender },
                    ...(['男', '女', '其他'] as const).map((value) => ({ value, label: value, checked: form.gender === value })),
                  ]}
                  onSelect={(value) => setField('gender', value || undefined)}
                  field
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="person-birthday">生日</label>
                <DateField id="person-birthday" value={form.birthday ?? ''} invalid={birthdayError}
                  describedBy={birthdayError ? 'birthday-error' : undefined}
                  onChange={(date) => { setField('birthday', date); setBirthdayError(false) }} />
                {birthdayError && <p className="field-error" id="birthday-error" role="alert">请输入有效日期，格式为 YYYY-MM-DD。</p>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="person-channel">认识渠道</label>
                <input id="person-channel" type="text" value={form.channel ?? ''} onChange={(event) => setField('channel', event.target.value)} placeholder="如 同事、聚会" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="person-metat">认识时间</label>
                <input id="person-metat" type="text" value={form.metAt ?? ''} onChange={(event) => setField('metAt', event.target.value)} placeholder="如 2026-11" />
              </div>
              <div className="field person-form-note">
                <label className="field-label" htmlFor="person-note">备注</label>
                <textarea id="person-note" value={form.note ?? ''} onChange={(event) => setField('note', event.target.value)} placeholder="记下你想记住的事" />
              </div>
            </div>
          </section>

          <section className="card person-panel person-form-panel" aria-labelledby="person-form-categories">
            <h2 className="section-title" id="person-form-categories">分类</h2>
            {([
              { key: 'tags', label: '标签', draft: newTag, setDraft: setNewTag },
              { key: 'groups', label: '分组', draft: newGroup, setDraft: setNewGroup },
            ] as const).map(({ key, label, draft, setDraft }) => (
              <fieldset className="person-form-categories" key={key}>
                <legend className="field-label">{label}</legend>
                <div className="tag-chips">
                  {Array.from(new Set([...data[key], ...(form[key] ?? [])])).map((value) => {
                    const selected = form[key]?.includes(value) ?? false
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`tag-chip${selected ? ' tag-chip-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => toggleVocab(key, value)}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
                <div className="person-form-add">
                  <input
                    className="input"
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault()
                        addVocab(key)
                      }
                    }}
                    placeholder={`新${label}`}
                    aria-label={`新${label}名称`}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" disabled={!draft.trim()} onClick={() => addVocab(key)}>添加</button>
                </div>
              </fieldset>
            ))}
          </section>
        </div>

        <div className="person-workspace-footer person-form-footer">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(returnTo)}>取消</button>
          <button type="submit" className="btn btn-primary">保存</button>
        </div>
      </form>

      <Modal
        open={confirmDuplicate}
        title="发现同名联系人"
        onClose={() => setConfirmDuplicate(false)}
        showClose={false}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDuplicate(false)}>返回编辑</button>
            <button type="button" className="btn btn-primary" onClick={saveNewPerson}>作为新联系人添加</button>
          </>
        }
      >
        <p>已有 {duplicateCount} 位同名联系人。你可以更新下方任意一位，或作为新联系人添加。</p>
        <p>更新时，本次填写的资料会覆盖对应字段，留空项保留原值，分组和标签会合并。</p>
        {duplicates.map((person) => {
          const details = [
            ['性别', person.gender],
            ['生日', person.birthday],
            ['认识渠道', person.channel],
            ['认识时间', person.metAt],
            ['分组', person.groups.join('、')],
            ['标签', person.tags.join('、')],
            ['备注', person.note],
          ].filter(([, value]) => value)
          return (
            <div key={person.id} style={{ marginTop: 'var(--sp-4)' }}>
              <h3 className="panel-section-title">{person.name}</h3>
              {details.length === 0 && <p>暂无其他资料</p>}
              {details.map(([label, value]) => (
                <p key={label} style={{ overflowWrap: 'anywhere' }}>{label}：{value}</p>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => saveExistingPerson(person.id)}
                style={{ marginTop: 'var(--sp-2)' }}
              >
                更新此联系人
              </button>
            </div>
          )
        })}
      </Modal>
    </div>
  )
}
