import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from "vue";
import { requestJson } from "../lib/api.js";
import {
  focusLines,
  links,
  profilePreset,
  quickActions,
  themes,
} from "../data/content.js";

const THEME_STORAGE_KEY = "neon-pulse-theme";
const CATEGORY_ALL = "全部";
const CATEGORY_PINNED = "已置顶";
const COMMAND_RESULT_LIMIT = 10;
const RECENT_DAYS_WINDOW = 7;
const MOBILE_BREAKPOINT = 760;
const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateLabelFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
  weekday: "short",
});
const absoluteTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const clockDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function createEmptyStats() {
  return {
    updatedAt: "",
    todayKey: getLocalDateKey(),
    todayTotal: 0,
    weeklyTotal: 0,
    totalTrackedDays: 0,
    totalOpenCount: 0,
    topToday: [],
    topWeek: [],
    recentDays: getRecentDateKeys().map((dateKey) => ({ dateKey, total: 0 })),
  };
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecentDateKeys(days = RECENT_DAYS_WINDOW) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    return getLocalDateKey(date);
  });
}

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return dateLabelFormatter.format(date);
}

function formatWeekdayLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return weekdayFormatter.format(date);
}

function formatAbsoluteTime(value) {
  if (!value) {
    return "尚未同步";
  }

  return absoluteTimeFormatter.format(new Date(value));
}

function formatRelativeTime(value) {
  if (!value) {
    return "尚未同步";
  }

  const delta = Date.now() - new Date(value).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (delta < minute) return "刚刚同步";
  if (delta < hour) return `${Math.max(1, Math.round(delta / minute))} 分钟前同步`;
  if (delta < 24 * hour) return `${Math.max(1, Math.round(delta / hour))} 小时前同步`;

  return formatAbsoluteTime(value);
}

