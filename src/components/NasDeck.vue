<template>
  <div v-if="islandVisible" class="music-island-shell" :class="{ 'is-expanded': islandExpanded }">
    <div ref="musicIslandCardRef" class="music-island-card">
      <button class="music-island-toggle" type="button" :aria-expanded="islandExpanded" @click="handleIslandPrimaryAction">
        <span class="music-island-art">{{ activeTrack?.title?.slice(0, 1) || "M" }}</span>
        <div class="music-island-copy">
          <strong>{{ activeTrack?.title || "Now Playing" }}</strong>
          <small>{{ audioState.playing ? (islandExpanded ? "播放中 · 轻触收起" : "播放中 · 轻触展开") : (islandExpanded ? "已暂停 · 轻触收起" : "已暂停 · 轻触展开") }}</small>
        </div>
        <div class="music-island-wave" :class="{ 'is-playing': audioState.playing }" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </button>
      <div class="music-island-panel">
        <div class="music-island-panel-inner" @click="openMusicDetail">
          <p class="kicker">MUSIC ISLAND</p>
          <div class="music-island-head">
            <div>
              <strong>{{ activeTrack?.title || "未命名曲目" }}</strong>
              <small>{{ islandMeta }}</small>
            </div>
            <span class="music-island-status" :class="{ 'is-live': audioState.playing }">{{ audioState.playing ? "LIVE" : "PAUSE" }}</span>
          </div>
          <div class="music-island-progress"><span :style="{ transform: `scaleX(${playbackProgress})` }"></span></div>
          <div class="music-island-times"><span>{{ currentTimeLabel }}</span><span>{{ durationLabel }}</span></div>
          <div class="music-island-actions">
            <button class="ghost-button ghost-button-small" type="button" @click.stop="cyclePlaybackOrder" :title="`播放顺序：${playbackOrderHint}`">{{ playbackOrderLabel }}</button>
            <button class="ghost-button ghost-button-small" type="button" :disabled="!hasMultipleTracks" @click.stop="playPreviousTrack">上一首</button>
            <button class="ghost-button ghost-button-small" type="button" @click.stop="toggleIslandPlayback">{{ audioState.playing ? "暂停" : "继续" }}</button>
            <button class="ghost-button ghost-button-small" type="button" :disabled="!hasMultipleTracks" @click.stop="playNextTrack">下一首</button>
            <button class="ghost-button ghost-button-small" type="button" @click.stop="focusMusicBay">查看音乐舱</button>
            <button class="ghost-button ghost-button-small" type="button" @click.stop="collapseIsland">收起</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <MusicPlayerDetail
    :open="detailOpen"
    :track="activeTrack"
    :detail="activeTrackDetail"
    :audio-state="audioState"
    :current-time-label="currentTimeLabel"
    :duration-label="durationLabel"
    :playback-order-label="playbackOrderLabel"
    :playback-order-hint="playbackOrderHint"
    :has-multiple-tracks="hasMultipleTracks"
    :volume-percent="volumePercent"
    @close="closeMusicDetail"
    @focus-bay="focusMusicBay"
    @previous="playPreviousTrack"
    @toggle-playback="toggleIslandPlayback"
    @next="playNextTrack"
    @cycle-order="cyclePlaybackOrder"
    @volume="handleVolumeInput"
  />

  <section class="nas-grid">
    <article class="nas-card glass-panel">
      <div class="section-head">
        <div><p class="kicker">NAS TRANSFER</p><h3>文件传输桥</h3></div>
        <div class="nas-toolbar">
          <label v-if="isAuthenticated" class="ghost-button ghost-button-small nas-upload-button" for="nasTransferUploadInput">
            选择文件上传
            <input id="nasTransferUploadInput" class="visually-hidden" type="file" multiple @change="onFileInputChange($event, 'transfer')" />
          </label>
          <button v-else class="ghost-button ghost-button-small" type="button" @click="requestAuth('请先登录后再上传文件')">登录后上传</button>
        </div>
      </div>

      <p class="nas-summary">{{ transferSummary }}</p>
      <div class="upload-meter"><div class="upload-meter-fill" :style="{ '--upload-progress': transferProgress }"></div></div>

      <div class="nas-message-shell">
        <label class="form-field nas-message-field">
          <span>传输留言板</span>
          <textarea v-model.trim="messageForm.body" rows="3" maxlength="240" placeholder="给这台 NAS 留一句话，支持多设备查看。"></textarea>
        </label>
        <div class="nas-inline-actions nas-inline-actions-wide">
          <span class="nas-message-meta">{{ isAuthenticated ? `以 ${props.authState.username} 发送 · 还可输入 ${messageRemaining} 字` : "登录后可发送消息" }}</span>
          <button v-if="isAuthenticated" class="pill-button pill-button-primary ghost-button-small" type="button" :disabled="!canSendMessage" @click="sendTransferMessage">发送消息</button>
          <button v-else class="ghost-button ghost-button-small" type="button" @click="requestAuth('请先登录后再发送消息')">登录后发送</button>
        </div>
        <div class="nas-list nas-message-list is-scrollable">
          <article v-for="message in messages" :key="message.id" class="nas-message-item">
            <div class="nas-message-head"><strong>{{ message.author }}</strong><small>{{ formatTime(message.createdAt) }}</small></div>
            <p>{{ message.body }}</p>
          </article>
          <article v-if="!messages.length" class="nas-empty">这里还没有消息，发一条试试看。</article>
        </div>
      </div>

      <div class="nas-list is-scrollable">
        <article v-for="item in transferItems" :key="item.id" class="nas-list-item">
          <div><strong>{{ item.name }}</strong><small>{{ formatBytes(item.size) }} · {{ formatTime(item.createdAt) }}</small></div>
          <div class="nas-inline-actions">
            <a class="ghost-button ghost-button-small nas-action-link" :href="item.downloadUrl" target="_blank" rel="noreferrer">下载</a>
            <button v-if="isAuthenticated" class="ghost-button ghost-button-small" type="button" @click="deleteTransferItem(item.id)">删除</button>
          </div>
        </article>
        <article v-if="!transferItems.length" class="nas-empty">还没有传输记录，先上传一个文件试试。</article>
      </div>
    </article>

    <article ref="musicBayRef" class="nas-card glass-panel">
      <div class="section-head">
        <div><p class="kicker">MUSIC BAY</p><h3>音乐播放舱</h3></div>
        <div class="nas-toolbar">
          <button class="ghost-button ghost-button-small" type="button" @click="refreshMusicLibrary">刷新曲库</button>
          <label v-if="isAuthenticated" class="ghost-button ghost-button-small nas-upload-button" for="nasMusicUploadInput">
            上传歌曲
            <input id="nasMusicUploadInput" class="visually-hidden" type="file" multiple accept="audio/*,.mp3,.flac,.wav,.m4a,.ogg,.aac" @change="onFileInputChange($event, 'music')" />
          </label>
          <button v-else class="ghost-button ghost-button-small" type="button" @click="requestAuth('请先登录后再上传音乐')">登录后上传</button>
        </div>
      </div>

      <p class="nas-summary">{{ musicSummary }}</p>

      <div class="music-player-shell">
        <div class="music-player-meta">
          <span class="music-player-chip">{{ activeTrack ? "NOW PLAYING READY" : "MUSIC LIBRARY" }}</span>
          <h4>{{ activeTrack?.title || "选择一首歌开始播放" }}</h4>
          <p>{{ activeTrack ? `${activeTrack.artist} · ${activeTrack.album || "Unknown Album"}` : "上传后的歌曲会直接进入曲库，并且可以在这里立刻播放。" }}</p>
          <div class="music-player-stats">
            <span>{{ formatDuration(activeTrack?.duration) }}</span>
            <span>{{ musicLibraryLabel }}</span>
            <span v-if="upload.active && upload.scope === 'music'">{{ upload.percent }}% 已上传</span>
          </div>
        </div>
        <div class="music-vinyl" aria-hidden="true"><span></span></div>
      </div>

      <div class="nas-audio-shell" :class="{ 'is-active': !!activeTrack, 'is-live': audioState.playing }">
        <div class="nas-audio-controls">
          <button class="nas-audio-control-button nas-audio-order-button" type="button" :title="`播放顺序：${playbackOrderHint}`" @click="cyclePlaybackOrder">
            <span aria-hidden="true">{{ playbackOrderGlyph }}</span>
            <span class="visually-hidden">{{ playbackOrderHint }}</span>
          </button>
          <button class="nas-audio-control-button nas-audio-nav-button" type="button" :disabled="!hasMultipleTracks" @click="playPreviousTrack">
            <span aria-hidden="true"><</span>
            <span class="visually-hidden">上一首</span>
          </button>
          <button class="nas-audio-control-button nas-audio-trigger" type="button" :disabled="!activeTrack" @click="toggleIslandPlayback">
            <span class="nas-audio-trigger-icon">{{ audioState.playing ? "II" : ">" }}</span>
          </button>
          <button class="nas-audio-control-button nas-audio-nav-button" type="button" :disabled="!hasMultipleTracks" @click="playNextTrack">
            <span aria-hidden="true">></span>
            <span class="visually-hidden">下一首</span>
          </button>
        </div>
        <div class="nas-audio-body">
          <div class="nas-audio-meta">
            <strong>{{ currentTimeLabel }} / {{ durationLabel }}</strong>
            <small>{{ activeTrack ? `${activeTrack.artist} · ${activeTrack.album || "Unknown Album"}` : "选择一首歌后即可拖动进度" }}</small>
          </div>
          <label class="nas-audio-range-shell" :style="{ '--audio-progress': `${playerProgressPercent}%` }">
            <input
              class="nas-audio-range"
              type="range"
              min="0"
              :max="audioDurationValue"
              step="0.1"
              :value="audioRangeValue"
              :disabled="!activeTrack || !audioDurationValue"
              aria-label="音乐播放进度"
              @input="handleSeekInput"
              @change="handleSeekInput"
            />
          </label>
        </div>
        <span class="nas-audio-badge">{{ audioState.playing ? "LIVE" : activeTrack ? "READY" : "--" }}</span>
      </div>

      <audio
        ref="audioRef"
        class="nas-audio-hidden"
        preload="metadata"
        :src="activeTrack?.streamUrl || ''"
        @play="handleAudioPlay"
        @pause="handleAudioPause"
        @timeupdate="handleAudioTimeUpdate"
        @loadedmetadata="handleAudioMetadata"
        @error="handleAudioError"
        @ended="handleAudioEnded"
      ></audio>

      <div class="nas-list is-scrollable">
        <article v-for="track in tracks" :key="track.id" class="nas-list-item" :class="{ active: track.id === activeTrackId }">
          <div><strong>{{ track.title }}</strong><small>{{ track.artist }} · {{ formatDuration(track.duration) }}</small></div>
          <div class="nas-inline-actions">
            <button class="ghost-button ghost-button-small" type="button" @click="playTrack(track.id)">播放</button>
            <button v-if="isAuthenticated" class="ghost-button ghost-button-small" type="button" @click="deleteTrack(track.id)">删除</button>
          </div>
        </article>
        <article v-if="!tracks.length" class="nas-empty">音乐目录里还没有可播放音频，上传几首歌就会出现在这里。</article>
      </div>
    </article>

    <article class="nas-card glass-panel">
      <div class="section-head">
        <div><p class="kicker">DOCKER DECK</p><h3>容器管理舱</h3></div>
        <div class="nas-toolbar">
          <button v-if="isAuthenticated && docker.containers.length" id="nasDockerDialogButton" class="ghost-button ghost-button-small" type="button" @click="dockerDialogOpen = true">查看全部 {{ docker.containers.length }}</button>
          <button class="ghost-button ghost-button-small" type="button" @click="refreshDocker">刷新容器</button>
        </div>
      </div>

      <p class="nas-summary">{{ dockerSummary }}</p>

      <article v-if="!isAuthenticated" class="nas-empty nas-login-gate">
        <strong>登录后可查看 Docker</strong>
        <p>容器列表、状态统计和启停控制都需要先完成登录验证。</p>
        <button class="ghost-button" type="button" @click="requestAuth('请先登录后查看 Docker')">立即登录</button>
      </article>
      <article v-else-if="!docker.available && !docker.containers.length" class="nas-empty nas-docker-note">{{ docker.error || "当前还没有可管理的容器。" }}</article>
      <article v-else-if="docker.available && !docker.containers.length" class="nas-empty nas-docker-note">当前 Docker 已连接，但还没有可展示的容器。</article>
      <template v-else>
        <div class="nas-docker-stack-shell">
          <div class="nas-docker-stack">
            <article v-for="container in docker.containers" :key="container.id" class="nas-docker-card">
              <div class="nas-docker-card-head">
                <div class="nas-docker-copy"><strong>{{ container.name }}</strong><small class="nas-docker-image">{{ container.image }}</small></div>
                <span class="nas-docker-state" :class="dockerStateTone(container)">{{ container.status || "--" }}</span>
              </div>
              <div v-if="dockerMetrics(container).length" class="nas-docker-metrics">
                <span v-for="metric in dockerMetrics(container)" :key="metric">{{ metric }}</span>
              </div>
              <div class="docker-actions docker-actions-inline">
                <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'start')">启动</button>
                <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'stop')">停止</button>
                <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'restart')">重启</button>
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
        <button class="ghost-button ghost-button-square" type="button" aria-label="关闭容器列表" @click="dockerDialogOpen = false">X</button>
      </div>
      <div class="nas-dialog-list">
        <article v-for="container in docker.containers" :key="`dialog-${container.id}`" class="nas-docker-card is-modal">
          <div class="nas-docker-card-head">
            <div class="nas-docker-copy"><strong>{{ container.name }}</strong><small class="nas-docker-image">{{ container.image }}</small></div>
            <span class="nas-docker-state" :class="dockerStateTone(container)">{{ container.status || "--" }}</span>
          </div>
          <div v-if="dockerMetrics(container).length" class="nas-docker-metrics">
            <span v-for="metric in dockerMetrics(container)" :key="`dialog-${container.id}-${metric}`">{{ metric }}</span>
          </div>
          <div class="docker-actions docker-actions-inline">
            <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'start')">启动</button>
            <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'stop')">停止</button>
            <button class="ghost-button ghost-button-small" type="button" @click="runDockerAction(container.id, 'restart')">重启</button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { requestJson } from "../lib/api.js";
