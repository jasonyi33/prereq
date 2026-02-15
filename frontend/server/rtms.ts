// Zoom RTMS integration — receives live meeting transcripts via Zoom's RTMS SDK
// Supports both global env-var credentials (legacy/demo) and per-teacher credentials

import { createHmac } from "crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import https from "https";
import type { Express } from "express";
import { supabase } from "./db";
import { emitToLectureRoom } from "./socket-helpers";

// Lazy-load @zoom/rtms SDK — only needed when actually connecting to a meeting.
// Webhook validation and OAuth work without it, so routes register even if SDK is missing.
let rtms: any = null;
async function getRtmsSdk(): Promise<any> {
  if (!rtms) {
    try {
      rtms = (await import("@zoom/rtms")).default;
    } catch (err: any) {
      throw new Error(`@zoom/rtms SDK not installed — ${err?.message || err}`);
    }
  }
  return rtms;
}

const RTMS_EVENTS = ["meeting.rtms_started", "webinar.rtms_started", "session.rtms_started"];
const RTMS_STOP_EVENTS = ["meeting.rtms_stopped", "webinar.rtms_stopped", "session.rtms_stopped"];
const RTMS_INTERRUPT_EVENTS = ["meeting.rtms_interrupted", "webinar.rtms_interrupted", "session.rtms_interrupted"];

// --- Multi-tenant state ---

interface ActiveStream {
  client: any;
  teacherId: string | null;
  lectureId: string;
  payload: any;
  watchdog?: ReturnType<typeof setInterval>;
}

// streamId -> active stream
const activeStreams = new Map<string, ActiveStream>();
// teacherId -> lectureId (for per-teacher routing)
const teacherLectures = new Map<string, string>();

// --- Credential cache ---

interface ZoomCredentials {
  zoom_client_id: string;
  zoom_client_secret: string;
  zoom_secret_token: string;
}

const credentialCache = new Map<string, ZoomCredentials>();

export function clearCredentialCache(teacherId: string): void {
  credentialCache.delete(teacherId);
}

async function getTeacherCredentials(teacherId: string): Promise<ZoomCredentials | null> {
  const cached = credentialCache.get(teacherId);
  if (cached) return cached;

  const { data } = await supabase
    .from("teachers")
    .select("zoom_client_id, zoom_client_secret, zoom_secret_token")
    .eq("id", teacherId)
    .single();

  if (!data?.zoom_client_id || !data?.zoom_client_secret) return null;

  const creds: ZoomCredentials = {
    zoom_client_id: data.zoom_client_id,
    zoom_client_secret: data.zoom_client_secret,
    zoom_secret_token: data.zoom_secret_token || data.zoom_client_secret,
  };
  credentialCache.set(teacherId, creds);
  return creds;
}

async function getTeacherCourseId(teacherId: string): Promise<string | null> {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("teacher_id", teacherId)
    .limit(1)
    .single();
  return data?.id || null;
}

// --- Shared helpers ---

const DEMO_COURSE_ID = process.env.DEMO_COURSE_ID || null;

function getFlaskUrl(): string {
  const url = (process.env.FLASK_API_URL || "http://localhost:5000").replace(/\/+$/, "");
  console.log(`[RTMS] getFlaskUrl() => ${url}`);
  return url;
}
function getFrontendBaseUrl(): string {
  return (process.env.FRONTEND_BASE_URL || "https://prereq-frontend.onrender.com").replace(/\/+$/, "");
}
function getLocalUrl(): string {
  return `http://localhost:${process.env.PORT || 3000}`;
}

async function getDefaultCourseId(): Promise<string | null> {
  if (DEMO_COURSE_ID) return DEMO_COURSE_ID;
  try {
    const res = await fetch(`${getFlaskUrl()}/api/courses`, {
      headers: { "ngrok-skip-browser-warning": "1" },
    });
    const courses = await res.json();
    if (courses.length > 0) return courses[0].id;
  } catch (err) {
    console.error("[RTMS] Failed to fetch courses:", err);
  }
  return null;
}

