# PRD: Prereq — Live Zoom Classroom Intelligence Loop

## 1. Introduction / Overview

**Prereq** is a live Zoom companion that creates a personalized, evolving Knowledge Graph for every student in a course, powered by real-time AI analytics during lectures.

**The problem:** Lectures are one-size-fits-all. Professors have no real-time visibility into who is confused, and students leave class with unrecognized knowledge gaps that compound over time. Existing tools like iClicker use multiple-choice questions that don't measure real understanding, and professors only get aggregate pass/fail stats.

**The solution:** Prereq integrates with Zoom to listen to a live lecture, transcribe it, detect which concepts are being covered, and generate AI-powered poll questions for students in real-time. Students answer in natural language (not multiple choice). An AI evaluates each response, updates each student's personal knowledge graph (nodes go green/yellow/red), and feeds aggregate data to a professor dashboard showing exactly which concepts are landing and which aren't. After lecture, students enter a 1:1 AI tutoring session targeting their specific weak spots.

**Context:** This is a hackathon project (~48 hours) for a team of 4, targeting the Zoom Education Track, Anthropic Claude Agent SDK, Render deployment, and Perplexity Sonar prizes.

---

## 2. Goals

1. Build a working end-to-end demo showing the full loop: live lecture transcription -> concept detection -> AI-generated polling -> student knowledge graph updates -> professor heatmap dashboard -> post-lecture AI tutoring
2. Create a visually compelling knowledge graph visualization that updates in real-time during the demo (this is the "wow factor")
3. Integrate with Zoom RTMS for live audio transcription (with transcript simulator as fallback)
4. Demonstrate a multi-turn AI tutoring agent (Anthropic prize requirement)
5. Deploy both services on Render
6. Deliver a convincing 3-minute live demo with 2 active participants (1 professor, 1 student) and 3 simulated students

---

## 3. User Stories

### Professor

- **US-1:** As a professor, I want to upload my course syllabus/reader (PDF) at the start of the semester so that the system generates a knowledge graph of all concepts my course covers.
- **US-2:** As a professor, I want to start a Zoom lecture and have the system automatically transcribe and detect which concepts I'm covering in real-time.
- **US-3:** As a professor, I want to press a button to generate an AI-powered poll question based on what I just taught, so I don't have to write questions myself.
- **US-4:** As a professor, I want to see a live class-wide heatmap showing which concepts are green (understood), yellow (partial), or red (not understood) across all students.
- **US-5:** As a professor, I want to see AI-generated intervention suggestions when many students struggle with a concept (e.g., "15 students confused about X — try re-explaining with Y approach").
- **US-6:** As a professor, I want to view any individual student's knowledge graph to see their specific weak spots.

### Student

- **US-7:** As a student, I want to see my personal knowledge graph for the course, with each concept colored by my mastery level (green/yellow/red/gray).
- **US-8:** As a student, during a live lecture I want to receive AI-generated questions and answer in my own words (not multiple choice), so the system can assess my true understanding.
- **US-9:** As a student, after answering a poll, I want instant feedback — not a grade, but a nudge telling me what I got right and what to pay attention to.
- **US-10:** As a student, after lecture I want to enter a 1:1 AI tutoring chat that knows my knowledge graph and targets my specific weak concepts with Socratic questioning.
- **US-11:** As a student, I want the tutor to reference specific moments from today's lecture (e.g., "At minute 43, the professor explained X — review that clip").
- **US-12:** As a student, I want to click on a red/yellow node in my graph and see learning resources (explanations, videos, articles) tailored to that concept.

---

## 4. Functional Requirements

### 4.1 Course Setup & Knowledge Graph Generation

