/**
 * [INPUT]: 依赖 react 的 ReactNode；依赖 lucide-react 的 ChevronRight；依赖 ../types 的 Person；依赖 ../util/format 的 formatDate/initials；依赖 ./RelationshipBadge 的 ImportantStar
 * [OUTPUT]: 导出 Avatar 与 PersonCard 组件
 * [POS]: 联系人头像与网格卡片；展示姓名、分组/标签摘要与重要标记；当前用户不在 people 中
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Person } from '../types'
import { formatDate, initials } from '../util/format'
import { ImportantStar } from './RelationshipBadge'

export function Avatar({ person, small = false }: { person: Pick<Person, 'name' | 'avatar'>; small?: boolean }) {
  return (
    <span className={`avatar${small ? ' avatar-sm' : ''}`} aria-hidden="true">
      {person.avatar ? <img src={person.avatar} alt="" /> : initials(person.name)}
    </span>
  )
}

interface PersonCardProps {
  person: Person
  onClick: () => void
  rightSlot?: ReactNode
}

export function PersonCard({ person, onClick, rightSlot }: PersonCardProps) {
  const sub = [
    person.groups.slice(0, 2).join('、') || undefined,
    person.tags.slice(0, 3).join('、') || undefined,
    person.channel || undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button type="button" className="person-card" onClick={onClick} aria-label={`查看 ${person.name} 的详情`}>
      <Avatar person={person} />
      <span className="person-info">
        <span className="person-name-row">
          {person.important && <ImportantStar active />}
          <span className="person-name">{person.name}</span>
        </span>
        <span className="person-sub">{sub || `添加于 ${formatDate(person.createdAt)}`}</span>
      </span>
      <span className="person-right">
        {rightSlot}
        <ChevronRight className="chevron" size={16} aria-hidden="true" />
      </span>
    </button>
  )
}
