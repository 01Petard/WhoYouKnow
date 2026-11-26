<p align="center">
  <img src="public/logo.svg" width="72" height="72" alt="WhoYouKnow logo" />
</p>

<h1 align="center">WhoYouKnow · 你的人脉</h1>

<p align="center"><strong>Every connection counts.</strong><br/>每一段关系都算数。</p>

<p align="center"><a href="README.en.md">English</a> · 简体中文</p>

---

WhoYouKnow 是一个以「你」为中心的个人关系系统。你不是在维护一张任意人的社交图，而是在整理自己的人脉：先创建或迁移出「我的信息」，人脉中只保留联系人；所有人默认与你相识，你只需要维护联系人的分组、圈子与标签。

## 运行

```bash
pnpm install
pnpm dev      # 开发
pnpm build    # 类型检查 + 生产构建
pnpm test     # 数据流程回归测试
pnpm preview  # 预览构建产物
pnpm serve    # 托管 dist + 数据文件 API；可用 LINKMAP_DATA_FILE 指定任意文件路径
```

`pnpm serve` 默认只监听 `127.0.0.1:4173`；可用 `PORT`、`HOST` 调整，例如 `HOST=0.0.0.0 pnpm serve`。

技术栈：React 18 + Vite + TypeScript + react-router-dom + zustand + lucide-react。包管理与脚本统一使用 pnpm；无 UI 组件库，样式基于 `src/styles/tokens.css` 的语义 Token。

## Docker 部署和更新

部署机需要 Git、Bash 和支持 `docker compose up --wait` 的 Docker Compose。用日常维护账户克隆项目。已有数据时，在首次启动前将旧版保存好的 `linkmap.json` 放到部署仓库的 `data/` 目录。服务通过 `http://127.0.0.1:4173` 访问。

首次部署和以后更新都在部署仓库运行同一条命令。更新前在开发机提交并推送，保存并关闭生产页面。

```bash
bash deploy.sh
```

- 脚本快进拉取当前分支，再把目标提交打包为构建上下文。新镜像构建时执行测试和生产构建，同一提交已有镜像时直接复用。构建成功后，Compose 短暂停机切换容器并检查首页、数据 API 和数据目录权限。
- 容器直接使用仓库内的 `data/linkmap.json`。从仓库运行的本地服务也使用该目录，部署时按当前文件继续使用。`data/` 由 Git 忽略，推送代码后部署机继续使用自己的数据文件。切换前已有数据时，脚本会保留一份 `data/.before-deploy.json`，下次切换更新这份副本。
- 新容器未通过健康检查时，脚本会尝试恢复上一镜像。用 `bash deploy.sh <Git-SHA>` 可直接部署指定提交，跳过拉取并使用部署仓库当前的 Compose 配置。镜像切换和回退都沿用 `data/linkmap.json` 里的最新内容。
- 用 `docker compose ps` 查看状态，用 `docker compose logs --tail 50 app` 查看日志。上线后在设置页确认保存位置显示「项目文件」，并打开一个已有联系人。

已有部署仍在使用旧版脚本时，先手动执行一次 `git pull --ff-only`，再运行 `bash deploy.sh`。

需要恢复 `data/.before-deploy.json` 时，先关闭页面并运行 `docker compose stop app`。另存当前 `data/linkmap.json`，将切换前副本复制为 `data/linkmap.json`，再执行 `docker compose start app`，并验证可以读取和保存。长期备份可在设置页导出完整 JSON，另存到其他设备，并通过设置页的「备份与恢复」导入。

宿主机只在 `127.0.0.1:4173` 发布端口。远程访问可走 SSH 隧道，或由宿主机上的反向代理对整个站点启用认证和 HTTPS，并转发到该端口。

## 反向代理示例

对外部署时把 `dist` 与 `/api` 放在同一域名下，由代理终止 TLS 并加访问控制；`serve` 继续只监听 `127.0.0.1`，作为唯一的数据写入入口。

**nginx**

```nginx
server {
  listen 443 ssl;
  server_name whoyouknow.example.com;

  ssl_certificate     /etc/letsencrypt/live/whoyouknow.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/whoyouknow.example.com/privkey.pem;

  root /srv/whoyouknow/dist;
  index index.html;

  location /assets/ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location /api/ {
    proxy_pass http://127.0.0.1:4173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_request_buffering off;
  }

  location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-cache";
  }
}
```

**Caddy**

```caddy
whoyouknow.example.com {
  root * /srv/whoyouknow/dist
  encode gzip

  @assets path /assets/*
  header @assets Cache-Control "public, immutable"

  reverse_proxy /api/* 127.0.0.1:4173

  try_files {path} /index.html
  file_server
}
```

要点：

- `/api` 必须与页面同源；跨域部署需要额外的 CORS 配置，当前实现不提供。
- 在代理层加认证（Basic Auth / SSO）；不要把 `4173` 直接暴露到公网。
- 带哈希的 `/assets/*` 可长期缓存；`index.html` 与 `/api` 不缓存。

## 核心模型

- **你是谁**：首次进入可创建「我的信息」、把一位已有联系人迁移成自己，或直接从 JSON 备份恢复。当前用户单独存放，不出现在人脉列表；关系网以你为中心。
- **默认相识**：所有联系人默认与你相识，不再有「已认识 / 未认识」状态。人脉页就是全部联系人。
- **关系网**：以你为中心的地图，可按分组、圈子或标签展开；系统不保存联系人彼此之间的关系边。
- **整理**：标签、分组、圈子合并在「整理分类」一页，通过视图切换；支持按钮排序与拖拽排序。分组与圈子的顺序会影响关系网的展开顺序。

