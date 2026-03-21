<template>
  <section class="nas-grid">
    <article class="nas-card glass-panel">
      <div class="section-head">
        <div>
          <p class="kicker">NAS TRANSFER</p>
          <h3>文件传输桥</h3>
        </div>
        <div class="nas-toolbar">
          <label v-if="isAuthenticated" class="ghost-button nas-upload-button" for="nasTransferUploadInput">
            选择文件上传
            <input
              id="nasTransferUploadInput"
              class="visually-hidden"
              type="file"
              multiple
              @change="onFileInputChange($event, 'transfer')"
            />
          </label>
          <button v-else class="ghost-button" type="button" @click="requestAuth('请先登录后再上传文件')">
            登录后上传
          </button>
        </div>
      </div>

      <p class="nas-summary">{{ transferSummary }}</p>

      <div class="upload-meter">
        <div class="upload-meter-fill" :style="{ '--upload-progress': transferProgress }"></div>
      </div>

      <div class="nas-list is-scrollable">
        <a
          v-for="item in transferItems"
          :key="item.id"
          class="nas-list-item"
          :href="item.downloadUrl"
          target="_blank"
          rel="noreferrer"
        >
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ formatBytes(item.size) }} · {{ formatTime(item.createdAt) }}</small>
          </div>
          <span>下载</span>
        </a>

        <article v-if="!transferItems.length" class="nas-empty">
          还没有传输记录，先上传一个文件试试。
        </article>
      </div>
    </article>

    <article class="nas-card glass-panel">
      <div class="section-head">
        <div>
          <p class="kicker">MUSIC BAY</p>
          <h3>音乐播放舱</h3>
        </div>
        <div class="nas-toolbar">
          <button class="ghost-button ghost-button-small" type="button" @click="refreshMusicLibrary">
            刷新曲库
          </button>
          <label v-if="isAuthenticated" class="ghost-button nas-upload-button" for="nasMusicUploadInput">
            上传歌曲
            <input
              id="nasMusicUploadInput"
              class="visually-hidden"
              type="file"
              multiple
              accept="audio/*,.mp3,.flac,.wav,.m4a,.ogg,.aac"
              @change="onFileInputChange($event, 'music')"
            />
          </label>
          <button v-else class="ghost-button" type="button" @click="requestAuth('请先登录后再上传音乐')">
            登录后上传音乐
          </button>
        </div>
      </div>

      <p class="nas-summary">{{ musicSummary }}</p>

      <div class="music-player-shell">
        <div class="music-player-meta">
          <span class="music-player-chip">{{ activeTrack ? "NOW PLAYING READY" : "MUSIC LIBRARY" }}</span>
          <h4>{{ activeTrack?.title || "选择一首歌开始播放" }}</h4>
          <p>
            {{
              activeTrack
                ? `${activeTrack.artist} · ${activeTrack.album || "Unknown Album"}`
                : "上传后的歌曲会直接进入曲库，并可在这里立即播放。"
            }}
          </p>

          <div class="music-player-stats">
            <span>{{ formatDuration(activeTrack?.duration) }}</span>
            <span>{{ musicLibraryLabel }}</span>
            <span v-if="upload.active && upload.scope === 'music'">{{ upload.percent }}% 已上传</span>
          </div>
        </div>

        <div class="music-vinyl" aria-hidden="true">
          <span></span>
        </div>
      </div>

      <audio
        ref="audioRef"
        class="nas-audio"
        controls
        :src="activeTrack?.streamUrl || ''"
      ></audio>

      <div class="nas-list is-scrollable">
        <button
          v-for="track in tracks"
          :key="track.id"
          class="nas-list-item"
          :class="{ active: track.id === activeTrackId }"
          type="button"
          @click="playTrack(track.id)"
        >
          <div>
            <strong>{{ track.title }}</strong>
            <small>{{ track.artist }} · {{ formatDuration(track.duration) }}</small>
          </div>
          <span>播放</span>
        </button>

        <article v-if="!tracks.length" class="nas-empty">
          音乐目录里还没有可播放音频，上传几首歌就会出现在这里。
        </article>
      </div>
    </article>

    <article class="nas-card glass-panel">
      <div class="section-head">
        <div>
          <p class="kicker">DOCKER DECK</p>
          <h3>容器管理舱</h3>
        </div>
        <div class="nas-toolbar">
          <button
            v-if="isAuthenticated && docker.containers.length"
            id="nasDockerDialogButton"
            class="ghost-button ghost-button-small"
            type="button"
            @click="dockerDialogOpen = true"
          >
            查看全部 {{ docker.containers.length }}
          </button>
          <button class="ghost-button ghost-button-small" type="button" @click="refreshDocker">
            刷新容器
          </button>
        </div>
      </div>

      <p class="nas-summary">{{ dockerSummary }}</p>

      <article v-if="!isAuthenticated" class="nas-empty nas-login-gate">
        <strong>登录后可查看 Docker</strong>
        <p>容器列表、状态统计和启停控制都需要先完成登录验证。</p>
        <button class="ghost-button" type="button" @click="requestAuth('请先登录后查看 Docker')">
          立即登录
        </button>
      </article>

      <article v-else-if="!docker.available && !docker.containers.length" class="nas-empty nas-docker-note">
        {{ docker.error || "当前还没有可管理的容器。" }}
      </article>

      <article v-else-if="docker.available && !docker.containers.length" class="nas-empty nas-docker-note">
        当前 Docker 已连接，但还没有可展示的容器。
      </article>

      <template v-else>
        <div class="nas-docker-stack-shell">
          <div class="nas-docker-stack">
            <article v-for="container in docker.containers" :key="container.id" class="nas-docker-card">
              <div class="nas-docker-card-head">
                <div class="nas-docker-copy">
                  <strong>{{ container.name }}</strong>
                  <small class="nas-docker-image">{{ container.image }}</small>
                </div>
                <span class="nas-docker-state" :class="dockerStateTone(container)">
                  {{ container.status || "--" }}
                </span>
              </div>

              <div v-if="dockerMetrics(container).length" class="nas-docker-metrics">
                <span v-for="metric in dockerMetrics(container)" :key="metric">{{ metric }}</span>
              </div>

              <div class="docker-actions docker-actions-inline">
                <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'start')">
                  启动
                </button>
                <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'stop')">
                  停止
                </button>
                <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'restart')">
                  重启
                </button>
              </div>
            </article>
          </div>
        </div>
        <p class="nas-inline-note nas-docker-note">主卡片支持竖向滚动，点“查看全部”可在对话框里集中浏览。</p>
      </template>
    </article>
  </section>

  <div v-if="dockerDialogOpen && isAuthenticated && docker.containers.length" class="nas-dialog" role="dialog" aria-modal="true">
    <button class="nas-dialog-backdrop" type="button" aria-label="关闭容器列表" @click="dockerDialogOpen = false"></button>

    <div class="nas-dialog-panel glass-panel">
      <div class="nas-dialog-head">
        <div>
          <p class="kicker">DOCKER DIRECTORY</p>
          <h3>全部容器清单</h3>
          <p class="nas-dialog-summary">共 {{ docker.containers.length }} 个容器，可在这里集中查看和操作。</p>
        </div>
        <button class="ghost-button ghost-button-square" type="button" aria-label="关闭容器列表" @click="dockerDialogOpen = false">
          ×
        </button>
      </div>

      <div class="nas-dialog-list">
        <article v-for="container in docker.containers" :key="`dialog-${container.id}`" class="nas-docker-card is-modal">
          <div class="nas-docker-card-head">
            <div class="nas-docker-copy">
              <strong>{{ container.name }}</strong>
              <small class="nas-docker-image">{{ container.image }}</small>
            </div>
            <span class="nas-docker-state" :class="dockerStateTone(container)">
              {{ container.status || "--" }}
            </span>
          </div>

          <div v-if="dockerMetrics(container).length" class="nas-docker-metrics">
            <span v-for="metric in dockerMetrics(container)" :key="`dialog-${container.id}-${metric}`">{{ metric }}</span>
          </div>

          <div class="docker-actions docker-actions-inline">
            <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'start')">
              启动
            </button>
            <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'stop')">
              停止
            </button>
            <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'restart')">
              重启
            </button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { requestJson } from "../lib/api.js";

