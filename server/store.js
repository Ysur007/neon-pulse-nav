import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { links, profilePreset } from "../src/data/content.js";

const PROFILE_LIMITS = {
  alias: 24,
  title: 48,
  intro: 160,
  signature: 120,
  status: 36,
  location: 36,
  primaryFocus: 48,
  secondaryFocus: 48,
};

const EXPORT_VERSION = 1;
const MAX_PINNED = 8;
const MAX_HISTORY_DAYS = 45;
const RECENT_DAYS_WINDOW = 7;
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin";
const USERNAME_LIMIT = 32;
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MAX_LENGTH = 64;
const VALID_LINK_IDS = new Set(links.map((item) => item.id).filter(Boolean));
const linkMetaById = new Map(
  links.map((item) => [
    item.id,
    {
      title: item.title,
      category: item.category,
      url: item.url,
      glyph: item.glyph,
      badge: item.badge,
    },
  ])
);

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

function sanitizeString(value, fallback, maxLength) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function sanitizeUsername(value, fallback = DEFAULT_USERNAME) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, USERNAME_LIMIT) : fallback;
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function createAuthState(username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD) {
  const nextUsername = sanitizeUsername(username);
  const salt = randomBytes(16).toString("hex");

  return {
    username: nextUsername,
    salt,
    passwordHash: hashPassword(password, salt),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeAuthState(rawAuth = {}) {
  if (
    rawAuth &&
    typeof rawAuth === "object" &&
    !Array.isArray(rawAuth) &&
    typeof rawAuth.username === "string" &&
    typeof rawAuth.salt === "string" &&
    typeof rawAuth.passwordHash === "string" &&
    rawAuth.username.trim() &&
    rawAuth.salt &&
    rawAuth.passwordHash
  ) {
    return {
      username: sanitizeUsername(rawAuth.username),
      salt: rawAuth.salt,
      passwordHash: rawAuth.passwordHash,
      updatedAt:
        typeof rawAuth.updatedAt === "string" && rawAuth.updatedAt
          ? rawAuth.updatedAt
          : new Date().toISOString(),
    };
  }

  return createAuthState();
}

function verifyPassword(authState, password) {
  if (typeof password !== "string" || !password) {
    return false;
  }

  const expected = Buffer.from(authState.passwordHash, "hex");
  const actual = Buffer.from(hashPassword(password, authState.salt), "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

function sanitizeProfile(profile = {}) {
  return {
    alias: sanitizeString(profile.alias, profilePreset.alias, PROFILE_LIMITS.alias),
    title: sanitizeString(profile.title, profilePreset.title, PROFILE_LIMITS.title),
    intro: sanitizeString(profile.intro, profilePreset.intro, PROFILE_LIMITS.intro),
    signature: sanitizeString(
      profile.signature,
      profilePreset.signature,
      PROFILE_LIMITS.signature
    ),
    status: sanitizeString(profile.status, profilePreset.status, PROFILE_LIMITS.status),
    location: sanitizeString(profile.location, profilePreset.location, PROFILE_LIMITS.location),
    primaryFocus: sanitizeString(
      profile.primaryFocus,
      profilePreset.primaryFocus,
      PROFILE_LIMITS.primaryFocus
    ),
    secondaryFocus: sanitizeString(
      profile.secondaryFocus,
      profilePreset.secondaryFocus,
      PROFILE_LIMITS.secondaryFocus
    ),
  };
}

function sanitizePinnedIds(pinnedIds = []) {
  if (!Array.isArray(pinnedIds)) {
    return [];
  }

  return [...new Set(pinnedIds)]
    .filter((id) => typeof id === "string" && VALID_LINK_IDS.has(id))
    .slice(0, MAX_PINNED);
}

function sanitizeClicksByDay(clicksByDay = {}) {
  if (!clicksByDay || typeof clicksByDay !== "object" || Array.isArray(clicksByDay)) {
    return {};
  }

  const sanitized = {};

  for (const [dateKey, dayClicks] of Object.entries(clicksByDay)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !dayClicks || typeof dayClicks !== "object") {
      continue;
    }

    const validDayClicks = {};

    for (const [linkId, count] of Object.entries(dayClicks)) {
      if (!VALID_LINK_IDS.has(linkId)) {
        continue;
      }

      const numericCount = Number(count);

      if (Number.isFinite(numericCount) && numericCount > 0) {
        validDayClicks[linkId] = Math.floor(numericCount);
      }
    }

    if (Object.keys(validDayClicks).length) {
      sanitized[dateKey] = validDayClicks;
    }
  }

  return sanitized;
}

function pruneClicksByDay(clicksByDay) {
  const entries = Object.entries(clicksByDay).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  if (entries.length <= MAX_HISTORY_DAYS) {
    return clicksByDay;
  }

  return Object.fromEntries(entries.slice(-MAX_HISTORY_DAYS));
}

function normalizeState(rawState = {}) {
  return {
    profile: sanitizeProfile(rawState.profile),
    pinnedIds: sanitizePinnedIds(rawState.pinnedIds),
    clicksByDay: pruneClicksByDay(sanitizeClicksByDay(rawState.clicksByDay)),
    auth: sanitizeAuthState(rawState.auth),
    updatedAt:
      typeof rawState.updatedAt === "string" && rawState.updatedAt
        ? rawState.updatedAt
        : new Date().toISOString(),
  };
}

function sumDayClicks(dayClicks = {}) {
  return Object.values(dayClicks).reduce((total, count) => total + count, 0);
}

function buildRankedEntries(clickMap = {}, limit = 5) {
  return Object.entries(clickMap)
    .filter(([linkId, count]) => VALID_LINK_IDS.has(linkId) && Number(count) > 0)
    .sort(([leftId, leftCount], [rightId, rightCount]) => {
      if (rightCount !== leftCount) {
        return rightCount - leftCount;
      }

      const leftTitle = linkMetaById.get(leftId)?.title ?? leftId;
      const rightTitle = linkMetaById.get(rightId)?.title ?? rightId;
      return leftTitle.localeCompare(rightTitle);
    })
    .slice(0, limit)
    .map(([linkId, count]) => {
      const meta = linkMetaById.get(linkId);
      return {
        linkId,
        title: meta?.title ?? linkId,
        category: meta?.category ?? "Other",
        url: meta?.url ?? "",
        glyph: meta?.glyph ?? "LK",
        badge: meta?.badge ?? "",
        count,
      };
    });
}

function aggregateClicksForDays(clicksByDay, dateKeys) {
  const totals = {};

  for (const dateKey of dateKeys) {
    const dayClicks = clicksByDay[dateKey] ?? {};

    for (const [linkId, count] of Object.entries(dayClicks)) {
      totals[linkId] = (totals[linkId] ?? 0) + count;
    }
  }

  return totals;
}

function resolveImportedState(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  if (payload.workspace && typeof payload.workspace === "object" && !Array.isArray(payload.workspace)) {
    return payload.workspace;
  }

  return payload;
}

export class WorkspaceStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.stateFile = path.join(this.dataDir, "workspace-state.json");
    this.state = normalizeState();
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      const rawText = await fs.readFile(this.stateFile, "utf8");
      this.state = normalizeState(JSON.parse(rawText));
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("Failed to read workspace state, using defaults:", error);
      }

      await this.persist();
    }
  }

  getWorkspacePayload() {
    const todayKey = getLocalDateKey();

    return {
      profile: this.state.profile,
      pinnedIds: this.state.pinnedIds,
      todayClicks: this.state.clicksByDay[todayKey] ?? {},
      updatedAt: this.state.updatedAt,
    };
  }

  getAuthPayload() {
    return {
      username: this.state.auth.username,
      updatedAt: this.state.auth.updatedAt,
    };
  }

  verifyCredentials(username, password) {
    return (
      sanitizeUsername(username, "") === this.state.auth.username &&
      verifyPassword(this.state.auth, password)
    );
  }

  getStatsPayload() {
    const todayKey = getLocalDateKey();
    const recentDateKeys = getRecentDateKeys();
    const todayClicks = this.state.clicksByDay[todayKey] ?? {};
    const recentDays = recentDateKeys.map((dateKey) => ({
      dateKey,
      total: sumDayClicks(this.state.clicksByDay[dateKey] ?? {}),
    }));
    const weeklyClicks = aggregateClicksForDays(this.state.clicksByDay, recentDateKeys);
    const totalOpenCount = Object.values(this.state.clicksByDay).reduce(
      (total, dayClicks) => total + sumDayClicks(dayClicks),
      0
    );

    return {
      updatedAt: this.state.updatedAt,
      todayKey,
      todayTotal: sumDayClicks(todayClicks),
      weeklyTotal: recentDays.reduce((total, day) => total + day.total, 0),
      totalTrackedDays: Object.keys(this.state.clicksByDay).length,
      totalOpenCount,
      topToday: buildRankedEntries(todayClicks, 5),
      topWeek: buildRankedEntries(weeklyClicks, 6),
      recentDays,
    };
  }

  exportWorkspace() {
    const { auth, ...workspace } = this.state;
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      workspace,
      stats: this.getStatsPayload(),
    };
  }

  async updateWorkspace(payload = {}) {
    this.state = {
      ...this.state,
      profile: sanitizeProfile(payload.profile ?? this.state.profile),
      pinnedIds: sanitizePinnedIds(payload.pinnedIds ?? this.state.pinnedIds),
      updatedAt: new Date().toISOString(),
    };

    await this.persist();
    return this.getWorkspacePayload();
  }

  async importWorkspace(payload = {}) {
    const importedState = normalizeState({
      ...resolveImportedState(payload),
      auth: this.state.auth,
    });

    this.state = {
      ...importedState,
      auth: this.state.auth,
      updatedAt: new Date().toISOString(),
    };

    await this.persist();
    return {
      workspace: this.getWorkspacePayload(),
      stats: this.getStatsPayload(),
    };
  }

  async resetWorkspace(scope = "all") {
    const nextUpdatedAt = new Date().toISOString();

    if (scope === "profile") {
      this.state = {
        ...this.state,
        profile: sanitizeProfile(),
        updatedAt: nextUpdatedAt,
      };
    } else if (scope === "pins") {
      this.state = {
        ...this.state,
        pinnedIds: [],
        updatedAt: nextUpdatedAt,
      };
    } else if (scope === "history") {
      this.state = {
        ...this.state,
        clicksByDay: {},
        updatedAt: nextUpdatedAt,
      };
    } else {
      this.state = {
        ...normalizeState(),
        auth: this.state.auth,
        updatedAt: nextUpdatedAt,
      };
    }

    await this.persist();
    return {
      workspace: this.getWorkspacePayload(),
      stats: this.getStatsPayload(),
    };
  }

  async recordLinkOpen(linkId) {
    if (!VALID_LINK_IDS.has(linkId)) {
      return false;
    }

    const todayKey = getLocalDateKey();
    const nextDayClicks = {
      ...(this.state.clicksByDay[todayKey] ?? {}),
      [linkId]: (this.state.clicksByDay[todayKey]?.[linkId] ?? 0) + 1,
    };

    this.state = {
      ...this.state,
      clicksByDay: pruneClicksByDay({
        ...this.state.clicksByDay,
        [todayKey]: nextDayClicks,
      }),
      updatedAt: new Date().toISOString(),
    };

    await this.persist();
    return true;
  }

  async updateCredentials({
    currentUsername,
    currentPassword,
    nextUsername,
    nextPassword,
  } = {}) {
    const sanitizedNextUsername = sanitizeUsername(nextUsername, "");
    const normalizedCurrentUsername = sanitizeUsername(currentUsername, "");

    if (normalizedCurrentUsername !== this.state.auth.username) {
      throw new Error("当前账号不正确");
    }

    if (!verifyPassword(this.state.auth, currentPassword)) {
      throw new Error("当前密码不正确");
    }

    if (!sanitizedNextUsername) {
      throw new Error("新账号不能为空");
    }

    if (typeof nextPassword !== "string" || nextPassword.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`新密码至少需要 ${PASSWORD_MIN_LENGTH} 位`);
    }

    if (nextPassword.length > PASSWORD_MAX_LENGTH) {
      throw new Error(`新密码不能超过 ${PASSWORD_MAX_LENGTH} 位`);
    }

    this.state = {
      ...this.state,
      auth: createAuthState(sanitizedNextUsername, nextPassword),
      updatedAt: new Date().toISOString(),
    };

    await this.persist();
    return this.getAuthPayload();
  }

  async persist() {
    const snapshot = JSON.stringify(this.state, null, 2);

    this.writeChain = this.writeChain.then(async () => {
      const tempFile = `${this.stateFile}.tmp`;
      await fs.writeFile(tempFile, snapshot, "utf8");
      await fs.rename(tempFile, this.stateFile);
    });

    return this.writeChain;
  }
}
