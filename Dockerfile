# 构建阶段执行仓库的测试和生产构建，运行阶段只带静态产物与文件 API。
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
    && pnpm install --frozen-lockfile

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY server ./server
COPY src ./src
COPY tests ./tests
RUN pnpm test && pnpm build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 LINKMAP_DATA_FILE=/data/linkmap.json
COPY --from=build /app/dist ./dist
COPY server.mjs ./
COPY server/dataFileApi.mjs ./server/
USER node
EXPOSE 4173
CMD ["node", "server.mjs"]