import MusicPlayerDetail from "./MusicPlayerDetail.vue";

const props = defineProps({ authState: { type: Object, required: true } });
const emit = defineEmits(["notify", "request-auth"]);
const PLAYBACK_ORDER_OPTIONS = [
  { key: "loop", label: "顺序", glyph: "S", hint: "顺序循环" },
  { key: "repeat", label: "单曲", glyph: "1", hint: "单曲循环" },
  { key: "shuffle", label: "随机", glyph: "R", hint: "随机播放" },
];

const PLAY_RETRY_DELAY_MS = 350;
const audioRef = ref(null);
const musicBayRef = ref(null);
const musicIslandCardRef = ref(null);
const dockerDialogOpen = ref(false);
const islandExpanded = ref(false);
const detailOpen = ref(false);
const detailLoading = ref(false);
const overview = ref(null);
const transferItems = ref([]);
const tracks = ref([]);
const messages = ref([]);
const activeTrackId = ref("");
const activeTrackDetail = ref(null);
const docker = ref({ available: false, locked: true, containers: [], error: "登录后可查看 Docker", engineVersion: "", socketPath: "" });
const audioState = reactive({ playing: false, currentTime: 0, duration: 0, volume: 0.72 });
const upload = reactive({ active: false, scope: "transfer", fileName: "", percent: 0 });
const messageForm = reactive({ body: "", sending: false });

