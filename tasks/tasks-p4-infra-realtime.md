# Tasks: Person 4 — Infrastructure & Real-time

> **Owner:** Person 4
> **Branch:** `feat/p4-infra`
> **Directory:** `frontend/server/`, `scripts/`
> **Responsibility:** Express custom server, Socket.IO server, Postgres connection pool (`pg`), Zoom RTMS / transcript simulator, demo mode auto-responder, `.env` loading, Render deployment

## Relevant Files

- `frontend/server/index.ts` - Express custom server entry point (integrates Next.js + Socket.IO)
- `frontend/server/socket.ts` - Socket.IO server setup + room management handlers
- `frontend/server/socket-helpers.ts` - Exported emit helpers (`emitToLectureRoom`, `emitToStudent`, `emitToProfessor`, `getStudentsInLecture`)
- `frontend/server/db.ts` - Supabase JS client (shared by all Next.js API routes)
- `frontend/server/simulator.ts` - Transcript simulator for demo mode (timed POST calls)
- `frontend/server/auto-responder.ts` - Demo auto-responder (listens for poll events, sends scripted answers)
- `frontend/server/rtms.ts` - Zoom RTMS integration (stretch goal)
- `frontend/src/app/api/lectures/route.ts` - Lecture creation endpoint (POST)
- `frontend/src/app/api/lectures/[id]/transcript/route.ts` - Transcript ingestion (SHARED with Person 3 — Person 4 handles data layer, Person 3 handles AI)
- `frontend/package.json` - Dependencies
- `frontend/tsconfig.json` - TypeScript config
- `frontend/next.config.js` - Next.js configuration
- `render.yaml` - Render deployment blueprint (frontend only)
- `api/Dockerfile` - Cloud Run deployment for Flask API

### Notes

- Use `@supabase/supabase-js` for DB access from Next.js. All Next.js API routes import the Supabase client from `frontend/server/db.ts`.
- The Express server MUST load `.env` from the project root BEFORE initializing Next.js: `require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })`.
- The Socket.IO server instance must be accessible from Next.js API routes. Store it as a module-level singleton in `socket.ts` that `socket-helpers.ts` imports.
- The transcript route is SHARED with Person 3. Person 4 creates the route file and handles: receiving the POST, storing the transcript chunk in DB, calling Person 3's `detectConcepts()` function, calling Flask attendance-boost, and emitting Socket.IO events. Person 3 exports the `detectConcepts()` function from `frontend/src/lib/prompts/concept-detection.ts`.
- The custom Express server means this project CANNOT deploy on Vercel. Render only.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [ ] 0.0 Create feature branch
  - [ ] 0.1 Run `git checkout -b feat/p4-infra` from `main`

- [ ] 1.0 Set up Express custom server with Next.js and Socket.IO
  - [ ] 1.1 Create the Next.js project if it doesn't exist: `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir`. **Coordinate with Person 2** — Person 4 creates the project first, Person 2 adds UI scaffolding on top.
  - [ ] 1.2 Install server dependencies: `cd frontend && npm install express socket.io socket.io-client @anthropic-ai/sdk @supabase/supabase-js dotenv tsx`
  - [ ] 1.3 Create `frontend/server/index.ts`:
    - Load `.env` from project root: `require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })`
    - Create Express app
    - Create HTTP server from Express
    - Initialize Socket.IO on the HTTP server (configure CORS for dev: `origin: "*"`)
    - Initialize Next.js (`next({ dev: process.env.NODE_ENV !== 'production' })`)
    - After Next.js is ready, add Express middleware to handle Next.js requests: `app.all('*', (req, res) => nextHandler(req, res))`
    - Start listening on `process.env.PORT || 3000`
    - Import and call socket setup from `./socket.ts`
  - [ ] 1.4 Add scripts to `package.json`: `"dev": "tsx server/index.ts"`, `"build": "next build"`, `"start": "tsx server/index.ts"`. Using `tsx` for both dev and production avoids needing a separate TypeScript compilation step for the `server/` directory. No `tsconfig.server.json` needed — `tsx` handles it.
  - [ ] 1.5 No separate `tsconfig.server.json` needed — `tsx` handles TypeScript execution for server files without a compilation step
  - [ ] 1.6 Verify: `npm run dev` starts Express + Next.js + Socket.IO. Visit `http://localhost:3000`, confirm Next.js pages load. Open browser console, confirm Socket.IO connects (you can add a temp `connection` log in socket setup).

