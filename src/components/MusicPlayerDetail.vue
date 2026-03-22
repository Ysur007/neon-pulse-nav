<template>
  <Teleport to="body">
    <Transition name="music-detail-fade">
      <div v-if="open" class="music-detail-overlay" @click.self="$emit('close')">
        <section class="music-detail-shell" @click.stop>
          <header class="music-detail-topbar">
            <button
              class="music-detail-icon-button"
              type="button"
              aria-label="Close music detail"
              @click="$emit('close')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.7 9.3 12 14.6l5.3-5.3 1.4 1.4-6.7 6.7-6.7-6.7z" />
              </svg>
            </button>

            <div class="music-detail-topbar-copy">
              <p class="music-detail-topbar-label">{{ topbarLabel }}</p>
              <strong :title="resolvedTitle">{{ resolvedTitle }}</strong>
              <small class="music-detail-topbar-meta">{{ topbarMeta }}</small>
            </div>

            <button
              class="music-detail-icon-button"
              type="button"
              aria-label="Jump to music bay"
              @click="$emit('focus-bay')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8a2 2 0 1 1 .001-4.001A2 2 0 0 1 5 8Zm7 0a2 2 0 1 1 .001-4.001A2 2 0 0 1 12 8Zm7 0a2 2 0 1 1 .001-4.001A2 2 0 0 1 19 8ZM5 14a2 2 0 1 1 .001-4.001A2 2 0 0 1 5 14Zm7 0a2 2 0 1 1 .001-4.001A2 2 0 0 1 12 14Zm7 0a2 2 0 1 1 .001-4.001A2 2 0 0 1 19 14ZM5 20a2 2 0 1 1 .001-4.001A2 2 0 0 1 5 20Zm7 0a2 2 0 1 1 .001-4.001A2 2 0 0 1 12 20Zm7 0a2 2 0 1 1 .001-4.001A2 2 0 0 1 19 20Z" />
              </svg>
            </button>
          </header>

          <div class="music-detail-body">
            <section class="music-detail-stage">
              <div class="music-detail-disc-shell" :class="{ 'is-playing': audioState.playing }">
                <div class="music-detail-disc-glow"></div>
                <div class="music-detail-disc">
                  <div class="music-detail-disc-rings"></div>
                  <div class="music-detail-cover-shell">
                    <img
                      v-if="detail?.artworkUrl"
                      class="music-detail-cover-image"
                      :src="detail.artworkUrl"
                      :alt="`${resolvedTitle} cover art`"
                    />
                    <div v-else class="music-detail-cover-fallback">
                      <span>{{ artworkInitial }}</span>
                    </div>
                  </div>
                  <span class="music-detail-disc-core"></span>
                </div>
              </div>

              <div class="music-detail-visualizer" aria-hidden="true">
                <span v-for="bar in 11" :key="bar" :style="{ '--bar-index': bar }"></span>
              </div>
            </section>

            <section class="music-detail-copy">
              <div class="music-detail-copy-top">
                <h2>{{ resolvedTitle }}</h2>
                <div class="music-detail-copy-meta">
                  <strong>{{ resolvedArtist }}</strong>
                  <span class="music-detail-quality-tag">{{ qualityTag }}</span>
                </div>
              </div>

              <div
                ref="lyricsContainerRef"
                class="music-detail-lyrics-flow"
                :class="{ 'has-timed-lyrics': hasTimedLyrics }"
              >
                <template v-if="lyricsLines.length">
                  <p
                    v-for="(line, index) in lyricsLines"
                    :key="`${index}-${line.timestampSeconds ?? 'plain'}-${line.text}`"
                    :ref="(element) => setLyricLineRef(element, index)"
                    class="music-detail-lyric-line"
                    :class="{
                      'is-active': index === activeLyricIndex,
                      'is-before': activeLyricIndex >= 0 && index < activeLyricIndex,
                      'is-after': activeLyricIndex >= 0 && index > activeLyricIndex,
                      'is-idle': activeLyricIndex < 0,
                    }"
                  >
                    <span>{{ line.text }}</span>
                  </p>
                </template>

                <div v-else class="music-detail-empty">
                  <strong>No lyrics detected</strong>
                  <p>This track has no embedded lyrics and no same-name .lrc file yet.</p>
                </div>
              </div>

              <div class="music-detail-progress-block">
                <div class="music-detail-progress-track">
                  <span :style="{ transform: `scaleX(${progressScale})` }"></span>
                </div>
                <div class="music-detail-progress-time">
                  <span>{{ currentTimeLabel }}</span>
                  <span>{{ durationLabel }}</span>
                </div>
              </div>
            </section>
          </div>

          <footer class="music-detail-footer">
            <div class="music-detail-footer-side">
              <button class="music-detail-mini-button" type="button" @click="$emit('cycle-order')">
                <span class="music-detail-inline-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17 3h4v4h-2V5h-4V3ZM3 17h2v2h4v2H3v-4Zm16 0h2v4h-6v-2h4v-2Zm-8-8h10v2H11l3 3-1.4 1.4L7.2 10l5.4-5.4L14 6l-3 3ZM3 5h6v2H5v2H3V5Z" />
                  </svg>
                </span>
                <span>{{ playbackOrderLabel }}</span>
              </button>
              <span class="music-detail-footer-state">{{ audioState.playing ? "LIVE" : "READY" }}</span>
            </div>

            <div class="music-detail-footer-core">
              <button
                class="music-detail-main-button"
                type="button"
                :disabled="!hasMultipleTracks"
                @click="$emit('previous')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 5h2v14H6V5Zm12.2 1.4L10.6 12l7.6 5.6V6.4Z" />
                </svg>
              </button>
              <button
                class="music-detail-main-button is-primary"
                type="button"
                :disabled="!track"
                @click="$emit('toggle-playback')"
              >
                <svg v-if="audioState.playing" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m8 5 11 7-11 7V5Z" />
                </svg>
              </button>
              <button
                class="music-detail-main-button"
                type="button"
                :disabled="!hasMultipleTracks"
                @click="$emit('next')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16 5h2v14h-2V5ZM5.8 6.4 13.4 12l-7.6 5.6V6.4Z" />
                </svg>
              </button>
            </div>

            <div class="music-detail-footer-side is-right">
              <div class="music-detail-volume-shell">
                <span class="music-detail-inline-icon is-volume">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 9h4l5-4v14l-5-4H5V9Zm12.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 17.5 12Zm-2.5-8.76v2.07a7 7 0 0 1 0 13.38v2.07a9 9 0 0 0 0-17.52Z" />
                  </svg>
                </span>
                <label
                  class="music-detail-mini-range-shell"
                  :style="{ '--detail-progress': `${volumePercent}%` }"
                >
                  <input
                    class="music-detail-mini-range"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="volumePercent"
                    aria-label="Music volume"
                    @input="$emit('volume', $event)"
                    @change="$emit('volume', $event)"
                  />
                </label>
              </div>
              <button class="music-detail-mini-button" type="button" @click="$emit('focus-bay')">
                <span class="music-detail-inline-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16v2H4V6Zm0 5h10v2H4v-2Zm0 5h16v2H4v-2Z" />
                  </svg>
                </span>
                <span>LIST</span>
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  track: { type: Object, default: null },
  detail: { type: Object, default: null },
  audioState: {
    type: Object,
    required: true,
  },
  currentTimeLabel: { type: String, default: "--:--" },
  durationLabel: { type: String, default: "--:--" },
  playbackOrderLabel: { type: String, default: "--" },
  playbackOrderHint: { type: String, default: "" },
  hasMultipleTracks: { type: Boolean, default: false },
  volumePercent: { type: Number, default: 70 },
});