| # | Requirement |
| --- | --- |
| FR-1 | The system must allow a professor to create a new course with a name and description. |
| FR-2 | The system must allow a professor to upload a PDF (course reader, syllabus, lecture notes) for a course. |
| FR-3 | Upon PDF upload, the system must truncate the PDF to the first 10 pages (PyPDF2), encode it as base64, and send it to Claude (Sonnet) via the document API to generate a structured list of concept nodes (label, description, category, difficulty) and prerequisite edges between them. |
| FR-4 | The generated concept nodes and edges must be stored in the database and form the course's knowledge graph. |
| FR-5 | The system must expose an API endpoint that returns the full graph (nodes + edges) for a course, optionally overlaid with a specific student's mastery data. |
| FR-6 | When a new student joins a course, the system must eagerly create a `student_mastery` row for every concept in the course with confidence 0.0 (unvisited). Person 1's student creation endpoint handles this. Similarly, when new concepts are added via PDF upload, mastery rows must be created for all existing students in the course. This avoids LEFT JOIN / COALESCE complexity on every read. |

### 4.2 Live Lecture & Transcription

| # | Requirement |
| --- | --- |
| FR-7 | The system must connect to a live Zoom meeting via the RTMS SDK and receive raw audio streams. **Important:** RTMS requires a Zoom Developer Pack (paid add-on, must contact Zoom sales), a General App registered in the Zoom Marketplace with `meeting:rtms:read` scope, RTMS enabled at the account level by a Zoom admin, and end-users on Zoom client 6.5.5+. See "Zoom RTMS Integration" in Technical Considerations for full setup. |
| FR-8 | Raw audio must be piped to Deepgram for real-time transcription. Deepgram offers $200 free credits with no credit card required, which is sufficient for the hackathon. |
| FR-9 | **Fallback:** If RTMS access is unavailable, the system must support a transcript simulator that feeds pre-written lecture text chunk by chunk with realistic timing (every 3-5 seconds). The simulator and RTMS produce identical output — both POST transcript chunks to the same `/api/lectures/:id/transcript` endpoint. All downstream features work identically regardless of source. |
| FR-10 | Each transcript chunk must be sent to Claude (Haiku) along with the course's known concept labels to detect which concepts are currently being discussed. |
| FR-11 | Detected concepts must be stored and linked to the transcript chunk with its timestamp (for later retrieval by the tutoring agent). |
| FR-12 | When a concept is detected, the system must emit a Socket.IO event to update the professor dashboard and student views in real-time. |
| FR-13 | When a concept is covered in lecture, every present student must receive a small passive confidence boost (+0.05, capped at 0.3) for that concept. "Present" means connected to the lecture's Socket.IO room. Person 4's transcript route handler calls Flask's `POST /api/mastery/attendance-boost` after concept detection, using a `getStudentsInLecture()` helper (provided by Person 4 alongside the Socket.IO emit helpers) to determine connected student IDs. |

### 4.3 Live Polling System

