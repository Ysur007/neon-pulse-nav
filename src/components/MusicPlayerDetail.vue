<template>
  <Teleport to="body">
    <Transition name="player-detail-fade">
      <div v-if="open" class="player-detail-overlay" @click.self="$emit('close')">
        <section
          class="player-detail-shell glass-panel"
          :class="{ 'is-mobile': isMobileViewport, 'is-mobile-lyrics': isMobileLyricsActive }"
        >
          <header class="player-detail-topbar">
            <button
              class="player-detail-icon-button"
              type="button"
              :aria-label="isMobileLyricsActive ? '返回唱片' : '关闭详情'"
              @click="handleLeadingAction"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path :d="isMobileLyricsActive ? 'M15 6 9 12l6 6' : 'm7 10 5 5 5-5'" />
              </svg>
            </button>

            <div class="player-detail-topbar-copy">
              <span class="player-detail-topbar-label">PLAYING FROM PLAYLIST</span>
              <strong>{{ titleLabel }}</strong>
              <small>{{ topbarMeta }}</small>
            </div>

            <button class="player-detail-icon-button" type="button" aria-label="定位到音乐舱" @click="$emit('focus-bay')">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 5h4v4H5zM10 5h4v4h-4zM15 5h4v4h-4zM5 10h4v4H5zM10 10h4v4h-4zM15 10h4v4h-4zM5 15h4v4H5zM10 15h4v4h-4zM15 15h4v4h-4z" />
              </svg>
            </button>
          </header>

          <div
            class="player-detail-body"
            :class="{ 'is-mobile-layout': isMobileViewport, 'is-lyrics-only': isMobileLyricsActive }"
            :data-mobile-direction="mobileTransitionDirection"
          >
            <component
              :is="isMobileViewport ? 'button' : 'div'"
              class="player-detail-stage"
              :class="mobileStageState"
              :type="isMobileViewport ? 'button' : undefined"
              @click="handleDiscTap"
            >
              <div class="player-detail-disc-shell" :class="{ 'is-playing': audioState?.playing }">
                <div class="player-detail-disc-glow"></div>
                <div class="player-detail-disc">
                  <div class="player-detail-cover" :class="{ 'is-placeholder': !artworkUrl }">
                    <img v-if="artworkUrl" :src="artworkUrl" :alt="`${titleLabel} cover`" />
                    <span v-else>{{ artworkInitials }}</span>
                  </div>
                  <div class="player-detail-disc-core"></div>
                </div>
              </div>

              <div class="player-detail-visualizer" :class="{ 'is-playing': audioState?.playing }" aria-hidden="true">
                <span v-for="bar in 10" :key="bar" :style="{ '--bar-delay': `${bar * 0.08}s` }"></span>
              </div>

              <div v-if="isMobileViewport" class="player-detail-stage-hint">
                {{ mobileLyricsMode ? "返回唱片" : "轻触唱片查看歌词" }}
              </div>
            </component>

            <section
              class="player-detail-copy"
              :class="mobileCopyState"
            >
              <div class="player-detail-copy-top">
                <h2>{{ titleLabel }}</h2>
                <div class="player-detail-copy-meta">
                  <strong>{{ artistLabel }}</strong>
                  <span class="player-detail-chip">{{ lyricsBadge }}</span>
                  <span v-if="albumLabel" class="player-detail-chip is-muted">{{ albumLabel }}</span>
                </div>
              </div>

              <div ref="lyricsFlowRef" class="player-detail-lyrics-flow">
                <p
                  v-for="(line, index) in lyricLines"
                  :key="line.id"
                  :ref="(element) => setLyricLineRef(element, index)"
                  class="player-detail-lyric-line"
                  :class="getLyricLineClass(index)"
                >
                  {{ line.text }}
                </p>
                <p v-if="!lyricLines.length" class="player-detail-empty-state">这首歌暂时没有可显示的歌词。</p>
              </div>

              <div class="player-detail-progress-block">
                <div class="player-detail-progress-track">
                  <span class="player-detail-progress-fill" :style="{ transform: `scaleX(${playbackProgress})` }"></span>
                </div>
                <div class="player-detail-progress-time">
                  <span>{{ safeCurrentTimeLabel }}</span>
                  <span>{{ safeDurationLabel }}</span>
                </div>
              </div>
            </section>
          </div>

          <footer class="player-detail-footer">
            <div class="player-detail-footer-side is-left">
              <button class="player-detail-pill" type="button" @click="$emit('cycle-order')">{{ playbackOrderLabel }}</button>
              <span class="player-detail-live-pill" :class="{ 'is-live': audioState?.playing }">
                {{ audioState?.playing ? "LIVE" : "READY" }}
              </span>
            </div>

            <div class="player-detail-footer-core">
              <button class="player-detail-main-button" type="button" :disabled="!hasMultipleTracks" aria-label="上一首" @click="$emit('previous')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6v12M18 7l-8 5 8 5z" /></svg>
              </button>

              <button
                class="player-detail-main-button is-primary"
                type="button"
                :disabled="!track"
                :aria-label="audioState?.playing ? '暂停' : '播放'"
                @click="$emit('toggle-playback')"
              >
                <svg v-if="audioState?.playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h3v12H8zM13 6h3v12h-3z" /></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5v11l9-5.5z" /></svg>
              </button>

              <button class="player-detail-main-button" type="button" :disabled="!hasMultipleTracks" aria-label="下一首" @click="$emit('next')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6v12M6 7l8 5-8 5z" /></svg>
              </button>
            </div>

            <div class="player-detail-footer-side is-right">
              <div class="player-detail-volume-shell" :style="{ '--volume-progress': `${clampedVolumePercent}%` }">
                <svg class="player-detail-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 10h3l4-4v12l-4-4H5zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
                </svg>
                <label class="player-detail-mini-range-shell">
                  <input
                    class="player-detail-mini-range"
                    type="range"
                    min="0"
                    max="100"
                    :value="clampedVolumePercent"
                    aria-label="音量"
                    @input="$emit('volume', $event)"
                    @change="$emit('volume', $event)"
                  />
                </label>
              </div>
              <button class="player-detail-pill" type="button" @click="$emit('focus-bay')">LIST</button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, required: true },
  track: { type: Object, default: null },
  detail: { type: Object, default: null },
  audioState: { type: Object, required: true },
  playbackOrderLabel: { type: String, default: "顺序" },
  hasMultipleTracks: { type: Boolean, default: false },
  volumePercent: { type: Number, default: 72 },
});