defineEmits([
  "close",
  "focus-bay",
  "seek",
  "previous",
  "toggle-playback",
  "next",
  "cycle-order",
  "volume",
]);

const lyricsContainerRef = ref(null);
const lyricLineRefs = ref([]);

const resolvedTitle = computed(() => props.detail?.title || props.track?.title || "Untitled Track");
const resolvedArtist = computed(() => props.detail?.artist || props.track?.artist || "Unknown Artist");
const resolvedAlbum = computed(() => props.detail?.album || props.track?.album || "Neon Pulse Library");
const topbarLabel = computed(() =>
  props.detail?.album || props.track?.album ? "PLAYING FROM ALBUM" : "PLAYING FROM LIBRARY"
);
const topbarMeta = computed(() => resolvedArtist.value || resolvedAlbum.value);
const artworkInitial = computed(() => resolvedTitle.value.slice(0, 1).toUpperCase() || "M");
const durationValue = computed(() =>
  Math.max(0, Number(props.audioState?.duration || props.track?.duration || 0))
);
const rangeValue = computed(() =>
  Math.min(durationValue.value, Math.max(0, Number(props.audioState?.currentTime || 0)))
);
const progressScale = computed(() =>
  durationValue.value > 0 ? Math.min(1, rangeValue.value / durationValue.value) : 0
);
const qualityTag = computed(() => {
  if (hasTimedLyrics.value) return "SYNC LYRICS";
  if (props.detail?.lyricsFormat === "plain") return "EMBEDDED";
  return "LIVE LIBRARY";
});