| # | Requirement |
| --- | --- |
| FR-14 | The professor must be able to click a "Generate Question" button that calls Claude (Sonnet) with the current/recent concept and transcript context to produce a natural language question + expected answer. |
| FR-15 | The professor must be able to preview the generated question and then click "Send to Students" to broadcast it. |
| FR-16 | When a poll is activated, the system must emit a Socket.IO event that makes the question appear on all connected students' screens. |
| FR-17 | Students must be able to type a free-form natural language response (not multiple choice) and submit it. |
| FR-18 | Upon submission, the system must send the student's answer to Claude (Haiku) along with the question and expected answer for evaluation. |
| FR-19 | The evaluation must return: a confidence delta (how much to adjust the student's confidence score), a brief reasoning, and a feedback nudge to show the student. See "Mastery System" below for how confidence maps to display colors. |
| FR-20 | The student's confidence for the polled concept must be updated in the database. The displayed mastery color is always derived from the confidence value (see Mastery System). |
| FR-21 | After mastery update, the system must emit Socket.IO events to: (a) update that student's knowledge graph visualization and (b) update the professor's class-wide heatmap. |
| FR-22 | The professor must be able to close a poll and see aggregate results: distribution of mastery levels (green/yellow/red counts), total responses, and a brief AI-generated misconception summary. The close endpoint (Person 3) makes a Claude Haiku call with all student responses to identify common errors, returning `{ status, distribution, totalResponses, misconceptionSummary }`. |

### 4.4 Professor Dashboard

| # | Requirement |
| --- | --- |
| FR-23 | The professor dashboard must display a live transcript feed showing incoming text with detected concept tags highlighted. |
| FR-24 | The dashboard must display a concept heatmap — a grid/table where each row is a concept and cells are colored by aggregate mastery across all students (green/yellow/red/gray). The heatmap includes gray (unvisited) counts so the professor can see which concepts haven't been assessed yet. The heatmap data comes from the Flask API's `GET /api/courses/:id/heatmap` endpoint. |
| FR-25 | The dashboard must display a concept timeline showing which concepts have been detected during the lecture in chronological order. |
| FR-26 | The dashboard must display a student list with mini mastery indicators (colored dots). Clicking a student should show their individual knowledge graph. |
| FR-27 | The dashboard must include an intervention panel with a "Get Suggestions" button. When clicked, it calls `POST /api/lectures/:id/interventions` (Person 3) with the concept IDs that have high red counts. The endpoint calls Claude Sonnet with those concepts' labels, descriptions, and heatmap distribution, and returns actionable teaching suggestions (e.g., "Consider re-explaining using the geometric interpretation"). This is professor-initiated, not automatic. |
| FR-28 | The dashboard must include poll controls: generate question, preview, send, close, view results. |
| FR-29 | All dashboard components must update in real-time via Socket.IO (no page refresh needed). |

### 4.5 Student Knowledge Graph View

| # | Requirement |
| --- | --- |
| FR-30 | The student must see an interactive force-directed graph where each node is a concept, edges show prerequisite relationships, and node color reflects their personal mastery derived from confidence (see Mastery System). **Technical note:** `react-force-graph-2d` uses browser APIs (`window`, `document`) and is incompatible with Next.js server-side rendering. The component MUST be imported using `next/dynamic` with `{ ssr: false }`. See Technical Considerations for the exact pattern. |
| FR-31 | The currently active concept (being discussed in lecture) must visually pulse or glow on the graph. |
| FR-32 | Clicking a node must show a detail panel with: concept name, description, mastery color, confidence score, and learning resources. |
| FR-33 | Learning resources for a weak node must be fetched from the Perplexity Sonar API (relevant YouTube clips, articles, textbook references). Perplexity Sonar API is pay-as-you-go at $1/M tokens — requires prepaid credits (no free tier for API access). |
| FR-34 | The graph must update in real-time when mastery changes (via Socket.IO), with smooth color transitions. |

### 4.6 Post-Lecture AI Tutoring Agent

| # | Requirement |
| --- | --- |
| FR-35 | After a lecture ends, a student must be able to start a 1:1 tutoring session. |
| FR-36 | The system must automatically identify the student's red and yellow concept nodes (confidence < 0.7) to target during the session. |
| FR-37 | The tutoring agent must use Claude (Sonnet) with a system prompt that includes: course context, the student's weak concepts, and instructions for Socratic method (guide, don't lecture). |
| FR-38 | The agent must maintain multi-turn conversation history (this is the multi-turn agent for the Anthropic prize). |
| FR-39 | The agent must be able to reference specific timestamps from the lecture transcript (e.g., "At minute 43, the professor explained this with an example"). The agent's system prompt must include relevant transcript chunks with their timestamps for the concepts being discussed. |
| FR-40 | The agent must be able to search for supplementary resources via Perplexity Sonar and include them in responses. |
| FR-41 | To detect understanding mid-conversation: after each student message, the Next.js route must make a SECOND Claude call (Haiku) with the student's latest response and the target concepts, asking "Has the student demonstrated understanding? Reply JSON: {understood: boolean, concept_label: string}". The `concept_label` identifies which target concept was understood. If true, the system calls the Flask mastery endpoint with `{ delta: 0.2 }` for that concept. |
| FR-42 | The chat interface must display the student's weak concepts in a sidebar, with mastery colors updating in real-time as the conversation progresses. |