const emit = defineEmits(["close", "focus-bay", "previous", "toggle-playback", "next", "cycle-order", "volume"]);
const MOBILE_BREAKPOINT = 760;

const isMobileViewport = ref(false);
const mobileLyricsMode = ref(false);
const mobileTransitionDirection = ref("to-lyrics");
const lyricLineRefs = ref([]);
const lyricsFlowRef = ref(null);

const detailForTrack = computed(() => props.detail ?? null);
const titleLabel = computed(() => props.track?.title || detailForTrack.value?.title || "未命名曲目");
const artistLabel = computed(() => props.track?.artist || detailForTrack.value?.artist || "Unknown Artist");
const albumLabel = computed(() => detailForTrack.value?.album || props.track?.album || "");
const topbarMeta = computed(() => (albumLabel.value ? `${artistLabel.value} · ${albumLabel.value}` : artistLabel.value));
const artworkUrl = computed(() => detailForTrack.value?.artworkUrl || "");
const artworkInitials = computed(() => Array.from(titleLabel.value || "M").slice(0, 1).join("").toUpperCase());
const lyricsText = computed(() => {
  const raw = detailForTrack.value?.lyrics;
  return typeof raw === "string" ? raw : "";
});
const hasTimestampedLyrics = computed(() => /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/.test(lyricsText.value));
const lyricMode = computed(() => {
  if (!lyricsText.value) return "none";
  if (hasTimestampedLyrics.value) {
    return "lrc";
  }
  if (detailForTrack.value?.lyricsFormat === "plain") {
    return "plain";
  }
  if (detailForTrack.value?.lyricsFormat === "lrc") {
    return "lrc";
  }
  return "plain";
});
const clampedVolumePercent = computed(() => {
  const value = Number(props.volumePercent);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 72;
});
const isMobileLyricsActive = computed(() => isMobileViewport.value && mobileLyricsMode.value);
const mobileStageState = computed(() =>
  isMobileViewport.value
    ? {
        "is-mobile-active": !isMobileLyricsActive.value,
        "is-mobile-hidden": isMobileLyricsActive.value,
      }
    : {}
);
const mobileCopyState = computed(() =>
  isMobileViewport.value
    ? {
        "is-mobile-active": isMobileLyricsActive.value,
        "is-mobile-hidden": !isMobileLyricsActive.value,
      }
    : {}
);
const playbackProgress = computed(() => {
  const duration = Number(props.audioState?.duration) || Number(props.track?.duration) || 0;
  const current = Number(props.audioState?.currentTime) || 0;
  return duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
});
const safeCurrentTimeLabel = computed(() => formatDuration(props.audioState?.currentTime));
const safeDurationLabel = computed(() => formatDuration(props.audioState?.duration || props.track?.duration));
const lyricsBadge = computed(() => {
  if (lyricMode.value === "lrc") return "SYNCED LYRICS";
  if (lyricMode.value === "plain") return "PLAIN LYRICS";
  return "NO LYRICS";
});

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function parseTimestampToSeconds(minute, second, fraction = "") {
  const mm = Number(minute);
  const ss = Number(second);
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  return mm * 60 + ss + (fraction ? Number(`0.${String(fraction).padEnd(3, "0").slice(0, 3)}`) : 0);
}

