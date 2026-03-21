import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Docker from "dockerode";
import { parseFile } from "music-metadata";

const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".wav", ".m4a", ".ogg", ".aac"]);
const MIME_BY_EXTENSION = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const MUSIC_CACHE_TTL = 15_000;
const DOCKER_STATS_TTL = 10_000;
const DOCKER_INFO_TTL = 5_000;
const MESSAGE_LIMIT = 40;
const MESSAGE_LENGTH_LIMIT = 240;
const VALID_UPLOAD_TARGETS = new Set(["transfer", "music"]);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSafeMimeType(fileName, fallback = "application/octet-stream") {
  const extension = path.extname(fileName).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? fallback;
}

function sanitizeBaseName(fileName) {
  const safeName = path
    .basename(fileName)
    .replace(/[^\p{Letter}\p{Number}._ -]+/gu, "-")
    .replace(/\s+/g, " ")
    .trim();

  return safeName || "upload.bin";
}

function encodeRelativeId(relativePath) {
  return Buffer.from(relativePath).toString("base64url");
}

function decodeRelativeId(id) {
  return Buffer.from(id, "base64url").toString("utf8");
}

function formatTransferItem(item) {
  return {
    id: item.id,
    name: item.name,
    size: item.size,
    mime: item.mime,
    createdAt: item.createdAt,
    downloadUrl: `/api/nas/transfer/files/${item.id}`,
  };
}

function sanitizeMessageBody(body) {
  if (typeof body !== "string") {
    return "";
  }

  return body.trim().slice(0, MESSAGE_LENGTH_LIMIT);
}

async function ensureDir(dirPath) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fsPromises.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  const tempFile = `${filePath}.tmp`;
  await fsPromises.writeFile(tempFile, JSON.stringify(payload, null, 2), "utf8");
  await fsPromises.rename(tempFile, filePath);
}

async function walkDirectory(rootDir, accumulator = [], currentDir = rootDir) {
  const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(rootDir, accumulator, fullPath);
      continue;
    }

    accumulator.push(fullPath);
  }

  return accumulator;
}

function parseDockerStats(rawStats) {
  const cpuStats = rawStats.cpu_stats ?? {};
  const preCpuStats = rawStats.precpu_stats ?? {};
  const cpuDelta =
    (cpuStats.cpu_usage?.total_usage ?? 0) - (preCpuStats.cpu_usage?.total_usage ?? 0);
  const systemDelta = (cpuStats.system_cpu_usage ?? 0) - (preCpuStats.system_cpu_usage ?? 0);
  const onlineCpus =
    cpuStats.online_cpus || cpuStats.cpu_usage?.percpu_usage?.length || 1;
  const cpuPercent =
    systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

  const memoryStats = rawStats.memory_stats ?? {};
  const memoryUsage = memoryStats.usage ?? 0;
  const memoryLimit = memoryStats.limit ?? 0;
  const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

  let networkRx = 0;
  let networkTx = 0;
  for (const network of Object.values(rawStats.networks ?? {})) {
    networkRx += network.rx_bytes ?? 0;
    networkTx += network.tx_bytes ?? 0;
  }

  return {
    cpuPercent: Number(cpuPercent.toFixed(2)),
    memoryUsage,
    memoryLimit,
    memoryPercent: Number(memoryPercent.toFixed(2)),
    networkRx,
    networkTx,
  };
}

