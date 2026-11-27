/**
 * [INPUT]: 读取联系手记、共同经历、回顾选编与实际日历间隔。
 * [OUTPUT]: 提供年份统计、重新联系记录、选编校验和 Markdown 导出。
 * [POS]: 统计及导出解析实时来源，选编只保存引用和用户短评。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { AppData, ContactEntry, Person, RelationshipReview, ReviewSelection, ReviewSource } from '../types'
import { collectContactEntries, compareContactEntries, CONTACT_METHODS, journalAnchor } from './contactJournal'
import { newestExperiences } from './experiences'
import { daysBetween } from './id'

export const reconnectGap = 180

export function summarizeYear(data: AppData, year: string) {
  const journal = collectContactEntries(data.people).filter(({ entry }) => entry.date.slice(0, 4) === year)
  const people = [...new Map(journal.map(({ person }) => [person.id, person])).values()]
  const events = newestExperiences((data.experiences ?? []).filter((item) => item.date.slice(0, 4) === year))
  const reconnected: { person: Person; entry: ContactEntry; gap: number }[] = []
  for (const person of data.people) {
    const entries = [...(person.contactHistory ?? [])].sort(compareContactEntries).reverse()
    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.date.slice(0, 4) !== year) continue
      const gap = daysBetween(entries[i - 1].date, entry.date)
      if (gap >= reconnectGap) reconnected.push({ person, entry, gap })
    }
  }
  return { journal, people, events, reconnected: reconnected.sort((a, b) => compareContactEntries(a.entry, b.entry)) }
}

export function reviewSourceId(source: ReviewSource): string {
  return JSON.stringify(source.kind === 'journal'
    ? [source.kind, source.personId, source.entryId]
    : [source.kind, source.entryId])
}

export function readReviews(raw: unknown): RelationshipReview[] | null {
  if (!Array.isArray(raw)) return null
  const ids = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item.id !== 'string' || !/^\d{4}$/.test(item.id) || ids.has(item.id)
      || typeof item.title !== 'string' || !item.title.trim() || typeof item.updatedAt !== 'string'
      || !Array.isArray(item.selections)) return null
    const selected = new Set()
    for (const choice of item.selections as ReviewSelection[]) {
      if (!choice || !choice.source || !['journal', 'experience'].includes(choice.source.kind)
        || typeof choice.source.entryId !== 'string' || !choice.source.entryId.trim()
        || (choice.source.kind === 'journal' && (typeof choice.source.personId !== 'string' || !choice.source.personId.trim()))
        || typeof choice.id !== 'string' || choice.id !== reviewSourceId(choice.source) || selected.has(choice.id)
        || typeof choice.comment !== 'string' || typeof choice.includeOriginal !== 'boolean'
        || typeof choice.updatedAt !== 'string') return null
      selected.add(choice.id)
    }
    ids.add(item.id)
  }
  return raw
}

export function reviewSources(data: AppData) {
  const peopleById = new Map(data.people.map((person) => [person.id, person]))
  const events = new Map((data.experiences ?? []).map((item) => [item.id, item]))
  const journal = new Map(data.people.map((person) => [person.id,
    new Map((person.contactHistory ?? []).map((entry) => [entry.id, entry]))]))
  return (source: ReviewSource) => {
    if (source.kind === 'experience') {
      const item = events.get(source.entryId)
      if (item) return { date: item.date, title: item.title, href: `/experiences/${encodeURIComponent(item.id)}`, note: '' }
    } else {
      const person = peopleById.get(source.personId)
      const entry = journal.get(source.personId)?.get(source.entryId)
      if (person && entry) return { date: entry.date, title: `${person.name} · ${CONTACT_METHODS[entry.method]}`,
        href: `/person/${encodeURIComponent(person.id)}#${journalAnchor(entry.id)}`, note: entry.note }
    }
    return undefined
  }
}

function markdownText(value: string) {
  return value.replace(/[\\`*_{}\[\]()#+.!<>|~-]/g, '\\$&')
}

export function reviewMarkdown(review: RelationshipReview, sourceFor: ReturnType<typeof reviewSources>): string {
  const lines = [`# ${markdownText(review.title.replace(/\s+/g, ' '))}`, '', `回顾年份 ${review.id}`]
  for (const selection of review.selections) {
    const source = sourceFor(selection.source)
    const details = source ? `${source.date} · ${source.title}` : '来源已移除'
    lines.push('', `## ${markdownText(details.replace(/\s+/g, ' '))}`)
    if (selection.comment.trim()) lines.push('', markdownText(selection.comment.trim()))
    if (selection.includeOriginal && source?.note) {
      lines.push('', ...source.note.split(/\r?\n/).map((line) => `> ${markdownText(line)}`))
    }
  }
  return lines.join('\n') + '\n'
}
