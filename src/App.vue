<template>
  <div class="app-shell">
    <canvas ref="fxCanvasRef" class="fx-canvas"></canvas>
    <div class="fx-overlay"></div>
    <div class="grain-layer"></div>

    <main class="page-shell">
      <header class="site-header">
        <div class="brand-block">
          <p class="kicker">NEON PULSE NAV</p>
          <h1>个人导航控制台</h1>
          <p class="brand-subtitle">{{ currentFocusLine }}</p>
        </div>

        <div class="header-actions">
          <button class="ghost-button" type="button" @click="cycleTheme">
            主题 · {{ activeTheme.label }}
          </button>
          <button class="ghost-button" type="button" @click="openPalette()">命令面板</button>
          <button class="pill-button pill-button-primary" type="button" @click="openAuthPanel">
            {{ auth.authenticated ? `账号 · ${auth.username}` : "登录" }}
          </button>
        </div>
      </header>

      <div v-if="flash.message" class="drawer-note">{{ flash.message }}</div>

      <section class="hero-panel glass-panel">
        <article class="identity-card">
          <div class="identity-top">
            <div class="avatar-core">
              <span>{{ initials }}</span>
            </div>

            <div class="identity-copy">
              <p class="kicker">{{ greeting.kicker }}</p>
              <h2>{{ profile.alias }}</h2>
              <p class="identity-title">{{ profile.title }}</p>
            </div>
          </div>

          <p class="hero-text">{{ profile.intro }}</p>

          <div class="identity-meta">
            <span>{{ profile.status }}</span>
            <span>{{ profile.location }}</span>
            <span>{{ syncSummaryText }}</span>
          </div>

          <div class="mission-strip">
            <article v-for="mission in missions" :key="mission.label" class="mission-card">
              <span>{{ mission.label }}</span>
              <strong>{{ mission.value }}</strong>
            </article>
          </div>

          <div class="subsection-head">
            <div>
              <p class="kicker">QUICK DOCK</p>
              <p class="subsection-caption">{{ spotlightModeLabel }}</p>
            </div>
            <button class="ghost-button" type="button" @click="scrollToNavMatrix">浏览全部入口</button>
          </div>

          <div class="quick-dock">
            <a
              v-for="entry in visibleDockEntries"
              :key="entry.item.id"
              class="dock-link"
              :href="entry.item.url"
              target="_blank"
              rel="noreferrer"
              @click="trackLinkOpen(entry.item.id)"
            >
              <span class="dock-glyph">{{ entry.item.glyph }}</span>
              <div>
                <strong>{{ entry.item.title }}</strong>
                <small>{{ getDockHint(entry) }}</small>
              </div>
            </a>
          </div>
        </article>

        <aside class="clock-card signal-card" :style="clockCardStyle">
          <div class="section-head">
            <div>
              <p class="kicker">TIME REACTOR</p>
              <h3>时间反应堆</h3>
            </div>
            <span class="status-pill" :class="statusLine.tone">{{ statusLine.text }}</span>
          </div>

          <div class="clock-orbit-shell">
            <div class="clock-ring clock-ring-hour"></div>
            <div class="clock-ring clock-ring-minute"></div>
            <div class="clock-ring clock-ring-second"></div>

            <div class="clock-core">
              <p class="kicker">LOCAL TIME</p>
              <p class="clock-time">
                <span class="clock-segment">{{ hourText }}</span>
                <span class="clock-divider">:</span>
                <span class="clock-segment">{{ minuteText }}</span>
                <span class="clock-divider">:</span>
                <span class="clock-segment">{{ secondText }}</span>
              </p>
              <p class="clock-date">{{ clockDateLabel }}</p>
            </div>
          </div>

          <p class="clock-phase">{{ clockPhase }}</p>

          <div class="clock-readouts">
            <article class="clock-node">
              <span>Hour</span>
              <strong>{{ hourText }}</strong>
            </article>
            <article class="clock-node">
              <span>Minute</span>
              <strong>{{ minuteText }}</strong>
            </article>
            <article class="clock-node">
              <span>Second</span>
              <strong>{{ secondText }}</strong>
            </article>
          </div>

          <div class="signal-grid">
            <article class="signal-node">
              <span>Theme</span>
              <strong>{{ activeTheme.label }}</strong>
            </article>
            <article class="signal-node">
              <span>Sync</span>
              <strong>{{ syncSummaryText }}</strong>
            </article>
            <article class="signal-node signal-node-wide">
              <span>Signature</span>
              <strong>{{ profile.signature }}</strong>
            </article>
          </div>
        </aside>
      </section>

      <section class="command-panel glass-panel">
        <div class="search-shell">
          <label for="navSearch">
            <input
              id="navSearch"
              ref="searchInputRef"
              v-model.trim="query"
              type="search"
              autocomplete="off"
              placeholder="搜索站点、分类、标签或功能"
            />
          </label>

          <div class="toolbar-actions">
            <div class="filter-row">
              <button
                v-for="category in categories"
                :key="category"
                class="filter-chip"
                :class="{ active: activeCategory === category }"
                type="button"
                @click="activeCategory = category"
              >
                {{ category }}
              </button>
            </div>

            <div class="toolbar-right">
              <span class="command-hint">/ 搜索 · T 切主题 · Ctrl / Cmd + K 打开命令面板</span>
              <button class="ghost-button" type="button" @click="openDrawer">定制工作台</button>
            </div>
          </div>
        </div>
      </section>

      <section class="board-layout">
        <article v-if="spotlightItem" class="spotlight-card glass-panel">
          <div>
            <p class="kicker">SPOTLIGHT ROUTE</p>
            <div class="spotlight-meta">
              <span>{{ spotlightModeLabel }}</span>
              <span>{{ spotlightItem.category }}</span>
              <span>{{ getHostLabel(spotlightItem.url) }}</span>
            </div>
            <h3 class="spotlight-title">{{ spotlightItem.title }}</h3>
            <p class="spotlight-text">{{ spotlightItem.desc }}</p>
            <div class="spotlight-tags">
              <span v-for="tag in spotlightItem.tags" :key="tag">{{ tag }}</span>
            </div>
          </div>

          <div class="spotlight-actions">
            <a
              class="spotlight-link"
              :href="spotlightItem.url"
              target="_blank"
              rel="noreferrer"
              @click="trackLinkOpen(spotlightItem.id)"
            >
              一跳直达
            </a>
            <button class="ghost-button" type="button" @click="togglePin(spotlightItem.id)">
              {{ isPinned(spotlightItem.id) ? "取消置顶" : "置顶入口" }}
            </button>
          </div>

          <div class="spotlight-queue">
            <a
              v-for="item in visibleSpotlightQueue"
              :key="item.id"
              class="queue-item"
              :href="item.url"
              target="_blank"
              rel="noreferrer"
              @click="trackLinkOpen(item.id)"
            >
              <span>{{ item.title }}</span>
              <small>{{ item.desc }}</small>
            </a>
          </div>
        </article>

        <article class="memo-card glass-panel">
          <div>
            <p class="kicker">OPS MEMO</p>
            <h3>{{ greeting.heading }}</h3>
            <p class="memo-quote">{{ profile.signature }}</p>
          </div>

          <div class="memo-stack">
            <article class="memo-node">
              <span>Alias</span>
              <strong>{{ profile.alias }}</strong>
            </article>
            <article class="memo-node">
              <span>Main Focus</span>
              <strong>{{ profile.primaryFocus }}</strong>
            </article>
            <article class="memo-node">
              <span>Next Push</span>
              <strong>{{ profile.secondaryFocus }}</strong>
            </article>
          </div>

          <div class="ops-row">
            <a
              v-for="action in quickActions"
              :key="action.label"
              class="ops-link"
              :href="action.url"
              target="_blank"
              rel="noreferrer"
              @click="trackLinkOpen(action.linkId)"
            >
              <strong>{{ action.label }}</strong>
              <span>{{ action.hint }}</span>
            </a>
          </div>
        </article>
      </section>

      <section class="intel-layout">
        <article class="analytics-card glass-panel">
          <div class="section-head">
            <div>
              <p class="kicker">USAGE INTEL</p>
              <h3>工作台正在怎样被你使用</h3>
            </div>
            <p class="sync-summary">{{ syncSummaryText }}</p>
          </div>

          <div class="stats-grid">
            <article v-for="metric in metricCards" :key="metric.label" class="metric-card">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
              <small>{{ metric.hint }}</small>
            </article>
          </div>

          <div class="trend-layout">
            <div class="trend-panel">
              <div class="subsection-head">
                <p class="kicker">7 DAY PULSE</p>
                <p class="subsection-caption">最近一周的真实打开趋势</p>
              </div>

              <div ref="trendBarsRef" class="trend-bars" @scroll="handleTrendScroll" @wheel="handleTrendWheel">
                <div v-for="sequence in 3" :key="sequence" class="trend-sequence">
                  <article
                    v-for="day in statsModel.recentDays"
                    :key="`${sequence}-${day.dateKey}`"
                    class="trend-bar"
                  >
                    <span>{{ formatWeekdayLabel(day.dateKey) }}</span>
                    <div class="trend-rail">
                      <div
                        class="trend-fill"
                        :style="{ '--level': `${Math.max(day.total / strongestTrendDay, day.total ? 0.12 : 0.05)}` }"
                      ></div>
                    </div>
                    <strong>{{ formatNumber(day.total) }}</strong>
                    <small>{{ formatDateLabel(day.dateKey) }}</small>
                  </article>
                </div>
              </div>
            </div>

            <div class="route-panel">
              <div class="subsection-head">
                <p class="kicker">HOT ROUTES</p>
                <p class="subsection-caption">今天和近 7 天最热的入口</p>
              </div>

              <div class="top-routes">
                <a
                  v-for="(route, index) in visibleTopRoutes"
                  :key="route.linkId"
                  class="route-item"
                  :href="route.url"
                  target="_blank"
                  rel="noreferrer"
                  @click="trackLinkOpen(route.linkId)"
                >
                  <span class="route-rank">{{ index + 1 }}</span>
                  <div class="route-copy">
                    <strong>{{ route.title }}</strong>
                    <small>{{ route.category }}</small>
                  </div>
                  <span class="route-count">{{ formatNumber(route.count) }}</span>
                </a>

                <article v-if="!visibleTopRoutes.length" class="route-empty">
                  还没有统计数据，打开几个常用入口后这里就会开始生长。
                </article>
              </div>
            </div>
          </div>
        </article>

        <article class="control-card glass-panel">
          <div class="section-head">
            <div>
              <p class="kicker">CONTROL ROOM</p>
              <h3>命令、备份与同步</h3>
            </div>
            <button class="ghost-button" type="button" @click="refreshWorkspace">重新同步</button>
          </div>

          <p class="control-summary">{{ controlSummary }}</p>

          <div class="control-chips">
            <span v-for="chip in visibleControlChips" :key="chip" class="control-chip">{{ chip }}</span>
          </div>

          <div class="shortcut-list">
            <article v-for="item in visibleShortcutItems" :key="item.key" class="shortcut-item">
              <span class="shortcut-key">{{ item.key }}</span>
              <span>{{ item.desc }}</span>
            </article>
          </div>

          <div class="drawer-actions">
            <button class="ghost-button" type="button" @click="openDrawer">编辑资料</button>
            <button class="ghost-button" type="button" @click="exportWorkspaceBackup">导出备份</button>
            <button class="ghost-button" type="button" @click="openAuthPanel">账号安全</button>
          </div>
        </article>
      </section>

      <NasDeck
        ref="nasDeckRef"
        :auth-state="auth"
        @notify="handleChildNotify"
        @request-auth="openAuthPanel"
      />

      <section ref="navMatrixRef" class="links-stage">
        <div class="section-head">
          <div>
            <p class="kicker">NAV MATRIX</p>
            <h3>全部入口矩阵</h3>
          </div>
          <p class="results-meta">{{ resultsMeta }}</p>
        </div>

        <div class="nav-grid">
          <article
            v-for="item in visibleLinks"
            :key="item.id"
            class="nav-card glass-panel"
            :class="{ 'is-pinned': isPinned(item.id) }"
          >
            <div class="nav-card-head">
              <div class="nav-card-title">
                <span class="nav-glyph">{{ item.glyph }}</span>
                <div>
                  <span class="nav-category">{{ item.category }}</span>
                  <h4>{{ item.title }}</h4>
                </div>
              </div>

              <button
                class="pin-toggle"
                :class="{ active: isPinned(item.id) }"
                type="button"
                @click="togglePin(item.id)"
              >
                {{ isPinned(item.id) ? "已置顶" : "置顶" }}
              </button>
            </div>

            <p class="nav-card-text">{{ item.desc }}</p>

            <div class="nav-tags">
              <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
            </div>

            <div class="nav-card-foot">
              <span>{{ item.badge }}</span>
              <span>{{ getHostLabel(item.url) }}</span>
            </div>

            <div class="nav-card-actions">
              <a
                class="nav-open"
                :href="item.url"
                target="_blank"
                rel="noreferrer"
                @click="trackLinkOpen(item.id)"
              >
                打开入口
              </a>
            </div>
          </article>

          <article v-if="!visibleLinks.length" class="empty-card glass-panel">
            <h4>没有找到匹配结果</h4>
            <p>换个关键词，或者切回“全部”分类再试一次。</p>
          </article>
        </div>
      </section>
    </main>

    <CustomizeDrawer
      :open="drawerOpen"
      :draft-profile="draftProfile"
      :data-sync-note="dataSyncNote"
      @close="closeDrawer"
      @save="saveProfile"
      @reset-profile="resetProfileToPreset"
      @export="exportWorkspaceBackup"
      @import-change="onImportFileChange"
      @refresh="refreshWorkspace"
      @reset-history="resetHistory"
      @reset-all="resetAllWorkspace"
    />

    <AuthPanel
      :auth="auth"
      :login-form="loginForm"
      :login-state="loginState"
      :credential-form="credentialForm"
      :credential-state="credentialState"
      @close="closeAuthPanel"
      @login="handleLogin"
      @logout="handleLogout"
      @update-credentials="handleCredentialUpdate"
    />

    <CommandPalette
      :open="paletteOpen"
      :query="paletteQuery"
      :meta="paletteMeta"
      :entries="paletteEntries"
      :active-index="paletteIndex"
      @close="closePalette"
      @execute="executePaletteEntry"
      @update:query="setPaletteQuery"
    />
  </div>
