/**
 * [INPUT]: 依赖 React 元素标识、路由链接、联系人字段与星标。
 * [OUTPUT]: 导出 Avatar 和 PersonCard。
 * [POS]: 各页面共用头像，目录行展示姓名、分组与上次联系日期。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Person } from '../types'
import { initials } from '../util/format'
import { ImportantStar } from './RelationshipBadge'

export function Avatar({ person, small = false }: { person: Pick<Person, 'name' | 'avatar'>; small?: boolean }) {
  const name = person.name.trim()
  const tone = ((name.codePointAt(0) ?? 0) + (name.codePointAt(name.length - 1) ?? 0)) % 5

  return (
    <span className={`avatar${small ? ' avatar-sm' : ''}`} data-tone={tone} aria-hidden="true">
      {person.avatar ? <img src={person.avatar} alt="" /> : initials(name)}
    </span>
  )
}

export function PersonCard({ person }: { person: Person }) {
  const contactDateId = useId()
  const subtitle = person.channel || person.tags.slice(0, 2).join('、')
  const group = person.groups[0]
  const groupCount = person.groups.length - 1

  return (
    <Link className="person-card" to={`/person/${encodeURIComponent(person.id)}`} aria-label={`查看 ${person.name} 的详情`} aria-describedby={contactDateId}>
      <span className="directory-person">
        <Avatar person={person} />
        <span className="person-info">
          <span className="person-name-row">
            <span className="person-name">{person.name}</span>
            {person.important && <ImportantStar active />}
          </span>
          {(subtitle || group) && <span className="person-sub">{subtitle || group}</span>}
        </span>
      </span>
      <span className="person-groups">
        {group ? (
          <>
            <span className="person-group" title={person.groups.join('、')}>{group}</span>
            {groupCount > 0 && <span className="person-group-count">+{groupCount}</span>}
          </>
        ) : <span className="person-muted">未分组</span>}
      </span>
      <span id={contactDateId} className={`person-contact-date tabular${person.lastContactAt ? '' : ' person-muted'}`}>
        <span className="sr-only">上次联系：</span>
        {person.lastContactAt ? <time dateTime={person.lastContactAt}>{person.lastContactAt}</time> : '未记录'}
      </span>
      <ChevronRight className="person-chevron" size={16} aria-hidden="true" />
    </Link>
  )
}
