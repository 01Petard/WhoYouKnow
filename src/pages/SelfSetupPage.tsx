/**
 * [INPUT]: 依赖全局资料、身份创建与迁移操作、备份面板和品牌标记。
 * [OUTPUT]: 导出 SelfSetupPage 组件。
 * [POS]: 未创建我的信息时的入口；创建、采用联系人和备份恢复在同一页面完成。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { ArrowRight, Check, Search } from 'lucide-react'
import { Alert } from '../components/Alert'
import { BackupPanel } from '../components/BackupPanel'
import { Avatar } from '../components/PersonCard'
import { Logo } from '../components/Logo'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import { COPY } from '../util/constants'

export function SelfSetupPage() {
  const people = useStore((state) => state.data.people)
  const createMe = useStore((state) => state.createMe)
  const adoptAsMe = useStore((state) => state.adoptAsMe)
  const toast = useToast()
  const saving = useStore((state) => state.storageSaving)
  const storageNotice = useStore((state) => state.storageNotice)
  const storageError = useStore((state) => state.storageError)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')

  const candidates = useMemo(
    () => people.filter((person) => person.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
    [people, search],
  )

  const selectedPerson = people.find((person) => person.id === selected)
  const hasPeople = people.length > 0

  const start = () => {
    if (!selectedPerson || saving) return
    if (!adoptAsMe(selectedPerson.id)) toast.show('设置失败，请重试')
  }

  return (
    <main className="welcome-page">
      <div className="welcome-layout">
        <div className="welcome-content">
          <div className="welcome-brand">
            <Logo size={36} />
            <span className="brand-name">WhoYouKnow</span>
          </div>

          <header className="welcome-heading">
            <h1>{hasPeople ? COPY.selfSetupTitle : '创建你的通讯录'}</h1>
            <p>你的资料会成为关系网的起点。</p>
          </header>

          {storageNotice && <Alert tone={storageError ? 'danger' : 'info'}>{storageNotice}</Alert>}

          {hasPeople && (
            <section className="welcome-adopt" aria-labelledby="welcome-adopt-heading">
              <h2 id="welcome-adopt-heading">从已有联系人中选择</h2>
              <p className="hint">选中的联系人会移出人脉，成为你的资料。</p>
              <div className="search-field">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索已有联系人"
                  aria-label="搜索已有联系人"
                />
              </div>
              <div className="self-option-list" role="radiogroup" aria-label="选择你自己">
                {candidates.map((person) => (
                  <label className={`self-option welcome-option${selected === person.id ? ' self-option-selected' : ''}`} key={person.id}>
                    <input
                      type="radio"
                      name="welcome-self"
                      className="sr-only"
                      checked={selected === person.id}
                      onChange={() => setSelected(person.id)}
                    />
                    <Avatar person={person} small />
                    <span className="self-option-body">
                      <span className="self-option-title">{person.name}</span>
                      {person.channel && <span className="hint">{person.channel}</span>}
                    </span>
                    {selected === person.id && <Check size={18} className="self-option-check" aria-hidden="true" />}
                  </label>
                ))}
                {candidates.length === 0 && <p className="hint">没有匹配的联系人</p>}
              </div>
              <button type="button" className="btn btn-primary btn-block" disabled={!selectedPerson || saving} onClick={start}>
                {selectedPerson ? `以「${selectedPerson.name}」的身份开始` : '确认选择'}
              </button>
            </section>
          )}

          <form className="welcome-create" onSubmit={(event) => {
            event.preventDefault()
            const clean = name.trim()
            if (clean && !saving && !createMe({ name: clean })) toast.show('创建失败，请重试')
          }}>
            <div className="field">
              <label className="field-label" htmlFor="self-name">{COPY.selfSetupName}</label>
              <input
                id="self-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如 张三"
              />
            </div>
            <button type="submit" className={`btn ${hasPeople ? 'btn-secondary' : 'btn-primary'} btn-block`} disabled={!name.trim() || saving}>
              创建我的信息 <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>

          <div className="welcome-restore">
            <BackupPanel setup />
          </div>
        </div>
        <div aria-hidden="true" className="welcome-art" />
      </div>
    </main>
  )
}
