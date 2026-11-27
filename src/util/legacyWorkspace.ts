/**
 * [INPUT]: 读取旧版本快照里的引荐、项目、居住城市和行程。
 * [OUTPUT]: 提供旧字段的结构校验和城市规范化。
 * [POS]: 保留现有快照和 JSON 备份中的历史字段。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { City, CityTrip, Introduction, IntroductionParty, PeopleProject } from '../types'
import { isDateOnly } from './id'

const introductionRoles = ['requester', 'introducer', 'target'] as const
const introductionStatuses = new Set(['pending', 'requested', 'completed', 'closed'])
const visitStatuses = new Set(['interested', 'scheduled', 'met', 'cancelled'])

function isRow(value: unknown): value is { id: string; updatedAt: string } {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<{ id: string; updatedAt: string }>
  return typeof row.id === 'string' && Boolean(row.id.trim()) && typeof row.updatedAt === 'string'
}

function isProjectInput(input: PeopleProject): boolean {
  if (typeof input.name !== 'string' || !input.name.trim() || typeof input.description !== 'string'
    || typeof input.archived !== 'boolean' || !Array.isArray(input.members) || !Array.isArray(input.tasks)) return false
  if (input.members.some((member) => !isRow(member) || typeof member.role !== 'string' || typeof member.progress !== 'string')) return false
  if (input.tasks.some((task) => !isRow(task) || typeof task.title !== 'string' || !task.title.trim()
    || typeof task.done !== 'boolean' || (task.due !== '' && !isDateOnly(task.due))
    || (task.memberId !== undefined && (typeof task.memberId !== 'string' || !task.memberId.trim())))) return false
  return new Set(input.members.map((member) => member.id)).size === input.members.length
    && new Set(input.tasks.map((task) => task.id)).size === input.tasks.length
}

export function readProjects(raw: unknown): PeopleProject[] | null {
  if (!Array.isArray(raw)) return null
  const ids = new Set<string>()
  for (const item of raw) {
    if (!isRow(item) || ids.has(item.id) || !isProjectInput(item as PeopleProject)) return null
    ids.add(item.id)
  }
  return raw
}

export function isCity(value: unknown): value is City {
  if (!value || typeof value !== 'object') return false
  const city = value as Partial<City>
  return typeof city.name === 'string' && Boolean(city.name.trim()) && typeof city.region === 'string'
}

export function cityKey(city: City): string {
  return JSON.stringify([city.name.trim().toLowerCase(), city.region.trim().toLowerCase()])
}

export function cityLabel(city: City): string {
  return city.region ? `${city.name} · ${city.region}` : city.name
}

export function normalizeCity(city: City): City {
  return { name: city.name.trim(), region: city.region.trim() }
}

export function uniqueCities(cities: City[]): City[] {
  return [...new Map(cities.map((city) => [cityKey(city), normalizeCity(city)])).values()]
}

function isTripInput(input: CityTrip): boolean {
  if (!isCity(input.city) || !isDateOnly(input.start) || !isDateOnly(input.end) || input.start > input.end
    || !Array.isArray(input.visits)) return false
  if (input.visits.some((visit) => !visit || typeof visit.id !== 'string' || !visit.id.trim()
    || !visitStatuses.has(visit.status) || (visit.date !== '' && !isDateOnly(visit.date))
    || typeof visit.note !== 'string' || typeof visit.updatedAt !== 'string')) return false
  return new Set(input.visits.map((visit) => visit.id)).size === input.visits.length
}

export function readCityTrips(value: unknown): CityTrip[] | null {
  if (!Array.isArray(value)) return null
  const ids = new Set<string>()
  for (const trip of value) {
    if (!trip || typeof trip.id !== 'string' || !trip.id.trim() || ids.has(trip.id)
      || typeof trip.updatedAt !== 'string' || !isTripInput(trip)) return null
    ids.add(trip.id)
  }
  return value
}

function isParty(value: unknown): value is IntroductionParty {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<{ kind: string; personId: string; name: string }>
  return item.kind === 'self'
    || (typeof item.name === 'string' && Boolean(item.name.trim())
      && (item.kind === 'unlisted' || (item.kind === 'contact' && typeof item.personId === 'string' && Boolean(item.personId.trim()))))
}

function validIntroduction(input: Introduction): boolean {
  if (!input.parties || introductionRoles.some((role) => !isParty(input.parties[role]))) return false
  if (!isDateOnly(input.date)) return false
  if (typeof input.reason !== 'string' || !input.reason.trim()) return false
  if (!introductionStatuses.has(input.status)) return false
  const { parties } = input
  if (parties.requester.kind === 'unlisted' || parties.introducer.kind === 'unlisted') return false
  const selected = introductionRoles.map((role) => parties[role])
  if (!selected.some((party) => party.kind === 'self')) return false
  const keys = selected.map((party) => party.kind === 'contact' ? `contact:${party.personId}` : party.kind)
  return new Set(keys).size === keys.length
}

export function readIntroductions(raw: unknown): Introduction[] | null {
  if (!Array.isArray(raw)) return null
  const ids = new Set<string>()
  for (const item of raw) {
    if (!isRow(item) || ids.has(item.id) || !validIntroduction(item as Introduction)) return null
    ids.add(item.id)
  }
  return raw
}