### 4.7 Demo Mode

| # | Requirement |
| --- | --- |
| FR-43 | The system must support a `DEMO_MODE` environment variable that enables demo-specific features. |
| FR-44 | In demo mode, the professor dashboard must include a "Start Demo" button that kicks off the transcript simulator. |
| FR-45 | In demo mode, 3 of 4 pre-seeded students must auto-respond to polls. **Sam is the live demo participant** (struggling profile — most dramatic visible changes). The auto-responder (Person 4, Next.js server module) listens for `poll:new-question` Socket.IO events and, after a random 5-15 second delay, calls `POST /api/polls/:pollId/respond` with scripted answers: **Alex → correct**, **Jordan → partial**, **Taylor → wrong**. |
| FR-46 | The seed script must create: 1 course (CS229 Machine Learning), ~35 concept nodes with prerequisite edges, and 4 students with different pre-seeded mastery profiles. |
| FR-47 | Student auth must be simplified: students pick their profile from a dropdown on the landing page (no login system). The selected student ID is stored in `localStorage` and a `studentId` cookie (for server-side access). The professor role is selected via a separate "Professor Mode" button on the same landing page. |

---

## 5. Mastery System (Confidence-Driven)

**Single source of truth:** The `confidence` float (0.0 to 1.0) in the `student_mastery` table is the authoritative value. The displayed mastery color is ALWAYS derived from confidence using these thresholds:

| Confidence Range | Display Color | Hex | Meaning |
| --- | --- | --- | --- |
| 0.0 (exactly) | Gray | #94a3b8 | Unvisited — concept hasn't been assessed |
| 0.01 - 0.39 | Red | #ef4444 | Not understood — misconception or doesn't know it |
| 0.40 - 0.69 | Yellow | #eab308 | Partial — right intuition but gaps remain |
| 0.70 - 1.0 | Green | #22c55e | Mastery — student understands the concept |
| N/A | Blue glow | #3b82f6 | Active — concept currently being discussed (overlay, not stored) |

**The `mastery` VARCHAR column in the DB is REMOVED.** Do not store a separate mastery string. Color is always computed from confidence at display time. This eliminates all contradictions.

**Confidence update rules:**

| Trigger | Confidence Change | Example |
| --- | --- | --- |
| Concept covered in lecture (passive) | +0.05 (capped: confidence cannot exceed 0.3 from passive alone) | Student attends lecture where "Chain Rule" is discussed → confidence goes from 0.0 to 0.05 |
| Poll answer — correct (Claude eval returns "correct") | Set to max(current, 0.85) | Student was at 0.45 (yellow) → jumps to 0.85 (green) |
| Poll answer — partial (Claude eval returns "partial") | Set to max(current, 0.50) | Student was at 0.20 (red) → jumps to 0.50 (yellow) |
| Poll answer — wrong (Claude eval returns "wrong") | Set to min(current, 0.20). Exception: if current is 0.0, set to 0.20. Answering wrong can never raise your score. | Student was at 0.60 (yellow) → drops to 0.20 (red). Student was at 0.0 (gray/unvisited) → becomes 0.20 (red). Student was at 0.10 (red) → stays 0.10. |
| Tutoring agent detects understanding (FR-41) | +0.20 (capped at 1.0) | Student was at 0.35 (red) → goes to 0.55 (yellow) |

**Note for Person 1 (Flask):** The `PUT /api/students/:id/mastery/:concept_id` endpoint accepts one of three body formats: (1) `{ confidence: float }` for absolute set, (2) `{ eval_result: "correct"|"partial"|"wrong" }` for poll responses — Flask applies the confidence rules above internally, or (3) `{ delta: float }` for relative changes like tutoring boosts — Flask adds delta, clamps to [0.0, 1.0]. It always returns `{ concept_id, old_color, new_color, confidence }`. This centralizes all confidence mutation logic in Flask so callers never need to know the current confidence value.