const isAuthenticated = computed(() => Boolean(props.authState?.authenticated));
const activeTrack = computed(() => tracks.value.find((item) => item.id === activeTrackId.value) ?? null);
const transferProgress = computed(() => (upload.active && upload.scope === "transfer" ? upload.percent / 100 : 0));
const musicLibraryLabel = computed(() => {
  const total = overview.value?.music?.totalTracks ?? tracks.value.length;
  return total ? `音乐库 ${total} 首` : "等待曲库扫描完成";
});
const transferSummary = computed(() => {
  if (upload.active && upload.scope === "transfer") return `正在上传 ${upload.fileName} · ${upload.percent}%`;
  const rootDir = overview.value?.overview?.transfer?.rootDir ?? overview.value?.transfer?.rootDir ?? "";
  return rootDir ? `已挂载 ${rootDir}` : "支持大文件分片上传到飞牛 NAS 挂载目录";
});
const musicSummary = computed(() => {
  if (upload.active && upload.scope === "music") return `正在上传 ${upload.fileName} · ${upload.percent}%`;
  const total = overview.value?.music?.totalTracks ?? tracks.value.length;
  return total ? `音乐库 ${total} 首` : "扫描 NAS 音乐目录";
});
const dockerSummary = computed(() => {
  if (!isAuthenticated.value) return "登录后可查看 Docker 容器列表";
  if (docker.value.available) return `Docker online · ${docker.value.engineVersion || docker.value.socketPath || "--"}`;
  return docker.value.error || "Docker socket 尚未接通";
});
const normalizedMessageBody = computed(() => messageForm.body.trim());
const messageRemaining = computed(() => Math.max(0, 240 - normalizedMessageBody.value.length));
const canSendMessage = computed(() => Boolean(isAuthenticated.value && normalizedMessageBody.value && !messageForm.sending));
const islandVisible = computed(() => Boolean(activeTrack.value && (audioState.playing || audioState.currentTime > 0)));
const playbackProgress = computed(() => (audioState.duration > 0 ? Math.min(1, audioState.currentTime / audioState.duration) : 0));
const activeTrackIndex = computed(() => tracks.value.findIndex((item) => item.id === activeTrackId.value));
const hasMultipleTracks = computed(() => tracks.value.length > 1);
const audioDurationValue = computed(() => Math.max(0, Number(audioState.duration || activeTrack.value?.duration || 0)));
const audioRangeValue = computed(() => Math.min(audioDurationValue.value, Math.max(0, Number(audioState.currentTime) || 0)));
const playerProgressPercent = computed(() => (audioDurationValue.value > 0 ? Math.min(100, (audioRangeValue.value / audioDurationValue.value) * 100) : 0));
const volumePercent = computed(() => Math.round(Math.min(1, Math.max(0, Number(audioState.volume) || 0)) * 100));
const islandMeta = computed(() => {
  if (!activeTrack.value) return "暂无曲目信息";
  return `${activeTrack.value.artist || "Unknown Artist"} · ${activeTrack.value.album || "Unknown Album"}`;
});
const currentTimeLabel = computed(() => formatDuration(Math.floor(audioState.currentTime)));
const durationLabel = computed(() => formatDuration(Math.floor(audioState.duration || activeTrack.value?.duration || 0)));
const playbackOrder = ref("loop");
const playbackOrderMeta = computed(() => PLAYBACK_ORDER_OPTIONS.find((item) => item.key === playbackOrder.value) ?? PLAYBACK_ORDER_OPTIONS[0]);
const playbackOrderLabel = computed(() => playbackOrderMeta.value.label);
const playbackOrderGlyph = computed(() => playbackOrderMeta.value.glyph);
const playbackOrderHint = computed(() => playbackOrderMeta.value.hint);
let activeDetailRequestToken = 0;

