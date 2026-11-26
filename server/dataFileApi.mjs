/**
 * [INPUT]: 依赖 node:crypto 生成内容版本；依赖 node:fs/promises 读写数据文件；依赖 node:path 解析路径
 * [OUTPUT]: 导出 createDataFileApi，提供 /api/config 与 /api/data 的 GET/PUT/DELETE
 * [POS]: Vite 开发/预览插件与 server.mjs 共用的数据文件 API；两处入口只做转发，避免实现漂移。
 *        同一进程内写请求串行执行；跨进程用 `.lock` 文件互斥；If-Match 做乐观并发校验。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_BODY_BYTES = 32 * 1024 * 1024
const MISSING_REVISION = '0'
/** 跨进程写锁：文件存在超过该时长视为残留，可回收 */
const LOCK_STALE_MS = 5000
/** 获取写锁的最长等待时间 */
const LOCK_WAIT_MS = 2000

function resolveDataFile(env) {
  return env.LINKMAP_DATA_FILE
    ? path.resolve(env.LINKMAP_DATA_FILE)
    : path.join(process.cwd(), 'data', 'linkmap.json')
}

function revisionOf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}

function normalizeMatch(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === '*') return null
  return trimmed.replace(/^W\//, '').replace(/^"|"$/g, '')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res, status, value, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [name, headerValue] of Object.entries(headers)) res.setHeader(name, headerValue)
  res.end(JSON.stringify(value))
}

function sendSnapshot(res, buffer, revision) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('ETag', `"${revision}"`)
  res.end(buffer)
}

/**
 * @param {object} [options]
 * @param {string} [options.dataFile] 绝对路径
 * @param {string} [options.label] 对外展示的路径
 * @param {NodeJS.ProcessEnv} [options.env]
 */
export function createDataFileApi(options = {}) {
  const dataFile = options.dataFile ?? resolveDataFile(options.env ?? process.env)
  const label = options.label ?? (options.env ?? process.env).LINKMAP_DATA_FILE ?? 'data/linkmap.json'
  const directory = path.dirname(dataFile)

  let writeQueue = Promise.resolve()
  function enqueue(task) {
    const run = writeQueue.then(task, task)
    writeQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async function readCurrent() {
    try {
      const buffer = await fs.readFile(dataFile)
      return { exists: true, buffer, revision: revisionOf(buffer) }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      return { exists: false, buffer: null, revision: MISSING_REVISION }
    }
  }

  async function writeAtomic(body) {
    await fs.mkdir(directory, { recursive: true })
    const temp = `${dataFile}.${process.pid}.${Date.now()}.tmp`
    await fs.writeFile(temp, body, 'utf8')
    await fs.rename(temp, dataFile)
  }

  /**
   * 跨进程互斥：用 `open(..., 'wx')` 创建锁文件，原子且不依赖额外依赖。
   * 进程崩溃留下的锁超过 LOCK_STALE_MS 后回收。
   */
  async function withFileLock(task) {
    const lockPath = `${dataFile}.lock`
    await fs.mkdir(directory, { recursive: true })
    const start = Date.now()
    while (true) {
      try {
        const handle = await fs.open(lockPath, 'wx')
        try {
          await handle.writeFile(String(process.pid))
          return await task()
        } finally {
          await handle.close().catch(() => undefined)
          await fs.unlink(lockPath).catch(() => undefined)
        }
      } catch (error) {
        if (!error || error.code !== 'EEXIST') throw error
        const stat = await fs.stat(lockPath).catch(() => null)
        if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.unlink(lockPath).catch(() => undefined)
          continue
        }
        if (Date.now() - start > LOCK_WAIT_MS) throw new Error('lock-timeout')
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    }
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @returns {Promise<boolean>} 已处理返回 true；非本项目 API 返回 false
   */
  async function handle(req, res) {
    let pathname
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    } catch {
      return false
    }

    if (pathname !== '/api/config' && pathname !== '/api/data') return false

    if (pathname === '/api/config' || req.method === 'GET' || req.method === 'HEAD') {
      try {
        const current = await readCurrent()
        if (pathname === '/api/config') {
          sendJson(res, 200, { dataFile: label, revision: current.revision }, { ETag: `"${current.revision}"` })
        } else if (!current.exists) {
          sendJson(res, 404, { ok: false, reason: 'no-data-file' }, { ETag: `"${MISSING_REVISION}"` })
        } else if (req.method === 'HEAD') {
          res.statusCode = 200
          res.setHeader('ETag', `"${current.revision}"`)
          res.end()
        } else {
          sendSnapshot(res, current.buffer, current.revision)
        }
      } catch {
        sendJson(res, 500, { ok: false, reason: 'read-failed' })
      }
      return true
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      let body
      try {
        body = await readBody(req)
        JSON.parse(body)
      } catch (error) {
        const tooLarge = error instanceof Error && error.message === 'body-too-large'
        sendJson(res, tooLarge ? 413 : 400, { ok: false, reason: tooLarge ? 'body-too-large' : 'invalid-json' })
        return true
      }

      const expected = normalizeMatch(req.headers['if-match'])
      await enqueue(async () => {
        try {
          await withFileLock(async () => {
            const current = await readCurrent()
            if (expected && expected !== current.revision) {
              sendJson(
                res,
                409,
                { ok: false, reason: 'revision-mismatch', revision: current.revision },
                { ETag: `"${current.revision}"` },
              )
              return
            }
            await writeAtomic(body)
            const revision = revisionOf(Buffer.from(body, 'utf8'))
            sendJson(
              res,
              200,
              { ok: true, savedAt: new Date().toISOString(), revision },
              { ETag: `"${revision}"` },
            )
          })
        } catch (error) {
          const locked = error instanceof Error && error.message === 'lock-timeout'
          sendJson(res, locked ? 503 : 500, { ok: false, reason: locked ? 'locked' : 'write-failed' })
        }
      })
      return true
    }

    if (req.method === 'DELETE') {
      await enqueue(async () => {
        try {
          await withFileLock(async () => {
            await fs.unlink(dataFile).catch(() => undefined)
          })
          sendJson(res, 200, { ok: true, revision: MISSING_REVISION }, { ETag: `"${MISSING_REVISION}"` })
        } catch (error) {
          const locked = error instanceof Error && error.message === 'lock-timeout'
          sendJson(res, locked ? 503 : 500, { ok: false, reason: locked ? 'locked' : 'write-failed' })
        }
      })
      return true
    }

    sendJson(res, 405, { ok: false, reason: 'method-not-allowed' })
    return true
  }

  return { dataFile, label, handle }
}
