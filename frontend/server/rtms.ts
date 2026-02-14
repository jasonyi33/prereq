// Zoom RTMS integration — receives live meeting transcripts via Zoom's RTMS SDK
// and POSTs them to /api/lectures/:id/transcript (same endpoint the simulator uses)

import rtms from "@zoom/rtms";
import type { Express } from "express";

const RTMS_EVENTS = ["meeting.rtms_started", "webinar.rtms_started", "session.rtms_started"];
const RTMS_STOP_EVENTS = ["meeting.rtms_stopped", "webinar.rtms_stopped", "session.rtms_stopped"];

// Track active RTMS clients by stream ID
const clients = new Map<string, any>();

// The active lecture ID created when RTMS connects
let activeLectureId: string | null = null;

// Default course ID — we use the first course in the system
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
    const url = `${getFlaskUrl()}/api/courses`;
    console.log(`[RTMS] Fetching courses from: ${url}`);
    const res = await fetch(url);
    const text = await res.text();
    console.log(`[RTMS] Courses response (${res.status}): ${text.slice(0, 200)}`);
    const courses = JSON.parse(text);
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
    // Socket.IO events are emitted by the API route via globalThis
  } catch (err) {
    console.warn("[RTMS] Failed to post transcript chunk:", err);
  }
}

export function setupRTMS(app: Express): void {
  // Set SDK env vars from our .env names
  if (process.env.ZOOM_CLIENT_ID) {
    process.env.ZM_RTMS_CLIENT = process.env.ZOOM_CLIENT_ID;
  }
  if (process.env.ZOOM_CLIENT_SECRET) {
    process.env.ZM_RTMS_SECRET = process.env.ZOOM_CLIENT_SECRET;
  }

  // OAuth callback — one-time authorization for General OAuth app
  app.get("/auth", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("Missing authorization code");
      return;
    }

    try {
      const credentials = Buffer.from(
        `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
      ).toString("base64");

      const tokenRes = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${process.env.NGROK_URL || "https://unnicknamed-tisha-unfair.ngrok-free.dev"}/auth`,
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        console.log("[RTMS] OAuth authorized successfully");
        res.send("Zoom app authorized! You can close this tab. RTMS is ready.");
      } else {
        console.error("[RTMS] OAuth token error:", tokenData);
        res.status(400).send(`Authorization failed: ${JSON.stringify(tokenData)}`);
      }
    } catch (err) {
      console.error("[RTMS] OAuth error:", err);
      res.status(500).send("OAuth exchange failed");
    }
  });

  // RTMS webhook handler — receives meeting.rtms_started events from Zoom
  app.post("/webhook", (req, res) => {
    // Zoom webhook validation challenge
    if (req.body?.event === "endpoint.url_validation") {
      const plainToken = req.body.payload?.plainToken;
      if (plainToken) {
        const crypto = require("crypto");
        const hashForValidate = crypto
          .createHmac("sha256", process.env.ZOOM_CLIENT_SECRET || "")
          .update(plainToken)
          .digest("hex");
        res.json({ plainToken, encryptedToken: hashForValidate });
        return;
      }
    }

    const event = req.body?.event;
    const payload = req.body?.payload;
    const streamId = payload?.rtms_stream_id;

    console.log(`[RTMS] Webhook event: ${event}`);

    // Must respond 200 immediately
    res.status(200).send("OK");

    if (RTMS_STOP_EVENTS.includes(event)) {
      // Don't disconnect — Zoom sends this webhook prematurely but the RTMS client
      // often stays connected and keeps receiving transcripts. Let the onLeave callback
      // handle actual disconnections.
      console.log("[RTMS] Received stop webhook (ignoring — waiting for actual disconnect)");
      return;
    }

    if (!RTMS_EVENTS.includes(event)) return;
    if (clients.has(streamId)) {
      console.log("[RTMS] Already connected to this stream");
      return;
    }

    // Auto-create a lecture and start receiving transcripts
    (async () => {
      const courseId = await getDefaultCourseId();
      if (!courseId) {
        console.error("[RTMS] No course found — cannot create lecture");
        return;
      }

      const lectureId = await createLecture(courseId);
      if (!lectureId) {
        console.error("[RTMS] Failed to create lecture");
        return;
      }
      activeLectureId = lectureId;

      const client = new rtms.Client();
      clients.set(streamId, client);

      let startTime = Date.now();

      client.onTranscriptData((data: Buffer, size: number, timestamp: number, metadata: any) => {
        const text = data.toString("utf8");
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speakerName = metadata?.userName || "Unknown";

        console.log(`[RTMS] [${elapsedSec.toFixed(1)}s] ${speakerName}: ${text}`);
        postTranscript(lectureId, text, elapsedSec, speakerName);
      });

      client.onJoinConfirm((reason: number) => {
        console.log(`[RTMS] Joined meeting (reason: ${reason})`);
        startTime = Date.now();
      });

      client.onLeave((reason: number) => {
        console.log(`[RTMS] Left meeting (reason: ${reason})`);
        clients.delete(streamId);
        activeLectureId = null;
      });

      client.join(payload);
      console.log(`[RTMS] Connecting to Zoom meeting stream...`);
    })();
  });

  console.log("[RTMS] Zoom RTMS integration initialized");
  console.log("[RTMS] Webhook endpoint: /webhook");
  console.log("[RTMS] OAuth callback: /auth");
}

export function getActiveLectureId(): string | null {
  return activeLectureId;
}