async function createLecture(courseId: string): Promise<string | null> {
  try {
    const res = await fetch(`${getFlaskUrl()}/api/lectures`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify({
        course_id: courseId,
        title: `Live Lecture — ${new Date().toLocaleString()}`,
      }),
    });
    const data = await res.json();
    console.log(`[RTMS] Created lecture: ${data.id}`);
    return data.id;
  } catch (err) {
    console.error("[RTMS] Failed to create lecture:", err);
    return null;
  }
}

async function postTranscript(lectureId: string, text: string, timestamp: number, speakerName: string) {
  try {
    await fetch(`${getLocalUrl()}/api/lectures/${lectureId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, timestamp, speakerName }),
    });
  } catch (err) {
    console.warn("[RTMS] Failed to post transcript chunk:", err);
  }
}

// --- Diagnostic log ---
// Circular buffer of recent RTMS events for the /api/rtms/status endpoint
interface DiagEvent {
  time: string;
  step: string;
  detail?: string;
}
const diagLog: DiagEvent[] = [];
function diag(step: string, detail?: string) {
  const entry = { time: new Date().toISOString(), step, detail };
  diagLog.push(entry);
  if (diagLog.length > 100) diagLog.shift();
  console.log(`[RTMS] ${step}${detail ? ` — ${detail}` : ""}`);
}

// --- Reconnect with backoff ---

const RECONNECT_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

async function reconnectWithBackoff(payload: any, teacherId: string | null, streamId: string, lectureId?: string): Promise<void> {
  for (let attempt = 0; attempt < RECONNECT_DELAYS.length; attempt++) {
    const delay = RECONNECT_DELAYS[attempt];
    diag("reconnect", `Attempt ${attempt + 1}/${RECONNECT_DELAYS.length} in ${delay / 1000}s for streamId=${streamId}`);
    await new Promise((r) => setTimeout(r, delay));
    try {
      await startRtmsConnection(payload, teacherId, lectureId);
      diag("reconnect", `Success on attempt ${attempt + 1}`);
      return;
    } catch (err: any) {
      diag("reconnect", `Attempt ${attempt + 1} failed: ${err.message || err}`);
    }
  }
  diag("reconnect", `All ${RECONNECT_DELAYS.length} attempts failed for streamId=${streamId}, giving up`);
}

// --- Core RTMS connection logic ---

async function startRtmsConnection(payload: any, teacherId: string | null, existingLectureId?: string): Promise<void> {
  const streamId = payload?.rtms_stream_id;
  diag("startRtmsConnection", `streamId=${streamId}, teacherId=${teacherId}`);
  diag("payload", JSON.stringify(payload).slice(0, 500));

  let clientId: string;
  let clientSecret: string;
  let courseId: string | null;

  if (teacherId) {
    // Per-teacher credentials
    const creds = await getTeacherCredentials(teacherId);
    if (!creds) {
      diag("ABORT", `No Zoom credentials in DB for teacher ${teacherId}`);
      return;
    }
    diag("credentials", `Found per-teacher creds, clientId=${creds.zoom_client_id.slice(0, 8)}...`);
    clientId = creds.zoom_client_id;
    clientSecret = creds.zoom_client_secret;
    courseId = await getTeacherCourseId(teacherId);
    diag("courseId", courseId || "NOT FOUND");
  } else {
    // Global/demo mode
    clientId = process.env.ZOOM_CLIENT_ID || "";
    clientSecret = process.env.ZOOM_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) {
      diag("ABORT", "No global Zoom credentials configured");
      return;
    }
    diag("credentials", `Using global env creds, clientId=${clientId.slice(0, 8)}...`);
    courseId = await getDefaultCourseId();
    diag("courseId", courseId || "NOT FOUND");
  }

  if (!courseId) {
    diag("ABORT", "No course found — cannot create lecture");
    return;
  }

  let lectureId: string | null;
  if (existingLectureId) {
    lectureId = existingLectureId;
    diag("lecture", `Reusing existing lectureId=${lectureId}`);
  } else {
    lectureId = await createLecture(courseId);
    if (!lectureId) {
      diag("ABORT", "Failed to create lecture via Flask");
      return;
    }
    diag("lecture", `Created lectureId=${lectureId}`);
  }

  if (teacherId) {
    teacherLectures.set(teacherId, lectureId);
  }

  // Ensure CA cert is ready before loading the SDK (avoids race condition)
  await ensureCaCert();
  diag("ca-cert", `ZM_RTMS_CA_CERT=${process.env.ZM_RTMS_CA_CERT || "NOT SET"}`);

  let sdk: any;
  try {
    sdk = await getRtmsSdk();
    diag("sdk", "@zoom/rtms SDK loaded successfully");
  } catch (err: any) {
    diag("ABORT", `SDK load failed: ${err.message}`);
    return;
  }

  const client = new sdk.Client();
  activeStreams.set(streamId, { client, teacherId, lectureId, payload });
  diag("client", `Created RTMS Client, activeStreams count=${activeStreams.size}`);

  let startTime = Date.now();
  let transcriptCount = 0;
  let lastTranscriptTime = Date.now();

  // Watchdog: warn if no transcripts for 30s
  const watchdog = setInterval(() => {
    const silenceSec = (Date.now() - lastTranscriptTime) / 1000;
    if (silenceSec > 30) {
      diag("watchdog", `No transcripts for ${silenceSec.toFixed(0)}s — stream may be dead (streamId=${streamId})`);
    }
  }, 15_000);

  const stream = activeStreams.get(streamId);
  if (stream) stream.watchdog = watchdog;

  client.onTranscriptData((data: Buffer, size: number, timestamp: number, metadata: any) => {
    transcriptCount++;
    lastTranscriptTime = Date.now();
    const text = data.toString("utf8");
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speakerName = metadata?.userName || "Unknown";

    diag("transcript", `#${transcriptCount} [${elapsedSec.toFixed(1)}s] ${speakerName}: ${text.slice(0, 100)}`);
    postTranscript(lectureId!, text, elapsedSec, speakerName);
  });

  client.onJoinConfirm((reason: number) => {
    diag("joinConfirm", `reason=${reason}, teacher=${teacherId || "global"}, clientId=${clientId.slice(0, 8)}...`);
    startTime = Date.now();
    lastTranscriptTime = Date.now(); // reset watchdog on join
  });

  client.onLeave((reason: number) => {
    diag("leave", `reason=${reason}, streamId=${streamId}`);
    const s = activeStreams.get(streamId);
    if (s?.watchdog) clearInterval(s.watchdog);
    activeStreams.delete(streamId);
    if (teacherId) {
      teacherLectures.delete(teacherId);
    }
  });

  // Check if CA cert is available — if not, disable verification as fallback
  const hasCaCert = process.env.ZM_RTMS_CA && existsSync(process.env.ZM_RTMS_CA);
  if (!hasCaCert) {
    diag("ca-cert", "WARNING: No CA cert found, disabling cert verification as fallback");
  }

  // Pass credentials directly to join() — avoids env var race conditions with multiple teachers
  diag("join", `Calling client.join() with streamId=${streamId}, clientId=${clientId.slice(0, 8)}..., secretLen=${clientSecret.length}, verifyCert=${hasCaCert ? 1 : 0}`);
  client.join({ ...payload, client: clientId, secret: clientSecret, is_verify_cert: hasCaCert ? 1 : 0 });

  diag("join", "client.join() called — waiting for onJoinConfirm callback...");
}

