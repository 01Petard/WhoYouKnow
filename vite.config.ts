/**
 * Vite 配置：React 插件 + 本地数据文件 API。
 * 数据 API 与独立服务 server.mjs 共用 server/dataFileApi.mjs，避免两份实现漂移。
 * 默认写入项目目录 data/linkmap.json；LINKMAP_DATA_FILE 可指向任意文件路径。
 */
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createDataFileApi } from './server/dataFileApi.mjs'

function fileStore(): Plugin {
  const api = createDataFileApi()
  const middleware = async (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    next: () => void,
  ) => {
    if (await api.handle(req, res)) return
    next()
  }

  return {
    name: 'whoyouknow-file-store',
    configureServer(server) {
      server.middlewares.use((req, res, next) => { void middleware(req, res, next) })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => { void middleware(req, res, next) })
    },
  }
}

export default defineConfig({
  plugins: [react(), fileStore()],
  // SPA 深链接（如 /settings）刷新时资源必须从站点根解析；相对路径会拼到当前路由下导致 404
  base: '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
})