function parseTimestampToSeconds(token) {
  const match = String(token).match(/^(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?$/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);
  const fraction = String(match[3] || "");

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  let decimal = 0;
  if (fraction) {
    decimal = Number(fraction) / (10 ** fraction.length);
  }

  return minutes * 60 + seconds + decimal;
}

const lyricsLines = computed(() => {
  const rawLyrics = String(props.detail?.lyrics ?? "")
    .replace(/\uFEFF/g, "")
    .trim();
  if (!rawLyrics) {
    return [];
  }

  const parsedLines = rawLyrics
    .split(/\r?\n/)
    .flatMap((line) => {
      const matches = [...line.matchAll(/\[([^\]]+)\]/g)];
      const text = line.replace(/\[[^\]]+\]/g, "").trim();

      if (!text) {
        return [];
      }

      if (!matches.length) {
        return [
          {
            text,
            timestampSeconds: null,
          },
        ];
      }

      return matches.map((match) => ({
        text,
        timestampSeconds: parseTimestampToSeconds(match[1]),
      }));
    })
    .filter((line) => line.text);

  const hasAnyTimedLine = parsedLines.some((line) => Number.isFinite(line.timestampSeconds));

  if (!hasAnyTimedLine) {
    return parsedLines;
  }

  return parsedLines
    .map((line, index) => ({ ...line, orderIndex: index }))
    .sort((left, right) => {
      const leftTime = Number.isFinite(left.timestampSeconds) ? left.timestampSeconds : Number.POSITIVE_INFINITY;
      const rightTime = Number.isFinite(right.timestampSeconds) ? right.timestampSeconds : Number.POSITIVE_INFINITY;

      if (leftTime === rightTime) {
        return left.orderIndex - right.orderIndex;
      }

      return leftTime - rightTime;
    })
    .map(({ orderIndex, ...line }) => line);
});

const hasTimedLyrics = computed(() =>
  lyricsLines.value.some((line) => Number.isFinite(line.timestampSeconds))
);

const firstTimedLyricIndex = computed(() =>
  lyricsLines.value.findIndex((line) => Number.isFinite(line.timestampSeconds))
);

