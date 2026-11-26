/**
 * [INPUT]: 依赖备份校验、三方合并、浏览器 localStorage 和项目文件 API。
 * [OUTPUT]: 提供启动恢复、队列写入和文件重读。
 * [POS]: 每笔写入基于提交前的快照；浏览器为每页单独保存待同步草稿。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { AppData, StorageKind, StorageSnapshot } from '../types'
import { validateBackup } from './backup'
import { DATA_FILE_PATH, STORAGE_KEY } from './constants'
import { uid } from './id'
import { mergeData } from './merge'

const API = '/api/data'
const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10_000
const DRAFT_PREFIX = `${STORAGE_KEY}.pending.`
let draftKey: string | undefined
export { DATA_FILE_PATH }

interface PendingWrite {
  base: AppData
  snapshot: StorageSnapshot
}

export interface PersistResult {
  ok: boolean
  kind: StorageKind
  notice?: string
  data: AppData
}

type Remote =
  | { kind: 'file'; revision: string; snapshot: StorageSnapshot }
  | { kind: 'missing'; revision: string }
  | { kind: 'unavailable' }

let remote: Remote = { kind: 'unavailable' }
let working: AppData | undefined
let pending: PendingWrite | undefined
let writeQueue: Promise<unknown> = Promise.resolve()

function request(init: RequestInit = {}): Promise<Response> {
  return fetch(API, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
}

function normalize(raw: unknown): StorageSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as Partial<StorageSnapshot>
  const check = validateBackup(parsed.data)
  if (check.ok) return { data: check.data, savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined }
}

function readLocal(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function clearDraft(key?: string) {
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    // 文件已保存；保留的草稿在下次打开时可以幂等合并。
  }
}

function readDrafts(): [string, PendingWrite][] {
  const drafts: [string, PendingWrite][] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      const raw = readLocal(key) as Partial<PendingWrite> | null
      const base = validateBackup(raw?.base)
      const snapshot = normalize(raw?.snapshot)
      if (base.ok && snapshot) drafts.push([key, { base: base.data, snapshot }])
    }
  } catch {
    return drafts
  }
  return drafts.sort((a, b) => (a[1].snapshot.savedAt ?? '').localeCompare(b[1].snapshot.savedAt ?? ''))
}

function revisionFrom(response: Response): string | null {
  return response.headers.get('etag')?.replace(/^W\//, '').replace(/^"|"$/g, '') ?? null
}

async function readRemote(): Promise<Remote> {
  try {
    const response = await request({ cache: 'no-store' })
    const revision = revisionFrom(response)
    if (!revision) return { kind: 'unavailable' }
    if (response.status === 404 && (await response.json())?.reason === 'no-data-file') {
      return { kind: 'missing', revision }
    }
    if (response.ok) {
      const snapshot = normalize(await response.json())
      if (snapshot) return { kind: 'file', snapshot, revision }
    }
  } catch {
    return { kind: 'unavailable' }
  }
  return { kind: 'unavailable' }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task)
  writeQueue = run.catch(() => undefined)
  return run
}

export function bootstrap(fallback: Pick<StorageSnapshot, 'data'>): Promise<{
  snapshot: StorageSnapshot
  kind: StorageKind
  notice?: string
  error?: boolean
}> {
  return enqueue(async () => {
    remote = await readRemote()
    const cached = readLocal(STORAGE_KEY) as { synced?: boolean } | null
    const local = normalize(cached)
    const drafts = readDrafts()
    const base = remote.kind === 'file' ? remote.snapshot : local ?? fallback
    let data = base.data
    const legacyDraft = cached?.synced !== true && local?.savedAt && remote.kind === 'file'
      && remote.snapshot.savedAt && local.savedAt > remote.snapshot.savedAt
    // 旧版镜像没有基线：补回较新的资料与新增记录，无法推断离线删除。
    if (legacyDraft) data = mergeData(fallback.data, local.data, data)
    for (const [, draft] of drafts) data = mergeData(draft.base, draft.snapshot.data, data)
    if (drafts.length || legacyDraft || (remote.kind === 'missing' && local)) {
      pending = { base: remote.kind === 'missing' ? fallback.data : base.data, snapshot: { data } }
      working = data
      const saved = await syncPending()
      if (saved.ok) {
        for (const [key, draft] of drafts) {
          // 另一页可能已经更新了该草稿，只删除本次合并的版本。
          const current = readLocal(key) as Partial<PendingWrite> | null
          if (current?.snapshot?.savedAt === draft.snapshot.savedAt && key !== draftKey) clearDraft(key)
        }
      }
      return { snapshot: { data: saved.data }, kind: saved.kind, notice: saved.notice, error: !saved.ok }
    }
    working = data
    if (remote.kind === 'file') writeLocal(STORAGE_KEY, { ...remote.snapshot, synced: true })
    return {
      snapshot: base,
      kind: remote.kind === 'unavailable' ? 'local' : 'file',
      notice: remote.kind === 'unavailable' ? '项目文件暂不可用，当前使用浏览器本地存储' : undefined,
    }
  })
}

export function persist(snapshot: StorageSnapshot, previous: AppData, replace = false): Promise<PersistResult> {
  return enqueue(async () => {
    const base = working ?? previous
    const data = replace || previous === base ? snapshot.data : mergeData(previous, snapshot.data, base)
    const priorPending = pending
    pending = { base: pending?.base ?? base, snapshot: { data } }
    working = data
    const result = await syncPending(replace)
    if (replace && !result.ok) {
      pending = priorPending
      working = base
      return { ...result, data: base }
    }
    return result
  })
}

async function syncPending(replace = false): Promise<PersistResult> {
  const draft = pending!
  let data = draft.snapshot.data
  let merged = false
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (remote.kind === 'unavailable') remote = await readRemote()
    if (remote.kind === 'unavailable') break
    data = draft.snapshot.data
    if (!replace && remote.kind === 'file' && remote.snapshot.data !== draft.base) {
      data = mergeData(draft.base, draft.snapshot.data, remote.snapshot.data)
      merged = true
    }

    const snapshot = { data, savedAt: new Date().toISOString() }
    try {
      const response = await request({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"${remote.revision}"` },
        body: JSON.stringify(snapshot),
      })
      if (response.status === 409) {
        if (replace) {
          return { ok: false, kind: 'file', data, notice: '文件已在别处修改，请重新读取后再次恢复' }
        }
        remote = await readRemote()
        continue
      }
      const revision = revisionFrom(response)
      if (response.ok && revision) {
        remote = { kind: 'file', revision, snapshot }
        working = data
        pending = undefined
        writeLocal(STORAGE_KEY, { ...snapshot, synced: true })
        clearDraft(draftKey)
        return { ok: true, kind: 'file', data, notice: merged ? '已合并项目文件中的改动' : undefined }
      }
    } catch {
      remote = { kind: 'unavailable' }
    }
    break
  }

  // 草稿保留原始基线；下次读取文件时才能安全重放新增、修改和删除。
  draftKey ??= `${DRAFT_PREFIX}${uid()}`
  const snapshot = { data: draft.snapshot.data, savedAt: new Date().toISOString() }
  const ok = writeLocal(draftKey, { base: draft.base, snapshot })
  return {
    ok,
    kind: 'local',
    data: working ?? draft.snapshot.data,
    notice: ok ? '改动仅暂存在此浏览器，项目文件恢复后会尝试同步' : '保存失败，改动仍在当前页面，请重试',
  }
}

export function reloadFromFile(): Promise<StorageSnapshot | null> {
  return enqueue(async () => {
    if (pending) return null
    const latest = await readRemote()
    if (latest.kind !== 'file') return null
    remote = latest
    working = latest.snapshot.data
    writeLocal(STORAGE_KEY, { ...latest.snapshot, synced: true })
    return latest.snapshot
  })
}