// --- Webhook handler factory ---

function handleWebhook(teacherId: string | null, secret: string) {
  return (req: any, res: any) => {
    // Zoom webhook validation challenge
    if (req.body?.event === "endpoint.url_validation") {
      const plainToken = req.body.payload?.plainToken;
      if (plainToken) {
        diag("validation", `Webhook URL validation challenge received (teacher=${teacherId || "global"})`);
        const hashForValidate = createHmac("sha256", secret)
          .update(plainToken)
          .digest("hex");
        res.json({ plainToken, encryptedToken: hashForValidate });
        diag("validation", "Responded with encrypted token");
        return;
      }
    }

    const event = req.body?.event;
    const payload = req.body?.payload;
    const streamId = payload?.rtms_stream_id;

    diag("webhook", `event=${event}, streamId=${streamId}, teacher=${teacherId || "global"}`);

    // Must respond 200 immediately
    res.status(200).send("OK");

    if (RTMS_STOP_EVENTS.includes(event)) {
      const stream = activeStreams.get(streamId);
      const stoppedLectureId = stream?.lectureId;

      if (stream) {
        diag("stop", `Calling client.leave() for streamId=${streamId}`);
        if (stream.watchdog) clearInterval(stream.watchdog);
        try { stream.client.leave(); } catch {}
        activeStreams.delete(streamId);
        if (teacherId) teacherLectures.delete(teacherId);
      } else {
        diag("stop", `No active stream for streamId=${streamId} (already cleaned up?)`);
      }

      // Lecture-end flow: update status, notify students, generate summary
      if (stoppedLectureId) {
        diag("stop", `Lecture ${stoppedLectureId} ended — triggering summary generation`);

        // 1. Mark lecture as completed via Flask
        fetch(`${getFlaskUrl()}/api/lectures/${stoppedLectureId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
          body: JSON.stringify({ status: "completed", ended_at: new Date().toISOString() }),
        }).catch((err) => diag("stop", `Failed to update lecture status: ${err}`));

        // 2. Notify all connected clients immediately
        emitToLectureRoom(stoppedLectureId, "lecture:ended", { lectureId: stoppedLectureId });

        // 3. Trigger summary generation (async — emits lecture:summary-ready when done)
        fetch(`${getLocalUrl()}/api/lectures/${stoppedLectureId}/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch((err) => diag("stop", `Summary generation request failed: ${err}`));
      }

      return;
    }

    if (RTMS_INTERRUPT_EVENTS.includes(event)) {
      const stream = activeStreams.get(streamId);
      if (stream) {
        diag("interrupt", `Stream interrupted, cleaning up and reconnecting with backoff...`);
        if (stream.watchdog) clearInterval(stream.watchdog);
        try { stream.client.leave(); } catch {}
        activeStreams.delete(streamId);
        reconnectWithBackoff(stream.payload, stream.teacherId, streamId, stream.lectureId);
      } else {
        diag("interrupt", `No active stream for streamId=${streamId}, reconnecting with backoff`);
        reconnectWithBackoff(payload, teacherId, streamId);
      }
      return;
    }

    if (!RTMS_EVENTS.includes(event)) {
      diag("webhook", `Ignoring unhandled event: ${event}`);
      return;
    }
    if (activeStreams.has(streamId)) {
      diag("webhook", `Already connected to stream ${streamId}, skipping`);
      return;
    }

    startRtmsConnection(payload, teacherId).catch((err) => {
      diag("ERROR", `startRtmsConnection failed: ${err.message || err}`);
    });
  };
}

// --- OAuth handler factory ---

function handleOAuth(teacherId: string | null) {
  return async (req: any, res: any) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("Missing authorization code");
      return;
    }

    let clientId: string;
    let clientSecret: string;
    let redirectUri: string;

    if (teacherId) {
      const creds = await getTeacherCredentials(teacherId);
      if (!creds) {
        res.status(404).send("No Zoom credentials found for this teacher");
        return;
      }
      clientId = creds.zoom_client_id;
      clientSecret = creds.zoom_client_secret;
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["host"];
      redirectUri = `${protocol}://${host}/auth/${teacherId}`;
    } else {
      clientId = process.env.ZOOM_CLIENT_ID || "";
      clientSecret = process.env.ZOOM_CLIENT_SECRET || "";
      redirectUri = `${getFrontendBaseUrl()}/auth`;
    }

    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        console.log(`[RTMS] OAuth authorized successfully${teacherId ? ` [teacher: ${teacherId}]` : ""}`);
        res.send("Zoom app authorized! You can close this tab. RTMS is ready.");
      } else {
        console.error("[RTMS] OAuth token error:", tokenData);
        res.status(400).send(`Authorization failed: ${JSON.stringify(tokenData)}`);
      }
    } catch (err) {
      console.error("[RTMS] OAuth error:", err);
      res.status(500).send("OAuth exchange failed");
    }
  };
}