## 功能

| 模块 | 能力 |
| --- | --- |
| 人脉 | 联系人目录、拼音首字母分组、姓名及备注搜索 |
| 筛选 | 可展开的分组、圈子和标签筛选，选择后即时生效 |
| 人物 | 添加、编辑、重要标记、删除 |
| 关系网 | 以我为中心的地图；按分组/圈子/标签切换；缩放、平移、定位、聚焦 |
| 整理 | 「整理分类」按标签、分组及圈子切换列表，支持按钮排序与拖拽排序 |
| 数据 | 人物 CSV、JSON 完整备份；CSV 导入同名增量更新 |

### 人脉页

- 按姓名拼音首字母 A-Z 分组，数字、字母、特殊字符归入末尾 `#` 组。
- 目录行展示姓名、重要标记、分组与上次联系日期。桌面端并排显示待联系概览和分组入口，移动端把待联系概览放在列表上方。
- 筛选改为多行分面面板：每行一个维度（分组 / 圈子 / 标签），左标签右选项；同一维度可多选（OR），维度之间为 AND；每行提供「未分类」，筛选出该维度没有值的联系人；「清除全部」一键清空。
- 通过「重要」快速筛选标记过的联系人。「待联系」显示无记录或满 30 天未联系的重要联系人。可在详情页记录今天、补填日期或清除记录。
- 人脉只显示联系人；当前用户在「我的信息」单独管理，不会出现在人脉中。

### 联系手记

- 在联系人档案记录见面、通话、消息或其他联系，同一天可写多条。
- 从人脉页进入「联系手记」，按月份浏览，按姓名、内容或方式筛选。「往年今日」回看往年同一天的联系记录。
- 上次联系取手动标记与手记的最新日期，并用于待联系筛选。手记随 JSON 完整备份保存。

### 关系网

- 以「我」为中心，联系人可按分组、圈子或标签分布在不同扇区；每个扇区有颜色与标签。同一个人属于多个分组/圈子/标签时会出现在多个簇中。
- 点小、间距大：节点是小型圆点，扇区随人数自动扩展；支持拖拽平移与全屏查看。
- 非全屏时滚轮保持页面上下滚动；进入全屏后才用滚轮缩放地图。
- 点击圆点聚焦，查看 TA 的分组、圈子与标签。

### 我的信息 / 整理分类 / 系统设置

- 三个页面独立放在导航栏中，不再折叠在「我的」里。
- **我的信息**（`/profile`）：当前用户的资料、分组/圈子与关系概览。
- **整理分类**（`/categories`）：按标签、分组或圈子切换列表；每项支持上下按钮排序与拖拽排序；分组与圈子可进入详情。
- **系统设置**（`/settings`）：项目数据文件状态、JSON 完整备份与恢复、CSV 联系人导入导出；改动优先写入当前数据文件（默认 `data/linkmap.json`），状态卡显示当前保存方式。

### 数据

- 结构：`{ version, people, tags, groups, circles, me }`；`people` 只存联系人，`me` 单独存当前用户。
- 数据文件：默认 `data/linkmap.json`；`pnpm dev` / `pnpm preview` 提供 Vite 文件 API，`pnpm serve` 托管静态 `dist` 并提供同一 API。
- 自定义路径：设置环境变量 `LINKMAP_DATA_FILE=/absolute/path/data.json` 后启动任一服务，读写位置与设置页显示的路径都会跟随该文件。
- 回退：文件 API 暂不可用时，待同步草稿保存在浏览器。重新打开页面、网络恢复或点击「立即保存」时会尝试同步。只托管静态页面时继续使用浏览器存储。
- 并发：写入带 `If-Match` 版本；版本冲突时按提交基线合并改动，再重试。完整备份替换遇到并发改动时，需要重新读取并确认。写请求在进程内串行执行，并用 `.lock` 文件跨进程互斥。
- 旧数据兼容：旧版 `friendships`、`edges`、方向与 `selfId` 字段会被忽略或迁移；重要标记与空备注迁移到人物；旧 `selfId` 指向的人物迁移为 `me`。
- CSV：导入按表头识别列，旧模板的「圈子」表头按分组导入；联系人上次联系日期随 JSON 完整备份保存；同名导入增量更新，与「我的信息」同名的行自动跳过。

## 路由

`/people`（默认）、`/journal`、`/person/new`、`/person/:id`、`/person/:id/edit`、`/network`、`/profile`、`/profile/edit`、`/categories`、`/categories/groups?name=…`、`/categories/circles/:id`、`/settings`。

响应式：`<1024px` 底部五项 Tab Bar；`≥1024px` 左侧竖向导航。宽屏内容区最大 1460px。

## 已知限制

- 拼音索引使用浏览器内置中文排序 + 声母边界字，极生僻的多音字可能按通用读音归组。
- 当前用户与联系人分开管理；旧版 `selfId` 数据会在加载时把对应人物迁移到 `me`。
- 关系网在数千人规模下仍为同步渲染；更大规模建议按分组/圈子/标签查看。
- 项目数据文件需要本地服务（`pnpm dev` / `preview` / `serve`）；只托管静态 HTML 时无法写文件，会回退浏览器本地存储。
- `serve` 的数据 API 没有鉴权。默认只监听 `127.0.0.1`；设置 `HOST=0.0.0.0` 只应在可信局域网内使用。对外部署时，请用反向代理把 `/api` 同源转发到本服务，并在代理层加认证与 TLS。

## License

Private project. All rights reserved.