const activeLyricIndex = computed(() => {
  if (!lyricsLines.value.length) {
    return -1;
  }

  if (!hasTimedLyrics.value) {
    return 0;
  }

  const currentTime = Number(props.audioState?.currentTime || 0);
  let activeIndex = firstTimedLyricIndex.value >= 0 ? firstTimedLyricIndex.value : 0;

  for (let index = 0; index < lyricsLines.value.length; index += 1) {
    const line = lyricsLines.value[index];
    if (!Number.isFinite(line.timestampSeconds)) {
      continue;
    }

    if (line.timestampSeconds <= currentTime + 0.05) {
      activeIndex = index;
      continue;
    }

    break;
  }

  return activeIndex;
});

function setLyricLineRef(element, index) {
  if (!element) {
    return;
  }

  lyricLineRefs.value[index] = element;
}

async function syncActiveLyricIntoView(behavior = "smooth") {
  if (!props.open || activeLyricIndex.value < 0) {
    return;
  }

  await nextTick();

  const container = lyricsContainerRef.value;
  const element = lyricLineRefs.value[activeLyricIndex.value];

  if (!(container instanceof HTMLElement) || !(element instanceof HTMLElement)) {
    return;
  }

  element.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior,
  });
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      void syncActiveLyricIntoView("auto");
    }
  }
);

watch(
  activeLyricIndex,
  (nextIndex, previousIndex) => {
    if (!props.open || nextIndex < 0 || nextIndex === previousIndex) {
      return;
    }

    void syncActiveLyricIntoView(previousIndex < 0 ? "auto" : "smooth");
  }
);

watch(
  lyricsLines,
  () => {
    lyricLineRefs.value = [];
    if (props.open) {
      void syncActiveLyricIntoView("auto");
    }
  },
  { deep: true }
);
</script>

<style scoped>
.music-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: stretch;
  padding: clamp(10px, 1.4vw, 18px);
  background:
    radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--accent-soft) 18%, transparent), transparent 30%),
    radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--accent-strong) 18%, transparent), transparent 28%),
    linear-gradient(180deg, rgba(5, 9, 18, 0.78), rgba(5, 9, 18, 0.92));
  backdrop-filter: blur(14px);
}

.music-detail-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(16px, 2vh, 24px);
  width: min(100%, 1520px);
  height: calc(100dvh - clamp(20px, 2.8vw, 32px));
  min-height: 0;
  margin: 0 auto;
  padding: clamp(18px, 2vw, 28px) clamp(22px, 2.4vw, 34px) 0;
  border-radius: 30px;
  overflow: hidden;
  background:
    radial-gradient(circle at 22% 56%, color-mix(in srgb, var(--accent-soft) 12%, transparent), transparent 0 26%),
    radial-gradient(circle at 78% 80%, color-mix(in srgb, var(--accent-strong) 12%, transparent), transparent 0 32%),
    linear-gradient(145deg, color-mix(in srgb, var(--bg) 88%, #100918 12%), color-mix(in srgb, var(--bg-secondary) 88%, black 12%));
  box-shadow:
    0 22px 72px rgba(0, 0, 0, 0.34),
    0 0 0 1px color-mix(in srgb, var(--line) 60%, transparent) inset;
}

.music-detail-topbar {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 52px;
  align-items: start;
  gap: 16px;
}

.music-detail-topbar-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  justify-items: center;
  text-align: center;
}

.music-detail-topbar-label {
  margin: 0;
  color: color-mix(in srgb, var(--muted) 84%, white 10%);
  font-size: 0.84rem;
  letter-spacing: 0.28em;
  white-space: nowrap;
}

