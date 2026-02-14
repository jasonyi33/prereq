// Zoom RTMS integration — receives live meeting transcripts via Zoom's RTMS SDK
// Supports both global env-var credentials (legacy/demo) and per-teacher credentials

import { createHmac } from "crypto";
import type { Express } from "express";
import { supabase } from "./db";

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

// --- Multi-tenant state ---

interface ActiveStream {
  client: any;
  teacherId: string | null;
  lectureId: string;
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
  return (process.env.FLASK_API_URL || "http://localhost:5000").replace(/\/+$/, "");
}
function getLocalUrl(): string {
  return `http://localhost:${process.env.PORT || 3000}`;
}

async function getDefaultCourseId(): Promise<string | null> {
  if (DEMO_COURSE_ID) return DEMO_COURSE_ID;
  try {
    const res = await fetch(`${getFlaskUrl()}/api/courses`);
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
      headers: { "Content-Type": "application/json" },
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

// --- Core RTMS connection logic ---

async function startRtmsConnection(payload: any, teacherId: string | null): Promise<void> {
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

  const lectureId = await createLecture(courseId);
  if (!lectureId) {
    diag("ABORT", "Failed to create lecture via Flask");
    return;
  }
  diag("lecture", `Created lectureId=${lectureId}`);

  if (teacherId) {
    teacherLectures.set(teacherId, lectureId);
  }

  // Set SDK env vars BEFORE constructing Client — the SDK reads these at construction time
  process.env.ZM_RTMS_CLIENT = clientId;
  process.env.ZM_RTMS_SECRET = clientSecret;

  let sdk: any;
  try {
    sdk = await getRtmsSdk();
    diag("sdk", "@zoom/rtms SDK loaded successfully");
  } catch (err: any) {
    diag("ABORT", `SDK load failed: ${err.message}`);
    return;
  }

  const client = new sdk.Client();
  activeStreams.set(streamId, { client, teacherId, lectureId });
  diag("client", `Created RTMS Client, activeStreams count=${activeStreams.size}`);

  let startTime = Date.now();
  let transcriptCount = 0;

  client.onTranscriptData((data: Buffer, size: number, timestamp: number, metadata: any) => {
    transcriptCount++;
    const text = data.toString("utf8");
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speakerName = metadata?.userName || "Unknown";

    diag("transcript", `#${transcriptCount} [${elapsedSec.toFixed(1)}s] ${speakerName}: ${text.slice(0, 100)}`);
    postTranscript(lectureId, text, elapsedSec, speakerName);
  });

  client.onJoinConfirm((reason: number) => {
    diag("joinConfirm", `reason=${reason}, teacher=${teacherId || "global"}`);
    startTime = Date.now();
  });

  client.onLeave((reason: number) => {
    diag("leave", `reason=${reason}, streamId=${streamId}`);
    activeStreams.delete(streamId);
    if (teacherId) {
      teacherLectures.delete(teacherId);
    }
  });

  diag("join", `Calling client.join() with streamId=${streamId}`);
  client.join(payload);

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
      if (stream) {
        diag("stop", `Calling client.leave() for streamId=${streamId}`);
        try { stream.client.leave(); } catch {}
        activeStreams.delete(streamId);
        if (teacherId) teacherLectures.delete(teacherId);
      } else {
        diag("stop", `No active stream for streamId=${streamId} (already cleaned up?)`);
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
      redirectUri = `${process.env.NGROK_URL || `http://localhost:${process.env.PORT || 3000}`}/auth`;
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

export function setupRTMS(app: Express): void {
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
    app.post("/webhook", handleWebhook(null, process.env.ZOOM_CLIENT_SECRET));
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
