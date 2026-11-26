/**
 * [INPUT]: 依赖联系人状态、手记查询与本地日期。
 * [OUTPUT]: 导出 ContactJournalPage。
 * [POS]: 按月显示全部手记，支持筛选并展示往年今天的记录。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import type { ContactMethod } from '../types'
import { collectContactEntries, CONTACT_METHODS, wentByOnThisDay } from '../util/contactJournal'
import { today } from '../util/id'

export function ContactJournalPage() {
  const people = useStore((state) => state.data.people)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState<ContactMethod | ''>('')
  const entries = useMemo(() => collectContactEntries(people), [people])
  const date = today()
  const thisMonth = date.slice(0, 7)
  const monthlyEntries = entries.filter(({ entry }) => entry.date.startsWith(thisMonth))
  const pastEntries = entries.filter(({ entry }) => wentByOnThisDay(entry.date, date))
  const searchTerm = search.trim().toLocaleLowerCase()
  const months = new Map<string, typeof entries>()

  for (const item of entries) {
    if (method && item.entry.method !== method) continue
    if (searchTerm && ![item.person.name, item.entry.note].some((value) => value.toLocaleLowerCase().includes(searchTerm))) continue
    const month = item.entry.date.slice(0, 7)
    const bucket = months.get(month)
    if (bucket) bucket.push(item)
    else months.set(month, [item])
  }

  return (
    <div className="content contact-journal">
      <Link className="back-link" to="/people"><ArrowLeft size={16} aria-hidden="true" /> 返回人脉</Link>
      <header className="page-header">
        <div>
          <h1 className="page-title">联系手记</h1>
          <p className="page-count">{entries.length} 条手记 · 本月联系了 {new Set(monthlyEntries.map(({ person }) => person.id)).size} 人</p>
        </div>
      </header>

      <div className="journal-workspace">
        <section className="card journal-timeline" aria-label="手记时间线">
          <div className="journal-timeline-toolbar">
            <div className="search-field">
              <Search size={17} aria-hidden="true" />
              <input type="search" aria-label="搜索联系人或手记" placeholder="搜索联系人或手记" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select className="input journal-filter" aria-label="筛选联系方式" value={method}
              onChange={(event) => setMethod(event.target.value as ContactMethod | '')}>
              <option value="">全部方式</option>
              {Object.entries(CONTACT_METHODS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>

          {months.size ? Array.from(months, ([month, group]) => (
            <section className="journal-month" key={month} aria-label={month}>
              <h2 className="tabular">{month.slice(0, 4)} 年 {Number(month.slice(5))} 月</h2>
              <ol className="journal-entries">
                {group.map(({ entry, person }) => (
                  <li className="journal-entry" key={`${person.id}:${entry.id}`}>
                    <div className="journal-timeline-row">
                      <Link className="journal-person" to={`/person/${encodeURIComponent(person.id)}`}>
                        <Avatar person={person} small /><span>{person.name}</span>
                      </Link>
                      <div className="journal-entry-meta">
                        <time className="tabular" dateTime={entry.date}>{entry.date.slice(5)}</time>
                        <span className="tag-chip">{CONTACT_METHODS[entry.method]}</span>
                      </div>
                    </div>
                    {entry.note && <p>{entry.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )) : (
            <div className="empty-state">
              <span className="empty-icon"><BookOpen size={24} aria-hidden="true" /></span>
              <p className="empty-title">{entries.length ? '没有匹配的手记' : '还没有联系手记'}</p>
              {entries.length ? (
                <div className="empty-action"><button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setMethod('') }}>清除筛选</button></div>
              ) : (
                <>
                  <p className="empty-desc">打开一位联系人的档案，就可以写下第一条手记。</p>
                  <div className="empty-action"><Link className="btn btn-secondary" to="/people">浏览联系人</Link></div>
                </>
              )}
            </div>
          )}
        </section>

        <aside className="card journal-anniversaries" aria-labelledby="journal-anniversaries-heading">
          <CalendarDays size={23} strokeWidth={1.6} aria-hidden="true" />
          <h2 id="journal-anniversaries-heading">往年今日</h2>
          <p className="hint">{Number(date.slice(5, 7))} 月 {Number(date.slice(8))} 日</p>
          {pastEntries.length ? (
            <ul>
              {pastEntries.map(({ entry, person }) => (
                <li key={`${person.id}:${entry.id}`}>
                  <Link to={`/person/${encodeURIComponent(person.id)}`}>
                    {person.name}<ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <div className="hint"><time dateTime={entry.date}>{entry.date.slice(0, 4)} 年</time> · {CONTACT_METHODS[entry.method]}</div>
                  {entry.note && <p>{entry.note}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="hint journal-anniversaries-empty">暂无往年今天的记录。</p>}
        </aside>
      </div>
    </div>
  )
}
