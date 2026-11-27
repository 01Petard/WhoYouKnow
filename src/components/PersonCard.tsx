/**
 * [INPUT]: 依赖 路由链接、联系人字段、所属圈子与星标。
 * [OUTPUT]: 导出 Avatar 和 PersonCard。
 * [POS]: 各页面共用头像，目录行展示姓名、分组、圈子和标签。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Circle, Person } from '../types'
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

export function PersonCard({ person, circles }: { person: Person; circles: Circle[] }) {
  const circleNames = circles.map(({ name }) => name).join('、')
  const tagNames = person.tags.join('、')
  const subtitle = person.channel
  const group = person.groups[0]
  const groupCount = person.groups.length - 1

  return (
    <Link className="person-card" to={`/person/${encodeURIComponent(person.id)}`}>
      <span className="directory-person">
        <Avatar person={person} />
        <span className="person-info">
          <span className="person-name-row">
            <span className="person-name">{person.name}</span>
            {person.important && <ImportantStar active />}
          </span>
          {subtitle && <span className="person-sub">{subtitle}</span>}
        </span>
      </span>
      <span className="person-groups">
        <span className="sr-only">分组：</span>
        {group ? (
          <>
            <span className="person-group" title={person.groups.join('、')}>{group}</span>
            {groupCount > 0 && <span className="person-group-count">+{groupCount}</span>}
          </>
        ) : <span className="person-muted">未分组</span>}
      </span>
      <span className="person-classification" title={circleNames || undefined}>
        <span className="sr-only">圈子：</span>{circleNames || '未加入圈子'}
      </span>
      <span className="person-classification" title={tagNames || undefined}>
        <span className="sr-only">标签：</span>{tagNames || '无标签'}
      </span>
      <ChevronRight className="person-chevron" size={16} aria-hidden="true" />
    </Link>
  )
}