export class NasBridge {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.bridgeDir = path.join(this.dataDir, "nas-bridge");
    this.transferDir = path.resolve(
      process.env.NAS_TRANSFER_DIR || path.join(this.bridgeDir, "transfer")
    );
    this.musicDir = path.resolve(process.env.NAS_MUSIC_DIR || path.join(this.bridgeDir, "music"));
    this.transferIndexFile = path.join(this.bridgeDir, "transfer-index.json");
    this.messageBoardFile = path.join(this.bridgeDir, "transfer-messages.json");
    this.uploadSessionDir = path.join(this.bridgeDir, "upload-sessions");
    this.dockerSocketPath = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock";
    this.transferIndex = { items: [] };
    this.messageBoard = { messages: [] };
    this.musicCache = {
      expiresAt: 0,
      tracks: [],
    };
    this.musicCacheVersion = 0;
    this.musicScanPromise = null;
    this.dockerInfoCache = {
      expiresAt: 0,
      value: null,
    };
    this.dockerInfoPromise = null;
    this.dockerStatsCache = new Map();
    this.docker = null;
  }

  async init() {
    await ensureDir(this.bridgeDir);
    await ensureDir(this.transferDir);
    await ensureDir(this.musicDir);
    await ensureDir(this.uploadSessionDir);

    this.transferIndex = await readJson(this.transferIndexFile, { items: [] });
    this.transferIndex.items = ensureArray(this.transferIndex.items);
    this.messageBoard = await readJson(this.messageBoardFile, { messages: [] });
    this.messageBoard.messages = ensureArray(this.messageBoard.messages);
    await this.persistTransferIndex();
    await this.persistMessageBoard();
    await this.cleanupExpiredUploadSessions();
  }

  async persistTransferIndex() {
    await writeJson(this.transferIndexFile, {
      items: this.transferIndex.items
        .slice()
        .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0)),
    });
  }

  async persistMessageBoard() {
    await writeJson(this.messageBoardFile, {
      messages: this.messageBoard.messages
        .slice()
        .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0)),
    });
  }

  async cleanupExpiredUploadSessions() {
    const sessionEntries = await fsPromises.readdir(this.uploadSessionDir, {
      withFileTypes: true,
    });
    const now = Date.now();

    for (const entry of sessionEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const sessionPath = path.join(this.uploadSessionDir, entry.name, "session.json");
      const session = await readJson(sessionPath, null);

      if (!session) {
        continue;
      }

      if (now - (session.createdAt ?? 0) > 24 * 60 * 60 * 1000) {
        await fsPromises.rm(path.join(this.uploadSessionDir, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }
  }

  getOverview() {
    return {
      transfer: {
        rootDir: this.transferDir,
        totalItems: this.transferIndex.items.length,
      },
      music: {
        rootDir: this.musicDir,
      },
      docker: {
        socketPath: this.dockerSocketPath,
      },
    };
  }

  listTransferItems({ limit = 20 } = {}) {
    return this.transferIndex.items
      .slice()
      .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
      .slice(0, limit)
      .map(formatTransferItem);
  }

  listMessages({ limit = 12 } = {}) {
    return this.messageBoard.messages
      .slice()
      .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
      .slice(0, limit);
  }

  async addMessage({ body, author }) {
    const nextBody = sanitizeMessageBody(body);
    const nextAuthor = typeof author === "string" && author.trim() ? author.trim().slice(0, 32) : "Anonymous";

    if (!nextBody) {
      throw new Error("Message body is required");
    }

    const message = {
      id: randomUUID(),
      body: nextBody,
      author: nextAuthor,
      createdAt: Date.now(),
    };

    this.messageBoard.messages = [message, ...this.messageBoard.messages].slice(0, MESSAGE_LIMIT);
    await this.persistMessageBoard();
    return message;
  }

  async initUpload({ fileName, size, mime }) {
    return this.initScopedUpload({
      fileName,
      size,
      mime,
      target: "transfer",
    });
  }

  async initMusicUpload({ fileName, size, mime }) {
    return this.initScopedUpload({
      fileName,
      size,
      mime,
      target: "music",
    });
  }

  async initScopedUpload({ fileName, size, mime, target = "transfer" }) {
    if (!fileName || !Number.isFinite(Number(size)) || Number(size) <= 0) {
      throw new Error("Invalid upload payload");
    }

    if (!VALID_UPLOAD_TARGETS.has(target)) {
      throw new Error("Invalid upload target");
    }

    const uploadId = randomUUID();
    const chunkSize = DEFAULT_CHUNK_SIZE;
    const totalChunks = Math.ceil(Number(size) / chunkSize);
    const sessionDir = path.join(this.uploadSessionDir, uploadId);
    const session = {
      id: uploadId,
      fileName: sanitizeBaseName(fileName),
      size: Number(size),
      mime: typeof mime === "string" && mime ? mime : getSafeMimeType(fileName),
      target,
      chunkSize,
      totalChunks,
      createdAt: Date.now(),
      uploaded: [],
    };

    await ensureDir(sessionDir);
    await writeJson(path.join(sessionDir, "session.json"), session);

    return {
      uploadId,
      chunkSize,
      totalChunks,
      uploaded: [],
    };
  }

  async saveUploadChunk({ uploadId, index, buffer }) {
    const session = await this.getUploadSession(uploadId);

    if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) {
      throw new Error("Invalid chunk index");
    }

    const chunkPath = path.join(this.uploadSessionDir, uploadId, `${index}.part`);
    await fsPromises.writeFile(chunkPath, buffer);

    if (!session.uploaded.includes(index)) {
      session.uploaded.push(index);
      session.uploaded.sort((left, right) => left - right);
      await writeJson(path.join(this.uploadSessionDir, uploadId, "session.json"), session);
    }

    return {
      uploadId,
      uploaded: session.uploaded,
      totalChunks: session.totalChunks,
    };
  }

  async completeUpload(uploadId) {
    const session = await this.getUploadSession(uploadId);
    const sessionDir = path.join(this.uploadSessionDir, uploadId);

    for (let index = 0; index < session.totalChunks; index += 1) {
      const chunkPath = path.join(sessionDir, `${index}.part`);
      await fsPromises.access(chunkPath);
    }

    const targetName = `${Date.now()}--${session.fileName}`;
    const targetDir = session.target === "music" ? this.musicDir : this.transferDir;
    const finalPath = path.join(targetDir, targetName);
    const output = fs.createWriteStream(finalPath);

    for (let index = 0; index < session.totalChunks; index += 1) {
      const chunkPath = path.join(sessionDir, `${index}.part`);
      await new Promise((resolve, reject) => {
        const input = fs.createReadStream(chunkPath);
        input.on("error", reject);
        input.on("end", resolve);
        input.pipe(output, { end: false });
      });
    }

    await new Promise((resolve, reject) => {
      output.end((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    const item = {
      id: randomUUID(),
      name: session.fileName,
      size: session.size,
      mime: session.mime || getSafeMimeType(session.fileName),
      storedName: targetName,
      createdAt: Date.now(),
    };

    if (session.target === "music") {
      this.invalidateMusicCache();
    } else {
      this.transferIndex.items = [item, ...this.transferIndex.items].slice(0, 200);
      await this.persistTransferIndex();
    }

    await fsPromises.rm(sessionDir, { recursive: true, force: true });

    return session.target === "music"
      ? {
          id: encodeRelativeId(targetName),
          name: session.fileName,
          size: session.size,
          mime: item.mime,
        }
      : formatTransferItem(item);
  }

  async getUploadSession(uploadId) {
    const sessionPath = path.join(this.uploadSessionDir, uploadId, "session.json");
    const session = await readJson(sessionPath, null);

    if (!session) {
      throw new Error("Upload session not found");
    }

    return session;
  }

  getTransferItemById(itemId) {
    return this.transferIndex.items.find((item) => item.id === itemId) ?? null;
  }

  resolveTransferFilePath(itemId) {
    const item = this.getTransferItemById(itemId);

    if (!item) {
      throw new Error("Transfer file not found");
    }

    return {
      item,
      filePath: path.join(this.transferDir, item.storedName),
    };
  }

  async deleteTransferItem(itemId) {
    const item = this.getTransferItemById(itemId);

    if (!item) {
      throw new Error("Transfer file not found");
    }

    const filePath = path.join(this.transferDir, item.storedName);
    await fsPromises.rm(filePath, { force: true });
    this.transferIndex.items = this.transferIndex.items.filter((entry) => entry.id !== itemId);
    await this.persistTransferIndex();

    return formatTransferItem(item);
  }

  async listMusicTracks({ force = false } = {}) {
    if (force) {
      this.invalidateMusicCache();
    }

    if (Date.now() < this.musicCache.expiresAt) {
      return this.musicCache.tracks;
    }

    if (this.musicScanPromise) {
      return this.musicScanPromise;
    }

    const cacheVersion = this.musicCacheVersion;
    const scanPromise = (async () => {
      const filePaths = await walkDirectory(this.musicDir, []);
      const trackPaths = filePaths.filter((filePath) =>
        AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
      );

      const tracks = [];

      for (const filePath of trackPaths) {
        const relativePath = path.relative(this.musicDir, filePath);
        let metadata = null;

        try {
          metadata = await parseFile(filePath, { duration: true });
        } catch {}

        const stats = await fsPromises.stat(filePath);
        const common = metadata?.common ?? {};
        const fallbackTitle = path.basename(filePath, path.extname(filePath));

        tracks.push({
          id: encodeRelativeId(relativePath),
          title: common.title || fallbackTitle,
          artist: common.artist || "Unknown Artist",
          album: common.album || "Unknown Album",
          duration: metadata?.format?.duration
            ? Math.round(metadata.format.duration)
            : null,
          size: stats.size,
          updatedAt: stats.mtimeMs,
          streamUrl: `/api/nas/music/stream/${encodeRelativeId(relativePath)}`,
        });
      }

      tracks.sort((left, right) => left.title.localeCompare(right.title));

      if (cacheVersion === this.musicCacheVersion) {
        this.musicCache = {
          expiresAt: Date.now() + MUSIC_CACHE_TTL,
          tracks,
        };
      }

      return tracks;
    })();
    this.musicScanPromise = scanPromise;

    try {
      return await scanPromise;
    } finally {
      if (this.musicScanPromise === scanPromise) {
        this.musicScanPromise = null;
      }
    }
  }

  async getMusicSummary() {
    const tracks = await this.listMusicTracks();
    return {
      rootDir: this.musicDir,
      totalTracks: tracks.length,
    };
  }

  async resolveTrack(trackId) {
    const relativePath = decodeRelativeId(trackId);
    const fullPath = path.resolve(this.musicDir, relativePath);
    const normalizedRelative = path.relative(this.musicDir, fullPath);

    if (normalizedRelative.startsWith("..") || path.isAbsolute(normalizedRelative)) {
      throw new Error("Invalid track path");
    }

    await fsPromises.access(fullPath);

    return {
      filePath: fullPath,
      mime: getSafeMimeType(fullPath, "audio/mpeg"),
    };
  }

  async deleteTrack(trackId) {
    const relativePath = decodeRelativeId(trackId);
    const fullPath = path.resolve(this.musicDir, relativePath);
    const normalizedRelative = path.relative(this.musicDir, fullPath);

    if (normalizedRelative.startsWith("..") || path.isAbsolute(normalizedRelative)) {
      throw new Error("Invalid track path");
    }

    await fsPromises.rm(fullPath, { force: true });
    this.invalidateMusicCache();

    return {
      id: trackId,
    };
  }

  invalidateMusicCache() {
    this.musicCacheVersion += 1;
    this.musicCache = {
      expiresAt: 0,
      tracks: [],
    };
    this.musicScanPromise = null;
  }

  getDockerClient() {
    if (this.docker) {
      return this.docker;
    }

    this.docker = new Docker({
      socketPath: this.dockerSocketPath,
    });

    return this.docker;
  }

  async getDockerInfo() {
    if (Date.now() < this.dockerInfoCache.expiresAt && this.dockerInfoCache.value) {
      return this.dockerInfoCache.value;
    }

    if (this.dockerInfoPromise) {
      return this.dockerInfoPromise;
    }

    this.dockerInfoPromise = (async () => {
      let result;

      try {
        if (!(await fsPromises.stat(this.dockerSocketPath)).isSocket?.()) {
          // continue even if stat cannot classify socket reliably across platforms
        }
      } catch (error) {
        result = {
          available: false,
          socketPath: this.dockerSocketPath,
          error: `Docker socket not found: ${error.message}`,
        };
        this.dockerInfoCache = {
          expiresAt: Date.now() + DOCKER_INFO_TTL,
          value: result,
        };
        return result;
      }

      try {
        const docker = this.getDockerClient();
        await docker.ping();
        const version = await docker.version();

        result = {
          available: true,
          socketPath: this.dockerSocketPath,
          engineVersion: version.Version,
          apiVersion: version.ApiVersion,
        };
      } catch (error) {
        result = {
          available: false,
          socketPath: this.dockerSocketPath,
          error: error.message,
        };
      }

      this.dockerInfoCache = {
        expiresAt: Date.now() + DOCKER_INFO_TTL,
        value: result,
      };

      return result;
    })();

    try {
      return await this.dockerInfoPromise;
    } finally {
      this.dockerInfoPromise = null;
    }
  }

  async listContainers() {
    const info = await this.getDockerInfo();

    if (!info.available) {
      return {
        ...info,
        containers: [],
      };
    }

    const docker = this.getDockerClient();
    const containers = await docker.listContainers({ all: true });
    const containerIds = new Set(containers.map((container) => container.Id));
    for (const cachedId of this.dockerStatsCache.keys()) {
      if (!containerIds.has(cachedId)) {
        this.dockerStatsCache.delete(cachedId);
      }
    }
    const enriched = await Promise.all(
      containers.map(async (container) => {
        const details = {
          id: container.Id,
          name: container.Names?.[0]?.replace(/^\//, "") || container.Id.slice(0, 12),
          image: container.Image,
          state: container.State,
          status: container.Status,
          ports: ensureArray(container.Ports),
          created: container.Created,
          stats: null,
        };

        if (container.State !== "running") {
          return details;
        }

        const cacheEntry = this.dockerStatsCache.get(container.Id);
        if (cacheEntry && Date.now() - cacheEntry.createdAt < DOCKER_STATS_TTL) {
          return {
            ...details,
            stats: cacheEntry.stats,
          };
        }

        try {
          const rawStats = await docker.getContainer(container.Id).stats({ stream: false });
          const stats = parseDockerStats(rawStats);
          this.dockerStatsCache.set(container.Id, {
            createdAt: Date.now(),
            stats,
          });

          return {
            ...details,
            stats,
          };
        } catch {
          return details;
        }
      })
    );

    return {
      ...info,
      containers: enriched,
    };
  }

  async runContainerAction(containerId, action) {
    const info = await this.getDockerInfo();

    if (!info.available) {
      throw new Error(info.error || "Docker unavailable");
    }

    const container = this.getDockerClient().getContainer(containerId);

    if (action === "start") {
      await container.start();
    } else if (action === "stop") {
      await container.stop();
    } else if (action === "restart") {
      await container.restart();
    } else {
      throw new Error("Unsupported container action");
    }

    this.dockerStatsCache.delete(containerId);
    this.dockerInfoCache = {
      expiresAt: 0,
      value: null,
    };
  }
}

export async function streamFileWithRange({
  filePath,
  mimeType,
  request,
  response,
  downloadName,
}) {
  const stats = await fsPromises.stat(filePath);
  const range = request.headers.range;

  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Content-Type", mimeType);

  if (!range) {
    response.setHeader("Content-Length", stats.size);
    if (downloadName) {
      response.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      );
    }
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  const [startText, endText] = String(range).replace("bytes=", "").split("-");
  const start = Number(startText);
  const end = endText ? Number(endText) : stats.size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= stats.size) {
    response.status(416).end();
    return;
  }

  response.status(206);
  response.setHeader("Content-Length", end - start + 1);
  response.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);

  fs.createReadStream(filePath, { start, end }).pipe(response);
}
