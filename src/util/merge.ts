/**
 * [INPUT]: 依赖 ../types 的 AppData/Circle/Person
 * [OUTPUT]: 导出 mergeData，用于多标签页写入冲突时的三方合并
 * [POS]: 存储层的纯函数边界；base=本页最后同步的版本，local=本页当前数据，remote=数据文件中的最新数据。
 *        同一实体两侧都改时按 updatedAt 取新；一侧删除、另一侧未改则删除生效；两侧都改则保留改动。
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import type { AppData, Circle, Person } from '../types'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function later<T extends { updatedAt: string }>(local: T, remote: T): T {
  return local.updatedAt >= remote.updatedAt ? local : remote
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
      if (same(mine, before)) chosen.set(id, theirs)
      else if (same(theirs, before)) chosen.set(id, mine)
      else chosen.set(id, later(mine, theirs))
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
  for (const item of [...local, ...remote]) {
    const picked = chosen.get(item.id)
    if (!picked || seen.has(item.id)) continue
    seen.add(item.id)
    result.push(picked)
  }
  return result
}

/** 词表按集合三方合并：任一侧删除的项移除，两侧新增的项都保留，顺序以 local 为主 */
function mergeNames(base: string[], local: string[], remote: string[]): string[] {
  const removed = new Set([
    ...base.filter((name) => !local.includes(name)),
    ...base.filter((name) => !remote.includes(name)),
  ])
  const result: string[] = []
  for (const name of [...local, ...remote]) {
    if (removed.has(name) || result.includes(name)) continue
    result.push(name)
  }
  return result
}

function mergeMe(base: Person | null, local: Person | null, remote: Person | null): Person | null {
  if (local && remote) {
    if (same(local, base)) return remote
    if (same(remote, base)) return local
    return later(local, remote)
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
