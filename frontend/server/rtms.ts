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
    } catch {
      throw new Error("@zoom/rtms SDK not installed — RTMS connections unavailable");
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
    .select("zoom_client_id, zoom_client_secret")
    .eq("id", teacherId)
    .single();

  if (!data?.zoom_client_id || !data?.zoom_client_secret) return null;

  const creds: ZoomCredentials = {
    zoom_client_id: data.zoom_client_id,
    zoom_client_secret: data.zoom_client_secret,
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

// --- Core RTMS connection logic ---

async function startRtmsConnection(payload: any, teacherId: string | null): Promise<void> {
  const streamId = payload?.rtms_stream_id;

  let clientId: string;
  let clientSecret: string;
  let courseId: string | null;

  if (teacherId) {
    // Per-teacher credentials
    const creds = await getTeacherCredentials(teacherId);
    if (!creds) {
      console.error(`[RTMS] No Zoom credentials for teacher ${teacherId}`);
      return;
    }
    clientId = creds.zoom_client_id;
    clientSecret = creds.zoom_client_secret;
    courseId = await getTeacherCourseId(teacherId);
  } else {
    // Global/demo mode
    clientId = process.env.ZOOM_CLIENT_ID || "";
    clientSecret = process.env.ZOOM_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) {
      console.error("[RTMS] No global Zoom credentials configured");
      return;
    }
    courseId = await getDefaultCourseId();
  }

  if (!courseId) {
    console.error("[RTMS] No course found — cannot create lecture");
    return;
  }

  const lectureId = await createLecture(courseId);
  if (!lectureId) {
    console.error("[RTMS] Failed to create lecture");
    return;
  }

  if (teacherId) {
    teacherLectures.set(teacherId, lectureId);
  }

  const sdk = await getRtmsSdk();
  const client = new sdk.Client();
  activeStreams.set(streamId, { client, teacherId, lectureId });

  let startTime = Date.now();

  client.onTranscriptData((data: Buffer, size: number, timestamp: number, metadata: any) => {
    const text = data.toString("utf8");
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speakerName = metadata?.userName || "Unknown";

    console.log(`[RTMS] [${elapsedSec.toFixed(1)}s] ${speakerName}: ${text}`);
    postTranscript(lectureId, text, elapsedSec, speakerName);
  });

  client.onJoinConfirm((reason: number) => {
    console.log(`[RTMS] Joined meeting (reason: ${reason})${teacherId ? ` [teacher: ${teacherId}]` : ""}`);
    startTime = Date.now();
  });

  client.onLeave((reason: number) => {
    console.log(`[RTMS] Left meeting (reason: ${reason})`);
    activeStreams.delete(streamId);
    if (teacherId) {
      teacherLectures.delete(teacherId);
    }
  });

  // Set SDK env vars temporarily for this client's join call
  // (the SDK's client.join() generates the signature internally from these)
  const prevClient = process.env.ZM_RTMS_CLIENT;
  const prevSecret = process.env.ZM_RTMS_SECRET;
  process.env.ZM_RTMS_CLIENT = clientId;
  process.env.ZM_RTMS_SECRET = clientSecret;

  client.join(payload);

  // Restore previous env vars
  if (prevClient !== undefined) process.env.ZM_RTMS_CLIENT = prevClient;
  else delete process.env.ZM_RTMS_CLIENT;
  if (prevSecret !== undefined) process.env.ZM_RTMS_SECRET = prevSecret;
  else delete process.env.ZM_RTMS_SECRET;

  console.log(`[RTMS] Connecting to Zoom meeting stream...${teacherId ? ` [teacher: ${teacherId}]` : ""}`);
}

// --- Webhook handler factory ---

function handleWebhook(teacherId: string | null, secret: string) {
  return (req: any, res: any) => {
    // Zoom webhook validation challenge
    if (req.body?.event === "endpoint.url_validation") {
      const plainToken = req.body.payload?.plainToken;
      if (plainToken) {
        const hashForValidate = createHmac("sha256", secret)
          .update(plainToken)
          .digest("hex");
        res.json({ plainToken, encryptedToken: hashForValidate });
        return;
      }
    }

    const event = req.body?.event;
    const payload = req.body?.payload;
    const streamId = payload?.rtms_stream_id;

    console.log(`[RTMS] Webhook event: ${event}${teacherId ? ` [teacher: ${teacherId}]` : ""}`);

    // Must respond 200 immediately
    res.status(200).send("OK");

    if (RTMS_STOP_EVENTS.includes(event)) {
      console.log("[RTMS] Received stop webhook (ignoring — waiting for actual disconnect)");
      return;
    }

    if (!RTMS_EVENTS.includes(event)) return;
    if (activeStreams.has(streamId)) {
      console.log("[RTMS] Already connected to this stream");
      return;
    }

    startRtmsConnection(payload, teacherId).catch((err) => {
      console.error("[RTMS] Error starting RTMS connection:", err);
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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
      redirectUri = `${appUrl}/auth/${teacherId}`;
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

    handleWebhook(teacherId, creds.zoom_client_secret)(req, res);
  });

  // Per-teacher OAuth: GET /auth/:teacherId
  app.get("/auth/:teacherId", async (req, res) => {
    const { teacherId } = req.params;
    await handleOAuth(teacherId)(req, res);
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
