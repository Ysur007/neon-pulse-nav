import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import express from "express";
import { fileURLToPath } from "node:url";
import { NasBridge, streamFileWithRange } from "./nas-bridge.js";
import { WorkspaceStore } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(rootDir, "data");
const port = Number(process.env.PORT || 3000);
const SESSION_COOKIE_NAME = "neon_pulse_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const store = new WorkspaceStore({ dataDir });
await store.init();
const nasBridge = new NasBridge({ dataDir });
await nasBridge.init();
const sessions = new Map();

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "512kb" }));

function parseCookies(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((cookies, chunk) => {
      const separatorIndex = chunk.indexOf("=");

      if (separatorIndex <= 0) {
        return cookies;
      }

      const key = decodeURIComponent(chunk.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(chunk.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.path) {
    segments.push(`Path=${options.path}`);
  }

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join("; ");
}

function sweepExpiredSessions(now = Date.now()) {
  for (const [token, session] of sessions.entries()) {
    if ((session?.expiresAt ?? 0) <= now) {
      sessions.delete(token);
    }
  }
}

function createSession(username) {
  sweepExpiredSessions();
  const token = randomBytes(24).toString("base64url");
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function clearSession(token) {
  if (token) {
    sessions.delete(token);
  }
}

function getSessionFromRequest(request) {
  sweepExpiredSessions();
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return {
    token,
    username: session.username,
  };
}

function setSessionCookie(response, token) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, token, {
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      httpOnly: true,
      sameSite: "Lax",
    })
  );
}

function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "Lax",
    })
  );
}

function buildSessionPayload(request) {
  return {
    authenticated: Boolean(request.auth),
    username: request.auth?.username ?? "",
  };
}