// --- Setup ---

async function ensureCaCert(): Promise<void> {
  // Check common CA cert paths
  const knownPaths = [
    "/etc/ssl/cert.pem",
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/etc/ssl/ca-bundle.pem",
  ];
  for (const p of knownPaths) {
    if (existsSync(p)) {
      process.env.ZM_RTMS_CA_CERT = p;
      process.env.ZM_RTMS_CA = p;
      console.log(`[RTMS] Found CA cert at ${p}`);
      return;
    }
  }
  // No system CA certs found — download Mozilla's bundle
  const dest = "/app/cacert.pem";
  if (existsSync(dest)) {
    process.env.ZM_RTMS_CA_CERT = dest;
    process.env.ZM_RTMS_CA = dest;
    console.log(`[RTMS] Using cached CA cert at ${dest}`);
    return;
  }
  console.log("[RTMS] No CA certs found — downloading Mozilla CA bundle...");
  return new Promise((resolve) => {
    https.get("https://curl.se/ca/cacert.pem", (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        writeFileSync(dest, buf);
        process.env.ZM_RTMS_CA_CERT = dest;
        process.env.ZM_RTMS_CA = dest;
        console.log(`[RTMS] Downloaded CA cert to ${dest} (${buf.length} bytes)`);
        resolve();
      });
    }).on("error", (err) => {
      console.error(`[RTMS] Failed to download CA cert: ${err.message}`);
      resolve(); // continue without — SDK will warn
    });
  });
}

