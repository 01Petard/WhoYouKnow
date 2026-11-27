/**
 * [INPUT]: 读取联系人和联系手记的数据模型。
 * [OUTPUT]: 提供联系方式、手记锚点、最新联系日期、时间线及往年今日查询。
 * [POS]: 统一目录、待联系和手记页使用的联系日期规则。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { ContactEntry, ContactMethod, Person } from '../types'

export const CONTACT_METHODS = {
  inPerson: '见面',
  call: '通话',
  message: '消息',
  other: '其他',
} as const satisfies Record<ContactMethod, string>

export function isContactMethod(value: unknown): value is ContactMethod {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONTACT_METHODS, value)
}

export function latestContactDate(person: Person): string | undefined {
  return (person.contactHistory ?? []).reduce<string | undefined>(
    (latest, entry) => !latest || entry.date > latest ? entry.date : latest,
    person.lastContactAt,
  )
}

export function compareContactEntries(a: ContactEntry, b: ContactEntry): number {
  return b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)
}

export function collectContactEntries(people: Person[]) {
  return people.flatMap((person) => (person.contactHistory ?? []).map((entry) => ({ person, entry })))
    .sort((a, b) => compareContactEntries(a.entry, b.entry))
}

export function wentByOnThisDay(date: string, currentDate: string): boolean {
  return date < currentDate && date.slice(5) === currentDate.slice(5)
}

export function journalAnchor(id: string): string {
  return `journal-entry-${encodeURIComponent(id)}`
}
