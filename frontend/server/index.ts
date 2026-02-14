import path from "path";
import dotenv from "dotenv";

// Load .env from project root BEFORE anything else
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { setupSocket } from "./socket";
import { setupRTMS } from "./rtms";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

setupSocket(io);

// Initialize Zoom RTMS if credentials are configured
// JSON parsing is scoped to /webhook route only to avoid conflicting with Next.js body parsing
if (process.env.ZOOM_CLIENT_ID) {
  app.use("/webhook", express.json());
  setupRTMS(app);
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