function parseLyrics(rawLyrics, mode) {
  const source = String(rawLyrics || "").replace(/\r/g, "").trim();
  if (!source) return [];

  const lines = source.split("\n").filter((line) => line.trim());
  if (mode !== "lrc") {
    return lines.map((line, index) => ({ id: `plain-${index}`, time: null, text: line.trim() }));
  }

  const pattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const parsed = [];

  lines.forEach((line, lineIndex) => {
    const matches = [...line.matchAll(pattern)];
    const text = line.replace(pattern, "").trim();
    if (!matches.length || !text) return;
    matches.forEach((match, timestampIndex) => {
      const seconds = parseTimestampToSeconds(match[1], match[2], match[3]);
      if (!Number.isFinite(seconds)) return;
      parsed.push({ id: `lrc-${lineIndex}-${timestampIndex}`, time: seconds, text });
    });
  });

  if (!parsed.length) {
    return lines.map((line, index) => ({
      id: `fallback-${index}`,
      time: null,
      text: line.replace(pattern, "").trim() || line.trim(),
    }));
  }

  return parsed.sort((left, right) => (left.time ?? 0) - (right.time ?? 0));
}

const lyricLines = computed(() => parseLyrics(lyricsText.value, lyricMode.value));
const activeLyricIndex = computed(() => {
  if (!lyricLines.value.length || lyricMode.value !== "lrc") return -1;
  const current = Math.max(0, Number(props.audioState?.currentTime) || 0);
  let active = 0;
  lyricLines.value.forEach((line, index) => {
    if (typeof line.time === "number" && line.time <= current + 0.04) {
      active = index;
    }
  });
  return active;
});

function getLyricLineClass(index) {
  if (lyricMode.value !== "lrc") return "is-plain";
  if (index === activeLyricIndex.value) return "is-active";
  return index < activeLyricIndex.value ? "is-before" : "is-after";
}

function setLyricLineRef(element, index) {
  if (element) {
    lyricLineRefs.value[index] = element;
  }
}