.music-detail-topbar-copy strong {
  display: block;
  width: 100%;
  color: color-mix(in srgb, var(--text) 90%, white 10%);
  font-size: clamp(1rem, 1.5vw, 1.3rem);
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-detail-topbar-meta {
  display: block;
  max-width: min(100%, 40ch);
  color: color-mix(in srgb, var(--muted) 88%, white 8%);
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-detail-icon-button,
.music-detail-mini-button,
.music-detail-main-button {
  appearance: none;
  border: 0;
  cursor: pointer;
}

.music-detail-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  background: color-mix(in srgb, var(--panel) 84%, transparent);
  color: var(--text);
}

.music-detail-icon-button svg,
.music-detail-inline-icon svg,
.music-detail-main-button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.music-detail-body {
  display: grid;
  grid-template-columns: minmax(240px, 0.64fr) minmax(0, 1.36fr);
  gap: clamp(24px, 3vw, 48px);
  min-height: 0;
  overflow: hidden;
  align-items: center;
}

.music-detail-stage,
.music-detail-copy {
  min-width: 0;
  min-height: 0;
}

.music-detail-stage {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 22px;
}

.music-detail-disc-shell {
  position: relative;
  display: grid;
  place-items: center;
  width: min(100%, 460px);
  aspect-ratio: 1;
}

.music-detail-disc-glow {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--accent) 28%, transparent), transparent 58%),
    radial-gradient(circle, color-mix(in srgb, var(--accent-strong) 18%, transparent), transparent 72%);
  filter: blur(44px);
}

.music-detail-disc-shell.is-playing .music-detail-disc {
  animation: music-detail-spin 18s linear infinite;
}

.music-detail-disc {
  position: relative;
  width: min(100%, 420px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(2, 4, 8, 0.98) 0 14%, rgba(18, 14, 29, 0.96) 14% 20%, rgba(244, 231, 214, 0.98) 20% 100%);
  box-shadow:
    0 0 0 10px color-mix(in srgb, var(--bg) 70%, transparent),
    0 0 42px color-mix(in srgb, var(--accent-soft) 30%, transparent);
}

.music-detail-disc-rings {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, transparent 0 28%, rgba(255, 255, 255, 0.03) 28% 31%, transparent 31% 40%, rgba(255, 255, 255, 0.025) 40% 43%, transparent 43% 52%, rgba(255, 255, 255, 0.02) 52% 55%, transparent 55%);
}

.music-detail-cover-shell {
  position: absolute;
  display: grid;
  place-items: center;
  width: 48%;
  height: 48%;
  border-radius: 14px;
  transform: rotate(-24deg);
  overflow: hidden;
  box-shadow: 0 28px 52px rgba(0, 0, 0, 0.32);
}

.music-detail-cover-image,
.music-detail-cover-fallback {
  width: 100%;
  height: 100%;
}

.music-detail-cover-image {
  display: block;
  object-fit: cover;
}

.music-detail-cover-fallback {
  display: grid;
  place-items: center;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--accent) 72%, white 10%), color-mix(in srgb, var(--accent-strong) 78%, white 8%)),
    color-mix(in srgb, var(--panel-strong) 86%, transparent);
}

.music-detail-cover-fallback span {
  font-size: clamp(3rem, 7vw, 5rem);
  font-weight: 800;
  color: color-mix(in srgb, var(--bg) 86%, black 14%);
}

.music-detail-disc-core {
  position: absolute;
  width: 11%;
  aspect-ratio: 1;
  border-radius: 50%;
  box-shadow:
    0 0 0 8px color-mix(in srgb, var(--bg) 84%, transparent),
    0 0 0 14px rgba(255, 255, 255, 0.04);
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 90%, white 10%) 0 28%, rgba(18, 25, 37, 0.96) 28% 100%);
}

.music-detail-visualizer {
  width: min(100%, 220px);
  height: 86px;
  display: grid;
  grid-template-columns: repeat(11, minmax(0, 1fr));
  gap: 8px;
  align-items: end;
}

.music-detail-visualizer span {
  height: calc(18px + (var(--bar-index) * 4px));
  border-radius: 999px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 96%, white 4%), color-mix(in srgb, var(--accent-strong) 90%, white 6%));
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent-soft) 28%, transparent);
  animation: music-detail-pulse calc(1.3s + (var(--bar-index) * 0.06s)) ease-in-out infinite;
}

