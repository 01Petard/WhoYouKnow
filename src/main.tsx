/**
 * [INPUT]: 依赖 react-dom/client 的 createRoot；依赖 react-router-dom 的 BrowserRouter；依赖 ./components/Toast 的 ToastProvider；依赖 ./styles/global.css 的全局样式
 * [OUTPUT]: 无导出，执行挂载副作用：把 App 渲染进 #root，并用 BrowserRouter 与 ToastProvider 包裹
 * [POS]: src 根目录的应用入口，全应用唯一的 DOM 挂载点；只装配 Provider 与样式，不承载业务逻辑
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/Toast'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
