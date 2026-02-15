import path from "path";
import dotenv from "dotenv";

// Load .env from project root BEFORE anything else
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { setupSocket } from "./socket";
import transcriptRoute from "./transcript-route";
const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

setupSocket(io);

// Initialize Zoom RTMS — always attempt to load so per-teacher webhooks work
// even without global ZOOM_CLIENT_ID env var
app.use("/webhook", express.json());
app.use("/webhook/:teacherId", express.json());

let clearCredentialCacheFn: ((teacherId: string) => void) | null = null;

// Start RTMS import early, but don't block — we'll await it before registering the catch-all
const rtmsReady = import("./rtms").then(({ setupRTMS, clearCredentialCache }) => {
  setupRTMS(app);
  clearCredentialCacheFn = clearCredentialCache;
}).catch((err) => {
  console.warn("[RTMS] Zoom RTMS module unavailable:", err.message);
});

// Cache-clearing endpoint called by ZoomSettingsDialog after saving credentials
app.post("/api/zoom/clear-cache", express.json(), (req, res) => {
  const teacherId = req.query.teacherId as string;
  if (teacherId && clearCredentialCacheFn) {
    clearCredentialCacheFn(teacherId);
  }
  res.json({ ok: true });
});

const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

nextApp.prepare().then(async () => {
  // Wait for RTMS routes to register BEFORE the Next.js catch-all
  await rtmsReady;

  // Transcript route runs in Express context so Socket.IO emit works
  app.use(transcriptRoute);

  app.all("/{*path}", (req, res) => {
    return nextHandler(req, res);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server attached`);
  });
});
