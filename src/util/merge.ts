/**
 * [INPUT]: 依赖 ../types 的 AppData/Circle/Person/ContactEntry
 * [OUTPUT]: 导出 mergeData，用于多标签页写入冲突时的三方合并
 * [POS]: 存储层的纯函数边界；base=本页最后同步的版本，local=本页当前数据，remote=数据文件中的最新数据。
 *        联系手记按记录 ID 独立合并。其他字段发生冲突时按 updatedAt 取新；一侧删除、另一侧未改则删除生效；两侧都改则保留改动。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { AppData, Circle, ContactEntry, Person } from '../types'

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => same(value, b[index]))
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every((key) => same(left[key], right[key]))
}

function later<T extends { updatedAt: string }>(local: T, remote: T): T {
  return local.updatedAt >= remote.updatedAt ? local : remote
}

function mergeRecord<T extends { updatedAt: string }>(base: T | undefined, local: T, remote: T): T {
  if (same(local, base)) return remote
  if (same(remote, base)) return local
  const latest = later(local, remote)
  if (!base) return latest
  const keys = [...new Set([...Object.keys(local), ...Object.keys(remote)])] as (keyof T)[]
  return Object.fromEntries(keys.map((key) => {
    const before = base[key]
    const mine = local[key]
    const theirs = remote[key]
    if (same(mine, before)) return [key, theirs]
    if (same(theirs, before)) return [key, mine]
    if (key === 'contactHistory') {
      const history = mergeRecords(
        (before ?? []) as ContactEntry[],
        (mine ?? []) as ContactEntry[],
        (theirs ?? []) as ContactEntry[],
      )
      return [key, history.length ? history : undefined]
    }
    if ((key === 'groups' || key === 'tags') && Array.isArray(before) && Array.isArray(mine) && Array.isArray(theirs)) {
      return [key, mergeNames(before, mine, theirs)]
    }
    return [key, latest[key]]
  })) as T
}

/**
 * 三方合并带 id 的实体列表。
 * 顺序以 local 为主，remote 新增的实体追加在后。
 */
function mergeRecords<T extends { id: string; updatedAt: string }>(
  base: T[],
  local: T[],
  remote: T[],
): T[] {
  const baseMap = new Map(base.map((item) => [item.id, item]))
  const localMap = new Map(local.map((item) => [item.id, item]))
  const remoteMap = new Map(remote.map((item) => [item.id, item]))
  const chosen = new Map<string, T>()

  const ids = new Set([...localMap.keys(), ...remoteMap.keys()])
  for (const id of ids) {
    const before = baseMap.get(id)
    const mine = localMap.get(id)
    const theirs = remoteMap.get(id)

    if (mine && theirs) {
      chosen.set(id, mergeRecord(before, mine, theirs))
      continue
    }
    if (mine) {
      // 远端删除：本页未改则跟随删除，本页改过则保留
      if (!before || !same(mine, before)) chosen.set(id, mine)
      continue
    }
    if (theirs) {
      // 本页删除：远端未改则跟随删除，远端改过则保留
      if (!before || !same(theirs, before)) chosen.set(id, theirs)
    }
  }

  const result: T[] = []
  const seen = new Set<string>()
  const localOrder = local.map((item) => item.id)
  const baseOrder = base.map((item) => item.id)
  const ordered = same(localOrder, baseOrder) ? [...remote, ...local] : [...local, ...remote]
  for (const item of ordered) {
    const picked = chosen.get(item.id)
    if (!picked || seen.has(item.id)) continue
    seen.add(item.id)
    result.push(picked)
  }
  return result
}

/** 词表按集合三方合并：任一侧删除的项移除，两侧新增的项都保留，顺序以 local 为主 */
function mergeNames(base: string[], local: string[], remote: string[]): string[] {
  if (same(local, base)) return remote
  if (same(remote, base)) return local
  const mine = new Set(local)
  const theirs = new Set(remote)
  const removed = new Set(base.filter((name) => !mine.has(name) || !theirs.has(name)))
  return [...new Set([...local, ...remote])].filter((name) => !removed.has(name))
}

function mergeMe(base: Person | null, local: Person | null, remote: Person | null): Person | null {
  if (local && remote) {
    return local.id === remote.id ? mergeRecord(base?.id === local.id ? base : undefined, local, remote) : later(local, remote)
  }
  if (local) {
    if (!base || !same(local, base)) return local
    return null
  }
  if (remote) {
    if (!base || !same(remote, base)) return remote
    return null
  }
  return null
}

export function mergeData(base: AppData, local: AppData, remote: AppData): AppData {
  const people: Person[] = mergeRecords(base.people, local.people, remote.people)
  const circles: Circle[] = mergeRecords(base.circles, local.circles, remote.circles)
  return {
    version: Math.max(base.version, local.version, remote.version),
    people,
    tags: mergeNames(base.tags, local.tags, remote.tags),
    groups: mergeNames(base.groups, local.groups, remote.groups),
    circles,
    me: mergeMe(base.me, local.me, remote.me),
  }
}