.music-detail-copy {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 18px;
  align-content: center;
  width: 100%;
  max-width: min(100%, 840px);
}

.music-detail-copy-top {
  display: grid;
  gap: 14px;
  width: 100%;
}

.music-detail-copy-top h2 {
  margin: 0;
  font-size: clamp(2.8rem, 4.8vw, 5rem);
  line-height: 0.92;
  color: color-mix(in srgb, var(--text) 88%, white 12%);
  word-break: break-word;
}

.music-detail-copy-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.music-detail-copy-meta strong {
  font-size: clamp(1.35rem, 2.1vw, 2.1rem);
  color: color-mix(in srgb, var(--accent) 94%, white 6%);
}

.music-detail-quality-tag {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 10px;
  background: var(--good);
  color: color-mix(in srgb, var(--bg) 88%, black 12%);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.music-detail-lyrics-flow {
  display: grid;
  align-content: start;
  gap: 18px;
  min-height: 320px;
  max-height: min(44vh, 470px);
  padding: max(18vh, 120px) 6px max(18vh, 120px) 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent, black 12%, black 88%, transparent);
}

.music-detail-lyrics-flow::-webkit-scrollbar {
  display: none;
}

.music-detail-lyric-line {
  margin: 0;
  font-size: clamp(1.86rem, 3vw, 3rem);
  line-height: 1.08;
  font-weight: 700;
  color: color-mix(in srgb, var(--text) 30%, transparent);
  opacity: 0.24;
  word-break: break-word;
  transition:
    color 160ms ease,
    opacity 160ms ease,
    text-shadow 220ms ease;
}

.music-detail-lyric-line.is-active {
  color: color-mix(in srgb, var(--accent) 96%, white 4%);
  opacity: 1;
  text-shadow: 0 0 22px color-mix(in srgb, var(--accent-soft) 36%, transparent);
}

.music-detail-empty {
  display: grid;
  gap: 10px;
  align-content: center;
  min-height: 100%;
  color: color-mix(in srgb, var(--muted) 88%, white 6%);
}

.music-detail-empty strong {
  color: color-mix(in srgb, var(--text) 92%, white 8%);
}

.music-detail-progress-block {
  display: grid;
  gap: 10px;
  width: min(100%, 760px);
}

.music-detail-progress-track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--panel) 82%, rgba(255, 255, 255, 0.08));
}

.music-detail-progress-track span {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent-strong) 88%, white 8%), color-mix(in srgb, var(--accent) 92%, white 8%));
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent-soft) 32%, transparent);
}

.music-detail-progress-time {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.95rem;
  color: color-mix(in srgb, var(--muted) 86%, white 8%);
}

.music-detail-footer {
  display: grid;
  grid-template-columns: minmax(190px, 1fr) auto minmax(250px, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 94px;
  margin: 0 calc(clamp(22px, 2.4vw, 34px) * -1);
  padding: 14px clamp(22px, 2.4vw, 34px) calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 20%, transparent), color-mix(in srgb, var(--panel-strong) 92%, transparent)),
    color-mix(in srgb, var(--bg-secondary) 88%, black 12%);
}

.music-detail-footer-side,
.music-detail-footer-core,
.music-detail-volume-shell {
  display: flex;
  align-items: center;
  gap: 14px;
}

.music-detail-footer-core {
  justify-content: center;
}

.music-detail-footer-side.is-right {
  justify-content: flex-end;
  min-width: 0;
}

.music-detail-mini-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
  background: color-mix(in srgb, var(--panel) 86%, transparent);
  color: color-mix(in srgb, var(--text) 86%, white 10%);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.music-detail-footer-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--good) 88%, transparent);
  color: color-mix(in srgb, var(--bg) 88%, black 12%);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.music-detail-main-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  background: color-mix(in srgb, var(--panel) 90%, transparent);
  color: var(--text);
}