function requireAuth(request, response, next) {
  if (!request.auth) {
    response.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  next();
}

app.use((request, response, next) => {
  request.auth = getSessionFromRequest(request);
  next();
});

app.get("/api/health", (request, response) => {
  response.json({
    ok: true,
    now: new Date().toISOString(),
  });
});

app.get("/api/auth/session", (request, response) => {
  response.json(buildSessionPayload(request));
});

app.post("/api/auth/login", async (request, response) => {
  const username = typeof request.body?.username === "string" ? request.body.username.trim() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";

  if (!username) {
    response.status(400).json({
      error: "请输入账号",
    });
    return;
  }

  if (!password) {
    response.status(400).json({
      error: "请输入密码",
    });
    return;
  }

  if (!store.verifyCredentials(username, password)) {
    response.status(401).json({
      error: "账号或密码错误",
    });
    return;
  }

  const token = createSession(store.getAuthPayload().username);
  setSessionCookie(response, token);
  response.json({
    ...buildSessionPayload({
      ...request,
      auth: {
        username: store.getAuthPayload().username,
      },
    }),
  });
});

app.post("/api/auth/logout", (request, response) => {
  clearSession(request.auth?.token);
  clearSessionCookie(response);
  response.status(204).end();
});

app.put("/api/auth/credentials", requireAuth, async (request, response) => {
  try {
    const authPayload = await store.updateCredentials({
      currentUsername: request.body?.currentUsername,
      currentPassword: request.body?.currentPassword,
      nextUsername: request.body?.nextUsername,
      nextPassword: request.body?.nextPassword,
    });

    sessions.clear();
    const nextToken = createSession(authPayload.username);
    setSessionCookie(response, nextToken);

    response.json({
      authenticated: true,
      username: authPayload.username,
      updatedAt: authPayload.updatedAt,
    });
  } catch (error) {
    console.error("Failed to update auth credentials:", error);
    response.status(400).json({
      error: error.message || "Failed to update credentials",
    });
  }
});

app.get("/api/nas/overview", async (request, response) => {
  try {
    const music = await nasBridge.getMusicSummary();
    const docker = request.auth
      ? await nasBridge.getDockerInfo()
      : {
          available: false,
          locked: true,
          error: "登录后可查看 Docker",
        };

    response.json({
      overview: nasBridge.getOverview(),
      music,
      docker,
    });
  } catch (error) {
    console.error("Failed to get NAS overview:", error);
    response.status(500).json({
      error: "Failed to get NAS overview",
    });
  }
});

app.get("/api/nas/transfer/items", (request, response) => {
  const limit = Number(request.query.limit || 20);
  response.json({
    items: nasBridge.listTransferItems({ limit }),
  });
});

app.delete("/api/nas/transfer/items/:id", requireAuth, async (request, response) => {
  try {
    response.json({
      item: await nasBridge.deleteTransferItem(request.params.id),
    });
  } catch (error) {
    console.error("Failed to delete transfer item:", error);
    response.status(400).json({
      error: error.message || "Failed to delete transfer item",
    });
  }
});

app.post("/api/nas/transfer/upload/init", requireAuth, async (request, response) => {
  try {
    const payload = await nasBridge.initUpload(request.body ?? {});
    response.json(payload);
  } catch (error) {
    console.error("Failed to init NAS upload:", error);
    response.status(400).json({
      error: error.message || "Failed to init upload",
    });
  }
});

app.post(
  "/api/nas/transfer/upload/chunk",
  requireAuth,
  express.raw({
    type: "application/octet-stream",
    limit: "8mb",
  }),
  async (request, response) => {
    try {
      const uploadId = String(request.headers["x-upload-id"] || "");
      const index = Number(request.headers["x-chunk-index"]);
      const payload = await nasBridge.saveUploadChunk({
        uploadId,
        index,
        buffer: request.body,
      });
      response.json(payload);
    } catch (error) {
      console.error("Failed to write NAS upload chunk:", error);
      response.status(400).json({
        error: error.message || "Failed to upload chunk",
      });
    }
  }
);

app.post("/api/nas/transfer/upload/complete", requireAuth, async (request, response) => {
  try {
    const item = await nasBridge.completeUpload(request.body?.uploadId);
    response.json({
      item,
    });
  } catch (error) {
    console.error("Failed to complete NAS upload:", error);
    response.status(400).json({
      error: error.message || "Failed to complete upload",
    });
  }
});

app.post("/api/nas/music/upload/init", requireAuth, async (request, response) => {
  try {
    const payload = await nasBridge.initMusicUpload(request.body ?? {});
    response.json(payload);
  } catch (error) {
    console.error("Failed to init music upload:", error);
    response.status(400).json({
      error: error.message || "Failed to init music upload",
    });
  }
});

app.post(
  "/api/nas/music/upload/chunk",
  requireAuth,
  express.raw({
    type: "application/octet-stream",
    limit: "8mb",
  }),
  async (request, response) => {
    try {
      const uploadId = String(request.headers["x-upload-id"] || "");
      const index = Number(request.headers["x-chunk-index"]);
      const payload = await nasBridge.saveUploadChunk({
        uploadId,
        index,
        buffer: request.body,
      });
      response.json(payload);
    } catch (error) {
      console.error("Failed to write music upload chunk:", error);
      response.status(400).json({
        error: error.message || "Failed to upload music chunk",
      });
    }
  }
);

app.post("/api/nas/music/upload/complete", requireAuth, async (request, response) => {
  try {
    const item = await nasBridge.completeUpload(request.body?.uploadId);
    response.json({
      item,
    });
  } catch (error) {
    console.error("Failed to complete music upload:", error);
    response.status(400).json({
      error: error.message || "Failed to complete music upload",
    });
  }
});

app.get("/api/nas/transfer/files/:id", async (request, response) => {
  try {
    const { item, filePath } = nasBridge.resolveTransferFilePath(request.params.id);
    await streamFileWithRange({
      filePath,
      mimeType: item.mime || "application/octet-stream",
      request,
      response,
      downloadName: item.name,
    });
  } catch (error) {
    response.status(404).json({
      error: "Transfer file not found",
    });
  }
});

app.get("/api/nas/music/tracks", async (request, response) => {
  try {
    const tracks = await nasBridge.listMusicTracks({
      force: String(request.query.refresh || "") === "1",
    });
    response.json({
      tracks,
    });
  } catch (error) {
    console.error("Failed to list music tracks:", error);
    response.status(500).json({
      error: "Failed to list music tracks",
    });
  }
});

app.delete("/api/nas/music/tracks/:trackId", requireAuth, async (request, response) => {
  try {
    response.json({
      item: await nasBridge.deleteTrack(request.params.trackId),
    });
  } catch (error) {
    console.error("Failed to delete music track:", error);
    response.status(400).json({
      error: error.message || "Failed to delete music track",
    });
  }
});

app.get("/api/nas/messages", (request, response) => {
  const limit = Number(request.query.limit || 12);
  response.json({
    messages: nasBridge.listMessages({ limit }),
  });
});

app.post("/api/nas/messages", requireAuth, async (request, response) => {
  try {
    response.json({
      message: await nasBridge.addMessage({
        body: request.body?.body,
        author: request.auth?.username,
      }),
    });
  } catch (error) {
    console.error("Failed to add NAS message:", error);
    response.status(400).json({
      error: error.message || "Failed to add NAS message",
    });
  }
});

app.get("/api/nas/music/stream/:trackId", async (request, response) => {
  try {
    const { filePath, mime } = await nasBridge.resolveTrack(request.params.trackId);
    await streamFileWithRange({
      filePath,
      mimeType: mime,
      request,
      response,
    });
  } catch (error) {
    response.status(404).json({
      error: "Track not found",
    });
  }
});

app.get("/api/nas/docker/info", requireAuth, async (request, response) => {
  response.json(await nasBridge.getDockerInfo());
});

app.get("/api/nas/docker/containers", requireAuth, async (request, response) => {
  try {
    response.json(await nasBridge.listContainers());
  } catch (error) {
    console.error("Failed to list docker containers:", error);
    response.status(500).json({
      error: "Failed to list docker containers",
    });
  }
});

app.post("/api/nas/docker/containers/:id/:action", requireAuth, async (request, response) => {
  try {
    await nasBridge.runContainerAction(request.params.id, request.params.action);
    response.status(204).end();
  } catch (error) {
    console.error("Failed to run docker action:", error);
    response.status(400).json({
      error: error.message || "Failed to run docker action",
    });
  }
});

app.get("/api/workspace", (request, response) => {
  response.json(store.getWorkspacePayload());
});

app.get("/api/workspace/stats", (request, response) => {
  response.json(store.getStatsPayload());
});

app.get("/api/workspace/export", (request, response) => {
  const todayKey = new Date().toISOString().slice(0, 10);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="neon-pulse-nav-backup-${todayKey}.json"`
  );
  response.json(store.exportWorkspace());
});

app.put("/api/workspace", async (request, response) => {
  try {
    const payload = await store.updateWorkspace(request.body ?? {});
    response.json(payload);
  } catch (error) {
    console.error("Failed to update workspace:", error);
    response.status(500).json({
      error: "Failed to update workspace",
    });
  }
});

app.post("/api/workspace/import", async (request, response) => {
  try {
    const payload = await store.importWorkspace(request.body ?? {});
    response.json(payload);
  } catch (error) {
    console.error("Failed to import workspace:", error);
    response.status(400).json({
      error: "Failed to import workspace backup",
    });
  }
});

app.post("/api/workspace/reset", async (request, response) => {
  try {
    const payload = await store.resetWorkspace(request.body?.scope);
    response.json(payload);
  } catch (error) {
    console.error("Failed to reset workspace:", error);
    response.status(500).json({
      error: "Failed to reset workspace",
    });
  }
});

app.post("/api/link-events/open", async (request, response) => {
  try {
    const ok = await store.recordLinkOpen(request.body?.linkId);

    if (!ok) {
      response.status(400).json({
        error: "Unknown link id",
      });
      return;
    }

    response.status(204).end();
  } catch (error) {
    console.error("Failed to record link open:", error);
    response.status(500).json({
      error: "Failed to record link open",
    });
  }
});

if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      extensions: ["html"],
    })
  );

  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) {
      next();
      return;
    }

    response.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (request, response) => {
    response.status(503).send("Frontend build is missing. Run `npm run build` first.");
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Neon Pulse Nav server listening on http://0.0.0.0:${port}`);
  console.log(`Persisted workspace data directory: ${dataDir}`);
});