**Note for Person 3 (AI):** Claude's response evaluation prompt must return one of three values: `"correct"`, `"partial"`, or `"wrong"` — NOT colors. The Next.js API route passes `{ eval_result }` directly to Flask's mastery endpoint, which applies the confidence rules internally. Person 3 does NOT need to compute confidence values or know the student's current confidence — Flask handles everything.

---

## 6. Non-Goals (Out of Scope)

- **Voice/avatar agent** — The tutoring agent is text-only. No voice synthesis, no Heygen avatars.
- **Spaced repetition scheduling** — No scheduling of review sessions or reminders.
- **Attention drift detection** — No tracking of response times or engagement metrics.
- **Gradescope/iClicker integration** — No scraping or API integration with external grading tools.
- **Student authentication** — No login/signup system. Students pick a profile from a dropdown.
- **Multi-course / university-wide** — One course only for the demo. No cross-course knowledge graph stitching.
- **Prior course history import** — Mentioned in the pitch but mocked via pre-seeded confidence differences, not actually built.
- **Mobile UI** — Web-only. No responsive mobile design.
- **Zoom Apps marketplace submission** — The app runs as a standalone web app, not as a certified Zoom App.
- **Self-study quiz system** — Students can't independently take quizzes outside of live polls (stretch goal).

---

## 7. Design Considerations

