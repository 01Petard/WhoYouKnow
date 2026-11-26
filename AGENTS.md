# WhoYouKnow

个人联系人管理。React 18 + Vite 5 + TypeScript 5 + Zustand 5 + Node.js。

- [src](src/AGENTS.md) 提供页面、关系网和浏览器存储。
- [server](server/AGENTS.md) 提供项目文件 API。
- [tests](tests/AGENTS.md) 验证联系人和数据流程。
- [public](public/AGENTS.md) 存放品牌图标和界面图像。
- `docs/design/` 保留早期设计规范。
- `Dockerfile` 和 `.dockerignore` 定义构建、测试与 Alpine 运行镜像的内容。
- `compose.yaml` 运行单容器服务，将部署仓库的 `data/` 挂载到 `/data`。
- `deploy.sh` 拉取 Git 更新、构建镜像、备份数据并清理已替换的容器和镜像。
- `server.mjs` 托管生产构建并挂载文件 API。
- `vite.config.ts` 在开发和预览服务中挂载同一 API。
- `package.json` 声明依赖、构建和测试命令。