</template>

<script setup>
import AuthPanel from "./components/AuthPanel.vue";
import CommandPalette from "./components/CommandPalette.vue";
import CustomizeDrawer from "./components/CustomizeDrawer.vue";
import NasDeck from "./components/NasDeck.vue";
import { useDashboardApp } from "./composables/useDashboardApp.js";

const {
  activeCategory,
  activeTheme,
  auth,
  categories,
  clockCardStyle,
  clockDateLabel,
  clockPhase,
  controlSummary,
  credentialState,
  credentialForm,
  currentFocusLine,
  dataSyncNote,
  draftProfile,
  drawerOpen,
  flash,
  formatDateLabel,
  formatNumber,
  formatWeekdayLabel,
  fxCanvasRef,
  getDockHint,
  getHostLabel,
  greeting,
  handleChildNotify,
  handleTrendScroll,
  handleTrendWheel,
  hourText,
  initials,
  isPinned,
  loginState,
  loginForm,
  loginToWorkspace,
  logoutFromWorkspace,
  metricCards,
  minuteText,
  missions,
  navMatrixRef,
  nasDeckRef,
  onImportFileChange,
  openAuthPanel,
  openDrawer,
  openPalette,
  paletteEntries,
  paletteIndex,
  paletteMeta,
  paletteOpen,
  paletteQuery,
  profile,
  query,
  quickActions,
  resetProfileToPreset,
  resetWorkspaceScope,
  resultsMeta,
  saveProfile,
  scrollToNavMatrix,
  searchInputRef,
  secondText,
  spotlightItem,
  spotlightModeLabel,
  statsModel,
  strongestTrendDay,
  statusLine,
  syncSummaryText,
  togglePin,
  trackLinkOpen,
  trendBarsRef,
  updateAuthCredentials,
  visibleLinks,
  visibleControlChips,
  visibleDockEntries,
  visibleShortcutItems,
  visibleSpotlightQueue,
  visibleTopRoutes,
  closeAuthPanel,
  closeDrawer,
  closePalette,
  cycleTheme,
  executePaletteEntry,
  exportWorkspaceBackup,
  hydrateServerSnapshot,
} = useDashboardApp();

function setPaletteQuery(value) {
  paletteQuery.value = value;
  paletteIndex.value = 0;
}

async function refreshWorkspace() {
  await hydrateServerSnapshot(true);
  await nasDeckRef.value?.hydrate?.();
}

async function handleLogin() {
  await loginToWorkspace();
  await nasDeckRef.value?.hydrate?.();
}

async function handleLogout() {
  await logoutFromWorkspace();
  await nasDeckRef.value?.hydrate?.();
}

async function handleCredentialUpdate() {
  await updateAuthCredentials();
  await nasDeckRef.value?.hydrate?.();
}

async function resetHistory() {
  await resetWorkspaceScope("history");
}

async function resetAllWorkspace() {
  await resetWorkspaceScope("all");
}
</script>