- [ ] 2.0 Set up shared Postgres connection pool and .env loading
  - [ ] 2.1 Create `frontend/server/db.ts`:
    - Import `createClient` from `@supabase/supabase-js`
    - Create and export a Supabase client: `export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)`
    - Note: `.env` is already loaded by `server/index.ts` before this module is imported
  - [ ] 2.2 Verify: in `server/index.ts`, after Supabase client creation, run a test query (e.g., `supabase.from('courses').select('id').limit(1)`) and log the result to confirm Supabase connectivity
  - [ ] 2.3 Add a path alias in `frontend/tsconfig.json` so API routes can cleanly import server modules. Add `"@server/*": ["./server/*"]` to the `paths` object. This lets API routes use `import { query } from '@server/db'` and `import { emitToStudent } from '@server/socket-helpers'` instead of brittle relative paths.
  - [ ] 2.4 Verify: create a simple API route that imports `{ supabase }` from `@server/db`, runs a test query, and returns the result. Confirm the path alias works.

> **MERGE POINT 1:** After completing tasks 0.0–2.0, merge to `main`. This is the foundation — Person 2 needs the Next.js project structure, Person 3 needs the DB pool and Socket.IO helpers. Coordinate so Person 1 also merges their Flask scaffolding at this point. After this merge, everyone has a working local dev setup.

- [ ] 3.0 Implement Socket.IO room management and helper functions
  - [ ] 3.1 Create `frontend/server/socket.ts`:
    - Export a `setupSocket(io: Server)` function that registers event handlers
    - Handle `lecture:join` event: extract `{ lectureId, role, studentId? }` from the payload, join the socket to room `lecture:${lectureId}`. If role is 'professor', also join room `professor:${lectureId}`. If role is 'student', also join room `student:${studentId}`.
    - Maintain an in-memory map of `lectureId → Set<studentId>` to track which students are in each lecture (updated on join/disconnect)
    - Handle `disconnect`: remove the student from the lecture's student set
  - [ ] 3.2 Create `frontend/server/socket-helpers.ts` — export these 4 functions (they all need access to the `io` instance, so import it from `socket.ts`):
    ```typescript
    export function emitToLectureRoom(lectureId: string, event: string, data: any): void
    // emits to room `lecture:${lectureId}`

    export function emitToStudent(studentId: string, event: string, data: any): void
    // emits to room `student:${studentId}`

    export function emitToProfessor(lectureId: string, event: string, data: any): void
    // emits to room `professor:${lectureId}`

    export function getStudentsInLecture(lectureId: string): string[]
    // returns the list of connected student IDs from the in-memory map
    ```
  - [ ] 3.3 Verify: open two browser tabs, have one join as professor and one as student. Emit a test event from the server, confirm both receive it. Confirm `getStudentsInLecture()` returns the connected student ID.

- [ ] 4.0 Build lecture creation and transcript ingestion endpoints
  - [ ] 4.1 Create `frontend/src/app/api/lectures/route.ts` (POST handler):
    - Accept `{ courseId, title }`
    - Insert a `lecture_sessions` row (status='live', started_at=NOW())
    - Return `{ id, courseId, title, status: "live" }`
  - [ ] 4.2 Create `frontend/src/app/api/lectures/[id]/transcript/route.ts` (POST handler) — **this is the SHARED route with Person 3**:
    - Accept `{ text, timestamp, speakerName? }`
    - **Step 1 (Person 4):** Insert a `transcript_chunks` row with the text, timestamp, speaker_name, and lecture_id
    - **Step 2 (Person 3):** Call Person 3's `detectConcepts(text, conceptLabels)` function. This requires the concept label list — pre-fetch it from Flask `GET /api/courses/:courseId/graph` when the first transcript chunk arrives, then cache the label→ID map in memory for the lecture's duration.
    - **Step 3 (Person 4):** For each detected concept label, resolve to UUID using the cached map, insert `transcript_concepts` rows linking the chunk to the concepts
    - **Step 4 (Person 4):** Call Flask `POST /api/mastery/attendance-boost` with `{ concept_ids: [detected UUIDs], student_ids: getStudentsInLecture(lectureId) }`. **DEPENDENCY: Person 1's attendance-boost endpoint** (available after Merge Point 2).
    - **Step 5 (Person 4):** Emit Socket.IO events:
      - `transcript:chunk` to lecture room: `{ text, timestamp, detectedConcepts: [{ id, label }] }`
      - `lecture:concept-detected` to lecture room for each concept: `{ conceptId, label }`
    - Return `{ chunkId, detectedConcepts: [{ id, label }] }`
  - [ ] 4.3 **Coordination note:** Person 3 creates the `detectConcepts()` function in task P3 2.4. Until that's available, stub it: `async function detectConcepts(text: string, labels: string[]): Promise<string[]> { return []; }`. Replace with the real import after Person 3 merges.
  - [ ] 4.4 Verify: POST a transcript chunk, confirm it's stored in DB, Socket.IO events fire. Once Person 3's detection is merged, confirm concepts are detected and linked.