### Layout: Professor Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  Prereq - Professor Dashboard          [Start Demo] btn │
├───────────────────┬─────────────────────┬───────────────┤
│                   │                     │               │
│  Transcript Feed  │  Concept Heatmap    │  Student List │
│  (scrolling text  │  (grid, rows =      │  (names +     │
│   with concept    │   concepts, colored │   colored     │
│   tags inline)    │   by class mastery) │   dots)       │
│                   │                     │               │
├───────────────────┴─────────────────────┴───────────────┤
│  Concept Timeline (horizontal pills, chronological)     │
├─────────────────────────────────────────────────────────┤
│  Poll Controls: [Generate Question] [Send] [Close]      │
│  Poll Results: distribution bar + misconception summary  │
├─────────────────────────────────────────────────────────┤
│  Intervention Panel: AI suggestions when concepts go red │
└─────────────────────────────────────────────────────────┘
```

### Layout: Student In-Lecture View
```
┌─────────────────────────────────────────────────────────┐
│  Prereq - Student View (Alex)              [Tutor] btn  │
├─────────────────────────┬───────────────────────────────┤
│                         │                               │
│  Knowledge Graph        │  Active Panel                 │
│  (force-directed,       │  ┌───────────────────────┐    │
│   colored nodes,        │  │ Poll Question          │   │
│   active concept        │  │ "Explain in your own   │   │
│   glows)                │  │  words why..."         │   │
│                         │  │                        │   │
│                         │  │ [textarea]             │   │
│                         │  │ [Submit]               │   │
│                         │  ├───────────────────────┤    │
│                         │  │ Feedback: "Good        │   │
│                         │  │ intuition but..."      │   │
│                         │  └───────────────────────┘    │
│                         │                               │
│                         │  Transcript Feed (smaller)    │
└─────────────────────────┴───────────────────────────────┘
```

### Layout: Student Tutoring View
```
┌─────────────────────────────────────────────────────────┐
│  Prereq - AI Tutor Session                              │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Weak        │  Chat Interface                          │
│  Concepts    │  ┌──────────────────────────────────┐    │
│  Sidebar     │  │ AI: "I noticed you struggled     │    │
│              │  │ with the chain rule..."           │    │
│  Chain Rule  │  │                                   │    │
│  ● Red       │  │ You: "I think it's about..."     │    │
│              │  │                                   │    │
│  Backprop    │  │ AI: "Good start! The key          │   │
│  ● Yellow    │  │ insight is..."                    │    │
│              │  │                                   │    │
│  Gradient    │  │ [Resource: YouTube clip 2:34]     │    │
│  ● Green     │  └──────────────────────────────────┘    │
│              │  [type message...]          [Send]       │
└──────────────┴──────────────────────────────────────────┘
```

---

## 8. Technical Considerations

### Two-Service Architecture

| Service | Tech | Port | Owner | Responsibilities |
| --- | --- | --- | --- | --- |
| **Frontend + Real-time** | Next.js 14 + Express + Socket.IO | 3000 | Person 2 (UI), Person 3 (AI routes), Person 4 (server/infra) | All frontend pages, Socket.IO WebSocket server, Zoom RTMS listener, Claude AI calls, Perplexity calls, poll management, tutoring chat |
| **Knowledge Graph API** | Flask (Python) | 5000 | Person 1 | Knowledge graph CRUD, PDF upload + concept extraction via Claude, mastery update endpoints, graph query endpoints, heatmap aggregation |

Both services connect to Supabase via client libraries (`supabase-py` for Flask, `@supabase/supabase-js` for Next.js). The Next.js service calls the Flask API over HTTP for graph/mastery operations using the `FLASK_API_URL` environment variable (localhost:5000 locally, Cloud Run URL in production).

### Database Write Ownership

**Critical: Each table is written to by exactly one service to prevent conflicts.**

| Table | Written by | Read by | Notes |
| --- | --- | --- | --- |
| `courses` | Flask | Both | Person 1 owns course CRUD |
| `concept_nodes` | Flask | Both | Created during PDF upload |
| `concept_edges` | Flask | Both | Created during PDF upload |
| `students` | Flask | Both | Person 1 owns student CRUD |
| `student_mastery` | Flask | Both | **All mastery writes go through Flask's PUT endpoint.** Next.js calls Flask over HTTP to update mastery. |
| `lecture_sessions` | Next.js | Both | Person 4 creates lectures when demo starts or RTMS connects |
| `transcript_chunks` | Next.js | Both | Person 4 writes from RTMS/simulator, Person 3 reads for tutoring |
| `transcript_concepts` | Next.js | Both | Person 3 writes during concept detection |
| `poll_questions` | Next.js | Both | Person 3 writes when generating questions |
| `poll_responses` | Next.js | Both | Person 3 writes when evaluating student answers |
| `tutoring_sessions` | Next.js | Next.js | Person 3 owns tutoring |
| `tutoring_messages` | Next.js | Next.js | Person 3 owns tutoring |

### Cross-Team Dependencies

These are the handoff points where one person's work depends on another's. Agree on these interfaces early.

| Dependency | Provider | Consumer | Interface | Notes |
| --- | --- | --- | --- | --- |
| Graph data for frontend | Person 1 (Flask) | Person 2 (Frontend) | `GET /api/courses/:id/graph?student_id=` → `{ nodes, edges }` | Person 2 needs this working to render the knowledge graph. Mock with hardcoded JSON until Flask is ready. |
| Mastery updates | Person 1 (Flask) | Person 3 (AI) | `PUT /api/students/:id/mastery/:concept_id` → `{ old_color, new_color, confidence }` | Person 3 calls this after every Claude evaluation. Mock with a simple function that returns dummy data until Flask is ready. |
| Heatmap data | Person 1 (Flask) | Person 2 (Frontend) | `GET /api/courses/:id/heatmap` → `{ concepts: [{ distribution }] }` | Person 2 renders the heatmap grid from this data. |
| Socket.IO event emission | Person 4 (Infra) | Person 2 (Frontend) | Socket.IO events (see event catalog in CLAUDE.md) | Person 2 subscribes to events. Person 4 provides `emitToRoom()` helper functions that Person 3's API routes call. |
| Claude prompt templates | Person 3 (AI) | Person 1 (Flask) | Person 3 writes the concept extraction prompt and gives it to Person 1 to integrate into the Flask upload endpoint. | Person 1 implements the PDF extraction + Claude call, but the prompt itself is authored by Person 3. |
| Poll evaluation endpoint | Person 3 (AI) | Person 4 (Infra) | `POST /api/polls/:pollId/respond` | Person 4's auto-responder (demo mode) calls this endpoint with scripted answers. Person 3 must have this endpoint working for the demo to function. |
| Transcript ingestion | Person 4 (Infra) | Person 3 (AI) | `POST /api/lectures/:id/transcript` | Person 4's simulator/RTMS feeds chunks here. Person 3's concept detection runs in this route. They share this endpoint — Person 4 handles receiving the data, Person 3 handles the AI processing within the same route handler. |

### react-force-graph-2d + Next.js SSR

`react-force-graph-2d` uses browser-only APIs (`window`, `document`, Canvas). It **will crash** during Next.js server-side rendering with "window is not defined."

**Required pattern for Person 2:**
```tsx
// frontend/src/components/graph/KnowledgeGraph.tsx
'use client';

