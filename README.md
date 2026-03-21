# Neon Pulse Nav

面向飞牛 NAS / 局域网环境的个人导航工作台。

它把个人导航页、服务器本地持久化、文件上传、音乐播放、Docker 容器管理和移动端适配放在同一个项目里。前端使用 Vue 3 + Vite，后端使用 Node.js + Express。

当前版本：`v0.4.0`

## 仓库与镜像

- GitHub: [https://github.com/Ysur007/neon-pulse-nav](https://github.com/Ysur007/neon-pulse-nav)
- GHCR: `ghcr.io/ysur007/neon-pulse-nav:latest`
- Docker Hub: `2095853912/neon-pulse-nav:latest`
- Docker Hub 固定版本示例: `2095853912/neon-pulse-nav:v0.4.0`

## 主要功能

- Vue 3 重构后的导航工作台界面
- Three.js 动态背景，桌面端和移动端都有效果
- 时间反应堆时钟
- 工作台配置持久化到服务器本地
- 最近 7 天真实打开趋势统计
- 命令面板：`Ctrl / Cmd + K`
- 登录、改密
- 文件上传到 NAS 挂载目录
- 音乐上传、曲库扫描、在线播放
- 音乐灵动岛、切歌、播放顺序切换、自动下一首
- Docker 容器列表与启停控制
- 适合飞牛 NAS 的 Docker / Compose 部署

## 默认账号

- 用户名：`admin`
- 密码：`admin`

首次登录后可以在页面内修改账号和密码。

## 技术栈

- 前端：Vue 3、Vite、Three.js
- 后端：Node.js、Express
- NAS 对接：文件目录挂载、Docker Socket、音乐文件扫描
- 部署：Docker、Docker Compose、GHCR、Docker Hub

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

关键文件：

- `src/App.vue`：页面主结构
- `src/composables/useDashboardApp.js`：工作台状态与交互
- `src/components/NasDeck.vue`：文件、音乐、Docker 面板
- `src/data/content.js`：默认导航数据
- `server/store.js`：账号、工作台、统计等持久化
- `server/nas-bridge.js`：文件上传、音乐曲库、Docker 对接
- `docker-compose.yml`：本地源码构建部署
- `docker-compose.ghcr.yml`：镜像直拉部署

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

主要变量：

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

适合持续迭代、需要自己改代码的场景。

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

- `scripts/nas-git-update.sh` 已处理部分 NAS 上 `git pull` 的 HTTP 协议兼容问题
- 这种方式会在 NAS 本地重新构建镜像

### 方式 2：飞牛 / fnOS 界面里直接用 Compose 创建项目

适合不想上传源码、只想在飞牛界面里创建项目的场景。

可以直接使用镜像版 Compose：

```text
docker-compose.ghcr.yml
```

如果你在飞牛界面里选择“创建 docker-compose.yml”，推荐直接填下面这份 Docker Hub 版本：

```yaml
services:
  neon-pulse-nav:
    container_name: neon-pulse-nav
    image: 2095853912/neon-pulse-nav:latest
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

飞牛 / fnOS 页面创建步骤：

1. 进入 Docker 或 Compose 页面
2. 点击“新增项目”
3. 项目名称填写：`neon-pulse-nav`
4. 路径填写：`/vol1/1000/docker/neon-pulse-nav`
5. 来源选择“创建 docker-compose.yml”
6. 粘贴上面的 Compose 内容
7. 勾选“创建项目后立即启动”
8. 点击确认

如果你不想手动粘贴，也可以使用“上传 docker-compose.yml”，上传仓库里的：

```text
docker-compose.ghcr.yml
```

这种方式的优点：

- 只需要 Compose 文件
- 不依赖源码目录
- 不依赖本地 `Dockerfile`
- 更适合飞牛图形界面管理

### 方式 3：源码目录直接执行 docker compose

如果你已经有完整源码目录，也可以直接：

```bash
docker compose up -d --build
```

对应文件：

- `docker-compose.yml`

## 已部署项目如何更新

### 如果你使用的是镜像版 Compose

也就是 `image: 2095853912/neon-pulse-nav:latest` 或 `image: ghcr.io/ysur007/neon-pulse-nav:latest` 这种方式。

更新命令：

```bash
cd /你的项目目录
sudo docker compose pull
sudo docker compose up -d --force-recreate
```

说明：

- `重启` 旧容器不等于更新
- 更新的关键是先拉最新镜像，再重建容器
- 只要挂载目录不变，数据不会丢

### 如果你使用的是源码构建版 Compose

更新命令：

```bash
cd /你的项目目录
git pull --ff-only
sudo docker compose up -d --build
```

## 数据持久化

运行时建议持久化这些目录：

- `data/`
- `nas/transfer/`
- `nas/music/`
- `.env`

其中：

- `data/workspace-state.json`：账号、工作台配置、统计数据
- `data/nas-bridge/music-index.json`：音乐曲库索引
- `nas/transfer/`：上传文件目录
- `nas/music/`：音乐目录

更新时只要保留这些目录和 `.env`，数据就不会丢。

## Docker 说明

源码构建使用：

- `Dockerfile`
- `docker-compose.yml`

镜像直拉使用：

- `docker-compose.ghcr.yml`
- 或你自己写的 Docker Hub 版 Compose

容器内部服务端口固定为：

```text
3000
```

默认外部映射端口：

```text
8080
```

## 自动发布

仓库已包含自动发布工作流：

- `.github/workflows/publish-ghcr.yml`

触发条件：

- 推送到 `main`
- 手动触发 `workflow_dispatch`

作用：

- 自动构建镜像
- 推送到 `ghcr.io/ysur007/neon-pulse-nav:latest`

Docker Hub 镜像当前为手动发布：

- `2095853912/neon-pulse-nav:latest`

## 常见问题

### 1. 上传后的音乐没有出现在曲库里

先确认：

- 文件确实已经进入 NAS 的音乐目录
- 当前版本已经更新到包含最新修复的镜像

如果你使用镜像版 Compose，执行：

```bash
cd /你的项目目录
sudo docker compose pull
sudo docker compose up -d --force-recreate
```

说明：

- 新版本已改成“目录扫描 + 上传索引双保险”
- 即使音频元数据解析失败，已上传文件也会进入列表

### 2. `git pull` 报 HTTP/2 / framing layer 错误

可临时执行：

```bash
git -c http.version=HTTP/1.1 pull --ff-only
```

或者直接使用仓库里的更新脚本：

```bash
sudo sh scripts/nas-git-update.sh
```

### 3. `could not lock config file /home/<user>/.gitconfig`

说明当前 NAS 用户没有可写的 home 目录。直接用本地仓库配置即可：

```bash
git config --local http.version HTTP/1.1
```

### 4. Docker 权限不足

如果提示无法访问 Docker daemon，请使用：

```bash
sudo docker compose pull
sudo docker compose up -d --force-recreate
```

或者先把用户加入 `docker` 组。

### 5. 浏览器控制台出现 `content_script.js` 报错

这通常是浏览器扩展注入脚本报错，不一定是本项目自身的问题。

建议先：

- 强刷页面
- 临时关闭浏览器扩展再测试
- 再观察项目自己的接口是否正常返回

## 适合的使用场景

- 放在飞牛 NAS 上作为家庭实验室入口页
- 局域网个人工作台
- 文件上传、音乐播放、容器管理的一体化轻量面板
- 手机和电脑共用的个人导航首页
