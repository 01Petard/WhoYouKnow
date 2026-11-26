/**
 * [INPUT]: 依赖 zustand 的 create；依赖 ../types 全部领域类型；依赖 ../util/constants 的 DATA_VERSION；依赖 ../util/id 的 today/uid；依赖 ../util/csv 的 ParsedCsvRow；依赖 ../util/storage 的 bootstrap/persist/reloadFromFile
 * [OUTPUT]: 导出 useStore、UiState、emptyData，并再导出 today
 * [POS]: 管理联系人、联系手记和我的资料；常规改动即时更新界面，备份恢复等待持久化。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { create } from 'zustand'
import {
  type AppData,
  type Circle,
  type ContactEntryInput,
  type FilterState,
  type Person,
  type PeopleView,
  type PersonInput,
  type StorageKind,
} from '../types'
import { isContactMethod } from '../util/contactJournal'
import { DATA_VERSION } from '../util/constants'
import { isDateOnly, today, uid } from '../util/id'
import type { ParsedCsvRow } from '../util/csv'
import { bootstrap, persist, reloadFromFile, type PersistResult } from '../util/storage'

export interface UiState {
  peopleSearch: string
  peopleView: PeopleView
  peopleFilter: FilterState
  networkSearch: string
}

const initialUi: UiState = {
  peopleSearch: '',
  peopleView: 'all',
  peopleFilter: { groups: [], circles: [], tags: [] },
  networkSearch: '',
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    people: [],
    tags: [],
    groups: [],
    circles: [],
    me: null,
  }
}

interface Persisted {
  data: AppData
}

const nowIso = () => new Date().toISOString()

/** 两个列表是否包含完全相同的元素集合（顺序无关） */
function sameSet(source: string[], next: string[]): boolean {
  if (source.length !== next.length || new Set(next).size !== next.length) return false
  const set = new Set(source)
  return next.every((item) => set.has(item))
}

