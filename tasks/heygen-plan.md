# HeyGen Streaming Avatar Integration Plan

## Context

Upgrade the text-only AI tutor at `/student/[studentId]/tutor` with a HeyGen streaming avatar that lip-syncs Claude's tutoring responses. HeyGen is **purely a presentation layer** — the entire backend (Claude prompts, mastery updates, understanding checks) stays unchanged. We pipe Claude's text response through `avatar.speak()` instead of only displaying it as a chat bubble.

**Graceful degradation is built in:** if `HEYGEN_API_KEY` is not set or the session fails, the page renders identically to the current text-only UI. The avatar is additive — the text chat always works.

---

## HeyGen API Overview

| Aspect | Detail |
|--------|--------|
| SDK | `@heygen/streaming-avatar` npm package |
| Protocol | WebRTC for media streaming |
| Session flow | Create token → `newSession()` → `startSession()` → `speak({ text })` → `stopAvatar()` |
| Latency | ~6-9s end-to-end in practice |
| Session limit | 10 min max per session |
| Text limit | 5,000 chars per `speak()` call |
| Cost | ~$0.10-0.20/min; free tier = 10 credits (50 min) |
| Token endpoint | `POST https://api.heygen.com/v1/streaming.create_token` with `x-api-key` header |
| Key events | `STREAM_READY`, `STREAM_DISCONNECTED`, `AVATAR_START_TALKING`, `AVATAR_STOP_TALKING` |
| Docs | https://docs.heygen.com/docs/streaming-avatar-sdk |

---

## Files to Create

### 1. `frontend/src/app/api/heygen/token/route.ts` — Token Proxy

Server-side Next.js API route that proxies HeyGen token creation. Keeps the API key out of the browser.

- `POST /api/heygen/token`
- Calls `POST https://api.heygen.com/v1/streaming.create_token` with `x-api-key` header
- Returns `{ token }` on success
- Returns `503` if `HEYGEN_API_KEY` env var is missing (signals graceful degradation)
- Returns `502` if HeyGen upstream fails

### 2. `frontend/src/hooks/useHeyGenAvatar.ts` — Avatar Lifecycle Hook

Custom React hook that encapsulates all HeyGen session management. Components only interact with: `status`, `mediaStream`, `speak(text)`, `startSession()`, `endSession()`.

**State exposed:**
- `status`: `"idle" | "loading" | "ready" | "speaking" | "error" | "reconnecting"`
- `mediaStream`: `MediaStream | null` (for `<video>` element)
- `isTalking`: boolean
- `sessionTimeRemaining`: number | null (countdown in seconds)

**Key behaviors:**
- Fetches token from `/api/heygen/token`, creates `StreamingAvatar` instance
- Uses `TaskType.REPEAT` (not `TALK`) — avatar says exactly what Claude generated, no HeyGen built-in LLM
- Auto-reconnects at 9:30 into a 10-min session (seamless token + session restart)
- On `STREAM_DISCONNECTED`, retries after 2s delay
- Text chunking on sentence boundaries if response > 4500 chars (safety margin under 5000 limit)
- All errors logged but never break text chat flow
- Cleanup on unmount: `stopAvatar()` + clear all timers

### 3. `frontend/src/components/tutor/AvatarDisplay.tsx` — Video Component

Presentational component that receives `mediaStream` and renders `<video>` with status overlays.

- `<video>` always mounted, opacity-toggled (avoids reflow on stream connect)
- Blue pulsing ring when avatar is talking
- Loading spinner for `"loading"` / `"reconnecting"` states
- Error state with retry button
- Session timer badge shown in last 2 minutes
- `aspect-video` (16:9) container with `rounded-2xl`, dark background

---

## Files to Modify

### 4. `frontend/src/components/tutor/ChatInterface.tsx` (minimal change)

Add one optional prop to the interface and one line in `handleSend`:

```diff
 interface ChatInterfaceProps {
   sessionId: string;
   initialMessages: ChatMessage[];
   onMasteryUpdate?: (updates: MasteryUpdate[]) => void;
+  onAssistantMessage?: (text: string) => void;
 }
```

After line 174 (`setMessages((prev) => [...prev, assistantMsg]);`), add:
```typescript
onAssistantMessage?.(assistantMsg.content);
```

This is the **only** change to ChatInterface. It remains fully functional without the prop.

### 5. `frontend/src/app/student/[studentId]/tutor/page.tsx` (layout + wiring)

**New imports:** `AvatarDisplay`, `useHeyGenAvatar`, `Video`/`VideoOff` icons

**New state:**
- `avatarEnabled` (boolean, default `true`) — user toggle
- `avatarAvailable` (boolean, default `true`) — set to `false` if token endpoint returns 503

**Hook instantiation:**
```typescript
const { status, mediaStream, isTalking, startSession, speak, interrupt, endSession, sessionTimeRemaining } = useHeyGenAvatar({
  onError: () => setAvatarAvailable(false),
});
```

