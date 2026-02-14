import path from "path";
import dotenv from "dotenv";

// Load .env from project root BEFORE anything else
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { setupSocket } from "./socket";
const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

setupSocket(io);

// Initialize Zoom RTMS if credentials are configured
// Dynamic import avoids loading the native @zoom/rtms binary when not needed (e.g. on Render)
if (process.env.ZOOM_CLIENT_ID) {
  app.use("/webhook", express.json());
  import("./rtms").then(({ setupRTMS }) => setupRTMS(app)).catch((err) => {
    console.warn("[RTMS] Failed to load Zoom RTMS module:", err.message);
  });
}

const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  app.all("/{*path}", (req, res) => {
    return nextHandler(req, res);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server attached`);
  });
});