async function syncActiveLyricIntoView() {
  if (!props.open || (isMobileViewport.value && !mobileLyricsMode.value) || lyricMode.value !== "lrc") return;
  const container = lyricsFlowRef.value;
  const target = lyricLineRefs.value[activeLyricIndex.value];
  if (!(container instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
  await nextTick();
  if (typeof window !== "undefined") {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextScrollTop =
    container.scrollTop + (targetRect.top - containerRect.top) - (container.clientHeight / 2 - target.clientHeight / 2);
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  container.scrollTo({
    top: Math.min(maxScrollTop, Math.max(0, nextScrollTop)),
    behavior: "smooth",
  });
}

function syncViewportMode() {
  if (typeof window === "undefined") return;
  isMobileViewport.value = window.innerWidth <= MOBILE_BREAKPOINT;
  if (!isMobileViewport.value) mobileLyricsMode.value = false;
}

function handleDiscTap() {
  if (isMobileViewport.value) {
    mobileTransitionDirection.value = "to-lyrics";
    mobileLyricsMode.value = true;
  }
}

function handleLeadingAction() {
  if (isMobileLyricsActive.value) {
    mobileTransitionDirection.value = "to-disc";
    mobileLyricsMode.value = false;
    return;
  }
  emit("close");
}

watch(
  () => props.open,
  async (open) => {
    lyricLineRefs.value = [];
    if (!open) {
      mobileLyricsMode.value = false;
      mobileTransitionDirection.value = "to-lyrics";
      return;
    }
    if (isMobileViewport.value) {
      mobileLyricsMode.value = false;
      mobileTransitionDirection.value = "to-lyrics";
    }
    await nextTick();
    await syncActiveLyricIntoView();
  }
);

watch(
  () => [props.track?.id, detailForTrack.value?.id, detailForTrack.value?.lyrics, lyricMode.value].join("|"),
  async () => {
    lyricLineRefs.value = [];
    await nextTick();
    await syncActiveLyricIntoView();
  }
);

watch(
  () => activeLyricIndex.value,
  async () => {
    await syncActiveLyricIntoView();
  }
);

watch(
  () => mobileLyricsMode.value,
  async (active) => {
    if (!active) return;
    await nextTick();
    await syncActiveLyricIntoView();
  }
);

onMounted(() => {
  syncViewportMode();
  window.addEventListener("resize", syncViewportMode);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncViewportMode);
});
</script>

<style scoped>
.player-detail-overlay{position:fixed;inset:0;z-index:35;display:grid;place-items:center;padding:clamp(12px,1.8vw,24px);background:radial-gradient(circle at 18% 24%,color-mix(in srgb,var(--accent-soft) 22%,transparent),transparent 30%),radial-gradient(circle at 82% 72%,color-mix(in srgb,var(--accent-strong) 18%,transparent),transparent 32%),rgba(4,8,16,.76);backdrop-filter:blur(18px)}
.player-detail-shell{width:min(100%,1520px);height:min(92dvh,960px);max-height:calc(100dvh - 24px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:clamp(18px,2vw,28px);padding:clamp(18px,2vw,28px);overflow:hidden;background:linear-gradient(180deg,rgba(7,12,24,.96),rgba(8,14,28,.98))}
.player-detail-topbar,.player-detail-footer-side,.player-detail-footer-core,.player-detail-copy-meta,.player-detail-progress-time,.player-detail-volume-shell{display:flex;align-items:center}
.player-detail-topbar{justify-content:space-between;gap:18px}
.player-detail-topbar-copy{flex:1 1 auto;min-width:0;display:grid;justify-items:center;text-align:center;gap:4px}
.player-detail-topbar-label,.player-detail-topbar-copy small{color:var(--muted);letter-spacing:.18em;text-transform:uppercase;white-space:nowrap}
.player-detail-topbar-copy strong,.player-detail-topbar-copy small{max-width:min(100%,42ch);overflow:hidden;text-overflow:ellipsis}
.player-detail-icon-button,.player-detail-pill,.player-detail-main-button{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.player-detail-icon-button{width:48px;height:48px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
.player-detail-icon-button svg,.player-detail-main-button svg,.player-detail-inline-icon{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.player-detail-body{min-height:0;height:100%;display:grid;grid-template-columns:minmax(280px,.84fr) minmax(0,1.16fr);gap:clamp(22px,4vw,70px);align-items:stretch}
.player-detail-stage,.player-detail-copy{min-width:0;min-height:0}
.player-detail-stage{appearance:none;border:0;padding:0;background:transparent;display:grid;justify-items:center;align-content:center;align-self:stretch;gap:22px;color:inherit}
.player-detail-disc-shell{position:relative;display:grid;place-items:center;width:min(100%,520px);aspect-ratio:1}
.player-detail-disc-glow{position:absolute;inset:10%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent-soft) 50%,transparent) 0%,transparent 62%);filter:blur(28px);opacity:.96}
.player-detail-disc{position:relative;width:min(100%,470px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 48%,rgba(255,255,255,.42),rgba(255,245,228,.88) 48%,rgba(232,220,198,.96) 100%);border:7px solid rgba(8,16,32,.88);box-shadow:0 34px 88px rgba(0,0,0,.38),0 0 44px color-mix(in srgb,var(--accent-soft) 48%,transparent);animation:discSpin 18s linear infinite paused}
.player-detail-disc-shell.is-playing .player-detail-disc{animation-play-state:running}
.player-detail-cover{position:relative;width:44%;aspect-ratio:1;overflow:hidden;border-radius:22px;box-shadow:0 22px 48px rgba(0,0,0,.28);transform:rotate(-12deg)}
.player-detail-cover img{width:100%;height:100%;object-fit:cover}
.player-detail-cover.is-placeholder{display:grid;place-items:center;background:linear-gradient(145deg,color-mix(in srgb,var(--accent-soft) 72%,black 18%),color-mix(in srgb,var(--accent-strong) 60%,black 18%));color:#fff;font-family:var(--display-font);font-size:clamp(2rem,5vw,4rem);font-weight:700}
.player-detail-disc-core{position:absolute;width:14%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--accent) 82%,white 6%) 0 26%,#11161f 28% 100%);box-shadow:0 0 0 16px rgba(6,11,22,.86)}
.player-detail-visualizer{display:inline-flex;align-items:end;gap:8px;min-height:76px}
.player-detail-visualizer span{width:11px;height:40px;border-radius:999px;opacity:.52;transform-origin:center bottom;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,white 8%),color-mix(in srgb,var(--accent-strong) 82%,white 4%));animation:equalizerPulse 1.06s ease-in-out infinite paused;animation-delay:var(--bar-delay,0s)}
.player-detail-visualizer.is-playing span{animation-play-state:running}
.player-detail-stage-hint{color:var(--muted);font-size:.92rem}
.player-detail-copy{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:clamp(18px,2.1vh,24px);width:min(100%,820px);height:100%;justify-self:stretch;align-self:stretch;overflow:hidden;color:var(--text)}
.player-detail-copy-top{display:grid;gap:14px;padding-top:12px}
.player-detail-copy-top h2{margin:0;padding-top:0;font-size:clamp(3rem,5.8vw,6.2rem);line-height:1.04;letter-spacing:-.04em;word-break:break-word}
.player-detail-copy-meta{gap:12px;flex-wrap:wrap}
.player-detail-copy-meta strong{font-size:clamp(1.12rem,2vw,1.8rem);color:color-mix(in srgb,var(--accent) 86%,white 10%)}
.player-detail-chip,.player-detail-live-pill,.player-detail-pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px}
.player-detail-chip{min-height:34px;padding:0 14px;border:1px solid color-mix(in srgb,var(--accent) 26%,var(--line));background:rgba(255,255,255,.05);color:color-mix(in srgb,var(--accent) 88%,white 12%);font-size:.8rem;font-weight:700;letter-spacing:.08em}
.player-detail-chip.is-muted{color:var(--muted)}
.player-detail-lyrics-flow{min-height:0;height:100%;display:grid;align-content:start;gap:clamp(14px,1.8vh,20px);overflow-y:auto;padding:max(10vh,64px) 8px max(10vh,64px) 0;scrollbar-width:none;mask-image:linear-gradient(180deg,transparent 0,black 14%,black 86%,transparent 100%)}
.player-detail-lyrics-flow::-webkit-scrollbar{display:none}
.player-detail-lyric-line{margin:0;font-size:clamp(1.86rem,3vw,3.06rem);line-height:1.08;font-weight:700;color:color-mix(in srgb,var(--text) 34%,transparent);opacity:.26;transition:color 220ms ease,opacity 220ms ease,transform 220ms ease,text-shadow 220ms ease;word-break:break-word}
.player-detail-lyric-line.is-before,.player-detail-lyric-line.is-after{color:color-mix(in srgb,var(--text) 34%,transparent);opacity:.22}
.player-detail-lyric-line.is-active{color:color-mix(in srgb,var(--accent) 95%,white 5%);opacity:1;transform:translateX(4px);text-shadow:0 0 22px color-mix(in srgb,var(--accent-soft) 92%,transparent)}
.player-detail-lyric-line.is-plain{color:color-mix(in srgb,var(--text) 82%,white 4%);opacity:.92}
.player-detail-empty-state{margin:0;color:var(--muted);font-size:1rem}
.player-detail-progress-block{display:grid;gap:10px}
.player-detail-progress-track{height:8px;overflow:hidden;border-radius:999px;background:color-mix(in srgb,var(--line) 76%,transparent)}
.player-detail-progress-fill{display:block;width:100%;height:100%;transform-origin:left center;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 92%,white 8%),color-mix(in srgb,var(--accent-strong) 88%,white 8%));box-shadow:0 0 22px color-mix(in srgb,var(--accent-soft) 84%,transparent)}
.player-detail-progress-time{justify-content:space-between;gap:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.player-detail-footer{display:grid;grid-template-columns:minmax(220px,1fr) auto minmax(300px,1fr);align-items:center;gap:18px;border-top:1px solid color-mix(in srgb,var(--line) 88%,transparent);padding-top:14px}
.player-detail-footer-core{justify-content:center;gap:14px}
.player-detail-footer-side{gap:14px;min-width:0}
.player-detail-footer-side.is-left{justify-content:flex-start}
.player-detail-footer-side.is-right{justify-content:flex-end}
.player-detail-pill{min-height:46px;padding:0 16px;font-weight:700}
.player-detail-live-pill{min-height:42px;padding:0 14px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-weight:700;letter-spacing:.12em}
.player-detail-live-pill.is-live{color:#061018;background:linear-gradient(135deg,var(--good),color-mix(in srgb,var(--accent) 70%,white 14%))}
.player-detail-main-button{width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
.player-detail-main-button.is-primary{width:86px;height:86px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent-soft) 92%,white 10%),color-mix(in srgb,var(--accent) 74%,white 16%));box-shadow:0 0 0 12px color-mix(in srgb,var(--accent-soft) 26%,transparent),0 0 34px color-mix(in srgb,var(--accent-soft) 46%,transparent)}
.player-detail-main-button:disabled{opacity:.48;cursor:not-allowed}
.player-detail-volume-shell{display:grid;grid-template-columns:auto minmax(180px,220px);align-items:center;justify-content:end;gap:12px;min-width:0}
.player-detail-mini-range-shell{position:relative;display:flex;align-items:center;width:100%;height:20px;border-radius:999px}
.player-detail-mini-range-shell::after{content:"";position:absolute;left:0;right:0;top:50%;height:8px;transform:translateY(-50%);border-radius:inherit;background:color-mix(in srgb,var(--line) 76%,transparent)}
.player-detail-mini-range-shell::before{content:"";position:absolute;left:0;top:50%;height:8px;transform:translateY(-50%);width:var(--volume-progress,0%);border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 92%,white 8%),color-mix(in srgb,var(--accent-strong) 86%,white 8%));box-shadow:0 0 14px color-mix(in srgb,var(--accent-soft) 74%,transparent)}
.player-detail-mini-range{position:relative;z-index:1;display:block;width:100%;height:20px;margin:0;appearance:none;background:transparent}
.player-detail-mini-range::-webkit-slider-runnable-track{height:8px;background:transparent}
.player-detail-mini-range::-moz-range-track{height:8px;background:transparent;border:none}
.player-detail-mini-range::-webkit-slider-thumb{appearance:none;width:16px;height:16px;margin-top:-4px;border-radius:50%;border:none;background:color-mix(in srgb,var(--text) 96%,white 4%);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent-soft) 58%,transparent)}
.player-detail-mini-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;border:none;background:color-mix(in srgb,var(--text) 96%,white 4%);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent-soft) 58%,transparent)}
.player-detail-fade-enter-active,.player-detail-fade-leave-active{transition:opacity 260ms ease,transform 320ms cubic-bezier(.22,1,.36,1)}
.player-detail-fade-enter-from,.player-detail-fade-leave-to{opacity:0}
@keyframes discSpin{to{transform:rotate(360deg)}}
@keyframes equalizerPulse{0%,100%{transform:scaleY(.42);opacity:.42}50%{transform:scaleY(1);opacity:1}}
@media (max-width:1180px){.player-detail-body{grid-template-columns:1fr;gap:24px}.player-detail-copy{width:100%}}
@media (max-width:760px){.player-detail-overlay{padding:0}.player-detail-shell{width:100%;height:100dvh;max-height:100dvh;border-radius:0;padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px))}.player-detail-topbar{gap:12px}.player-detail-topbar-copy strong{font-size:1rem}.player-detail-topbar-copy small{font-size:.76rem;letter-spacing:.08em}.player-detail-body.is-mobile-layout{grid-template-columns:1fr;justify-items:center;position:relative;overflow:hidden;perspective:1200px}.player-detail-body.is-mobile-layout:not(.is-lyrics-only){align-content:center}.player-detail-body.is-mobile-layout.is-lyrics-only{align-content:stretch}.player-detail-body.is-mobile-layout .player-detail-stage,.player-detail-body.is-mobile-layout .player-detail-copy{grid-area:1/1;width:100%;transition:opacity 340ms ease,transform 620ms cubic-bezier(.16,1,.3,1),filter 340ms ease;will-change:transform,opacity,filter}.player-detail-body.is-mobile-layout .player-detail-stage{transform-origin:center 36%}.player-detail-body.is-mobile-layout .player-detail-copy{transform-origin:center bottom}.player-detail-body.is-mobile-layout .player-detail-stage.is-mobile-active,.player-detail-body.is-mobile-layout .player-detail-copy.is-mobile-active{opacity:1;filter:blur(0);pointer-events:auto}.player-detail-body.is-mobile-layout .player-detail-stage.is-mobile-hidden,.player-detail-body.is-mobile-layout .player-detail-copy.is-mobile-hidden{pointer-events:none}.player-detail-body.is-mobile-layout[data-mobile-direction='to-lyrics'] .player-detail-stage.is-mobile-active{transform:translateY(0) scale(1) rotate(0)}.player-detail-body.is-mobile-layout[data-mobile-direction='to-lyrics'] .player-detail-stage.is-mobile-hidden{opacity:0;transform:translateY(112px) scale(.9) rotate(10deg);filter:blur(12px)}.player-detail-body.is-mobile-layout[data-mobile-direction='to-lyrics'] .player-detail-copy.is-mobile-hidden{opacity:0;transform:translateY(132px) scale(.97);filter:blur(14px)}.player-detail-body.is-mobile-layout[data-mobile-direction='to-lyrics'] .player-detail-copy.is-mobile-active{transform:translateY(0) scale(1)}.player-detail-body.is-mobile-layout[data-mobile-direction='to-disc'] .player-detail-stage.is-mobile-hidden{opacity:0;transform:translateY(-120px) scale(.86) rotate(-10deg);filter:blur(14px)}.player-detail-body.is-mobile-layout[data-mobile-direction='to-disc'] .player-detail-stage.is-mobile-active{transform:translateY(0) scale(1) rotate(0)}.player-detail-body.is-mobile-layout[data-mobile-direction='to-disc'] .player-detail-copy.is-mobile-active{transform:translateY(0) scale(1)}.player-detail-body.is-mobile-layout[data-mobile-direction='to-disc'] .player-detail-copy.is-mobile-hidden{opacity:0;transform:translateY(-108px) scale(.97);filter:blur(12px)}.player-detail-disc-shell{width:min(100%,360px)}.player-detail-disc{width:min(100%,320px)}.player-detail-visualizer{min-height:64px;gap:6px}.player-detail-visualizer span{width:9px}.player-detail-copy{width:100%;min-height:0;align-self:stretch}.player-detail-copy-top{padding-top:22px}.player-detail-copy-top h2{font-size:clamp(2.2rem,12vw,4rem)}.player-detail-copy-meta strong{font-size:1.06rem}.player-detail-lyrics-flow{min-height:0;height:100%;padding:24px 4px 24px 0;mask-image:linear-gradient(180deg,transparent 0,black 10%,black 90%,transparent 100%)}.player-detail-lyric-line{font-size:clamp(1.4rem,7.2vw,2.24rem)}.player-detail-footer{grid-template-columns:1fr;align-items:stretch;gap:12px}.player-detail-footer-side,.player-detail-footer-core{width:100%;justify-content:center;flex-wrap:wrap}.player-detail-footer-side.is-right{justify-content:center}.player-detail-main-button{width:56px;height:56px}.player-detail-main-button.is-primary{width:74px;height:74px}.player-detail-volume-shell{width:100%;grid-template-columns:auto minmax(0,1fr);justify-content:center}.player-detail-mini-range-shell{max-width:none}}
</style>