function getHostLabel(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function sanitizeString(value, fallback, maxLength) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function sanitizeProfile(nextProfile = {}) {
  return {
    alias: sanitizeString(nextProfile.alias, profilePreset.alias, 24),
    title: sanitizeString(nextProfile.title, profilePreset.title, 48),
    intro: sanitizeString(nextProfile.intro, profilePreset.intro, 160),
    signature: sanitizeString(nextProfile.signature, profilePreset.signature, 120),
    status: sanitizeString(nextProfile.status, profilePreset.status, 36),
    location: sanitizeString(nextProfile.location, profilePreset.location, 36),
    primaryFocus: sanitizeString(nextProfile.primaryFocus, profilePreset.primaryFocus, 48),
    secondaryFocus: sanitizeString(nextProfile.secondaryFocus, profilePreset.secondaryFocus, 48),
  };
}

function normalizeAuthText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFreeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getLoginValidationState(form) {
  const username = normalizeAuthText(form.username);
  const password = typeof form.password === "string" ? form.password : "";

  if (!username) {
    return { valid: false, message: "请输入账号" };
  }

  if (username.length > 32) {
    return { valid: false, message: "账号不能超过 32 位" };
  }

  if (!password) {
    return { valid: false, message: "请输入密码" };
  }

  if (password.length < 4) {
    return { valid: false, message: "密码至少需要 4 位" };
  }

  if (password.length > 64) {
    return { valid: false, message: "密码不能超过 64 位" };
  }

  return { valid: true, message: "" };
}

function getCredentialValidationState(form) {
  const currentUsername = normalizeAuthText(form.currentUsername);
  const currentPassword = typeof form.currentPassword === "string" ? form.currentPassword : "";
  const nextUsername = normalizeAuthText(form.nextUsername);
  const nextPassword = typeof form.nextPassword === "string" ? form.nextPassword : "";

  if (!currentUsername) {
    return { valid: false, message: "请输入当前账号" };
  }

  if (!currentPassword) {
    return { valid: false, message: "请输入当前密码" };
  }

  if (!nextUsername) {
    return { valid: false, message: "请输入新账号" };
  }

  if (nextUsername.length > 32) {
    return { valid: false, message: "新账号不能超过 32 位" };
  }

  if (!nextPassword) {
    return { valid: false, message: "请输入新密码" };
  }

  if (nextPassword.length < 4) {
    return { valid: false, message: "新密码至少需要 4 位" };
  }

  if (nextPassword.length > 64) {
    return { valid: false, message: "新密码不能超过 64 位" };
  }

  return { valid: true, message: "" };
}

function getInitials(alias) {
  const cleaned = String(alias || "").trim();

  if (!cleaned) {
    return "ME";
  }

  if (/^[\p{Script=Han}\p{Number}]+$/u.test(cleaned)) {
    return Array.from(cleaned).slice(0, 2).join("");
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return cleaned.slice(0, 2).toUpperCase();
}

function getGreeting(hours) {
  if (hours >= 5 && hours < 11) {
    return { kicker: "MORNING SYNC", heading: "早晨适合优先推进最难的那件事" };
  }
  if (hours >= 11 && hours < 14) {
    return { kicker: "MIDDAY FLOW", heading: "午间继续守住主线，不让注意力被切碎" };
  }
  if (hours >= 14 && hours < 19) {
    return { kicker: "AFTERNOON DRIVE", heading: "下午是把计划拽成结果的黄金时段" };
  }
  if (hours >= 19 && hours < 24) {
    return { kicker: "NIGHT MODE", heading: "晚上适合沉浸式深潜，把页面和思路一起做薄" };
  }

  return { kicker: "LATE CORE", heading: "深夜只保留真正重要的入口和任务" };
}

function getClockPhase(hours) {
  if (hours >= 5 && hours < 9) return "Dawn ignition";
  if (hours >= 9 && hours < 12) return "Morning vector";
  if (hours >= 12 && hours < 15) return "Zenith pulse";
  if (hours >= 15 && hours < 19) return "Golden relay";
  if (hours >= 19 && hours < 23) return "Night drive";
  return "Midnight drift";
}

export function useDashboardApp() {
  const fxCanvasRef = ref(null);
  const searchInputRef = ref(null);
  const navMatrixRef = ref(null);
  const trendBarsRef = ref(null);
  const nasDeckRef = ref(null);

  const allLinks = links.map((item, index) => ({
    ...item,
    id: item.id ?? `link-${index + 1}`,
  }));
  const linkById = new Map(allLinks.map((item) => [item.id, item]));

  const themeIndex = ref(0);
  const query = ref("");
  const activeCategory = ref(CATEGORY_ALL);
  const currentTime = ref(new Date());
  const scene = shallowRef(null);
  const currentFocusLine = ref(focusLines[0]);
  const statsRefreshTimer = ref(0);
  const drawerOpen = ref(false);
  const paletteOpen = ref(false);
  const paletteQuery = ref("");
  const paletteIndex = ref(0);
  const trendPinnedToLatest = ref(true);
  const trendLoopSyncing = ref(false);
  const serverReady = ref(false);
  const updatedAt = ref("");
  const coarsePointer = ref(false);
  const compactViewport = ref(false);
  const fxReady = ref(true);
  const flashTimerId = ref(0);
  const clockTimerId = ref(0);
  const focusTimerId = ref(0);

  const profile = reactive({ ...profilePreset });
  const draftProfile = reactive({ ...profilePreset });
  const stats = ref(createEmptyStats());
  const pinnedIds = ref([]);
  const todayClicks = ref({});
  const flash = reactive({
    tone: "info",
    message: "",
  });
  const auth = reactive({
    checked: false,
    authenticated: false,
    username: "",
    panelOpen: false,
  });
  const loginForm = reactive({
    username: "",
    password: "",
  });
  const credentialForm = reactive({
    currentUsername: "",
    currentPassword: "",
    nextUsername: "",
    nextPassword: "",
  });

  const activeTheme = computed(() => themes[themeIndex.value] ?? themes[0]);
  const normalizedQuery = computed(() => normalizeFreeText(query.value));
  const normalizedPaletteQuery = computed(() => normalizeFreeText(paletteQuery.value));
  const categories = computed(() => [
    CATEGORY_ALL,
    CATEGORY_PINNED,
    ...new Set(allLinks.map((item) => item.category)),
  ]);
  const todayOpenTotal = computed(() =>
    Object.values(todayClicks.value).reduce((total, count) => total + count, 0)
  );
  const initials = computed(() => getInitials(profile.alias));
  const greeting = computed(() => getGreeting(currentTime.value.getHours()));
  const hourText = computed(() => String(currentTime.value.getHours()).padStart(2, "0"));
  const minuteText = computed(() => String(currentTime.value.getMinutes()).padStart(2, "0"));
  const secondText = computed(() => String(currentTime.value.getSeconds()).padStart(2, "0"));
  const clockDateLabel = computed(() => clockDateFormatter.format(currentTime.value));
  const clockPhase = computed(() => getClockPhase(currentTime.value.getHours()));
  const clockCardStyle = computed(() => {
    const hours = currentTime.value.getHours() % 12;
    const minutes = currentTime.value.getMinutes();
    const seconds = currentTime.value.getSeconds();
    const milliseconds = currentTime.value.getMilliseconds();

    return {
      "--clock-hour": `${(hours + minutes / 60) * 30}deg`,
      "--clock-minute": `${(minutes + seconds / 60) * 6}deg`,
      "--clock-second": `${(seconds + milliseconds / 1000) * 6}deg`,
    };
  });
  const visibleLinks = computed(() => {
    const keyword = normalizedQuery.value.toLowerCase();

    return allLinks.filter((item) => {
      const categoryMatch =
        activeCategory.value === CATEGORY_ALL ||
        (activeCategory.value === CATEGORY_PINNED && pinnedIds.value.includes(item.id)) ||
        item.category === activeCategory.value;

      if (!categoryMatch) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchText = [
        item.title,
        item.desc,
        item.category,
        item.badge,
        item.glyph,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase();

      return searchText.includes(keyword);
    });
  });
  const missions = computed(() => [
    { label: "今日主线", value: profile.primaryFocus },
    { label: "次级推进", value: profile.secondaryFocus },
    { label: "置顶入口", value: `${pinnedIds.value.length} 个` },
  ]);
  const topClickedEntries = computed(() =>
    Object.entries(todayClicks.value)
      .filter(([linkId, count]) => linkById.has(linkId) && count > 0)
      .sort(([leftId, leftCount], [rightId, rightCount]) => {
        if (rightCount !== leftCount) {
          return rightCount - leftCount;
        }

        if (pinnedIds.value.includes(leftId) !== pinnedIds.value.includes(rightId)) {
          return Number(pinnedIds.value.includes(rightId)) - Number(pinnedIds.value.includes(leftId));
        }

        return leftId.localeCompare(rightId);
      })
      .map(([linkId, count]) => ({
        item: linkById.get(linkId),
        count,
        mode: "dynamic",
      }))
  );
  const dockEntries = computed(() => {
    const seen = new Set();
    const entries = [];

    function pushEntry(entry) {
      if (!entry?.item || seen.has(entry.item.id)) {
        return;
      }

      seen.add(entry.item.id);
      entries.push(entry);
    }

    topClickedEntries.value.forEach(pushEntry);
    allLinks
      .filter((item) => pinnedIds.value.includes(item.id))
      .forEach((item) => pushEntry({ item, mode: "pinned" }));
    allLinks
      .filter((item) => item.featured)
      .forEach((item) => pushEntry({ item, mode: "featured" }));
    allLinks.forEach((item) => pushEntry({ item, mode: "default" }));

    return entries.slice(0, 4);
  });
  const prioritizedLinks = computed(() =>
    [...allLinks].sort((left, right) => {
      const leftScore =
        (todayClicks.value[left.id] ?? 0) * 100 +
        Number(pinnedIds.value.includes(left.id)) * 20 +
        Number(Boolean(left.featured)) * 10;
      const rightScore =
        (todayClicks.value[right.id] ?? 0) * 100 +
        Number(pinnedIds.value.includes(right.id)) * 20 +
        Number(Boolean(right.featured)) * 10;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.title.localeCompare(right.title);
    })
  );
  const spotlightItem = computed(() => {
    const topToday = topClickedEntries.value[0]?.item;

    return (
      topToday ||
      visibleLinks.value.find((item) => pinnedIds.value.includes(item.id)) ||
      visibleLinks.value.find((item) => item.featured) ||
      visibleLinks.value[0] ||
      allLinks.find((item) => pinnedIds.value.includes(item.id)) ||
      allLinks.find((item) => item.featured) ||
      allLinks[0] ||
      null
    );
  });
  const spotlightQueue = computed(() =>
    visibleLinks.value.filter((item) => item.id !== spotlightItem.value?.id).slice(0, 3)
  );
  const spotlightModeLabel = computed(() => {
    const topToday = topClickedEntries.value[0];

    if (topToday?.item?.id === spotlightItem.value?.id) {
      return `Today Top Route · ${topToday.count} 次`;
    }

    if (spotlightItem.value && pinnedIds.value.includes(spotlightItem.value.id)) {
      return "Pinned Route";
    }

    return "Featured Route";
  });
  const statsModel = computed(() => {
    if (stats.value?.recentDays?.length) {
      return stats.value;
    }

    const recentDays = getRecentDateKeys().map((dateKey) => ({
      dateKey,
      total: dateKey === getLocalDateKey() ? todayOpenTotal.value : 0,
    }));
    const topToday = topClickedEntries.value.map((entry) => ({
      linkId: entry.item.id,
      title: entry.item.title,
      category: entry.item.category,
      url: entry.item.url,
      glyph: entry.item.glyph,
      badge: entry.item.badge,
      count: entry.count,
    }));

    return {
      updatedAt: updatedAt.value,
      todayKey: getLocalDateKey(),
      todayTotal: todayOpenTotal.value,
      weeklyTotal: todayOpenTotal.value,
      totalTrackedDays: todayOpenTotal.value ? 1 : 0,
      totalOpenCount: todayOpenTotal.value,
      topToday,
      topWeek: topToday,
      recentDays,
    };
  });
  const strongestTrendDay = computed(() =>
    Math.max(...statsModel.value.recentDays.map((item) => item.total), 1)
  );
  const metricCards = computed(() => [
    { label: "今日打开", value: formatNumber(statsModel.value.todayTotal), hint: "今天真实记录到的入口点击" },
    { label: "7 日脉冲", value: formatNumber(statsModel.value.weeklyTotal), hint: "最近一周累计点击次数" },
    { label: "累计打开", value: formatNumber(statsModel.value.totalOpenCount), hint: "服务器保留的全量点击记录" },
    { label: "追踪天数", value: formatNumber(statsModel.value.totalTrackedDays), hint: "已持久化的活跃日期" },
  ]);
  const topRoutes = computed(() => {
    const entries = [
      ...(statsModel.value.topToday?.length ? statsModel.value.topToday : []),
      ...(statsModel.value.topWeek ?? []),
    ];
    const unique = [];

    for (const item of entries) {
      if (!unique.some((entry) => entry.linkId === item.linkId)) {
        unique.push(item);
      }
    }

    return unique.slice(0, 5);
  });
  const syncSummaryText = computed(() =>
    formatRelativeTime(statsModel.value.updatedAt || updatedAt.value)
  );
  const statusLine = computed(() => {
    if (flash.message) {
      return {
        tone: flash.tone === "error" ? "is-error" : "is-ok",
        text: flash.message,
      };
    }

    if (serverReady.value) {
      return {
        tone: "is-ok",
        text: syncSummaryText.value,
      };
    }

    return {
      tone: "is-error",
      text: "Server offline fallback",
    };
  });
  const controlSummary = computed(() =>
    serverReady.value
      ? `当前工作台数据由服务器本地文件托管，上次写入时间是 ${formatAbsoluteTime(
          statsModel.value.updatedAt || updatedAt.value
        )}。命令面板、备份恢复和点击趋势都共用这份数据源。`
      : "当前使用本地回退状态，服务端恢复连通后会自动拉回完整工作台数据。"
  );
  const controlChips = computed(() => [
    `主题：${activeTheme.value.label}`,
    `置顶入口：${pinnedIds.value.length} 个`,
    `筛选：${activeCategory.value}`,
    `搜索：${normalizedQuery.value || "无"}`,
  ]);
  const shortcutItems = [
    { key: "Ctrl / Cmd + K", desc: "打开命令面板" },
    { key: "/", desc: "聚焦搜索输入框" },
    { key: "T", desc: "切换主题" },
    { key: "Esc", desc: "关闭抽屉或命令面板" },
  ];
  const loginState = computed(() => getLoginValidationState(loginForm));
  const credentialState = computed(() => getCredentialValidationState(credentialForm));
  const visibleDockEntries = computed(() =>
    compactViewport.value ? dockEntries.value.slice(0, 2) : dockEntries.value
  );
  const visibleSpotlightQueue = computed(() =>
    compactViewport.value ? spotlightQueue.value.slice(0, 2) : spotlightQueue.value
  );
  const visibleTopRoutes = computed(() =>
    compactViewport.value ? topRoutes.value.slice(0, 3) : topRoutes.value
  );
  const visibleControlChips = computed(() =>
    compactViewport.value ? controlChips.value.slice(0, 2) : controlChips.value
  );
  const visibleShortcutItems = computed(() =>
    compactViewport.value ? shortcutItems.slice(0, 2) : shortcutItems
  );
  const resultsMeta = computed(() => {
    if (normalizedQuery.value) {
      return `搜索 “${normalizedQuery.value}” 匹配到 ${visibleLinks.value.length} 个入口`;
    }

    if (activeCategory.value === CATEGORY_ALL) {
      return `当前显示全部节点，共 ${visibleLinks.value.length} 个入口`;
    }

    return `当前分类为 “${activeCategory.value}”，共 ${visibleLinks.value.length} 个入口`;
  });
  const dataSyncNote = computed(() => {
    if (flash.message) {
      return `${flash.message} · ${formatAbsoluteTime(statsModel.value.updatedAt || updatedAt.value)}`;
    }

    if (serverReady.value) {
      return `服务器数据已在线，最近同步时间 ${formatAbsoluteTime(
        statsModel.value.updatedAt || updatedAt.value
      )}。导出会包含资料、置顶入口和历史点击记录。`;
    }

    return "当前未拿到服务端快照，导出、导入和清理操作会在服务端恢复后更可靠。";
  });
  const paletteEntries = computed(() => {
    const keyword = normalizedPaletteQuery.value.toLowerCase();
    const commandEntries = [
      {
        id: "command:customize",
        type: "command",
        label: "打开定制工作台",
        hint: "编辑个人资料、备份和恢复",
        keywords: "定制 工作台 资料 备份 恢复",
        run: () => openDrawer(),
      },
      {
        id: "command:auth",
        type: "command",
        label: auth.authenticated ? "打开账号安全舱" : "打开登录面板",
        hint: auth.authenticated ? "修改账号密码或退出登录" : "使用 admin / admin 登录",
        keywords: "登录 账号 密码 auth security",
        run: () => openAuthPanel(),
      },
      {
        id: "command:search",
        type: "command",
        label: "聚焦搜索框",
        hint: "马上开始筛选导航矩阵",
        keywords: "搜索 查找 filter",
        run: async () => {
          await nextTick();
          searchInputRef.value?.focus();
          searchInputRef.value?.select();
        },
      },
      {
        id: "command:theme",
        type: "command",
        label: "切换主题",
        hint: `当前主题 ${activeTheme.value.label}`,
        keywords: "主题 theme laser matrix sunset",
        run: () => cycleTheme(),
      },
      {
        id: "command:scroll",
        type: "command",
        label: "滚动到导航矩阵",
        hint: "跳转到全部入口卡片区域",
        keywords: "导航 矩阵 滚动 card",
        run: () => scrollToNavMatrix(),
      },
      {
        id: "command:export",
        type: "command",
        label: "导出服务器备份",
        hint: "下载当前工作台 JSON 备份",
        keywords: "导出 备份 backup json",
        run: () => exportWorkspaceBackup(),
      },
      {
        id: "command:refresh",
        type: "command",
        label: "重新同步服务器数据",
        hint: "手动刷新资料和统计",
        keywords: "刷新 同步 reload sync",
        run: () => hydrateServerSnapshot(true),
      },
      {
        id: "command:reset-filter",
        type: "command",
        label: "清空筛选条件",
        hint: "恢复到全部分类并清空搜索",
        keywords: "清空 重置 reset clear",
        run: () => clearFilters(),
      },
      {
        id: "command:reset-history",
        type: "command",
        label: "清空点击统计",
        hint: "保留资料与置顶，只清空打开历史",
        keywords: "清空 点击 统计 history",
        run: () => resetWorkspaceScope("history"),
      },
    ];

    const linkEntries = prioritizedLinks.value.map((item) => ({
      id: `link:${item.id}`,
      type: "link",
      label: item.title,
      hint: `${item.category} · ${item.badge} · ${getHostLabel(item.url)}`,
      keywords: [item.title, item.desc, item.category, item.badge, ...item.tags].join(" "),
      glyph: item.glyph,
      meta: item,
      run: () => openLinkFromPalette(item),
    }));

    return [...commandEntries, ...linkEntries]
      .map((entry) => {
        const searchText = `${entry.label} ${entry.hint} ${entry.keywords}`.toLowerCase();
        const labelText = entry.label.toLowerCase();
        let score = 0;

        if (!keyword) {
          score = entry.type === "command" ? 200 : 100;
        } else if (labelText.startsWith(keyword)) {
          score = 400;
        } else if (searchText.includes(keyword)) {
          score = 260;
        }

        if (entry.type === "link" && entry.meta) {
          score += (todayClicks.value[entry.meta.id] ?? 0) * 50;
          score += Number(pinnedIds.value.includes(entry.meta.id)) * 20;
          score += Number(Boolean(entry.meta.featured)) * 10;
        }

        if (entry.type === "command") {
          score += 100;
        }

        return {
          ...entry,
          score,
        };
      })
      .filter((entry) => (!keyword ? true : entry.score > 0))
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
      .slice(0, COMMAND_RESULT_LIMIT);
  });
  const paletteMeta = computed(() =>
    paletteEntries.value.length
      ? `${paletteEntries.value.length} 个可执行结果`
      : "没有匹配结果，试试输入站点名、标签或“导出备份”等命令"
  );

  function setFlash(message, tone = "info") {
    flash.message = message;
    flash.tone = tone;
  }

  function clearFlash() {
    flash.message = "";
    flash.tone = "info";
  }

  function mergeWorkspacePayload(payload = {}) {
    Object.assign(profile, sanitizeProfile(payload.profile ?? profile));
    pinnedIds.value = Array.isArray(payload.pinnedIds)
      ? [...new Set(payload.pinnedIds)].filter((id) => linkById.has(id)).slice(0, 8)
      : pinnedIds.value;
    todayClicks.value =
      payload.todayClicks && typeof payload.todayClicks === "object"
        ? Object.fromEntries(
            Object.entries(payload.todayClicks)
              .filter(([linkId, count]) => linkById.has(linkId) && Number(count) > 0)
              .map(([linkId, count]) => [linkId, Math.floor(Number(count))])
          )
        : todayClicks.value;
    updatedAt.value =
      typeof payload.updatedAt === "string" && payload.updatedAt ? payload.updatedAt : updatedAt.value;
  }

  function mergeStatsPayload(payload = {}) {
    stats.value = {
      updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : stats.value.updatedAt,
      todayKey: typeof payload.todayKey === "string" ? payload.todayKey : getLocalDateKey(),
      todayTotal: Math.max(0, Math.floor(Number(payload.todayTotal) || 0)),
      weeklyTotal: Math.max(0, Math.floor(Number(payload.weeklyTotal) || 0)),
      totalTrackedDays: Math.max(0, Math.floor(Number(payload.totalTrackedDays) || 0)),
      totalOpenCount: Math.max(0, Math.floor(Number(payload.totalOpenCount) || 0)),
      topToday: Array.isArray(payload.topToday) ? payload.topToday : [],
      topWeek: Array.isArray(payload.topWeek) ? payload.topWeek : [],
      recentDays: Array.isArray(payload.recentDays)
        ? payload.recentDays.map((item) => ({
            dateKey: item.dateKey,
            total: Math.max(0, Math.floor(Number(item.total) || 0)),
          }))
        : getRecentDateKeys().map((dateKey) => ({ dateKey, total: 0 })),
    };
  }

  function syncDraftProfile() {
    Object.assign(draftProfile, profile);
  }

  function syncCredentialForm() {
    credentialForm.currentUsername = auth.username || "";
    credentialForm.currentPassword = "";
    credentialForm.nextUsername = auth.username || "";
    credentialForm.nextPassword = "";
  }

  function syncViewportFlags() {
    compactViewport.value = window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function mergeAuthPayload(payload = {}) {
    auth.checked = true;
    auth.authenticated = Boolean(payload.authenticated);
    auth.username = typeof payload.username === "string" ? payload.username : "";
  }

  async function hydrateAuthSession() {
    const payload = await requestJson("/api/auth/session");
    mergeAuthPayload(payload);
  }

  async function loginToWorkspace() {
    if (!loginState.value.valid) {
      setFlash(loginState.value.message, "error");
      return;
    }

    const payload = await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: normalizeAuthText(loginForm.username),
        password: loginForm.password,
      }),
    });

    mergeAuthPayload(payload);
    setFlash(`已登录为 ${auth.username}`, "info");
    loginForm.password = "";
    syncCredentialForm();
    await nasDeckRef.value?.hydrate();
    closeAuthPanel();
  }

  async function logoutFromWorkspace() {
    await requestJson("/api/auth/logout", {
      method: "POST",
    });

    mergeAuthPayload({
      authenticated: false,
      username: "",
    });
    setFlash("已退出登录", "info");
    loginForm.username = "";
    loginForm.password = "";
    await nasDeckRef.value?.hydrate();
  }

  async function updateAuthCredentials() {
    if (!credentialState.value.valid) {
      setFlash(credentialState.value.message, "error");
      return;
    }

    const payload = await requestJson("/api/auth/credentials", {
      method: "PUT",
      body: JSON.stringify({
        currentUsername: normalizeAuthText(credentialForm.currentUsername),
        currentPassword: credentialForm.currentPassword,
        nextUsername: normalizeAuthText(credentialForm.nextUsername),
        nextPassword: credentialForm.nextPassword,
      }),
    });

    mergeAuthPayload(payload);
    setFlash("账号密码已更新", "info");
    syncCredentialForm();
    await nasDeckRef.value?.hydrate();
    closeAuthPanel();
  }

  async function hydrateStatsOnly() {
    const payload = await requestJson("/api/workspace/stats");
    mergeStatsPayload(payload);
    serverReady.value = true;
  }

  async function hydrateServerSnapshot(announceSuccess = false) {
    try {
      const [workspacePayload, statsPayload] = await Promise.all([
        requestJson("/api/workspace"),
        requestJson("/api/workspace/stats"),
      ]);

      mergeWorkspacePayload(workspacePayload);
      mergeStatsPayload(statsPayload);
      serverReady.value = true;

      if (announceSuccess) {
        setFlash("服务端数据已刷新", "info");
      }
    } catch (error) {
      serverReady.value = false;
      setFlash("服务端同步失败，已切回本地回退", "error");
      console.error("Failed to hydrate workspace from server:", error);
    }
  }

  async function pushWorkspaceToServer() {
    const payload = await requestJson("/api/workspace", {
      method: "PUT",
      body: JSON.stringify({
        profile,
        pinnedIds: pinnedIds.value,
      }),
    });

    mergeWorkspacePayload(payload);
    serverReady.value = true;
    setFlash("工作台已写入服务器", "info");
  }

  function scheduleStatsRefresh() {
    window.clearTimeout(statsRefreshTimer.value);
    statsRefreshTimer.value = window.setTimeout(async () => {
      try {
        await hydrateStatsOnly();
      } catch (error) {
        serverReady.value = false;
        setFlash("统计同步失败", "error");
        console.error("Failed to refresh stats:", error);
      }
    }, 700);
  }

  async function togglePin(id) {
    const previous = [...pinnedIds.value];
    pinnedIds.value = pinnedIds.value.includes(id)
      ? pinnedIds.value.filter((itemId) => itemId !== id)
      : [id, ...pinnedIds.value].slice(0, 8);

    try {
      await pushWorkspaceToServer();
    } catch (error) {
      pinnedIds.value = previous;
      serverReady.value = false;
      setFlash("置顶入口保存失败", "error");
      console.error("Failed to persist pinned ids:", error);
    }
  }

  async function saveProfile() {
    const previous = { ...profile };
    Object.assign(profile, sanitizeProfile(draftProfile));

    try {
      await pushWorkspaceToServer();
      closeDrawer();
    } catch (error) {
      Object.assign(profile, previous);
      serverReady.value = false;
      setFlash("个人资料保存失败", "error");
      console.error("Failed to persist profile:", error);
    }
  }

  async function resetProfileToPreset() {
    const previous = { ...profile };
    Object.assign(profile, { ...profilePreset });
    syncDraftProfile();

    try {
      await pushWorkspaceToServer();
    } catch (error) {
      Object.assign(profile, previous);
      syncDraftProfile();
      serverReady.value = false;
      setFlash("恢复默认资料失败", "error");
      console.error("Failed to reset profile:", error);
    }
  }

  function trackLinkOpen(linkId) {
    if (!linkById.has(linkId)) {
      return;
    }

    todayClicks.value[linkId] = (todayClicks.value[linkId] ?? 0) + 1;

    const payload = JSON.stringify({ linkId });

    if (navigator.sendBeacon) {
      const data = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/link-events/open", data);
      scheduleStatsRefresh();
      return;
    }

    fetch("/api/link-events/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    })
      .then(() => {
        scheduleStatsRefresh();
      })
      .catch((error) => {
        serverReady.value = false;
        setFlash("点击统计写入失败", "error");
        console.error("Failed to record link click:", error);
      });
  }

  function openLinkFromPalette(item) {
    trackLinkOpen(item.id);
    closePalette();
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  function downloadJsonFile(fileName, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function exportWorkspaceBackup() {
    try {
      const payload = await requestJson("/api/workspace/export");
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJsonFile(`neon-pulse-nav-backup-${stamp}.json`, payload);
      setFlash("备份已导出到本地", "info");
    } catch (error) {
      serverReady.value = false;
      setFlash("导出备份失败", "error");
      console.error("Failed to export workspace:", error);
    }
  }

  async function importWorkspaceBackup(file) {
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const payload = JSON.parse(rawText);
      const result = await requestJson("/api/workspace/import", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      mergeWorkspacePayload(result.workspace ?? {});
      mergeStatsPayload(result.stats ?? {});
      setFlash("备份已导入并写回服务器", "info");
    } catch (error) {
      serverReady.value = false;
      setFlash("导入备份失败，请检查文件格式", "error");
      console.error("Failed to import workspace backup:", error);
    }
  }

  function onImportFileChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const [file] = target.files ?? [];
    importWorkspaceBackup(file).finally(() => {
      target.value = "";
    });
  }

  async function resetWorkspaceScope(scope) {
    const confirmMap = {
      history: "这会清空所有点击统计记录，但会保留资料和置顶入口。继续吗？",
      all: "这会把整个工作台恢复到默认状态，并清空点击统计。继续吗？",
    };

    if (confirmMap[scope] && !window.confirm(confirmMap[scope])) {
      return;
    }

    try {
      const result = await requestJson("/api/workspace/reset", {
        method: "POST",
        body: JSON.stringify({ scope }),
      });

      mergeWorkspacePayload(result.workspace ?? {});
      mergeStatsPayload(result.stats ?? {});
      setFlash(scope === "history" ? "点击统计已清空" : "工作台已重置为默认状态", "info");
    } catch (error) {
      serverReady.value = false;
      setFlash(scope === "history" ? "清空统计失败" : "重置工作台失败", "error");
      console.error("Failed to reset workspace scope:", error);
    }
  }

  function clearFilters() {
    query.value = "";
    activeCategory.value = CATEGORY_ALL;
  }

  function openDrawer() {
    closePalette();
    drawerOpen.value = true;
    syncDraftProfile();
  }

  function closeDrawer() {
    drawerOpen.value = false;
  }

  async function openAuthPanel() {
    closePalette();
    auth.panelOpen = true;
    if (auth.authenticated) {
      syncCredentialForm();
    } else {
      loginForm.username = auth.username || "";
      loginForm.password = "";
    }
    await nextTick();
  }

  function closeAuthPanel() {
    auth.panelOpen = false;
  }

  async function openPalette(initialQuery = "") {
    closeDrawer();
    closeAuthPanel();
    paletteOpen.value = true;
    paletteQuery.value = typeof initialQuery === "string" ? initialQuery : "";
    paletteIndex.value = 0;
    await nextTick();
  }

  function closePalette() {
    paletteOpen.value = false;
    paletteQuery.value = "";
    paletteIndex.value = 0;
  }

  function executePaletteEntry(index = paletteIndex.value) {
    const entry = paletteEntries.value[index];
    if (!entry) {
      return;
    }

    closePalette();
    entry.run();
  }

  function scrollToNavMatrix() {
    navMatrixRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cycleTheme() {
    themeIndex.value = (themeIndex.value + 1) % themes.length;
    setFlash(`已切换到 ${activeTheme.value.label}`, "info");
  }

  function getDockHint(entry) {
    if (entry.mode === "dynamic") {
      return `今日打开 ${entry.count} 次`;
    }

    if (entry.mode === "pinned") {
      return "手动置顶";
    }

    return entry.item.badge;
  }

  function getTrendLoopWidth() {
    const container = trendBarsRef.value;
    const sequence = container?.querySelector(".trend-sequence");
    return sequence instanceof HTMLElement ? sequence.offsetWidth : 0;
  }

  function syncTrendBarsViewport({ forceLatest = trendPinnedToLatest.value } = {}) {
    const container = trendBarsRef.value;
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const loopWidth = getTrendLoopWidth();
    if (!loopWidth) {
      return;
    }

    const latestOffset = loopWidth + Math.max(0, loopWidth - container.clientWidth);
    trendLoopSyncing.value = true;

    if (forceLatest) {
      container.scrollLeft = latestOffset;
    } else if (container.scrollLeft < loopWidth * 0.25 || container.scrollLeft > loopWidth * 1.75) {
      container.scrollLeft = latestOffset;
    }

    window.requestAnimationFrame(() => {
      trendLoopSyncing.value = false;
    });
  }

  function handleTrendScroll() {
    const container = trendBarsRef.value;
    if (!(container instanceof HTMLElement) || trendLoopSyncing.value) {
      return;
    }

    const loopWidth = getTrendLoopWidth();
    if (!loopWidth) {
      return;
    }

    if (container.scrollLeft < loopWidth * 0.25) {
      trendLoopSyncing.value = true;
      container.scrollLeft += loopWidth;
      window.requestAnimationFrame(() => {
        trendLoopSyncing.value = false;
      });
    } else if (container.scrollLeft > loopWidth * 1.75) {
      trendLoopSyncing.value = true;
      container.scrollLeft -= loopWidth;
      window.requestAnimationFrame(() => {
        trendLoopSyncing.value = false;
      });
    }

    const maxOffset = Math.max(0, container.scrollWidth - container.clientWidth);
    trendPinnedToLatest.value = maxOffset - container.scrollLeft <= 12;
  }

  function handleTrendWheel(event) {
    const container = trendBarsRef.value;
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      container.scrollLeft += event.deltaY;
    }
  }

  function handleChildNotify(payload) {
    if (payload?.message) {
      setFlash(payload.message, payload.tone || "info");
    }
  }

  async function initScene() {
    try {
      const { createNebulaScene } = await import("../scene/nebula-scene.js");
      scene.value = createNebulaScene(fxCanvasRef.value, activeTheme.value.key);
      fxReady.value = true;
    } catch (error) {
      fxReady.value = false;
      console.error("Three.js scene failed to initialize:", error);
    }
  }

  function onDocumentKeydown(event) {
    const activeElement = document.activeElement;
    const isTyping =
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (paletteOpen.value) {
        closePalette();
      } else {
        openPalette();
      }
      return;
    }

    if (paletteOpen.value) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        paletteIndex.value = Math.min(paletteIndex.value + 1, Math.max(paletteEntries.value.length - 1, 0));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        paletteIndex.value = Math.max(paletteIndex.value - 1, 0);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        executePaletteEntry(paletteIndex.value);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
        return;
      }
    }

    if (event.key === "/" && !isTyping && !drawerOpen.value) {
      event.preventDefault();
      searchInputRef.value?.focus();
      searchInputRef.value?.select();
    }

    if (event.key.toLowerCase() === "t" && !isTyping && !drawerOpen.value && !auth.panelOpen) {
      cycleTheme();
    }

    if (event.key === "Escape" && drawerOpen.value) {
      closeDrawer();
    } else if (event.key === "Escape" && auth.panelOpen) {
      closeAuthPanel();
    } else if (event.key === "Escape" && isTyping) {
      searchInputRef.value?.blur();
    }
  }

  watch(
    themeIndex,
    (nextIndex) => {
      const theme = themes[nextIndex] ?? themes[0];
      document.body.dataset.theme = theme.key;
      window.localStorage.setItem(THEME_STORAGE_KEY, theme.key);
      scene.value?.setTheme(theme.key);
    },
    { immediate: true }
  );

  watch(drawerOpen, (open) => {
    document.body.classList.toggle("drawer-open", open);
  });

  watch(
    () => auth.panelOpen,
    (open) => {
      document.body.classList.toggle("auth-open", open);
    }
  );

  watch(paletteOpen, (open) => {
    document.body.classList.toggle("palette-open", open);
  });

  watch(
    () => statsModel.value.recentDays.map((item) => `${item.dateKey}:${item.total}`).join("|"),
    async () => {
      await nextTick();
      syncTrendBarsViewport();
    }
  );

  onMounted(async () => {
    coarsePointer.value = window.matchMedia("(pointer: coarse)").matches;
    syncViewportFlags();
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextThemeIndex = themes.findIndex((item) => item.key === savedTheme);
    themeIndex.value = nextThemeIndex >= 0 ? nextThemeIndex : 0;
    currentFocusLine.value = focusLines[Math.floor(Math.random() * focusLines.length)];
    syncDraftProfile();

    document.addEventListener("keydown", onDocumentKeydown);
    window.addEventListener("resize", syncViewportFlags);
    await initScene();

    try {
      await hydrateAuthSession();
    } catch (error) {
      mergeAuthPayload({ authenticated: false, username: "" });
      console.error("Failed to hydrate auth session:", error);
    }

    if (auth.authenticated) {
      syncCredentialForm();
    }

    await hydrateServerSnapshot(false);
    await nextTick();
    await nasDeckRef.value?.hydrate();
    syncTrendBarsViewport({ forceLatest: true });

    flashTimerId.value = window.setInterval(() => {
      clearFlash();
    }, 30_000);

    clockTimerId.value = window.setInterval(() => {
      currentTime.value = new Date();
    }, 250);

    focusTimerId.value = window.setInterval(() => {
      currentFocusLine.value = focusLines[Math.floor(Math.random() * focusLines.length)];
    }, 5200);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onDocumentKeydown);
    window.removeEventListener("resize", syncViewportFlags);
    document.body.classList.remove("drawer-open", "auth-open", "palette-open");
    scene.value?.destroy?.();
    window.clearTimeout(statsRefreshTimer.value);
    window.clearInterval(flashTimerId.value);
    window.clearInterval(clockTimerId.value);
    window.clearInterval(focusTimerId.value);
  });

  return {
    CATEGORY_ALL,
    activeTheme,
    auth,
    clockCardStyle,
    clockDateLabel,
    clockPhase,
    coarsePointer,
    compactViewport,
    controlChips,
    controlSummary,
    credentialState,
    credentialForm,
    currentFocusLine,
    dataSyncNote,
    dockEntries,
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
    loginState,
    loginForm,
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
    pinnedIds,
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
    shortcutItems,
    spotlightItem,
    spotlightModeLabel,
    spotlightQueue,
    statsModel,
    strongestTrendDay,
    statusLine,
    syncSummaryText,
    themeIndex,
    todayClicks,
    todayOpenTotal,
    topRoutes,
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
    categories,
    activeCategory,
    closeAuthPanel,
    closeDrawer,
    closePalette,
    cycleTheme,
    executePaletteEntry,
    exportWorkspaceBackup,
    hydrateServerSnapshot,
    isPinned: (id) => pinnedIds.value.includes(id),
    loginToWorkspace,
    logoutFromWorkspace,
  };
}