**New effects:**
- Start avatar session when `sessionId` is set and `avatarEnabled && avatarAvailable`
- Speak initial message once `avatarStatus === "ready"` (with ref guard to prevent double-speak)
- Cleanup: `endAvatarSession()` on unmount

**New handler:**
```typescript
const handleAssistantMessage = (text: string) => {
  if (avatarEnabled && avatarStatus !== "error") {
    interrupt().then(() => speak(text));
  }
};
```

**Layout change** — from 2-panel to 3-zone:
```
┌──────────┬──────────────────────────┐
│          │  AvatarDisplay (max 40%) │
│ Sidebar  ├──────────────────────────┤
│ (280px)  │  ChatInterface (flex-1)  │
│          │                          │
└──────────┴──────────────────────────┘
```

When avatar is disabled/unavailable, ChatInterface takes 100% of right panel (identical to current).

**Header addition:** Toggle button (Video/VideoOff icon) to switch between avatar and text-only mode. Only shown when `avatarAvailable` is true.

### 6. `frontend/package.json`

Add dependency:
```
"@heygen/streaming-avatar": "^2.0.0"
```

(May also need `livekit-client` as peer dep — check at install time)

### 7. `.env.example`

Add at bottom:
```bash
# HeyGen Streaming Avatar (optional — if not set, tutoring uses text-only mode)
HEYGEN_API_KEY=
```

---

## Architecture Diagram

```
Student types message
        |
        v
ChatInterface.handleSend()
        |
        v
POST /api/tutoring/sessions/{id}/messages  <-- UNCHANGED
  (Claude Sonnet + Haiku understanding check + mastery update)
        |
        | response text
        v
ChatInterface displays text bubble  <-- UNCHANGED
        |
        | onAssistantMessage(text)  <-- NEW callback
        v
page.tsx handleAssistantMessage()
        |
        | interrupt() then speak(text)
        v
useHeyGenAvatar hook
        |
        | avatar.speak({ text, taskType: REPEAT })
        v
HeyGen WebRTC --> <video> element in AvatarDisplay
```

---

## Implementation Order

| Step | What | Est. Time |
|------|------|-----------|
| 1 | Add `HEYGEN_API_KEY` to `.env.example` and `.env` | 2 min |
| 2 | `npm install @heygen/streaming-avatar` (+ peer deps) | 5 min |
| 3 | Create `api/heygen/token/route.ts` — token proxy | 10 min |
| 4 | Create `hooks/useHeyGenAvatar.ts` — lifecycle hook | 30 min |
| 5 | Create `components/tutor/AvatarDisplay.tsx` — video component | 20 min |
| 6 | Modify `ChatInterface.tsx` — add `onAssistantMessage` prop | 5 min |
| 7 | Modify tutor `page.tsx` — wire hook, layout, toggle | 30 min |
| 8 | Test full flow + fallback | 15 min |

**Total: ~2 hours**

---

## Error Handling & Fallback Matrix

| Failure Point | Detection | Fallback |
|---|---|---|
| No `HEYGEN_API_KEY` in env | Token route returns 503 | `avatarAvailable = false`, text-only mode (current UI) |
| HeyGen token creation fails | Token route returns 502 | Hook sets `status = "error"`, retry button shown, text chat unaffected |
| `createStartAvatar()` throws | Caught in hook | `status = "error"`, same as above |
| `STREAM_DISCONNECTED` mid-session | Event listener | Auto-reconnect after 2s, text chat unaffected |
| `speak()` throws | Caught in hook's speak method | Error logged, text already shown as bubble |
| 10-minute session expires | Timer in hook | Auto-restart with new token, seamless |
| User wants text-only | Toggle button in header | `endAvatarSession()`, avatar hidden, chat takes full space |

---

## Verification

1. **With API key set:** Start tutor session, verify avatar loads and speaks initial message. Send a message, verify avatar speaks the response while text bubble appears simultaneously. Check mastery update notifications still work.

2. **Without API key:** Remove `HEYGEN_API_KEY` from `.env`, restart. Verify the tutor page looks and works identically to the current text-only version — no errors, no avatar UI elements visible.

3. **Avatar toggle:** With API key set, click the "Text Only" toggle in header. Verify avatar disappears and chat takes full width. Click "Show Avatar" to re-enable.

4. **Error recovery:** Start session, then kill network briefly. Verify avatar shows "Reconnecting..." state, text chat continues working, avatar reconnects when network returns.

---

## Stretch: Voice Input

If time permits, add microphone input so students can speak instead of type:

1. Add mic toggle button next to text input in ChatInterface
2. Call `avatar.startVoiceChat({ useSilencePrompt: false })` — uses HeyGen's built-in Deepgram STT
3. Listen for `USER_TALKING_MESSAGE` events for transcribed text
4. On `USER_END_MESSAGE`, feed transcribed text into existing `handleSend()` path
5. Mute HeyGen's auto-LLM response — only use their STT, then route through our Claude pipeline

**Complexity:** Medium. Recommend deferring until core text-to-avatar is working.