const props = defineProps({
  authState: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["notify", "request-auth"]);

const audioRef = ref(null);
const dockerDialogOpen = ref(false);
const overview = ref(null);
const transferItems = ref([]);
const tracks = ref([]);
const activeTrackId = ref("");
const docker = ref({
  available: false,
  locked: true,
  containers: [],
  error: "登录后可查看 Docker",
  engineVersion: "",
  socketPath: "",
});
const upload = reactive({
  active: false,
  scope: "transfer",
  fileName: "",
  percent: 0,
});

const isAuthenticated = computed(() => Boolean(props.authState?.authenticated));
const activeTrack = computed(() => tracks.value.find((item) => item.id === activeTrackId.value) ?? null);
const transferProgress = computed(() =>
  upload.active && upload.scope === "transfer" ? upload.percent / 100 : 0
);
const musicLibraryLabel = computed(() => {
  const total = overview.value?.music?.totalTracks ?? tracks.value.length;
  return total ? `音乐库 ${total} 首` : "等待曲库扫描完成";
});
const transferSummary = computed(() => {
  if (upload.active && upload.scope === "transfer") {
    return `正在上传 ${upload.fileName} · ${upload.percent}%`;
  }

  const rootDir =
    overview.value?.overview?.transfer?.rootDir ?? overview.value?.transfer?.rootDir ?? "";
  return rootDir ? `已挂载 ${rootDir}` : "支持大文件分片上传到飞牛 NAS 挂载目录";
});
const musicSummary = computed(() => {
  if (upload.active && upload.scope === "music") {
    return `正在上传 ${upload.fileName} · ${upload.percent}%`;
  }

  const total = overview.value?.music?.totalTracks ?? tracks.value.length;
  return total ? `音乐库 ${total} 首` : "扫描 NAS 音乐目录";
});
const dockerSummary = computed(() => {
  if (!isAuthenticated.value) {
    return "登录后可查看 Docker 容器列表";
  }

  if (docker.value.available) {
    return `Docker online · ${docker.value.engineVersion || docker.value.socketPath || "--"}`;
  }

  return docker.value.error || "Docker socket 尚未接通";
});

function notify(message, tone = "info") {
  emit("notify", { message, tone });
}

function requestAuth(message) {
  notify(message, "info");
  emit("request-auth");
}

function isUnauthorized(error) {
  return Number(error?.status) === 401;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 ** 2) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 ** 3) {
    return `${(value / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatTime(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "--:--";
  }

  const minute = Math.floor(seconds / 60);
  const second = String(seconds % 60).padStart(2, "0");
  return `${minute}:${second}`;
}

function formatDockerPorts(ports = []) {
  if (!Array.isArray(ports) || !ports.length) {
    return "";
  }

  return ports
    .map((port) => {
      const publicPort = port?.PublicPort ? `${port.PublicPort}:` : "";
      const privatePort = port?.PrivatePort ? `${port.PrivatePort}` : "-";
      const type = port?.Type ? `/${port.Type}` : "";
      return `${publicPort}${privatePort}${type}`;
    })
    .join(" · ");
}

function dockerStateTone(container) {
  const status = String(container?.status || container?.state || "").toLowerCase();

  if (status.includes("up") || status.includes("running")) {
    return "is-running";
  }

  if (status.includes("restart") || status.includes("paused")) {
    return "is-warning";
  }

  return "is-muted";
}

function dockerMetrics(container) {
  const metrics = [];

  if (container?.stats) {
    metrics.push(`CPU ${container.stats.cpuPercent}%`);
    metrics.push(`RAM ${formatBytes(container.stats.memoryUsage)}`);
  }

  const ports = formatDockerPorts(container?.ports);
  if (ports) {
    metrics.push(ports);
  }

  return metrics;
}

function syncActiveTrack(preferredTrackId = "") {
  const nextId =
    (preferredTrackId && tracks.value.some((item) => item.id === preferredTrackId)
      ? preferredTrackId
      : "") ||
    (activeTrackId.value && tracks.value.some((item) => item.id === activeTrackId.value)
      ? activeTrackId.value
      : "") ||
    tracks.value[0]?.id ||
    "";

  activeTrackId.value = nextId;
}

async function playTrack(trackId) {
  activeTrackId.value = trackId;
  await nextTick();
  audioRef.value?.play().catch(() => {});
}

async function uploadChunk(endpoint, { uploadId, index, chunk }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-upload-id": uploadId,
      "x-chunk-index": String(index),
    },
    credentials: "same-origin",
    body: chunk,
  });

  if (!response.ok) {
    let message = `Chunk upload failed with status ${response.status}`;
    let payload = null;

    try {
      payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch {}

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return response.json();
}

async function hydrate(options = {}) {
  const { preferredTrackId = "", autoplay = false } = options;
  const requests = [
    requestJson("/api/nas/overview"),
    requestJson("/api/nas/transfer/items"),
    requestJson("/api/nas/music/tracks"),
    isAuthenticated.value ? requestJson("/api/nas/docker/containers") : Promise.resolve(null),
  ];

  const [overviewResult, transferResult, musicResult, dockerResult] = await Promise.allSettled(
    requests
  );

  if (overviewResult.status === "fulfilled") {
    overview.value = overviewResult.value;
  }

  if (transferResult.status === "fulfilled") {
    transferItems.value = Array.isArray(transferResult.value?.items)
      ? transferResult.value.items
      : [];
  }

  if (musicResult.status === "fulfilled") {
    tracks.value = Array.isArray(musicResult.value?.tracks) ? musicResult.value.tracks : [];
    syncActiveTrack(preferredTrackId);
  }

  if (!isAuthenticated.value) {
    dockerDialogOpen.value = false;
    docker.value = {
      ...docker.value,
      available: false,
      locked: true,
      containers: [],
      error: "登录后可查看 Docker",
    };
  } else if (dockerResult.status === "fulfilled" && dockerResult.value) {
    docker.value = {
      available: Boolean(dockerResult.value.available),
      locked: Boolean(dockerResult.value.locked),
      containers: Array.isArray(dockerResult.value.containers) ? dockerResult.value.containers : [],
      error: dockerResult.value.error || "",
      engineVersion: dockerResult.value.engineVersion || "",
      socketPath: dockerResult.value.socketPath || "",
    };
  } else if (dockerResult.status === "rejected") {
    if (isUnauthorized(dockerResult.reason)) {
      requestAuth("登录状态已失效，请重新登录");
      return;
    }

    docker.value = {
      ...docker.value,
      available: false,
      containers: [],
      error: dockerResult.reason?.message || "读取 Docker 列表失败",
    };
  }

  if (autoplay && activeTrackId.value) {
    await nextTick();
    audioRef.value?.play().catch(() => {});
  }
}

async function refreshMusicLibrary() {
  try {
    await hydrate({
      preferredTrackId: activeTrackId.value,
    });
    notify("音乐库已刷新", "info");
  } catch (error) {
    notify(error.message || "刷新曲库失败", "error");
  }
}

async function refreshDocker() {
  if (!isAuthenticated.value) {
    requestAuth("请先登录后查看 Docker");
    return;
  }

  try {
    const payload = await requestJson("/api/nas/docker/containers");
    docker.value = {
      available: Boolean(payload.available),
      locked: Boolean(payload.locked),
      containers: Array.isArray(payload.containers) ? payload.containers : [],
      error: payload.error || "",
      engineVersion: payload.engineVersion || "",
      socketPath: payload.socketPath || "",
    };
  } catch (error) {
    if (isUnauthorized(error)) {
      requestAuth("登录状态已失效，请重新登录");
      return;
    }

    notify(error.message || "刷新容器失败", "error");
  }
}

async function uploadFiles(fileList, scope) {
  if (!isAuthenticated.value) {
    requestAuth(scope === "music" ? "请先登录后再上传音乐" : "请先登录后再上传文件");
    return;
  }

  const files = Array.from(fileList ?? []);
  if (!files.length) {
    return;
  }

  const endpointBase = scope === "music" ? "/api/nas/music/upload" : "/api/nas/transfer/upload";
  let preferredTrackId = "";

  try {
    for (const file of files) {
      upload.active = true;
      upload.scope = scope;
      upload.fileName = file.name;
      upload.percent = 0;

      const initPayload = await requestJson(`${endpointBase}/init`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          mime: file.type,
        }),
      });

      for (let index = 0; index < initPayload.totalChunks; index += 1) {
        const start = index * initPayload.chunkSize;
        const end = Math.min(file.size, start + initPayload.chunkSize);
        const chunk = await file.slice(start, end).arrayBuffer();

        await uploadChunk(`${endpointBase}/chunk`, {
          uploadId: initPayload.uploadId,
          index,
          chunk,
        });

        upload.percent = Math.round(((index + 1) / initPayload.totalChunks) * 100);
      }

      const completePayload = await requestJson(`${endpointBase}/complete`, {
        method: "POST",
        body: JSON.stringify({
          uploadId: initPayload.uploadId,
        }),
      });

      if (scope === "music" && completePayload?.item?.id) {
        preferredTrackId = completePayload.item.id;
      }

      notify(scope === "music" ? `${file.name} 已加入音乐库` : `${file.name} 已上传到 NAS`, "info");
    }
  } catch (error) {
    if (isUnauthorized(error)) {
      requestAuth(scope === "music" ? "请先登录后再上传音乐" : "请先登录后再上传文件");
      return;
    }

    notify(error.message || "上传失败", "error");
  } finally {
    upload.active = false;
    upload.scope = "transfer";
    upload.fileName = "";
    upload.percent = 0;
  }

  await hydrate({
    preferredTrackId,
    autoplay: scope === "music" && Boolean(preferredTrackId),
  });
}

async function onFileInputChange(event, scope) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  try {
    await uploadFiles(input.files, scope);
  } finally {
    input.value = "";
  }
}

async function runDockerAction(containerId, action) {
  if (!isAuthenticated.value) {
    requestAuth("请先登录后再管理 Docker 容器");
    return;
  }

  try {
    await requestJson(`/api/nas/docker/containers/${containerId}/${action}`, {
      method: "POST",
    });
    notify(`容器已执行 ${action}`, "info");
    await refreshDocker();
  } catch (error) {
    if (isUnauthorized(error)) {
      requestAuth("登录状态已失效，请重新登录");
      return;
    }

    notify(error.message || "Docker 操作失败", "error");
  }
}

watch(dockerDialogOpen, (open) => {
  document.body.classList.toggle("nas-modal-open", open);
});

watch(
  () => props.authState?.authenticated,
  (authenticated) => {
    if (!authenticated) {
      dockerDialogOpen.value = false;
      docker.value = {
        ...docker.value,
        available: false,
        locked: true,
        containers: [],
        error: "登录后可查看 Docker",
      };
    }
  }
);

onBeforeUnmount(() => {
  document.body.classList.remove("nas-modal-open");
});

defineExpose({
  hydrate,
});
</script>