function notify(message, tone = "info") { emit("notify", { message, tone }); }
function requestAuth(message) { notify(message, "info"); emit("request-auth"); }
function isUnauthorized(error) { return Number(error?.status) === 401; }

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const minute = Math.floor(seconds / 60);
  const second = String(seconds % 60).padStart(2, "0");
  return `${minute}:${second}`;
}

function formatDockerPorts(ports = []) {
  if (!Array.isArray(ports) || !ports.length) return "";
  return ports.map((port) => `${port?.PublicPort ? `${port.PublicPort}:` : ""}${port?.PrivatePort ? `${port.PrivatePort}` : "-"}${port?.Type ? `/${port.Type}` : ""}`).join(" · ");
}

function dockerStateTone(container) {
  const status = String(container?.status || container?.state || "").toLowerCase();
  if (status.includes("up") || status.includes("running")) return "is-running";
  if (status.includes("restart") || status.includes("paused")) return "is-warning";
  return "is-muted";
}

function dockerMetrics(container) {
  const metrics = [];
  if (container?.stats) {
    metrics.push(`CPU ${container.stats.cpuPercent}%`);
    metrics.push(`RAM ${formatBytes(container.stats.memoryUsage)}`);
  }
  const ports = formatDockerPorts(container?.ports);
  if (ports) metrics.push(ports);
  return metrics;
}

