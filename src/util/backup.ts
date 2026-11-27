/**
 * [INPUT]: 依赖 ../types 的 AppData/BackupFile/Circle/Person 等；依赖 ./constants 的 DATA_VERSION；依赖 ./id 和 ./contactJournal 校验联系日期和方式；依赖浏览器 FileReader
 * [OUTPUT]: 导出 ValidationResult、validateBackup、makeBackup、readJsonFile、readTextFile
 * [POS]: 校验与序列化 JSON 备份。旧 selfId 迁移为 me。共同经历保留有效的参与人引用。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { AppData, BackupFile, Circle, ContactEntry, Experience, Gender, Person } from '../types'
import { DATA_VERSION } from './constants'
import { isContactMethod } from './contactJournal'
import { isDateOnly } from './id'

export type ValidationResult =
  | { ok: true; data: AppData; exportedAt?: string }
  | { ok: false; reason: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const asGender = (value: unknown): Gender | undefined =>
  value === '男' || value === '女' || value === '其他' ? value : undefined
const asIso = (value: unknown): string =>
  typeof value === 'string' ? value : new Date(0).toISOString()

/** JSON 备份结构校验：版本 / 必需字段 / 引用完整性，失败不允许部分恢复 */
export function validateBackup(raw: unknown): ValidationResult {
  if (!isRecord(raw)) return { ok: false, reason: '这不是 WhoYouKnow 的备份文件' }
  if (typeof raw.version !== 'number') return { ok: false, reason: '这不是 WhoYouKnow 的备份文件' }
  if (raw.version !== DATA_VERSION) {
    return { ok: false, reason: `版本不兼容：备份版本 ${raw.version}，当前应用版本 ${DATA_VERSION}` }
  }
  const arrays = ['people', 'tags', 'groups']
  for (const key of arrays) {
    if (!Array.isArray(raw[key])) return { ok: false, reason: `备份缺少「${key}」字段或格式错误` }
  }

  const rawPeople = raw.people as unknown[]
  const tags = asStringArray(raw.tags)
  const groups = asStringArray(raw.groups)
  if (tags.length !== (raw.tags as unknown[]).length || groups.length !== (raw.groups as unknown[]).length) {
    return { ok: false, reason: '标签或分组格式错误' }
  }

  // 旧版 friendships 只用于迁移：重要标记与空备注回填；状态、复查、方向全部丢弃
  const importantIds = new Set<string>()
  const legacyNoteById = new Map<string, string>()
  if (Array.isArray(raw.friendships)) {
    for (const item of raw.friendships) {
      if (!isRecord(item) || typeof item.personId !== 'string') continue
      if (item.importance === '重要') importantIds.add(item.personId)
      const note = asString(item.statusNote).trim()
      if (note) legacyNoteById.set(item.personId, note)
    }
  }

  const normalizePerson = (item: Record<string, unknown>): Person | string => {
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || !item.name.trim()) {
      return '人物数据中存在缺失 id 或姓名的记录'
    }
    const entries: ContactEntry[] = []
    if (item.contactHistory !== undefined) {
      if (!Array.isArray(item.contactHistory)) return '联系手记格式错误'
      const ids = new Set<string>()
      for (const entry of item.contactHistory) {
        if (
          !isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id)
          || !isDateOnly(entry.date) || !isContactMethod(entry.method) || typeof entry.note !== 'string'
          || typeof entry.updatedAt !== 'string'
        ) return '联系手记包含重复编号或无效字段'
        ids.add(entry.id)
        entries.push({ id: entry.id, date: entry.date, method: entry.method, note: entry.note, updatedAt: entry.updatedAt })
      }
    }
    return {
      id: item.id,
      name: item.name,
      avatar: typeof item.avatar === 'string' ? item.avatar : undefined,
      gender: asGender(item.gender),
      birthday: typeof item.birthday === 'string' ? item.birthday : undefined,
      channel: asString(item.channel),
      metAt: asString(item.metAt),
      lastContactAt: isDateOnly(item.lastContactAt) ? item.lastContactAt : undefined,
      contactHistory: entries.length ? entries : undefined,
      note: asString(item.note) || legacyNoteById.get(item.id) || '',
      tags: asStringArray(item.tags),
      groups: asStringArray(item.groups),
      practical: item.practical === true ? true : undefined,
      important: item.important === true || importantIds.has(item.id) ? true : undefined,
      createdAt: asIso(item.createdAt),
      updatedAt: asIso(item.updatedAt),
    }
  }

  const peopleById = new Map<string, Person>()
  for (const item of rawPeople) {
    if (!isRecord(item)) return { ok: false, reason: '人物数据格式错误' }
    const person = normalizePerson(item)
    if (typeof person === 'string') return { ok: false, reason: person }
    if (peopleById.has(person.id)) return { ok: false, reason: `人物 id 重复：${person.id}` }
    peopleById.set(person.id, person)
  }

  // 当前用户单独存放：新格式读取 me；旧格式把 selfId 指向的联系人迁移成 me
  let me: Person | null = null
  const rawMe = (raw as Record<string, unknown>).me
  if (rawMe !== undefined && rawMe !== null) {
    if (!isRecord(rawMe)) return { ok: false, reason: '「我的信息」格式错误' }
    const normalized = normalizePerson(rawMe)
    if (typeof normalized === 'string') return { ok: false, reason: '「我的信息」缺少 id 或姓名' }
    me = normalized
    peopleById.delete(me.id)
  } else {
    const rawSelfId = (raw as Record<string, unknown>).selfId
    if (rawSelfId !== undefined && rawSelfId !== null) {
      if (typeof rawSelfId !== 'string' || !peopleById.has(rawSelfId)) {
        return { ok: false, reason: '「当前用户」标记引用了不存在的人物' }
      }
      me = peopleById.get(rawSelfId)!
      peopleById.delete(rawSelfId)
    }
  }

  const people = [...peopleById.values()]

  // circles 为增量可选字段：缺失（旧备份/旧数据）按空数组处理；存在则校验结构，
  // 并丢弃已不存在的分组引用，避免悬空指向
  const rawCircles = (raw as Record<string, unknown>).circles
  if (rawCircles !== undefined && rawCircles !== null && !Array.isArray(rawCircles)) {
    return { ok: false, reason: '圈子数据格式错误' }
  }
  const circleIds = new Set<string>()
  const circles: Circle[] = []
  for (const item of (rawCircles ?? []) as unknown[]) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || !item.name.trim()) {
      return { ok: false, reason: '圈子数据存在缺失 id 或名称的记录' }
    }
    if (circleIds.has(item.id)) return { ok: false, reason: `圈子 id 重复：${item.id}` }
    circleIds.add(item.id)
    if (item.groups !== undefined && !Array.isArray(item.groups)) {
      return { ok: false, reason: '圈子包含的分组格式错误' }
    }
    const circleGroups: unknown[] = Array.isArray(item.groups) ? item.groups : []
    if (circleGroups.some((g) => typeof g !== 'string')) {
      return { ok: false, reason: '圈子包含的分组格式错误' }
    }
    circles.push({
      id: item.id,
      name: item.name.trim(),
      groups: [...new Set(circleGroups.filter((g): g is string => typeof g === 'string' && groups.includes(g)))],
      createdAt: asIso(item.createdAt),
      updatedAt: asIso(item.updatedAt),
    })
  }

  const experiences: Experience[] = []
  if (raw.experiences !== undefined) {
    if (!Array.isArray(raw.experiences)) return { ok: false, reason: '共同经历格式错误' }
    const ids = new Set<string>()
    for (const item of raw.experiences) {
      if (
        !isRecord(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)
        || typeof item.title !== 'string' || !item.title.trim() || !isDateOnly(item.date)
        || typeof item.place !== 'string' || typeof item.note !== 'string' || typeof item.updatedAt !== 'string'
        || !Array.isArray(item.participantIds) || item.participantIds.some((id) => typeof id !== 'string')
      ) return { ok: false, reason: '共同经历包含重复编号或无效字段' }
      ids.add(item.id)
      experiences.push({
        id: item.id, title: item.title.trim(), date: item.date, place: item.place,
        note: item.note, updatedAt: item.updatedAt,
        participantIds: [...new Set<string>(item.participantIds)].filter((id) => peopleById.has(id)),
      })
    }
  }

  return {
    ok: true,
    data: {
      version: DATA_VERSION,
      people,
      tags,
      groups,
      circles,
      ...(raw.experiences !== undefined ? { experiences } : {}),
      me,
    },
    exportedAt: typeof (raw as Record<string, unknown>).exportedAt === 'string'
      ? (raw as Record<string, unknown>).exportedAt as string
      : undefined,
  }
}

export function makeBackup(data: AppData): BackupFile {
  return { ...data, exportedAt: new Date().toISOString() }
}

export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result).replace(/^﻿/, '')))
      } catch {
        reject(new Error('文件不是有效的 JSON'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}
