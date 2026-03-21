# Neon Pulse Nav

一个基于 Vite、Three.js 和 Node 的个人导航工作台，适合部署到飞牛 NAS 或其他局域网服务器。

当前版本包含这些能力：
- Three.js 炫酷背景和移动端自适应特效
- 时间反应堆时钟
- 服务器本地持久化的个人资料、置顶入口和点击历史
- 真正动态的一跳直达入口
- 命令面板：`Ctrl / Cmd + K`
- 工作台统计面板：今日热度、7 日趋势、热门入口
- 数据管理：导出备份、导入恢复、清空统计、重置工作台
- 飞牛 NAS 对接：文件传输、音乐播放、Docker 容器管理

## 本地开发

```bash
npm install
npm run dev
```

本地开发会同时启动：
- Vite 前端开发服务：`5173`
- Node API 服务：`3000`

## 生产运行

```bash
npm run build
npm run start
```

默认服务端口是 `3000`。

## 数据存储

服务端会把工作台状态写到本地 JSON 文件：

```bash
data/workspace-state.json
```

默认保存内容：
- 个人资料
- 置顶入口
- 按天统计的点击历史
- NAS 传输索引和分片上传会话

## 主要 API

- `GET /api/workspace`
- `PUT /api/workspace`
- `GET /api/workspace/stats`
- `GET /api/workspace/export`
- `POST /api/workspace/import`
- `POST /api/workspace/reset`
- `POST /api/link-events/open`
- `GET /api/nas/overview`
- `GET /api/nas/transfer/items`
- `POST /api/nas/transfer/upload/init`
- `POST /api/nas/transfer/upload/chunk`
- `POST /api/nas/transfer/upload/complete`
- `GET /api/nas/transfer/files/:id`
- `GET /api/nas/music/tracks`
- `GET /api/nas/music/stream/:trackId`
- `GET /api/nas/docker/info`
- `GET /api/nas/docker/containers`
- `POST /api/nas/docker/containers/:id/:action`

## Docker 构建

```bash
docker build -t neon-pulse-nav:latest .
docker run -d --name neon-pulse-nav -p 8080:3000 -v $(pwd)/data:/app/data --restart unless-stopped neon-pulse-nav:latest
```

浏览器访问：

```text
http://localhost:8080
```

## Docker Compose

```bash
docker compose up -d --build
```

默认映射：
- 宿主机端口：`8080`
- 容器端口：`3000`

如需改宿主机端口，复制 `.env.example` 为 `.env` 后修改：

```bash
NAV_PORT=8090
NAS_TRANSFER_MOUNT=/vol1/1000/transfer
NAS_MUSIC_MOUNT=/vol1/1000/music
DOCKER_SOCKET_MOUNT=/var/run/docker.sock
```

## 飞牛 NAS 部署建议

推荐把整个项目目录上传到 NAS，再让 NAS 本机构建镜像。这样不需要担心本地导出的镜像架构和 NAS 架构不一致。

飞牛 NAS 是 Debian 系系的定制环境，这版默认按 Linux 目录和 Docker socket 来设计，重点是这 3 个挂载：

- `NAS_TRANSFER_MOUNT`
  这里放上传后的文件，建议挂到你飞牛里专门的共享目录
- `NAS_MUSIC_MOUNT`
  这里放音乐库，页面会自动扫描并提供在线播放
- `DOCKER_SOCKET_MOUNT`
  默认挂 `/var/run/docker.sock`，这样容器内服务才能管理宿主机 Docker

一个更接近飞牛实际使用场景的 `.env` 示例：

```bash
NAV_PORT=8080
NAS_TRANSFER_MOUNT=/vol1/1000/Files/Transfer
NAS_MUSIC_MOUNT=/vol1/1000/Media/Music
DOCKER_SOCKET_MOUNT=/var/run/docker.sock
```

然后执行：

```bash
docker compose up -d --build
```

如果你已经有离线镜像，也可以使用：

```bash
docker compose -f docker-compose.image.yml up -d
```

## 目录说明

- `src/main.js`：页面结构、命令面板、前端状态和交互
- `src/nas-deck.js`：飞牛 NAS 文件传输、音乐播放、Docker 管理前端模块
- `src/style.css`：页面视觉和响应式样式
- `src/data/content.js`：默认链接和文案数据
- `server/index.js`：API 与静态资源服务入口
- `server/store.js`：本地 JSON 持久化、导出导入与统计汇总
- `server/nas-bridge.js`：NAS 文件传输、音乐库扫描、Docker socket 对接
- `Dockerfile`：容器构建
- `docker-compose.yml`：源码构建部署
- `docker-compose.image.yml`：离线镜像部署