function syncActiveTrack(preferredTrackId = "") {
  activeTrackId.value = (preferredTrackId && tracks.value.some((item) => item.id === preferredTrackId) ? preferredTrackId : "") || (activeTrackId.value && tracks.value.some((item) => item.id === activeTrackId.value) ? activeTrackId.value : "") || tracks.value[0]?.id || "";
}

function syncAudioStateFromElement() {
  const element = audioRef.value;
  if (!(element instanceof HTMLAudioElement)) return;
  audioState.playing = !element.paused && !element.ended;
  audioState.currentTime = Number.isFinite(element.currentTime) ? element.currentTime : 0;
  audioState.duration = (Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0) || Number(activeTrack.value?.duration) || 0;
  audioState.volume = Number.isFinite(element.volume) ? element.volume : audioState.volume;
}

function applyAudioPreferences() {
  const element = audioRef.value;
  if (!(element instanceof HTMLAudioElement)) return;
  element.volume = Math.min(1, Math.max(0, Number(audioState.volume) || 0));
}

function handleAudioPlay() { syncAudioStateFromElement(); }
function handleAudioPause() { syncAudioStateFromElement(); }
function handleAudioTimeUpdate() { syncAudioStateFromElement(); }
function handleAudioMetadata() { syncAudioStateFromElement(); }
function handleAudioError() { syncAudioStateFromElement(); }
function wait(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
async function playAudioElement({ forceReload = false, retries = 1, suppressError = false } = {}) {
  const element = audioRef.value;
  if (!(element instanceof HTMLAudioElement)) return false;
  applyAudioPreferences();

  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (forceReload || attempt > 0) {
      element.load();
    }

    try {
      await element.play();
      syncAudioStateFromElement();
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await wait(PLAY_RETRY_DELAY_MS);
      }
    }
  }

  syncAudioStateFromElement();
  if (!suppressError && activeTrack.value) {
    notify(lastError?.message || "褰撳墠姝屾洸鏆傛椂鏃犳硶鎾斁", "error");
  }

  return false;
}
function cyclePlaybackOrder() {
  const currentIndex = PLAYBACK_ORDER_OPTIONS.findIndex((item) => item.key === playbackOrder.value);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PLAYBACK_ORDER_OPTIONS.length : 0;
  playbackOrder.value = PLAYBACK_ORDER_OPTIONS[nextIndex].key;
}

