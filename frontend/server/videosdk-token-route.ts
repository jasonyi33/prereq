/**
 * Express route for POST /api/zoom/videosdk-token
 *
 * Generates a JWT for the Zoom Video SDK UI Toolkit.
 * Requires ZOOM_VIDEO_SDK_KEY and ZOOM_VIDEO_SDK_SECRET env vars.
 */

import { Router, json } from "express";
import { KJUR } from "jsrsasign";

const router = Router();

router.post("/api/zoom/videosdk-token", json(), (req, res) => {
  const { topic, userIdentity } = req.body;
  if (!topic) return res.status(400).json({ error: "topic required" });

  const sdkKey = process.env.ZOOM_VIDEO_SDK_KEY;
  const sdkSecret = process.env.ZOOM_VIDEO_SDK_SECRET;
  if (!sdkKey || !sdkSecret) {
    return res.status(500).json({ error: "Video SDK credentials not configured" });
  }

  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours

  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  const payload = JSON.stringify({
    app_key: sdkKey,
    tpc: topic,
    role_type: 1,
    version: 1,
    iat,
    exp,
    ...(userIdentity && { user_identity: userIdentity }),
  });

  const token = KJUR.jws.JWS.sign("HS256", header, payload, sdkSecret);

  res.json({ token });
});

export default router;
