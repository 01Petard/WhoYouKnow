/**
 * WhoYouKnow 本地静态服务：托管 dist，并提供项目数据文件 API。
 *
 * 用法：
 *   pnpm build
 *   LINKMAP_DATA_FILE=/path/to/data.json node server.mjs
 *   # 可选：PORT=4173 HOST=127.0.0.1
 *
 * 安全边界：默认只监听 127.0.0.1。数据 API 没有鉴权，
 * 设置 HOST=0.0.0.0 前请确认局域网可信；对外部署应由反向代理加认证与 TLS。
 *
 * API 与 Vite 插件共用 server/dataFileApi.mjs：
 *   GET    /api/config  返回当前数据文件路径与版本
 *   GET    /api/data    读取数据文件
 *   PUT    /api/data    原子写入；带 If-Match 时执行乐观并发校验
 *   DELETE /api/data    删除数据文件
 */
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createDataFileApi } from './server/dataFileApi.mjs'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT ?? 4173)
const HOST = process.env.HOST ?? '127.0.0.1'
const api = createDataFileApi()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendJson(res, status, value) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

async function sendFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath)
    res.statusCode = 200
    res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream')
    if (path.basename(filePath) === 'index.html') res.setHeader('Cache-Control', 'no-cache')
    res.end(data)
    return true
  } catch {
    return false
  }
}

const server = http.createServer(async (req, res) => {
  if (await api.handle(req, res)) return

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, reason: 'method-not-allowed' })
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  } catch {
    sendJson(res, 400, { ok: false, reason: 'bad-request' })
    return
  }

  const target = path.resolve(DIST, `.${pathname}`)
  if (target !== DIST && !target.startsWith(`${DIST}${path.sep}`)) {
    sendJson(res, 403, { ok: false, reason: 'forbidden' })
    return
  }
  if (await sendFile(res, target === DIST ? path.join(DIST, 'index.html') : target)) return
  // SPA 深链接回退；带扩展名的缺失资源保持 404
  if (!path.extname(pathname)) {
    if (await sendFile(res, path.join(DIST, 'index.html'))) return
  }
  sendJson(res, 404, { ok: false, reason: 'not-found' })
})

server.listen(PORT, HOST, () => {
  console.log(`WhoYouKnow: http://${HOST}:${PORT}`)
  console.log(`Data file: ${api.dataFile}`)
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log('Warning: data API has no authentication; expose it only on trusted networks.')
  }
})