> **MERGE POINT 2:** After completing tasks 3.0–4.0, merge to `main`. Person 2 needs Socket.IO helpers to wire up real-time listeners. Person 3 needs the DB pool and emit helpers for their API routes. Coordinate with Person 1's Merge Point 2 (mastery endpoints).

- [ ] 5.0 Build transcript simulator for demo mode
  - [ ] 5.1 Create `frontend/server/simulator.ts`:
    - Export a `startSimulator(lectureId: string, courseId: string): void` function
    - The simulator reads from a hardcoded array of transcript chunks — write ~20-30 chunks covering a 3-minute "lecture" about neural networks and backpropagation (the demo topic). Each chunk should be 1-3 sentences of realistic lecture dialogue.
    - Every 3-5 seconds (randomized), POST the next chunk to `POST /api/lectures/:id/transcript` with `{ text, timestamp, speakerName: "Professor" }`
    - The `timestamp` should increment realistically (e.g., chunk 1 at 0s, chunk 2 at 4s, chunk 3 at 7s...)
    - Include concept-rich chunks that will trigger detection of: Chain Rule, Gradients, Backpropagation, Computational Graphs, Loss Functions, Gradient Descent (these are the concepts the demo will focus on)
    - Stop after all chunks are sent (or when `stopSimulator()` is called)
  - [ ] 5.2 Export a `stopSimulator(): void` function that clears the interval/timeout
  - [ ] 5.3 Wire the simulator to the "Start Demo" button flow: when the professor dashboard calls `POST /api/lectures` (creating a lecture), if `DEMO_MODE=true`, automatically start the simulator for that lecture. Add this logic in the lecture creation route or as a separate `POST /api/lectures/:id/start-demo` endpoint.
  - [ ] 5.4 Verify: start a demo lecture, confirm transcript chunks appear in real-time on the professor dashboard (via Socket.IO events). Confirm concept detection fires for relevant chunks.

- [ ] 6.0 Build demo auto-responder for simulated students
  - [ ] 6.1 Create `frontend/server/auto-responder.ts`:
    - Export a `onPollActivated(pollId: string, question: string, conceptLabel: string): void` function. Person 3's poll activate route calls this directly (no Socket.IO listener needed — the auto-responder runs in the same process).
    - When called, after a random 5-15 second delay per student, call `POST /api/polls/:pollId/respond` for each of the 3 auto-responding students. **DEPENDENCY: Person 3's respond endpoint must be merged** (Merge Point 2).
    - Scripted answers per student (matching CLAUDE.md seed data roles):
      - **Alex (correct):** Submit a well-reasoned, accurate answer that Claude will evaluate as "correct"
      - **Jordan (partial):** Submit an answer with the right intuition but missing key details — Claude should evaluate as "partial"
      - **Taylor (wrong):** Submit a clearly incorrect or confused answer — Claude should evaluate as "wrong"
    - Use student IDs from the seed data. These can be hardcoded or fetched from Flask `GET /api/courses/:id/students` on startup.
  - [ ] 6.2 Write 3-5 sets of scripted answer templates for different ML concepts (Chain Rule, Backpropagation, Gradient Descent, etc.) so the auto-responder gives concept-appropriate answers, not generic ones
  - [ ] 6.3 No startup initialization needed — Person 3's activate route imports and calls `onPollActivated()` directly when `DEMO_MODE=true`. Just ensure the function is exported from `@server/auto-responder`.
  - [ ] 6.4 Verify: activate a poll, confirm 3 auto-responses appear after a delay. Check that Alex → green, Jordan → yellow, Taylor → red in the mastery data. Confirm the professor dashboard heatmap updates.

