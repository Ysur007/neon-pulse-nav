# Neon Pulse Nav

一个面向飞牛 NAS / 局域网环境的个人导航工作台。

它把个人导航页、服务器本地持久化、文件上传、音乐播放、Docker 容器管理和移动端适配放到同一个项目里，前端使用 Vue 3 + Vite，后端使用 Node.js + Express。

当前版本：`v0.3.0`

仓库地址：

- GitHub: `https://github.com/Ysur007/neon-pulse-nav`
- GHCR 镜像: `ghcr.io/ysur007/neon-pulse-nav:latest`

## 功能

- Vue 3 重构后的前端界面
- Three.js 背景特效，支持桌面端和移动端
- 时间反应堆时钟
- 工作台配置持久化到服务器本地
- 动态统计最近 7 天真实打开趋势
- 命令面板：`Ctrl / Cmd + K`
- 登录 / 改密
- 文件上传到 NAS 挂载目录
- 音乐上传、扫描、在线播放
- Docker 容器列表与启停控制
- 支持 Git 拉取更新
- 支持“只用 docker-compose.yml”在飞牛界面里创建项目

## 技术栈

- 前端：Vue 3、Vite、Three.js
- 后端：Node.js、Express
- NAS 能力：Docker Socket、文件目录挂载、音乐扫描
- 部署：Docker / Docker Compose / GHCR

## 默认账号

- 用户名：`admin`
- 密码：`admin`

首次登录后可以在页面里修改账号和密码。

## 项目结构

```text
src/
  App.vue
  main.js
  style.css
  data/content.js
  composables/useDashboardApp.js
  components/
server/
  index.js
  store.js
  nas-bridge.js
scripts/
  nas-git-deploy.sh
  nas-git-update.sh
  nas-git-stop.sh
docker-compose.yml
docker-compose.ghcr.yml
Dockerfile
```

关键文件说明：

- `src/App.vue`：页面主结构
- `src/composables/useDashboardApp.js`：前端主状态与交互
- `src/components/NasDeck.vue`：NAS 文件、音乐、Docker 面板
- `src/data/content.js`：默认导航数据
- `server/store.js`：工作台数据持久化
- `server/nas-bridge.js`：文件上传、音乐播放、Docker 对接
- `docker-compose.yml`：源码构建部署
- `docker-compose.ghcr.yml`：只拉镜像的 Compose 部署

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

默认会同时启动：

- 前端开发服务：`5173`
- 后端服务：`3000`

生产构建：

```bash
npm run build
npm run start
```

## 环境变量

复制模板：

```bash
cp .env.example .env
```

当前支持的主要变量：

| 变量名 | 说明 | 默认值 |
| --- | --- | --- |
| `NAV_PORT` | 宿主机访问端口 | `8080` |
| `NAS_TRANSFER_MOUNT` | 文件上传目录的宿主机路径 | `./nas/transfer` |
| `NAS_MUSIC_MOUNT` | 音乐目录的宿主机路径 | `./nas/music` |
| `DOCKER_SOCKET_MOUNT` | Docker socket 宿主机路径 | `/var/run/docker.sock` |

示例：

```bash
NAV_PORT=8080
NAS_TRANSFER_MOUNT=/vol1/1000/docker/neon-pulse-nav/transfer
NAS_MUSIC_MOUNT=/vol1/1000/docker/neon-pulse-nav/music
DOCKER_SOCKET_MOUNT=/var/run/docker.sock
```

## 部署方式

### 方式 1：Git 拉取源码后在 NAS 本机构建

适合你现在这种持续迭代、要经常更新的方式。

首次部署：

```bash
git clone https://github.com/Ysur007/neon-pulse-nav.git
cd neon-pulse-nav
cp .env.example .env
sudo sh scripts/nas-git-deploy.sh
```

更新：

```bash
cd /你的部署目录/neon-pulse-nav
sudo sh scripts/nas-git-update.sh
```

停止：

```bash
cd /你的部署目录/neon-pulse-nav
sudo sh scripts/nas-git-stop.sh
```

说明：

