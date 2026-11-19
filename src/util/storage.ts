/**
 * [INPUT]: 依赖 ./backup 的 validateBackup；依赖 ./merge 的 mergeData；依赖 ./constants 的 STORAGE_KEY/DATA_FILE_PATH；依赖浏览器 fetch 与 localStorage
 * [OUTPUT]: 导出 bootstrap、persist、reloadFromFile、DATA_FILE_PATH
 * [POS]: 项目文件存储适配层；优先读写 /api/data 对应的数据文件，失败时回退浏览器本地镜像。
 *        PUT 携带 If-Match 版本；409 时按 base/local/remote 三方合并后重试，避免多标签页互相覆盖。
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import type { AppData, StorageKind, StorageSnapshot } from '../types'
import { validateBackup } from './backup'
import { DATA_FILE_PATH, STORAGE_KEY } from './constants'
import { mergeData } from './merge'

const API = '/api/data'
const MAX_ATTEMPTS = 3
/** 单次请求上限；超时中断并回退浏览器本地，避免写队列永久悬挂 */
const REQUEST_TIMEOUT_MS = 10_000
export { DATA_FILE_PATH }

function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => window.clearTimeout(timer))
}

interface PersistResult {
  ok: boolean
  kind: StorageKind
  notice?: string
  savedAt?: string
  /** 发生并发合并时返回合并后的数据，供 store 采用 */
  data?: AppData
}

/** 本页最后一次成功读写的文件版本；null = 尚未与服务端对齐 */
let revision: string | null = null
/** 本页最后一次成功同步的数据；三方合并的 base */
let baseData: AppData | null = null
/** 本页写入串行队列：保证 revision/baseData 按请求顺序更新 */
let writeQueue: Promise<unknown> = Promise.resolve()

function normalize(raw: unknown): StorageSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<StorageSnapshot>
  if (!parsed.data) return null
  const check = validateBackup(parsed.data)
  if (!check.ok) return null
  return {
    data: check.data,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined,
  }
}

function readLocal(): StorageSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeLocal(snapshot: StorageSnapshot): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}

function revisionFrom(response: Response): string | null {
  const etag = response.headers.get('etag')
  if (!etag) return null
  return etag.replace(/^W\//, '').replace(/^"|"$/g, '')
}

/** 读取数据文件；reachable=false 表示文件 API 不可用（不是 404 空文件） */
async function readRemote(): Promise<{
  reachable: boolean
  snapshot: StorageSnapshot | null
  revision: string | null
}> {
  try {
    const response = await fetchWithTimeout(API, { cache: 'no-store' })
    const nextRevision = revisionFrom(response)
    if (response.status === 404) return { reachable: true, snapshot: null, revision: nextRevision }
    if (!response.ok) return { reachable: false, snapshot: null, revision: null }
    return { reachable: true, snapshot: normalize(await response.json()), revision: nextRevision }
  } catch {
    return { reachable: false, snapshot: null, revision: null }
  }
}

/** 启动：项目文件优先；文件为空时迁移浏览器本地旧数据；API 不可用时回退本地 */
export async function bootstrap(fallback: Pick<StorageSnapshot, 'data'>): Promise<{
  snapshot: StorageSnapshot
  kind: StorageKind
  notice?: string
}> {
  const remote = await readRemote()
  if (remote.snapshot) {
    revision = remote.revision
    baseData = remote.snapshot.data
    return { snapshot: remote.snapshot, kind: 'file' }
  }

  const local = readLocal()
  if (local) {
    if (remote.reachable) {
      revision = remote.revision ?? '0'
      baseData = local.data
      const saved = await persist(local)
      return {
        snapshot: { data: saved.data ?? local.data, savedAt: saved.savedAt },
        kind: saved.kind,
        notice: saved.ok ? '已把浏览器本地数据迁移到项目文件' : saved.notice,
      }
    }
    revision = null
    baseData = local.data
    return { snapshot: local, kind: 'local', notice: '项目文件 API 不可用，已使用浏览器本地数据' }
  }

  if (remote.reachable) {
    revision = remote.revision ?? '0'
    baseData = fallback.data
  } else {
    revision = null
    baseData = fallback.data
  }
  return {
    snapshot: { data: fallback.data },
    kind: remote.reachable ? 'file' : 'local',
    notice: remote.reachable ? undefined : '项目文件 API 不可用，当前使用浏览器本地存储',
  }
}

/**
 * 写入项目文件；失败时回退浏览器本地镜像。
 * 本页请求串行执行；版本冲突时拉取最新文件并三方合并，最多重试 MAX_ATTEMPTS 次。
 */
export function persist(snapshot: StorageSnapshot): Promise<PersistResult> {
  const run = writeQueue.then(
    () => persistOnce(snapshot),
    () => persistOnce(snapshot),
  )
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function persistOnce(snapshot: StorageSnapshot): Promise<PersistResult> {
  let data = snapshot.data
  let merged = false

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const enriched: StorageSnapshot = { data, savedAt: new Date().toISOString() }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (revision !== null) headers['If-Match'] = `"${revision}"`

    let response: Response
    try {
      response = await fetchWithTimeout(API, { method: 'PUT', headers, body: JSON.stringify(enriched) })
    } catch {
      break
    }

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { savedAt?: string; revision?: string } | null
      revision = revisionFrom(response) ?? body?.revision ?? revision
      baseData = data
      const written: StorageSnapshot = { data, savedAt: body?.savedAt ?? enriched.savedAt }
      writeLocal(written)
      return {
        ok: true,
        kind: 'file',
        savedAt: written.savedAt,
        notice: merged ? '检测到其他标签页的改动，已自动合并并保存' : undefined,
        data: merged ? data : undefined,
      }
    }

    if (response.status === 409) {
      const latest = await readRemote()
      if (!latest.snapshot) break
      revision = latest.revision
      data = mergeData(baseData ?? latest.snapshot.data, data, latest.snapshot.data)
      merged = true
      continue
    }
    break
  }

  const fallback: StorageSnapshot = { data, savedAt: new Date().toISOString() }
  if (writeLocal(fallback)) {
    return {
      ok: true,
      kind: 'local',
      notice: merged
        ? '数据文件同时在别处修改，改动已暂存到浏览器本地；请稍后重试'
        : '项目文件不可用，数据已保存到浏览器本地',
      savedAt: fallback.savedAt,
      data: merged ? data : undefined,
    }
  }
  return { ok: false, kind: 'local', notice: '保存失败，请检查项目文件权限或浏览器存储空间' }
}

/** 重新读取项目文件（设置页「重新读取」） */
export async function reloadFromFile(): Promise<StorageSnapshot | null> {
  const remote = await readRemote()
  if (remote.snapshot) {
    revision = remote.revision
    baseData = remote.snapshot.data
  }
  return remote.snapshot
}
