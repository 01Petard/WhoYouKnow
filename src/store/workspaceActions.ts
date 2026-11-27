/**
 * [INPUT]: 读取当前 AppData，提交变更交由主状态仓库的保存队列。
 * [OUTPUT]: 提供 WorkspaceActions 与工作台写入实现。
 * [POS]: 工作台的写入边界。保存往来状态与发生日期时沿用原编号。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { AppData, City, CityTripInput, ExchangeInput, ExperienceInput, IntroductionInput, PeopleProjectInput, RelationshipReview } from '../types'
import { cityKey, cityPeople, isCity, isTripInput, normalizeCity, uniqueCities } from '../util/cities'
import { isDateOnly, today, uid } from '../util/id'
import { validExchange } from '../util/exchanges'
import { readReviews } from '../util/reviews'
import { introductionIssue, introductionRoles } from '../util/introductions'
import { isProjectInput } from '../util/projects'

export interface WorkspaceActions {
  saveExperience: (input: ExperienceInput, id?: string) => string | null
  deleteExperience: (id: string) => boolean
  saveIntroduction: (input: IntroductionInput, id?: string) => string | null
  saveProject: (input: PeopleProjectInput, id?: string) => string | null
  setContactCities: (id: string, currentCity: City | undefined, pastCities: City[]) => boolean
  saveTrip: (input: CityTripInput, id?: string) => string | null
  saveExchange: (input: ExchangeInput, id?: string) => string | null
  deleteExchange: (id: string) => boolean
  saveReview: (review: Omit<RelationshipReview, 'updatedAt'>) => boolean
}

export function workspaceActions(readData: () => AppData, commit: (patch: { data: AppData }) => boolean): WorkspaceActions {
  const nowIso = () => new Date().toISOString()
  return {
    saveExperience(input, id) {
      const data = readData()
      const experiences = data.experiences ?? []
      const title = input.title.trim()
      const participantIds = [...new Set(input.participantIds)]
      const peopleIds = new Set(data.people.map((person) => person.id))
      if (!title || !isDateOnly(input.date) || participantIds.some((personId) => !peopleIds.has(personId))) return null
      if (id ? !experiences.some((item) => item.id === id) : !participantIds.length) return null
      const entry = {
        ...input, id: id ?? uid(), title, participantIds,
        note: input.note.trim(), place: input.place.trim(), updatedAt: nowIso(),
      }
      const next = id ? experiences.map((item) => item.id === id ? entry : item) : [...experiences, entry]
      return commit({ data: { ...data, experiences: next } }) ? entry.id : null
    },

    deleteExperience(id) {
      const data = readData()
      if (!data.experiences?.some((item) => item.id === id)) return false
      return commit({ data: { ...data, experiences: data.experiences.filter((item) => item.id !== id) } })
    },

    saveIntroduction(input, id) {
      const data = readData()
      const introductions = data.introductions ?? []
      const previous = introductions.find((item) => item.id === id)
      if ((id && !previous) || introductionIssue(input)) return null
      const people = new Map(data.people.map((person) => [person.id, person]))
      const parties = { ...input.parties }
      for (const role of introductionRoles) {
        const party = parties[role]
        if (party.kind !== 'contact') continue
        const person = people.get(party.personId)
        const former = previous?.parties[role]
        if (!person && (former?.kind !== 'contact' || former.personId !== party.personId)) return null
        parties[role] = { ...party, name: person?.name ?? (former?.kind === 'contact' ? former.name : party.name) }
      }
      const entry = { ...input, parties, id: id ?? uid(), reason: input.reason.trim(), updatedAt: nowIso() }
      const next = previous ? introductions.map((item) => item === previous ? entry : item) : [...introductions, entry]
      return commit({ data: { ...data, introductions: next } }) ? entry.id : null
    },

    saveProject(input, id) {
      const data = readData()
      const projects = data.projects ?? []
      const previous = projects.find((item) => item.id === id)
      if ((id && !previous) || !isProjectInput(input)) return null
      const peopleIds = new Set(data.people.map((person) => person.id))
      if (input.members.some((member) => !peopleIds.has(member.id))) return null
      const memberIds = new Set(input.members.map((member) => member.id))
      const earlierTasks = new Map(previous?.tasks.map((task) => [task.id, task.memberId]))
      if (input.tasks.some((task) => task.memberId && !memberIds.has(task.memberId)
        && earlierTasks.get(task.id) !== task.memberId)) return null
      const updated = { ...input, id: id ?? uid(), name: input.name.trim(), description: input.description.trim(), updatedAt: nowIso() }
      const next = previous ? projects.map((item) => item === previous ? updated : item) : [...projects, updated]
      return commit({ data: { ...data, projects: next } }) ? updated.id : null
    },

    setContactCities(id, currentCity, pastCities) {
      const data = readData()
      if ((currentCity && !isCity(currentCity)) || pastCities.some((city) => !isCity(city))) return false
      if (!data.people.some((person) => person.id === id)) return false
      const current = currentCity ? normalizeCity(currentCity) : undefined
      const past = uniqueCities(pastCities).filter((city) => !current || cityKey(city) !== cityKey(current))
      const people = data.people.map((person) => person.id === id
        ? { ...person, currentCity: current, pastCities: past, updatedAt: nowIso() }
        : person)
      return commit({ data: { ...data, people } })
    },

    saveTrip(input, id) {
      const data = readData()
      const trips = data.trips ?? []
      const previous = trips.find((trip) => trip.id === id)
      if ((id && !previous) || !isTripInput(input)) return null
      const people = new Set(data.people.map((person) => person.id))
      const listed = cityPeople(data.people, input.city)
      const allowed = new Set([...listed.current.map((person) => person.id), ...listed.past.map((person) => person.id),
        ...(previous?.visits.map((visit) => visit.id) ?? [])])
      if (input.visits.some((visit) => !people.has(visit.id) || !allowed.has(visit.id))) return null
      const trip = { ...input, city: normalizeCity(input.city), id: id ?? uid(), updatedAt: nowIso() }
      const next = previous ? trips.map((item) => item === previous ? trip : item) : [...trips, trip]
      return commit({ data: { ...data, trips: next } }) ? trip.id : null
    },

    saveExchange(input, id) {
      const data = readData()
      const exchanges = data.exchanges ?? []
      const previous = exchanges.find((item) => item.id === id)
      if ((id && !previous) || !validExchange(input)) return null
      if (input.phase.status === 'occurred' && input.phase.date > today()) return null
      const person = data.people.find((item) => item.id === input.personId)
      const personName = person?.name ?? (previous?.personId === input.personId ? previous.personName : undefined)
      if (!personName) return null
      const exchange = { ...input, personName, id: id ?? uid(), content: input.content.trim(), updatedAt: nowIso() }
      const next = previous ? exchanges.map((item) => item === previous ? exchange : item) : [...exchanges, exchange]
      return commit({ data: { ...data, exchanges: next } }) ? exchange.id : null
    },

    deleteExchange(id) {
      const data = readData()
      if (!data.exchanges?.some((item) => item.id === id && item.phase.status === 'occurred')) return false
      return commit({ data: { ...data, exchanges: data.exchanges.filter((item) => item.id !== id) } })
    },

    saveReview(input) {
      const data = readData()
      const reviews = data.reviews ?? []
      const review = { ...input, title: input.title.trim(), updatedAt: nowIso() }
      if (!readReviews([review])) return false
      const next = reviews.some((item) => item.id === review.id)
        ? reviews.map((item) => item.id === review.id ? review : item)
        : [...reviews, review]
      return commit({ data: { ...data, reviews: next } })
    },
  }
}