- `scripts/nas-git-update.sh` 已经内置 `HTTP/1.1` 拉取，避免部分 NAS 上 `git pull` 的 HTTP/2 报错
- 这条路径会在 NAS 上本地重建镜像

### 方式 2：飞牛 / fnOS 界面里只用 Compose 创建项目

如果你想在飞牛的 Docker / Compose 页面里直接创建项目，不想上传源码，也不想依赖本地构建，可以使用：

```text
docker-compose.ghcr.yml
```

这个文件会直接拉取 GHCR 镜像：

```text
ghcr.io/ysur007/neon-pulse-nav:latest
```

你也可以直接在飞牛界面里“创建 docker-compose.yml”，粘贴下面这份：

```yaml
services:
  neon-pulse-nav:
    container_name: neon-pulse-nav
    image: ghcr.io/ysur007/neon-pulse-nav:latest
    restart: unless-stopped
    ports:
      - "8080:3000"
    environment:
      DATA_DIR: /app/data
      NAS_TRANSFER_DIR: /app/nas/transfer
      NAS_MUSIC_DIR: /app/nas/music
      DOCKER_SOCKET_PATH: /var/run/docker.sock
    volumes:
      - /vol1/1000/docker/neon-pulse-nav/data:/app/data
      - /vol1/1000/docker/neon-pulse-nav/transfer:/app/nas/transfer
      - /vol1/1000/docker/neon-pulse-nav/music:/app/nas/music
      - /var/run/docker.sock:/var/run/docker.sock
```

这种方式的优点：

- 只需要 Compose 文件
- 不需要源码目录
- 不需要本地 `Dockerfile`
- 更适合飞牛网页界面管理

注意：

- 如果飞牛拉取 `ghcr.io/ysur007/neon-pulse-nav:latest` 报权限问题，需要把 GitHub Packages 中这个容器包的可见性改成 `public`

### 方式 3：源码目录直接 `docker compose up`

如果你手里已经有完整源码目录，也可以直接：

```bash
docker compose up -d --build
```

这个方式对应：

- `docker-compose.yml`

## 数据持久化

容器运行时，下面这些数据通过挂载目录持久化：

- `data/`
- `nas/transfer/`
- `nas/music/`
- `.env`

其中：

- `data/workspace-state.json`：工作台配置、账号、统计等核心数据
- `nas/transfer/`：上传文件目录
- `nas/music/`：音乐目录

更新时只要保留这些目录和 `.env`，数据就不会丢。

## Docker 说明

源码构建时使用：

- `Dockerfile`
- `docker-compose.yml`

镜像直拉时使用：

- `docker-compose.ghcr.yml`

当前容器内部服务端口固定为：

```text
3000
```

默认外部映射端口：

```text
8080
```

## GitHub Actions

仓库中已包含自动发布工作流：

- `.github/workflows/publish-ghcr.yml`

触发条件：

- 推送到 `main`
- 手动触发 `workflow_dispatch`

作用：

- 自动构建多架构镜像
- 推送到 `ghcr.io/ysur007/neon-pulse-nav:latest`

## 常见问题

### 1. `git pull` 报 HTTP/2 / framing layer 错误

可临时执行：

```bash
git -c http.version=HTTP/1.1 pull --ff-only
```

或者直接使用仓库里的更新脚本：

```bash
sudo sh scripts/nas-git-update.sh
```

### 2. `could not lock config file /home/<user>/.gitconfig`

说明当前 NAS 用户没有可写的 home 目录。直接用本地仓库配置即可：

```bash
git config --local http.version HTTP/1.1
```

### 3. Docker 权限不足

如果脚本提示无法访问 Docker daemon，请使用：

```bash
sudo sh scripts/nas-git-deploy.sh
```

### 4. GHCR 拉镜像报权限错误

请到 GitHub 仓库对应的 Packages 页面，把容器包可见性改为 `public`。

## 适合的使用场景

- 放在飞牛 NAS 上做家庭实验室入口页
- 局域网个人工作台
- 文件上传、音乐播放、容器管理的轻量统一面板
- 手机和电脑共用的个人导航首页
