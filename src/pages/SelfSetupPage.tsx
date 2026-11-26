/**
 * [INPUT]: 依赖 react 的 useMemo/useState；依赖 lucide-react 的 Check/Search；依赖 ../components 的 Avatar/Alert/BackupPanel/useToast；依赖 ../store/useStore 的 data/adoptAsMe/createMe；依赖 ../util/constants 的 COPY
 * [OUTPUT]: 导出 SelfSetupPage 组件
 * [POS]: 未创建「我的信息」时的唯一入口；可把已有联系人迁移成我，或直接创建我的资料，也可从完整备份迁移，恢复成功后进入主路由
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Alert } from '../components/Alert'
import { BackupPanel } from '../components/BackupPanel'
import { Avatar } from '../components/PersonCard'
import { Logo } from '../components/Logo'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import { COPY } from '../util/constants'

export function SelfSetupPage() {
  const data = useStore((s) => s.data)
  const createMe = useStore((s) => s.createMe)
  const adoptAsMe = useStore((s) => s.adoptAsMe)
  const toast = useToast()
  const saving = useStore((state) => state.storageSaving)
  const storageNotice = useStore((state) => state.storageNotice)
  const storageError = useStore((state) => state.storageError)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')

  const candidates = useMemo(
    () => data.people.filter((p) => p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
    [data.people, search],
  )

  const start = () => {
    if (!selected) return
    if (!adoptAsMe(selected)) {
      toast.show('设置失败，请重试')
    }
  }

  const create = () => {
    const clean = name.trim()
    if (!clean || saving) return
    if (!createMe({ name: clean })) {
      toast.show('保存失败，请重试')
    }
  }

  return (
    <div className="self-setup">
      <div className="self-setup-card">
        <div className="brand" style={{ marginBottom: 'var(--sp-4)' }}>
          <span className="brand-mark"><Logo size={32} /></span>
          <span className="brand-copy">
            <span className="brand-name">WhoYouKnow</span>
            <span className="brand-tagline">你的人脉 · Every connection counts.</span>
          </span>
        </div>
        <h1 className="page-title" style={{ marginBottom: 'var(--sp-2)' }}>{COPY.selfSetupTitle}</h1>
        <p className="hint" style={{ marginBottom: 'var(--sp-4)' }}>
          {COPY.selfSetupHint} 已有联系人会被移出人脉，单独成为你的资料。
        </p>

        {data.people.length > 0 && (
          <>
            <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索已有联系人"
                aria-label="搜索已有联系人"
              />
            </div>
            <div className="self-option-list" role="radiogroup" aria-label="选择你自己">
              {candidates.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  role="radio"
                  aria-checked={selected === person.id}
                  className={`self-option${selected === person.id ? ' self-option-selected' : ''}`}
                  onClick={() => setSelected(person.id)}
                >
                  <Avatar person={person} small />
                  <span className="self-option-body">
                    <span className="self-option-title">{person.name}</span>
                    {person.channel && <span className="hint">{person.channel}</span>}
                  </span>
                  {selected === person.id && <Check size={18} className="self-option-check" aria-hidden="true" />}
                </button>
              ))}
              {candidates.length === 0 && <p className="hint">没有匹配的联系人</p>}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 'var(--sp-3)' }}
              disabled={!selected || saving}
              onClick={start}
            >
              {selected ? `以「${data.people.find((p) => p.id === selected)?.name ?? ''}」的身份开始` : '请选择或创建你自己'}
            </button>
            <div className="split-line" />
          </>
        )}

        <div className="field">
          <label className="field-label" htmlFor="self-name">{COPY.selfSetupName}</label>
          <input
            id="self-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：张三"
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
          />
        </div>
        <button type="button" className="btn btn-secondary btn-block" disabled={!name.trim() || saving} onClick={create}>
          创建我的信息
        </button>
        <div className="split-line" />
        {storageNotice && <Alert tone={storageError ? 'danger' : 'info'}>{storageNotice}</Alert>}
        <BackupPanel setup />
      </div>
    </div>
  )
}