function getAdjacentTrackId(step) {
  if (!tracks.value.length) return "";
  const currentIndex = activeTrackIndex.value >= 0 ? activeTrackIndex.value : 0;
  return tracks.value[(currentIndex + step + tracks.value.length) % tracks.value.length]?.id || "";
}

function getRandomTrackId(excludeId = "") {
  if (!tracks.value.length) return "";
  const candidates = tracks.value.filter((item) => item.id !== excludeId);
  if (!candidates.length) return excludeId || tracks.value[0]?.id || "";
  return candidates[Math.floor(Math.random() * candidates.length)]?.id || excludeId || "";
}

async function replayCurrentTrack() {
  const element = audioRef.value;
  if (!(element instanceof HTMLAudioElement)) return;
  element.currentTime = 0;
  await element.play().catch(() => {});
  syncAudioStateFromElement();
}

async function handleAudioEnded() {
  audioState.playing = false;
  audioState.currentTime = 0;
  audioState.duration = Number(activeTrack.value?.duration) || audioState.duration;

  if (!activeTrack.value) {
    islandExpanded.value = false;
    return;
  }

  if (playbackOrder.value === "repeat") {
    await replayCurrentTrack();
    return;
  }

  const nextTrackId = playbackOrder.value === "shuffle"
    ? getRandomTrackId(activeTrack.value.id)
    : getAdjacentTrackId(1);

  if (!nextTrackId) {
    islandExpanded.value = false;
    return;
  }

  if (nextTrackId === activeTrack.value.id) {
    await replayCurrentTrack();
    return;
  }

  await playTrack(nextTrackId);
}

function handleSeekInput(event) {
  const element = audioRef.value;
  const input = event?.target;
  if (!(element instanceof HTMLAudioElement) || !(input instanceof HTMLInputElement)) return;
  const nextTime = Number(input.value);
  if (!Number.isFinite(nextTime)) return;
  element.currentTime = Math.max(0, Math.min(nextTime, audioDurationValue.value || nextTime));
  syncAudioStateFromElement();
}

function handleVolumeInput(event) {
  const input = event?.target;
  const element = audioRef.value;
  if (!(input instanceof HTMLInputElement)) return;

  const nextVolume = Math.min(1, Math.max(0, Number(input.value) / 100));
  if (!Number.isFinite(nextVolume)) return;

  audioState.volume = nextVolume;
  if (element instanceof HTMLAudioElement) {
    element.volume = nextVolume;
  }
}

async function loadTrackDetail(trackId, { force = false } = {}) {
  if (!trackId) {
    activeTrackDetail.value = null;
    return null;
  }

  const requestToken = activeDetailRequestToken + 1;
  activeDetailRequestToken = requestToken;
  detailLoading.value = true;

  try {
    const suffix = force ? "?refresh=1" : "";
    const payload = await requestJson(`/api/nas/music/tracks/${encodeURIComponent(trackId)}/detail${suffix}`);

    if (activeDetailRequestToken !== requestToken) {
      return activeTrackDetail.value;
    }

    activeTrackDetail.value = payload?.detail ?? null;
    return activeTrackDetail.value;
  } catch (error) {
    if (activeDetailRequestToken === requestToken) {
      activeTrackDetail.value = null;
    }

    if (detailOpen.value) {
      notify(error.message || "Failed to load music detail", "error");
    }

    return null;
  } finally {
    if (activeDetailRequestToken === requestToken) {
      detailLoading.value = false;
    }
  }
}

function openMusicDetail() {
  if (!activeTrack.value) {
    return;
  }

  detailOpen.value = true;

  if (activeTrackId.value && activeTrackDetail.value?.id !== activeTrackId.value) {
    void loadTrackDetail(activeTrackId.value);
  }
}

function closeMusicDetail() {
  detailOpen.value = false;
}

function handleIslandPrimaryAction() {
  if (!activeTrack.value) {
    return;
  }

  if (!islandExpanded.value) {
    islandExpanded.value = true;
    return;
  }

  openMusicDetail();
}

function toggleIslandExpanded() { islandExpanded.value = !islandExpanded.value; }
function collapseIsland() { islandExpanded.value = false; }
function handleMusicDetailKeydown(event) {
  if (event?.key === "Escape") {
    closeMusicDetail();
  }
}

function handleDocumentPointerDown(event) {
  if (!islandExpanded.value || detailOpen.value) return;
  const islandCard = musicIslandCardRef.value;
  const target = event?.target;
  if (!(islandCard instanceof HTMLElement) || !(target instanceof Node)) return;
  if (islandCard.contains(target)) return;
  islandExpanded.value = false;
}