import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false }
);

export default function KnowledgeGraph({ data, mastery }) {
  // ForceGraph2D only renders on client
  return <ForceGraph2D graphData={data} /* ... */ />;
}
```

**Known issue:** Dynamic imports break `ref` forwarding for `react-force-graph`. If you need to access the graph instance (e.g., to call `d3Force()`), use a callback ref pattern instead of `useRef`.

### Zoom RTMS Integration

**Requirements (verified via [Zoom RTMS docs](https://developers.zoom.us/docs/rtms/)):**
1. RTMS must be enabled at account level — this is a paid feature available via "Zoom Developer Pack" (must contact Zoom sales, no public pricing)
2. Register a **General App** (NOT Server-to-Server OAuth) in the Zoom Marketplace
3. Add scopes: `meeting:rtms:read` + meeting-related scopes under both Scopes and Access
4. End users must be on Zoom client 6.5.5+
5. The [`@zoom/rtms` npm package](https://www.npmjs.com/package/@zoom/rtms) (v0.0.2) requires Node.js 20.3.0+

**If RTMS access is obtained at the hackathon:** Person 4 implements the RTMS SDK connection in `frontend/server/rtms.ts`, pipes raw audio to Deepgram's streaming API ([$200 free credits](https://deepgram.com/pricing), no credit card needed), and POSTs transcript chunks to `/api/lectures/:id/transcript`.

**If RTMS access is NOT available:** Person 4 uses the transcript simulator (pre-written text, timed POSTs). The demo is functionally identical — all downstream features work the same way since both paths produce the same transcript chunk format.

### Key Dependencies

**Frontend (Next.js):**
- `next` 14+, `react` 18+, `typescript`
- `tailwindcss`, `shadcn/ui` components
- `socket.io` 4.x, `socket.io-client` 4.x
- `@anthropic-ai/sdk` (Claude API — [verified available](https://www.npmjs.com/package/@anthropic-ai/sdk))
- `react-force-graph-2d` 1.29+ ([verified available](https://www.npmjs.com/package/react-force-graph-2d), published 7 days ago)
- `recharts` (heatmap / charts)
- `@supabase/supabase-js` (Supabase client for direct DB reads/writes from Next.js)
- `express` (custom server for Socket.IO — [documented pattern](https://socket.io/how-to/use-with-nextjs))
- `@zoom/rtms` 0.0.2 (if RTMS access obtained)

**Knowledge Graph API (Flask):**
- `flask` 3.x, `flask-cors`
- `supabase` (Supabase Python client)
- `anthropic` Python SDK (for concept extraction)
- `pypdf2` (PDF page truncation for Claude's document API)
- `python-dotenv`, `gunicorn`

**External APIs:**
- [Anthropic Claude API](https://docs.anthropic.com/) — Model IDs: `claude-sonnet-4-5-20250929` (Sonnet), `claude-haiku-4-5-20251001` (Haiku). Verified available.
- [Perplexity Sonar API](https://docs.perplexity.ai/) — $1/M tokens (Sonar), $3/$15 (Sonar Pro). Pay-as-you-go, requires prepaid credits.
- [Deepgram](https://deepgram.com/pricing) — $200 free credits, no credit card. Real-time streaming supported.

### Deployment

- **Frontend (Render):** Next.js app (Node.js runtime, build: `cd frontend && npm install && npm run build`, start: `cd frontend && npx tsx server/index.ts`)
- **Flask API (Cloud Run):** Dockerfile in `api/`, start: `gunicorn app:app --bind 0.0.0.0:$PORT`
- **Database:** Supabase (hosted, same URL in all environments)
- Set `FLASK_API_URL` on the Render Next.js service to the Cloud Run Flask service URL
- Set `SUPABASE_URL` and `SUPABASE_KEY` on both services
- **Important:** Custom Express server prevents Vercel deployment. Render for frontend, Cloud Run for Flask API.

---

## 9. Success Metrics

| Metric | Target |
| --- | --- |
| End-to-end demo completes without errors | Full loop from transcript to graph update works live |
| Knowledge graph renders 35+ nodes with smooth interactions | No lag, nodes colored correctly |
| Poll question generated in < 5 seconds | Judges don't wait awkwardly |
| Professor heatmap updates within 2 seconds of student response | Feels "live" |
| Tutoring agent maintains coherent multi-turn conversation | At least 5 exchanges without losing context |
| Tutoring agent references lecture timestamps | At least once during demo |
| Demo runs on Render deployment (not localhost) | Both services accessible via public URLs |
| 3-minute pitch delivered with working live demo | Judges see the heatmap "aha" moment |

---

## 10. Open Questions

1. **Zoom RTMS access:** Can we get the Zoom Developer Pack at the hackathon (talk to Zoom booth)? If not, the transcript simulator is the path forward.
2. **CS229 course reader PDF:** Is the Stanford ML course reader PDF available? Or should we write a smaller synthetic syllabus (~5 pages)?
3. **Perplexity Sonar credits:** Do we have an API key with prepaid credits? The API has no free tier — even Pro subscribers get only $5/month credit.
4. **Deepgram account:** Someone needs to sign up for the $200 free credits (no card required).
5. **Render + Cloud Run accounts:** Render for frontend deployment, Cloud Run for Flask API. Have vendor credits been requested?
6. **CodeRabbit:** Set up on the GitHub repo?
7. **Anthropic API key:** Who has the key? Is there a shared team key or individual keys?

---

## Appendix A: Demo Script (~3 minutes)

| Scene | Duration | What happens | What to say |
| --- | --- | --- | --- |
| Pre-semester | 20s | Professor uploads PDF -> knowledge graph with 35 ML concepts appears | "Our AI decomposes the entire curriculum into a concept graph in seconds." |
| Two students | 15s | Show Student A (some green from prior courses) and Student B (all gray) side-by-side | "Each student's graph reflects their unique background." |
| Live lecture | 60s | Split screen. Transcript flows. Concepts light up. Professor generates question -> appears for all students. One answers well (green), one struggles (red). Heatmap updates. | "The professor teaches normally. Our AI detects concepts, generates questions, and evaluates understanding — all in real-time." |
| Professor insight | 20s | Dashboard shows "2/4 struggle with Chain Rule" + AI suggestion | "The professor sees exactly where the class is struggling. No more guessing." |
| Post-lecture tutor | 40s | Struggling student chats with AI tutor. References lecture timestamp. Links YouTube clip. Node goes red -> yellow. | "Every student gets a personal AI tutor that targets their specific gaps." |
| Close | 15s | Zoom out on full knowledge graph | "Every lecture makes every student's map more complete. No one falls behind." |

## Appendix B: Sponsor Prize Alignment

| Prize Track | How We Qualify |
| --- | --- |
| **Zoom Education Track** (primary) | RTMS integration for live lecture transcription, entire app is a Zoom companion |
| **Anthropic Claude Agent SDK** | Multi-turn tutoring agent (FR-35 through FR-42), concept extraction, question gen, response eval — 5 distinct Claude integrations |
| **Render** | Frontend deployed on Render, Flask API on Cloud Run, database on Supabase |
| **Perplexity Sonar** | Resource search for student weak nodes (FR-33, FR-40) |
| **Decagon** (stretch) | The tutoring agent is a conversational AI |