/** 在数组中上移/下移一项；越界返回 null */
function moveItem<T>(list: T[], item: T, delta: number): T[] | null {
  const index = list.indexOf(item)
  const target = index + delta
  if (index < 0 || target < 0 || target >= list.length) return null
  const next = [...list]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

function collectVocabulary(data: AppData, tags: string[], groups: string[]): Pick<AppData, 'tags' | 'groups'> {
  return {
    tags: [...new Set([...data.tags, ...tags.filter(Boolean)])],
    groups: [...new Set([...data.groups, ...groups.filter(Boolean)])],
  }
}

function makePerson(input: PersonInput): Person {
  const t = nowIso()
  return {
    id: uid(),
    name: input.name.trim(),
    avatar: input.avatar,
    gender: input.gender,
    birthday: input.birthday || undefined,
    channel: input.channel?.trim() ?? '',
    metAt: input.metAt?.trim() ?? '',
    note: input.note?.trim() ?? '',
    tags: [...new Set((input.tags ?? []).filter(Boolean))],
    groups: [...new Set((input.groups ?? []).filter(Boolean))],
    createdAt: t,
    updatedAt: t,
  }
}

interface Store extends Persisted {
  ui: UiState
  storageError: boolean
  storageSaving: boolean
  storageSettled: () => Promise<PersistResult | undefined>
  /** 启动加载是否完成：未完成前页面显示加载态，避免异步加载与操作竞态 */
  hydrated: boolean
  /** 当前生效的存储方式：项目文件或浏览器本地回退 */
  storageKind: StorageKind
  /** 存储降级/异常提示 */
  storageNotice?: string
  /** 启动：读取项目数据文件；可被多次调用 */
  hydrate: () => Promise<void>
  /** 立即把当前内存数据写入项目文件 */
  storageSaveNow: () => Promise<PersistResult>
  /** 重新读取项目数据文件并替换当前内存数据 */
  storageReload: () => Promise<boolean>
  /** 常规操作返回是否接受修改；持久化结果通过 storageSettled 读取 */
  addPerson: (input: PersonInput) => boolean
  updatePerson: (id: string, input: PersonInput) => boolean
  deletePerson: (id: string) => boolean
  /** 创建当前用户资料；已存在则失败 */
  createMe: (input: PersonInput) => boolean
  /** 更新当前用户资料；未创建则失败 */
  updateMe: (input: PersonInput) => boolean
  /** 把一位已有联系人迁移成「我」：从 people 移除，并清理涉及 TA 的关系边 */
  adoptAsMe: (personId: string) => boolean
  setLastContact: (id: string, date?: string) => boolean
  saveContactEntry: (personId: string, input: ContactEntryInput, entryId?: string) => boolean
  deleteContactEntry: (personId: string, entryId: string) => boolean
  setImportance: (id: string, important: boolean) => boolean
  addTag: (name: string) => boolean
  renameTag: (oldName: string, newName: string) => boolean
  removeTag: (name: string) => number
  /** 上移/下移一位：delta 为 -1 或 1；用于标签、分组、圈子的自定义排序 */
  moveTag: (name: string, delta: number) => boolean
  /** 按给定顺序重排标签；names 必须与现有集合完全一致 */
  reorderTags: (names: string[]) => boolean
  addGroup: (name: string) => boolean
  renameGroup: (oldName: string, newName: string) => boolean
  removeGroup: (name: string) => number
  moveGroup: (name: string, delta: number) => boolean
  reorderGroups: (names: string[]) => boolean
  /** 批量把成员加入分组（分组不存在时一并创建）；返回实际新增的成员数 */
  addToGroup: (name: string, personIds: string[]) => number
  /** 给单个成员补一个已有标签；已存在则视为成功 */
  addTagToPerson: (tag: string, personId: string) => boolean
  /** 把单个成员移出分组，不删除人物；返回是否成功 */
  removeFromGroup: (name: string, personId: string) => boolean
  /** 新建圈子：只保存分组组合，成员由分组派生 */
  addCircle: (name: string, groups: string[]) => boolean
  renameCircle: (id: string, name: string) => boolean
  /** 设置圈子包含的分组；不存在的分组名会被忽略 */
  setCircleGroups: (id: string, groups: string[]) => boolean
  removeCircle: (id: string) => boolean
  moveCircle: (id: string, delta: number) => boolean
  reorderCircles: (ids: string[]) => boolean
  /** 按姓名导入：新姓名新增；同名增量更新；与「我的信息」同名的行自动跳过 */
  importPeople: (rows: ParsedCsvRow[]) => { added: number; merged: number; skippedSelf: number } | null
  restoreData: (data: AppData) => Promise<PersistResult | undefined>
  resetData: () => boolean
  setUi: (patch: Partial<UiState>) => void
  resetUi: () => void
}

export const useStore = create<Store>((set, get) => {
  let commitSeq = 0
  let save: Promise<PersistResult> | undefined
  let hydration: Promise<void> | undefined
  let restoring = false

  function saveData(nextData: AppData, replace = false): Promise<PersistResult> {
    const prior = get()
    const previous = prior.data
    const seq = ++commitSeq
    set({
      ...(replace ? {} : { data: nextData }),
      storageSaving: true,
      storageError: false,
      storageNotice: undefined,
    })
    save = persist({ data: nextData }, previous, replace).then((result) => {
      if (seq === commitSeq) {
        set({
          data: result.data,
          storageSaving: false,
          storageError: replace && !result.ok ? prior.storageError : !result.ok,
          storageNotice: replace && !result.ok ? prior.storageNotice : result.notice,
          storageKind: replace && !result.ok ? prior.storageKind : result.kind,
        })
      }
      return result
    })
    return save
  }

  function commit(patch: Partial<Persisted>): boolean {
    if (restoring) return false
    void saveData(patch.data ?? get().data)
    return true
  }

  return {
    data: emptyData(),
    ui: initialUi,
    storageError: false,
    storageSaving: false,
    hydrated: false,
    storageKind: 'file',
    storageSettled: async () => save,

    hydrate() {
      hydration ??= bootstrap({ data: get().data }).then((result) => {
        set({
          data: result.snapshot.data,
          storageKind: result.kind,
          storageNotice: result.notice,
          storageError: result.error ?? false,
          hydrated: true,
        })
      })
      return hydration
    },

    storageSaveNow() {
      return restoring && save ? save : saveData(get().data)
    },

    async storageReload() {
      if (get().storageSaving) return false
      const seq = commitSeq
      const snapshot = await reloadFromFile()
      if (seq !== commitSeq) return false
      if (!snapshot) {
        if (!get().storageNotice) set({ storageNotice: '暂时无法重新读取项目文件' })
        return false
      }
      set({
        data: snapshot.data,
        ui: initialUi,
        storageError: false,
        storageKind: 'file',
        storageNotice: undefined,
      })
      return true
    },

    addPerson(input) {
      const data = get().data
      const person = makePerson(input)
      return commit({
        data: {
          ...data,
          people: [...data.people, person],
          ...collectVocabulary(data, person.tags, person.groups),
        },
      })
    },

    updatePerson(id, input) {
      const data = get().data
      const previous = data.people.find((p) => p.id === id)
      const person = makePerson(input)
      const updated: Person = {
        ...person,
        id,
        important: previous?.important,
        lastContactAt: previous?.lastContactAt,
        contactHistory: previous?.contactHistory,
        createdAt: previous?.createdAt ?? person.createdAt,
      }
      return commit({
        data: {
          ...data,
          people: data.people.map((p) => (p.id === id ? updated : p)),
          ...collectVocabulary(data, updated.tags, updated.groups),
        },
      })
    },

    deletePerson(id) {
      const data = get().data
      return commit({
        data: {
          ...data,
          people: data.people.filter((p) => p.id !== id),
        },
      })
    },

    createMe(input) {
      const data = get().data
      if (data.me) return false
      const me = makePerson(input)
      return commit({
        data: { ...data, me, ...collectVocabulary(data, me.tags, me.groups) },
      })
    },

    updateMe(input) {
      const data = get().data
      if (!data.me) return false
      const person = makePerson(input)
      const me: Person = {
        ...person, id: data.me.id, createdAt: data.me.createdAt, contactHistory: data.me.contactHistory,
      }
      return commit({
        data: { ...data, me, ...collectVocabulary(data, me.tags, me.groups) },
      })
    },

    adoptAsMe(personId) {
      const data = get().data
      if (data.me) return false
      const person = data.people.find((p) => p.id === personId)
      if (!person) return false
      return commit({
        data: {
          ...data,
          me: person,
          people: data.people.filter((p) => p.id !== personId),
        },
      })
    },

    setLastContact(id, date) {
      if (date !== undefined && (!isDateOnly(date) || date > today())) return false
      const data = get().data
      const person = data.people.find((item) => item.id === id)
      if (!person) return false
      if (person.lastContactAt === date) return true
      return commit({
        data: {
          ...data,
          people: data.people.map((item) =>
            item.id === id ? { ...item, lastContactAt: date, updatedAt: nowIso() } : item,
          ),
        },
      })
    },

    saveContactEntry(personId, input, entryId) {
      if (!isDateOnly(input.date) || input.date > today() || !isContactMethod(input.method)) return false
      const data = get().data
      const person = data.people.find((item) => item.id === personId)
      if (!person) return false
      const history = person.contactHistory ?? []
      if (entryId && !history.some((entry) => entry.id === entryId)) return false
      const updatedAt = nowIso()
      const entry = { id: entryId ?? uid(), date: input.date, method: input.method, note: input.note.trim(), updatedAt }
      const contactHistory = entryId ? history.map((item) => item.id === entryId ? entry : item) : [...history, entry]
      return commit({
        data: { ...data, people: data.people.map((item) => item === person ? { ...person, contactHistory, updatedAt } : item) },
      })
    },

    deleteContactEntry(personId, entryId) {
      const data = get().data
      const person = data.people.find((item) => item.id === personId)
      if (!person?.contactHistory?.some((entry) => entry.id === entryId)) return false
      const remaining = person.contactHistory.filter((entry) => entry.id !== entryId)
      const updated = { ...person, contactHistory: remaining.length ? remaining : undefined, updatedAt: nowIso() }
      return commit({ data: { ...data, people: data.people.map((item) => item === person ? updated : item) } })
    },

    setImportance(id, important) {
      const data = get().data
      if (!data.people.some((p) => p.id === id)) return false
      return commit({
        data: {
          ...data,
          people: data.people.map((p) =>
            p.id === id ? { ...p, important, updatedAt: nowIso() } : p,
          ),
        },
      })
    },

    addTag(name) {
      const clean = name.trim()
      const data = get().data
      if (!clean || data.tags.includes(clean)) return false
      return commit({ data: { ...data, tags: [...data.tags, clean] } })
    },
    moveTag(name, delta) {
      const data = get().data
      const next = moveItem(data.tags, name, delta)
      if (!next) return false
      return commit({ data: { ...data, tags: next } })
    },
    reorderTags(names) {
      const data = get().data
      if (!sameSet(data.tags, names)) return false
      return commit({ data: { ...data, tags: names } })
    },
    renameTag(oldName, newName) {
      const clean = newName.trim()
      const data = get().data
      if (!clean) return false
      // 名称未变视为成功：重命名弹窗直接保存不应报「已存在」
      if (clean === oldName) return data.tags.includes(oldName)
      if (data.tags.includes(clean)) return false
      return commit({
        data: {
          ...data,
          tags: data.tags.map((t) => (t === oldName ? clean : t)),
          people: data.people.map((p) => ({
            ...p,
            tags: p.tags.map((t) => (t === oldName ? clean : t)),
            updatedAt: nowIso(),
          })),
        },
      })
    },
    removeTag(name) {
      const data = get().data
      const affected = data.people.filter((p) => p.tags.includes(name)).length
      const ok = commit({
        data: {
          ...data,
          tags: data.tags.filter((t) => t !== name),
          people: data.people.map((p) =>
            p.tags.includes(name) ? { ...p, tags: p.tags.filter((t) => t !== name), updatedAt: nowIso() } : p,
          ),
        },
      })
      return ok ? affected : -1
    },
    addGroup(name) {
      const clean = name.trim()
      const data = get().data
      if (!clean || data.groups.includes(clean)) return false
      return commit({ data: { ...data, groups: [...data.groups, clean] } })
    },
    moveGroup(name, delta) {
      const data = get().data
      const next = moveItem(data.groups, name, delta)
      if (!next) return false
      return commit({ data: { ...data, groups: next } })
    },
    reorderGroups(names) {
      const data = get().data
      if (!sameSet(data.groups, names)) return false
      return commit({ data: { ...data, groups: names } })
    },
    renameGroup(oldName, newName) {
      const clean = newName.trim()
      const data = get().data
      if (!clean) return false
      // 名称未变视为成功：重命名弹窗直接保存不应报「已存在」
      if (clean === oldName) return data.groups.includes(oldName)
      if (data.groups.includes(clean)) return false
      const t = nowIso()
      return commit({
        data: {
          ...data,
          groups: data.groups.map((g) => (g === oldName ? clean : g)),
          people: data.people.map((p) => ({
            ...p,
            groups: p.groups.map((g) => (g === oldName ? clean : g)),
            updatedAt: nowIso(),
          })),
          // 圈子保存的是分组名，分组改名后必须同步，否则圈子的成员会全部丢失
          circles: data.circles.map((c) =>
            c.groups.includes(oldName)
              ? { ...c, groups: c.groups.map((g) => (g === oldName ? clean : g)), updatedAt: t }
              : c,
          ),
        },
      })
    },
    removeGroup(name) {
      const data = get().data
      const affected = data.people.filter((p) => p.groups.includes(name)).length
      const ok = commit({
        data: {
          ...data,
          groups: data.groups.filter((g) => g !== name),
          people: data.people.map((p) =>
            p.groups.includes(name) ? { ...p, groups: p.groups.filter((g) => g !== name), updatedAt: nowIso() } : p,
          ),
          circles: data.circles.map((c) =>
            c.groups.includes(name)
              ? { ...c, groups: c.groups.filter((g) => g !== name), updatedAt: nowIso() }
              : c,
          ),
        },
      })
      return ok ? affected : -1
    },
    addToGroup(name, personIds) {
      const clean = name.trim()
      if (!clean) return 0
      const data = get().data
      const ids = new Set(personIds)
      const members = data.people.filter((p) => ids.has(p.id) && !p.groups.includes(clean))
      if (members.length === 0) return 0
      const memberIds = new Set(members.map((p) => p.id))
      const ok = commit({
        data: {
          ...data,
          groups: data.groups.includes(clean) ? data.groups : [...data.groups, clean],
          people: data.people.map((p) =>
            memberIds.has(p.id) ? { ...p, groups: [...p.groups, clean], updatedAt: nowIso() } : p,
          ),
        },
      })
      return ok ? members.length : 0
    },
    addTagToPerson(tag, personId) {
      const data = get().data
      const person = data.people.find((p) => p.id === personId)
      if (!person) return false
      if (person.tags.includes(tag)) return true
      return commit({
        data: {
          ...data,
          people: data.people.map((p) =>
            p.id === personId ? { ...p, tags: [...p.tags, tag], updatedAt: nowIso() } : p,
          ),
        },
      })
    },
    removeFromGroup(name, personId) {
      const data = get().data
      const person = data.people.find((p) => p.id === personId)
      if (!person || !person.groups.includes(name)) return false
      return commit({
        data: {
          ...data,
          people: data.people.map((p) =>
            p.id === personId ? { ...p, groups: p.groups.filter((g) => g !== name), updatedAt: nowIso() } : p,
          ),
        },
      })
    },

    addCircle(name, groups) {
      const clean = name.trim()
      const data = get().data
      if (!clean || data.circles.some((c) => c.name === clean)) return false
      const t = nowIso()
      const circle: Circle = {
        id: uid(),
        name: clean,
        groups: data.groups.filter((g) => groups.includes(g)),
        createdAt: t,
        updatedAt: t,
      }
      return commit({ data: { ...data, circles: [...data.circles, circle] } })
    },
    renameCircle(id, name) {
      const clean = name.trim()
      const data = get().data
      if (!clean || data.circles.some((c) => c.id !== id && c.name === clean)) return false
      const target = data.circles.find((c) => c.id === id)
      if (!target) return false
      if (target.name === clean) return true
      return commit({
        data: {
          ...data,
          circles: data.circles.map((c) => (c.id === id ? { ...c, name: clean, updatedAt: nowIso() } : c)),
        },
      })
    },
    setCircleGroups(id, groups) {
      const data = get().data
      const target = data.circles.find((c) => c.id === id)
      if (!target) return false
      const next = data.groups.filter((g) => groups.includes(g))
      if (next.length === target.groups.length && next.every((g, index) => g === target.groups[index])) return true
      return commit({
        data: {
          ...data,
          circles: data.circles.map((c) => (c.id === id ? { ...c, groups: next, updatedAt: nowIso() } : c)),
        },
      })
    },
    removeCircle(id) {
      const data = get().data
      if (!data.circles.some((c) => c.id === id)) return false
      return commit({ data: { ...data, circles: data.circles.filter((c) => c.id !== id) } })
    },
    moveCircle(id, delta) {
      const data = get().data
      const index = data.circles.findIndex((c) => c.id === id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= data.circles.length) return false
      const circles = [...data.circles]
      const [moved] = circles.splice(index, 1)
      circles.splice(target, 0, moved)
      return commit({ data: { ...data, circles } })
    },
    reorderCircles(ids) {
      const data = get().data
      const byId = new Map(data.circles.map((circle) => [circle.id, circle]))
      if (ids.length !== data.circles.length || ids.some((id) => !byId.has(id))) return false
      return commit({ data: { ...data, circles: ids.map((id) => byId.get(id)!) } })
    },

    importPeople(rows) {
      const data = get().data
      const people = [...data.people]
      const byName = new Map(people.map((p) => [p.name.trim(), p]))
      const selfName = data.me?.name.trim() ?? ''
      const touchedTags: string[] = []
      const touchedGroups: string[] = []
      let added = 0
      let merged = 0
      let skippedSelf = 0

      for (const row of rows) {
        if (selfName && row.name.trim() === selfName) {
          skippedSelf += 1
          continue
        }
        const target = byName.get(row.name.trim())
        if (target) {
          // 同名：只做增量。已有非空值优先，标签与分组取并集，绝不覆盖
          const tags = [...new Set([...target.tags, ...row.tags])]
          const groups = [...new Set([...target.groups, ...row.groups])]
          const note = target.note || row.note
          const birthday = target.birthday || row.birthday || undefined
          const changed =
            tags.length !== target.tags.length ||
            groups.length !== target.groups.length ||
            note !== target.note ||
            birthday !== target.birthday
          if (changed) {
            const next: Person = { ...target, tags, groups, note, birthday, updatedAt: nowIso() }
            people[people.indexOf(target)] = next
            // 后续同名行必须命中更新后的对象，否则会写回旧引用
            byName.set(next.name.trim(), next)
          }
          touchedTags.push(...row.tags)
          touchedGroups.push(...row.groups)
          merged += 1
          continue
        }
        const person = makePerson({
          name: row.name,
          tags: row.tags,
          groups: row.groups,
          note: row.note,
          birthday: row.birthday,
        })
        people.push(person)
        byName.set(person.name.trim(), person)
        touchedTags.push(...row.tags)
        touchedGroups.push(...row.groups)
        added += 1
      }

      // 词汇表只登记真正落地的人物所用标签/分组，空行不产生空分组
      const tags = [...new Set([...data.tags, ...touchedTags])]
      const groups = [...new Set([...data.groups, ...touchedGroups])]
      const ok = commit({ data: { ...data, people, tags, groups } })
      return ok ? { added, merged, skippedSelf } : null
    },

    async restoreData(data) {
      if (restoring) return
      restoring = true
      try {
        if (save) await save
        return await saveData(data, true)
      } finally {
        restoring = false
      }
    },

    resetData() {
      return commit({ data: emptyData() })
    },

    setUi(patch) {
      set({ ui: { ...get().ui, ...patch } })
    },
    resetUi() {
      set({ ui: initialUi })
    },
  }
})

export { today }