async function toggleIslandPlayback() {
  const element = audioRef.value;
  if (!(element instanceof HTMLAudioElement)) return;
  if (element.paused) {
    await playAudioElement({ forceReload: Boolean(element.error), retries: 2 });
    return;
  }
  element.pause();
}

function focusMusicBay() {
  detailOpen.value = false;
  islandExpanded.value = false;
  musicBayRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function playTrack(trackId) {
  const trackChanged = activeTrackId.value !== trackId;
  activeTrackId.value = trackId;
  await nextTick();
  await playAudioElement({
    forceReload: true,
    retries: trackChanged ? 3 : 2,
  });
}

async function switchTrack(step) {
  const nextTrackId = getAdjacentTrackId(step);
  if (!nextTrackId) return;
  await playTrack(nextTrackId);
}

async function playPreviousTrack() {
  await switchTrack(-1);
}

async function playNextTrack() {
  await switchTrack(1);
}

async function uploadChunk(endpoint, { uploadId, index, chunk }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "x-upload-id": String(uploadId), "x-chunk-index": String(index) },
    credentials: "same-origin",
    body: chunk,
  });
  if (!response.ok) {
    let message = `Chunk upload failed with status ${response.status}`;
    let payload = null;
    try {
      payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {}
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.json();
}

async function hydrate(options = {}) {
  const { preferredTrackId = "", autoplay = false, refreshMusic = false } = options;
  const musicTracksUrl = refreshMusic ? "/api/nas/music/tracks?refresh=1" : "/api/nas/music/tracks";
  const requests = [
    requestJson("/api/nas/overview"),
    requestJson("/api/nas/transfer/items"),
    requestJson(musicTracksUrl),
    requestJson("/api/nas/messages"),
    isAuthenticated.value ? requestJson("/api/nas/docker/containers") : Promise.resolve(null),
  ];
  const [overviewResult, transferResult, musicResult, messageResult, dockerResult] = await Promise.allSettled(requests);

  if (overviewResult.status === "fulfilled") overview.value = overviewResult.value;
  if (transferResult.status === "fulfilled") transferItems.value = Array.isArray(transferResult.value?.items) ? transferResult.value.items : [];
  if (musicResult.status === "fulfilled") {
    tracks.value = Array.isArray(musicResult.value?.tracks) ? musicResult.value.tracks : [];
    syncActiveTrack(preferredTrackId);
  }
  if (messageResult.status === "fulfilled") messages.value = Array.isArray(messageResult.value?.messages) ? messageResult.value.messages : [];

  if (!isAuthenticated.value) {
    dockerDialogOpen.value = false;
    docker.value = { ...docker.value, available: false, locked: true, containers: [], error: "登录后可查看 Docker" };
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
    docker.value = { ...docker.value, available: false, containers: [], error: dockerResult.reason?.message || "读取 Docker 列表失败" };
  }

  await nextTick();
  applyAudioPreferences();
  syncAudioStateFromElement();
  if (autoplay && activeTrackId.value) {
    await playAudioElement({
      forceReload: true,
      retries: 3,
      suppressError: true,
    });
  }
}

async function refreshMusicLibrary() {
  try {
    await hydrate({ preferredTrackId: activeTrackId.value, refreshMusic: true });
    if (detailOpen.value && activeTrackId.value) {
      await loadTrackDetail(activeTrackId.value, { force: true });
    }
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

async function sendTransferMessage() {
  if (!isAuthenticated.value) {
    requestAuth("请先登录后再发送消息");
    return;
  }
  if (!normalizedMessageBody.value) {
    notify("请输入要发送的消息", "error");
    return;
  }
  try {
    messageForm.sending = true;
    const payload = await requestJson("/api/nas/messages", { method: "POST", body: JSON.stringify({ body: normalizedMessageBody.value }) });
    if (payload?.message) messages.value = [payload.message, ...messages.value].slice(0, 12);
    messageForm.body = "";
    notify("消息已发送到传输留言板", "info");
  } catch (error) {
    if (isUnauthorized(error)) {
      requestAuth("登录状态已失效，请重新登录");
      return;
    }
    notify(error.message || "发送消息失败", "error");
  } finally {
    messageForm.sending = false;
  }
}

async function uploadFiles(fileList, scope) {
  if (!isAuthenticated.value) {
    requestAuth(scope === "music" ? "请先登录后再上传音乐" : "请先登录后再上传文件");
    return;
  }
  const files = Array.from(fileList ?? []);
  if (!files.length) return;
  const endpointBase = scope === "music" ? "/api/nas/music/upload" : "/api/nas/transfer/upload";
  let preferredTrackId = "";

  try {
    for (const file of files) {
      upload.active = true;
      upload.scope = scope;
      upload.fileName = file.name;
      upload.percent = 0;
      const initPayload = await requestJson(`${endpointBase}/init`, { method: "POST", body: JSON.stringify({ fileName: file.name, size: file.size, mime: file.type }) });
      for (let index = 0; index < initPayload.totalChunks; index += 1) {
        const start = index * initPayload.chunkSize;
        const end = Math.min(file.size, start + initPayload.chunkSize);
        const chunk = await file.slice(start, end).arrayBuffer();
        await uploadChunk(`${endpointBase}/chunk`, { uploadId: initPayload.uploadId, index, chunk });
        upload.percent = Math.round(((index + 1) / initPayload.totalChunks) * 100);
      }
      const completePayload = await requestJson(`${endpointBase}/complete`, { method: "POST", body: JSON.stringify({ uploadId: initPayload.uploadId }) });
      if (scope === "music" && completePayload?.item?.id) preferredTrackId = completePayload.item.id;
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
    refreshMusic: scope === "music",
  });
}

async function onFileInputChange(event, scope) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  try {
    await uploadFiles(input.files, scope);
  } finally {
    input.value = "";
  }
}

async function deleteTransferItem(itemId) {
  if (!isAuthenticated.value) {
    requestAuth("请先登录后再删除文件");
    return;
  }
  if (!window.confirm("确认删除这条传输文件吗？删除后无法恢复。")) return;
  try {
    await requestJson(`/api/nas/transfer/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    transferItems.value = transferItems.value.filter((item) => item.id !== itemId);
    notify("文件已从传输列表删除", "info");
  } catch (error) {
    if (isUnauthorized(error)) {
      requestAuth("登录状态已失效，请重新登录");
      return;
    }
    notify(error.message || "删除文件失败", "error");
  }
}

async function deleteTrack(trackId) {
  if (!isAuthenticated.value) {
    requestAuth("请先登录后再删除音乐");
    return;
  }
  if (!window.confirm("确认从音乐库删除这首歌吗？删除后无法恢复。")) return;

  const remainingTracks = tracks.value.filter((item) => item.id !== trackId);
  const nextTrackId = activeTrackId.value === trackId ? remainingTracks[0]?.id || "" : activeTrackId.value;
  if (activeTrackId.value === trackId) audioRef.value?.pause();

  try {
    await requestJson(`/api/nas/music/tracks/${encodeURIComponent(trackId)}`, { method: "DELETE" });
    tracks.value = remainingTracks;
    activeTrackId.value = nextTrackId;
    if (!nextTrackId) {
      closeMusicDetail();
    }
    await nextTick();
    syncAudioStateFromElement();
    notify("歌曲已从音乐库删除", "info");
  } catch (error) {
    if (isUnauthorized(error)) {
      requestAuth("登录状态已失效，请重新登录");
      return;
    }
    notify(error.message || "删除歌曲失败", "error");
  }
}

async function runDockerAction(containerId, action) {
  if (!isAuthenticated.value) {
    requestAuth("请先登录后再管理 Docker 容器");
    return;
  }
  try {
    await requestJson(`/api/nas/docker/containers/${containerId}/${action}`, { method: "POST" });
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

watch(dockerDialogOpen, (open) => { document.body.classList.toggle("nas-modal-open", open); });
watch(detailOpen, async (open) => {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("music-detail-open", open);
  document.removeEventListener("keydown", handleMusicDetailKeydown);
  if (!open) return;
  document.addEventListener("keydown", handleMusicDetailKeydown);
  await nextTick();
  if (activeTrackId.value) {
    await loadTrackDetail(activeTrackId.value);
  }
});
watch(islandVisible, (visible) => {
  if (!visible) {
    islandExpanded.value = false;
    detailOpen.value = false;
  }
});
watch(islandExpanded, async (expanded) => {
  if (typeof document === "undefined") return;
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  if (!expanded) return;
  await nextTick();
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});
watch(
  () => activeTrackId.value,
  async (trackId) => {
    await nextTick();
    applyAudioPreferences();
    syncAudioStateFromElement();

    if (!trackId) {
      activeTrackDetail.value = null;
      detailOpen.value = false;
      return;
    }

    if (activeTrackDetail.value?.id !== trackId) {
      activeTrackDetail.value = null;
    }

    await loadTrackDetail(trackId);
  }
);
watch(() => props.authState?.authenticated, (authenticated) => {
  if (!authenticated) {
    dockerDialogOpen.value = false;
    docker.value = { ...docker.value, available: false, locked: true, containers: [], error: "登录后可查看 Docker" };
  }
});

onBeforeUnmount(() => {
  document.body.classList.remove("nas-modal-open");
  document.body.classList.remove("music-detail-open");
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleMusicDetailKeydown);
});
defineExpose({ hydrate });
</script>