> **MERGE POINT 3:** After completing tasks 5.0–6.0, merge to `main`. This aligns with Person 2 merging Socket.IO wiring and Person 3 merging AI routes. After this merge, the full end-to-end demo should work: start demo → transcript flows → professor generates question → Sam (live) + 3 auto-responders answer → mastery updates → heatmap updates → tutoring.

- [ ] 7.0 Configure Render deployment for both services
  - [ ] 7.1 Create `render.yaml` at the project root (Render Blueprint — frontend only):
    ```yaml
    services:
      - type: web
        name: prereq-frontend
        runtime: node
        buildCommand: cd frontend && npm install && npm run build
        startCommand: cd frontend && npx tsx server/index.ts
        envVars:
          - key: FLASK_API_URL
            sync: false  # Set to Cloud Run Flask service URL after deploying
          - key: SUPABASE_URL
            sync: false
          - key: SUPABASE_KEY
            sync: false
          - key: ANTHROPIC_API_KEY
            sync: false
          - key: PERPLEXITY_API_KEY
            sync: false
          - key: DEMO_MODE
            value: "true"
    ```
  - [ ] 7.2 Create `api/Dockerfile` for Cloud Run deployment (adapt from `knowledge-graph/Dockerfile`):
    ```dockerfile
    FROM python:3.12-slim
    WORKDIR /app
    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    COPY . .
    EXPOSE 8080
    ENTRYPOINT ["sh", "-c", "gunicorn main:app --bind 0.0.0.0:$PORT"]
    ```
  - [ ] 7.3 Ensure the Flask app binds to `0.0.0.0` and uses `PORT` env var: `app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))`
  - [ ] 7.4 Ensure the Express server uses `process.env.PORT` (Render sets this)
  - [ ] 7.5 Build the Next.js production bundle: `cd frontend && npm run build`. Fix any build errors (common: SSR issues with react-force-graph-2d if not properly dynamic-imported).
  - [ ] 7.6 Test production mode locally: `cd frontend && NODE_ENV=production npx tsx server/index.ts`. Confirm pages load and Socket.IO connects.
  - [ ] 7.7 Deploy Flask API to Cloud Run: `gcloud run deploy prereq-api --source api/ --region us-central1 --allow-unauthenticated`. Set env vars: `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`.
  - [ ] 7.8 Deploy frontend to Render: push to GitHub, connect the repo to Render, deploy using the blueprint. Set `FLASK_API_URL` to the Cloud Run service URL.
  - [ ] 7.9 Verify: Flask health check responds on Cloud Run. Frontend loads on Render. Socket.IO connects. Run the seed script against Supabase. Start a demo lecture and confirm end-to-end flow works.

> **MERGE POINT 4 (Final):** Merge deployment config to `main`. All 4 devs should be on `main` at this point for final demo rehearsal on the deployed environment (Render frontend + Cloud Run Flask API + Supabase DB).

- [ ] 8.0 Implement Zoom RTMS integration (if access obtained, otherwise skip)
  - [ ] 8.1 Install `@zoom/rtms` package: `npm install @zoom/rtms` (requires Node.js 20.3.0+)
  - [ ] 8.2 Create `frontend/server/rtms.ts`:
    - Use Zoom RTMS SDK to connect to a live Zoom meeting
    - Register for audio streams
    - Pipe raw audio to Deepgram's streaming API for real-time transcription
    - Deepgram returns transcript text — POST each chunk to `POST /api/lectures/:id/transcript` (same endpoint the simulator uses)
  - [ ] 8.3 Set up Deepgram: create account for $200 free credits, get API key, add `DEEPGRAM_API_KEY` to `.env`
  - [ ] 8.4 Add a toggle: if `ZOOM_CLIENT_ID` is set, use RTMS; otherwise fall back to the transcript simulator
  - [ ] 8.5 Verify: join a Zoom meeting, confirm audio is transcribed and concept detection works in real-time
  - [ ] 8.6 **This entire task is a stretch goal.** The demo works identically with the transcript simulator. Only attempt if RTMS access is confirmed and there's time remaining.