.music-detail-main-button.is-primary {
  width: 84px;
  height: 84px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent-strong) 86%, white 10%), color-mix(in srgb, var(--accent) 92%, white 8%));
  color: color-mix(in srgb, var(--bg) 86%, black 14%);
  box-shadow:
    0 0 0 10px color-mix(in srgb, var(--accent-soft) 24%, transparent),
    0 0 28px color-mix(in srgb, var(--accent-soft) 28%, transparent);
}

.music-detail-volume-shell {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: flex-end;
}

.music-detail-inline-icon.is-volume {
  flex: 0 0 auto;
}

.music-detail-mini-range-shell {
  position: relative;
  display: block;
  flex: 1 1 180px;
  min-width: 120px;
  max-width: 220px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--line) 76%, transparent);
}

.music-detail-mini-range-shell::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--detail-progress, 0%);
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 92%, white 8%), color-mix(in srgb, var(--accent-strong) 88%, white 8%));
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-soft) 28%, transparent);
}

.music-detail-mini-range {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 8px;
  margin: 0;
  background: transparent;
  appearance: none;
}

.music-detail-mini-range::-webkit-slider-runnable-track {
  height: 8px;
  background: transparent;
}

.music-detail-mini-range::-moz-range-track {
  height: 8px;
  border: none;
  background: transparent;
}

.music-detail-mini-range::-moz-range-progress {
  height: 8px;
  border-radius: 999px;
  background: transparent;
}

.music-detail-mini-range::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -3px;
  border: none;
  border-radius: 50%;
  appearance: none;
  background: color-mix(in srgb, var(--text) 96%, white 4%);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-soft) 28%, transparent);
}

.music-detail-mini-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text) 96%, white 4%);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-soft) 28%, transparent);
}

@keyframes music-detail-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes music-detail-pulse {
  0%, 100% { transform: scaleY(0.52); opacity: 0.38; }
  50% { transform: scaleY(1.08); opacity: 1; }
}

@media (max-width: 1080px) {
  .music-detail-body {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .music-detail-copy {
    max-width: none;
  }

  .music-detail-lyrics-flow {
    max-height: 34vh;
  }

  .music-detail-footer {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .music-detail-footer-side,
  .music-detail-footer-core {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .music-detail-volume-shell {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 700px) {
  .music-detail-overlay {
    padding: 0;
  }

  .music-detail-shell {
    width: 100%;
    height: 100dvh;
    padding: 14px 16px 0;
    border-radius: 0;
  }

  .music-detail-topbar {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
  }

  .music-detail-topbar-label {
    font-size: 0.74rem;
    letter-spacing: 0.22em;
  }

  .music-detail-topbar-meta {
    font-size: 0.78rem;
  }

  .music-detail-disc-shell {
    width: min(100%, 360px);
  }

  .music-detail-disc {
    width: min(100%, 320px);
  }

  .music-detail-visualizer {
    height: 52px;
  }

  .music-detail-copy-top h2 {
    font-size: clamp(2.5rem, 13vw, 4.2rem);
  }

  .music-detail-copy-meta strong {
    font-size: 1.18rem;
  }

  .music-detail-lyrics-flow {
    min-height: 220px;
    max-height: 31vh;
    padding-top: max(12vh, 72px);
    padding-bottom: max(12vh, 72px);
    gap: 12px;
  }

  .music-detail-lyric-line {
    font-size: clamp(1.42rem, 7vw, 2.1rem);
  }

  .music-detail-footer {
    gap: 12px;
    margin: 0 -16px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .music-detail-main-button {
    width: 56px;
    height: 56px;
  }

  .music-detail-main-button.is-primary {
    width: 72px;
    height: 72px;
  }

  .music-detail-volume-shell {
    max-width: none;
  }

  .music-detail-mini-range-shell {
    max-width: none;
  }
}
</style>