export function setupRTMS(app: Express): void {
  // Enable SDK debug logging to diagnose auth failures
  process.env.ZM_RTMS_LOG_LEVEL = "debug";
  process.env.ZM_RTMS_LOG_ENABLED = "true";

  // Download CA certs if missing (needed for RTMS native SDK on Render)
  ensureCaCert().catch(() => {});

  // --- Diagnostic endpoint ---
  app.get("/api/rtms/status", (_req, res) => {
    res.json({
      activeStreams: Array.from(activeStreams.entries()).map(([id, s]) => ({
        streamId: id,
        teacherId: s.teacherId,
        lectureId: s.lectureId,
      })),
      teacherLectures: Object.fromEntries(teacherLectures),
      recentEvents: diagLog.slice(-30),
      sdkLoaded: rtms !== null,
      hasGlobalCreds: !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET),
    });
  });

  // --- Debug endpoints (temporary, for diagnosing Render RTMS issues) ---

  // 0. Clock check — signature generation uses timestamps
  app.get("/api/debug/clock", async (_req, res) => {
    const localTime = new Date();
    // Compare against a known time source
    let remoteTime: string | null = null;
    let skewMs: number | null = null;
    try {
      const r = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC", { signal: AbortSignal.timeout(5000) });
      const data = await r.json() as any;
      remoteTime = data.utc_datetime;
      const remote = new Date(data.utc_datetime);
      skewMs = localTime.getTime() - remote.getTime();
    } catch (err: any) {
      remoteTime = `error: ${err.message}`;
    }
    res.json({
      serverTime: localTime.toISOString(),
      remoteTime,
      skewMs,
      skewSeconds: skewMs !== null ? Math.round(skewMs / 1000) : null,
    });
  });

  // 1. Check if logs directory exists (SDK may need it)
  app.get("/api/debug/logs-dir", (_req, res) => {
    const cwd = process.cwd();
    const checks = [
      `${cwd}/logs`,
      "/app/logs",
      "/tmp/logs",
    ];
    const results: Record<string, boolean> = {};
    for (const dir of checks) {
      results[dir] = existsSync(dir);
    }
    // Try creating ./logs if it doesn't exist
    let createResult = "already exists";
    if (!existsSync(`${cwd}/logs`)) {
      try {
        mkdirSync(`${cwd}/logs`, { recursive: true });
        createResult = "created successfully";
      } catch (err: any) {
        createResult = `failed: ${err.message}`;
      }
    }
    res.json({ cwd, checks: results, createLogsDir: createResult });
  });

  // 2. Check SSL CA certificate paths
  app.get("/api/debug/ca-certs", (_req, res) => {
    const paths = [
      "/etc/ssl/cert.pem",                       // macOS default
      "/etc/ssl/certs/ca-certificates.crt",       // Debian/Ubuntu
      "/etc/pki/tls/certs/ca-bundle.crt",         // RHEL/CentOS
      "/etc/ssl/ca-bundle.pem",                   // OpenSUSE
      "/etc/ssl/certs",                           // Debian certs dir
    ];
    const results: Record<string, boolean> = {};
    for (const p of paths) {
      results[p] = existsSync(p);
    }
    // Check if /etc/ssl/certs has files
    let certsDir: string[] = [];
    try {
      certsDir = readdirSync("/etc/ssl/certs").slice(0, 10);
    } catch {}
    res.json({
      checks: results,
      certsDir_sample: certsDir,
      env: {
        SSL_CERT_FILE: process.env.SSL_CERT_FILE || "(not set)",
        SSL_CERT_DIR: process.env.SSL_CERT_DIR || "(not set)",
        NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS || "(not set)",
        ZM_RTMS_CA_CERT: process.env.ZM_RTMS_CA_CERT || "(not set)",
      },
    });
  });

  // 3. Check outbound network to Zoom WebSocket servers
  // Pass ?url=wss://... or ?url=https://... to test a specific server
  app.get("/api/debug/network", async (req, res) => {
    const results: Record<string, any> = {};
    // Test HTTPS to zoom.us
    try {
      const start = Date.now();
      const r = await fetch("https://zoom.us", { method: "HEAD", signal: AbortSignal.timeout(5000) });
      results["https://zoom.us"] = { ok: true, status: r.status, ms: Date.now() - start };
    } catch (err: any) {
      results["https://zoom.us"] = { ok: false, error: err.message };
    }
    // Test custom server URL if provided
    const customUrl = req.query.url as string;
    if (customUrl) {
      // Convert wss:// to https:// for fetch compatibility
      const httpsUrl = customUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
      try {
        const start = Date.now();
        const r = await fetch(httpsUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        results["custom_server"] = { url: customUrl, httpsUrl, ok: true, status: r.status, ms: Date.now() - start };
      } catch (err: any) {
        results["custom_server"] = { url: customUrl, httpsUrl, ok: false, error: err.message };
      }
    }
    res.json(results);
  });

  // Legacy global env var setup (for backward compat / demo mode)
  if (process.env.ZOOM_CLIENT_ID) {
    process.env.ZM_RTMS_CLIENT = process.env.ZOOM_CLIENT_ID;
  }
  if (process.env.ZOOM_CLIENT_SECRET) {
    process.env.ZM_RTMS_SECRET = process.env.ZOOM_CLIENT_SECRET;
  }

  // --- Legacy global routes (backward compat) ---
  if (process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET) {
    app.get("/auth", handleOAuth(null));
    app.post("/webhook", handleWebhook(null, process.env.ZOOM_SECRET_TOKEN || process.env.ZOOM_CLIENT_SECRET));
    console.log("[RTMS] Legacy global webhook: /webhook");
    console.log("[RTMS] Legacy global OAuth: /auth");
  }

  // --- Per-teacher routes ---

  // Per-teacher webhook: POST /webhook/:teacherId
  app.post("/webhook/:teacherId", async (req, res) => {
    try {
      const { teacherId } = req.params;

      // For validation challenges, we need the teacher's secret
      // For RTMS events, we also need credentials
      const creds = await getTeacherCredentials(teacherId);
      if (!creds) {
        // If it's a validation challenge and we have no creds, we can't validate
        if (req.body?.event === "endpoint.url_validation") {
          res.status(404).json({ error: "No Zoom credentials found. Save credentials first." });
          return;
        }
        res.status(200).send("OK");
        console.warn(`[RTMS] No credentials for teacher ${teacherId}, ignoring event`);
        return;
      }

      handleWebhook(teacherId, creds.zoom_secret_token)(req, res);
    } catch (err) {
      console.error("[RTMS] Webhook handler error:", err);
      if (!res.headersSent) {
        res.status(500).send("Webhook handler failed — check server logs");
      }
    }
  });

  // Per-teacher OAuth: GET /auth/:teacherId
  app.get("/auth/:teacherId", async (req, res) => {
    try {
      const { teacherId } = req.params;
      await handleOAuth(teacherId)(req, res);
    } catch (err: any) {
      console.error("[RTMS] OAuth callback error:", err);
      if (!res.headersSent) {
        res.status(500).send(`OAuth callback failed: ${err?.message || err}`);
      }
    }
  });

  console.log("[RTMS] Zoom RTMS integration initialized");
  console.log("[RTMS] Per-teacher webhook: /webhook/:teacherId");
  console.log("[RTMS] Per-teacher OAuth: /auth/:teacherId");
}

export function getActiveLectureId(): string | null {
  // Return the first active lecture (legacy compat)
  for (const stream of activeStreams.values()) {
    return stream.lectureId;
  }
  return null;
}