/**
 * [INPUT]: 读取联系人城市、行程与约见记录。
 * [OUTPUT]: 提供城市去重、目录查询、行程校验和引用清理。
 * [POS]: 用城市名及地区区分同名城市，用联系人编号保留原行程候选。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { City, CityTrip, CityTripInput, Person, VisitStatus } from '../types'
import { isDateOnly } from './id'

export const visitStatusLabels: Record<VisitStatus, string> = {
  interested: '想约', scheduled: '已约', met: '已见面', cancelled: '取消',
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

export function knownCities(people: Person[], trips: CityTrip[] = []): City[] {
  return uniqueCities([
    ...trips.map((trip) => trip.city),
    ...people.flatMap((person) => [...(person.pastCities ?? []), ...(person.currentCity ? [person.currentCity] : [])]),
  ]).sort((a, b) => cityLabel(a).localeCompare(cityLabel(b), 'zh-CN'))
}

export function cityPeople(people: Person[], city: City) {
  const key = cityKey(city)
  const current: Person[] = []
  const past: Person[] = []
  for (const person of people) {
    if (person.currentCity && cityKey(person.currentCity) === key) current.push(person)
    else if (person.pastCities?.some((item) => cityKey(item) === key)) past.push(person)
  }
  return { current, past }
}

export function isTripInput(input: CityTripInput): boolean {
  if (!isCity(input.city) || !isDateOnly(input.start) || !isDateOnly(input.end) || input.start > input.end
    || !Array.isArray(input.visits)) return false
  if (input.visits.some((visit) => !visit || typeof visit.id !== 'string' || !visit.id.trim()
    || !Object.prototype.hasOwnProperty.call(visitStatusLabels, visit.status) || (visit.date !== '' && !isDateOnly(visit.date))
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

export function filterTripVisits(trip: CityTrip, peopleIds: ReadonlySet<string>): CityTrip {
  const visits = trip.visits.filter((visit) => peopleIds.has(visit.id))
  return visits.length === trip.visits.length ? trip : { ...trip, visits }
}
