# PRD: Prereq — Live Zoom Classroom Intelligence Loop

## 1. Introduction / Overview

**Prereq** is a live Zoom companion that creates a personalized, evolving Knowledge Graph for every student in a course, powered by real-time AI analytics during lectures.

**The problem:** Lectures are one-size-fits-all. Professors have no real-time visibility into who is confused, and students leave class with unrecognized knowledge gaps that compound over time. Existing tools like iClicker use multiple-choice questions that don't measure real understanding, and professors only get aggregate pass/fail stats.

**The solution:** Prereq integrates with Zoom to listen to a live lecture, transcribe it, detect which concepts are being covered, and generate AI-powered poll questions for students in real-time. Students answer in natural language (not multiple choice). An AI evaluates each response, updates each student's personal knowledge graph (nodes go green/yellow/red), and feeds aggregate data to a professor dashboard showing exactly which concepts are landing and which aren't. After lecture, students enter a 1:1 AI tutoring session targeting their specific weak spots, review AI-generated lecture summaries, study personalized learning pages, and find complementary study partners through AI-powered study group matching.

**Context:** This project started as a hackathon project (~48 hours) for a team of 4, targeting the Zoom Education Track, Anthropic Claude Agent SDK, Render deployment, and Perplexity Sonar prizes. It has since expanded beyond the initial hackathon scope with full authentication, study groups, lecture summaries, and personalized learning pages.

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
- **US-13:** As a professor, I want to sign up with email/password, create a course with an auto-generated join code, and optionally configure my Zoom RTMS credentials for live lecture transcription.
- **US-15:** As a professor, I want to upload PDFs on a dedicated upload page with drag-and-drop and preview the generated knowledge graph before starting lectures.

### Student

- **US-7:** As a student, I want to see my personal knowledge graph for the course, with each concept colored by my mastery level (green/yellow/red/gray).
- **US-8:** As a student, during a live lecture I want to receive AI-generated questions and answer in my own words (not multiple choice), so the system can assess my true understanding.
- **US-9:** As a student, after answering a poll, I want instant feedback — not a grade, but a nudge telling me what I got right and what to pay attention to.
- **US-10:** As a student, after lecture I want to enter a 1:1 AI tutoring chat that knows my knowledge graph and targets my specific weak concepts with Socratic questioning.
- **US-11:** As a student, I want the tutor to reference specific moments from today's lecture (e.g., "At minute 43, the professor explained X — review that clip").
- **US-12:** As a student, I want to click on a red/yellow node in my graph and see learning resources (explanations, videos, articles) tailored to that concept.
- **US-14:** As a student, I want to sign up with email/password and join a course using a join code shared by my professor.
- **US-16:** As a student, after a lecture I want to review an AI-generated summary of what was covered, with key bullet points.
- **US-17:** As a student, I want to find a study partner who has complementary strengths and weaknesses so we can help each other.

---

## 4. Functional Requirements

### 4.1 Course Setup & Knowledge Graph Generation

| # | Requirement |
| --- | --- |
| FR-1 | The system must allow a professor to create a new course with a name and description. Courses are owned by a teacher (via `teacher_id`) and automatically receive a unique join code (e.g., `CS229M`) for student enrollment. |
| FR-2 | The system must allow a professor to upload a PDF (course reader, syllabus, lecture notes) for a course via a dedicated upload page (`/professor/upload`) with drag-and-drop support and graph preview. |
| FR-3 | Upon PDF upload, the system must truncate the PDF to the first 10 pages (PyPDF2), encode it as base64, and send it to Claude (`claude-sonnet-4-20250514`) via the document API to generate a structured list of concept nodes (label, description, category, difficulty) and prerequisite edges between them. |
| FR-4 | The generated concept nodes and edges must be stored in the database and form the course's knowledge graph. |
| FR-4b | PDF extraction results must be cached in a `pdf_cache` table (keyed by file hash) to avoid redundant Claude calls for the same document. |
| FR-4c | Node importance must be scored via in-degree centrality (number of incoming edges) for layout and display prioritization. |
| FR-5 | The system must expose an API endpoint that returns the full graph (nodes + edges) for a course, optionally overlaid with a specific student's mastery data. |
| FR-6 | When a new student joins a course, the system must eagerly create a `student_mastery` row for every concept in the course with confidence 0.0 (unvisited). Person 1's student creation endpoint handles this. Similarly, when new concepts are added via PDF upload, mastery rows must be created for all existing students in the course. This avoids LEFT JOIN / COALESCE complexity on every read. |

### 4.2 Live Lecture & Transcription

| # | Requirement |
| --- | --- |
| FR-7 | The system must connect to a live Zoom meeting via the RTMS SDK and receive raw audio streams. **Important:** RTMS requires a Zoom Developer Pack (paid add-on, must contact Zoom sales), a General App registered in the Zoom Marketplace with `meeting:rtms:read` scope, RTMS enabled at the account level by a Zoom admin, and end-users on Zoom client 6.5.5+. Zoom credentials are now stored per-teacher in the `teachers` table. See "Zoom RTMS Integration" in Technical Considerations for full setup. |
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
| FR-30 | The student must see an interactive force-directed graph where each node is a concept, edges show prerequisite relationships, and node color reflects their personal mastery derived from confidence (see Mastery System). **Technical note:** The graph is rendered using raw `d3-force` with custom SVG, `motion` (Framer Motion) for smooth color transitions, and a dark glass-morphic theme. The `react-force-graph-2d` package is installed but NOT used — the custom d3-force implementation provides a left-to-right reveal animation, particle effects along edges, and position caching. See Technical Considerations for details. |
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

### 4.7 Demo Mode & Authentication

| # | Requirement |
| --- | --- |
| FR-43 | The system must support a `DEMO_MODE` environment variable that enables demo-specific features. |
| FR-44 | In demo mode, the professor dashboard must include a "Start Demo" button that kicks off the transcript simulator. |
| FR-45 | In demo mode, 3 of 4 pre-seeded students must auto-respond to polls. **Sam is the live demo participant** (struggling profile — most dramatic visible changes). The auto-responder (Person 4, Next.js server module) listens for `poll:new-question` Socket.IO events and, after a random 5-15 second delay, calls `POST /api/polls/:pollId/respond` with scripted answers: **Alex → correct**, **Jordan → partial**, **Taylor → wrong**. |
| FR-46 | The seed script must create: 1 course (CS229 Machine Learning), ~35 concept nodes with prerequisite edges, and 4 students with different pre-seeded mastery profiles. The seed script also creates Supabase Auth users for each participant with known credentials (see Seed Data section). |
| FR-47 | The system uses full Supabase Auth for authentication. Users sign up / sign in with email and password. The auth flow is: splash screen → "Get Started" → role-toggled auth form (Student / Professor, Sign In / Sign Up) → role-based redirect (teachers to course creation or dashboard, students to enrollment or course list). JWT tokens are managed by `auth-context.tsx` on the frontend and verified by `@optional_auth` / `@require_auth` middleware decorators on the Flask API. Students enroll via join codes (e.g., `CS229M`). |

### 4.8 Study Groups

| # | Requirement |
| --- | --- |
| FR-48 | A student must be able to opt-in to the study group matching pool by selecting concepts they want to study. Pool entries expire after 5 minutes. Reference: `api/src/routes/study_groups.py`, frontend page at `/student/[studentId]/study-group`. |
| FR-49 | The system must calculate a complementarity score between potential study partners based on mastery differences across shared concepts. Two students are considered complementary when one is strong where the other is weak (score threshold: 0.3). |
| FR-50 | When a match is found, the system pairs students automatically and generates a Zoom link. If no complementary partner is found but another student is waiting, the system falls back to an instant random match. |
| FR-51 | Students must be able to check their study group status (waiting, matched, or expired), opt out of the pool, or clear their current match. |

### 4.9 Lecture Summaries

| # | Requirement |
| --- | --- |
| FR-52 | After a lecture ends, the system must generate an AI summary using Claude Haiku, taking the full transcript text and course concept labels as input. Reference: `frontend/src/lib/prompts/lecture-summary.ts`. |
| FR-53 | The summary output must include `{ bullets: string[], title_summary: string }` — 4-6 bullet points and a short title. |
| FR-54 | Students must be able to view summaries on a dedicated summaries page (`/student/[studentId]/summaries`) with expandable lecture cards showing bullet points. |

### 4.10 Learning Pages & Practice Quizzes (Experimental)

| # | Requirement |
| --- | --- |
| FR-55 | The system must generate personalized learning pages for individual concepts using Claude Sonnet (in Flask), including explanations, examples, and further reading via Perplexity. Reference: `api/src/routes/pages.py`, `api/src/services/generate_content.py`. |
| FR-56 | The system must be able to query Perplexity Sonar Pro for supplementary resources and further reading on a concept. |
| FR-57 | The system must generate 5-question multiple-choice practice quizzes for a concept using Claude Sonnet, with options, correct answers, and explanations. |
| FR-58 | When a student submits a quiz, the system must score it, calculate a confidence boost based on the score, and update the student's mastery for that concept via Flask. |

**Note:** This feature is experimental with known bugs in `api/src/routes/pages.py`. DB tables: `learning_pages`, `practice_quizzes`, `quiz_questions`, `quiz_responses`.

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

**Implementation note — color scheme variants across the codebase:**
- **Canonical 4-bucket** (gray/red/yellow/green at 0.0/0.4/0.7): Used in `api/src/routes/graph.py`, `heatmap.py`, `study_groups.py`, and `frontend/src/lib/colors.ts` `confidenceToColor()`.
- **5-bucket variant** (gray/orange/yellow/lime/green): Used in `api/src/routes/students.py` — adds a "lime" band at 0.55-0.69 and uses "orange" instead of "red" for 0.01-0.39.
- **Frontend gradient fills**: `frontend/src/lib/colors.ts` has `confidenceToFill()` and `confidenceToNodeFill()`/`confidenceToNodeBorder()` functions with finer-grained intermediate thresholds (orange-200 at 0.2, yellow-200 at 0.4, lime-200 at 0.55, green-200 at 0.7) for smooth visual gradients in the knowledge graph.
- **"Red" hex**: The actual hex used for the "red" bucket in the frontend is `#fb923c` (Tailwind `orange-400`), not `#ef4444`.

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
- **Multi-course / university-wide** — One course only for the demo. No cross-course knowledge graph stitching.
- **Prior course history import** — Mentioned in the pitch but mocked via pre-seeded confidence differences, not actually built.
- **Mobile UI** — Web-only. No responsive mobile design.
- **Zoom Apps marketplace submission** — The app runs as a standalone web app, not as a certified Zoom App.
- **Self-study quiz system** — Partially built as an experimental feature (see Section 4.10: Learning Pages & Practice Quizzes). The concept-level quiz generation and scoring works, but the feature has known bugs and is not demo-ready.

---

## 7. Design Considerations

### Layout: Landing / Auth Flow
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                        prereq                           │
│         Real-time knowledge graphs for every lecture     │
│                                                         │
│                    [Get Started]                         │
│                                                         │
│      Works with: Zoom | Perplexity | Render | Anthropic │
└─────────────────────────────────────────────────────────┘
           ↓ Click "Get Started"
┌─────────────────────────────────────────────────────────┐
│                        prereq                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  [Sign In] [Sign Up]                              │  │
│  │  [Student] [Professor]     ← role toggle          │  │
│  │                                                   │  │
│  │  Name (signup only):  [____________]              │  │
│  │  Email:               [____________]              │  │
│  │  Password:            [____________]              │  │
│  │                                                   │  │
│  │  [Sign In as Student / Create Account]            │  │
│  └───────────────────────────────────────────────────┘  │
│                       ← Back                            │
└─────────────────────────────────────────────────────────┘
           ↓ Teacher → create course → /professor/upload
           ↓ Student → enter join code → /student/:id
```

### Layout: PDF Upload Page (`/professor/upload`)
```
┌─────────────────────────────────────────────────────────┐
│  Prereq — Upload Course Material          [Dashboard →] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │        Drag & drop your PDF here                  │  │
│  │            or click to browse                     │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [Upload & Generate Graph]                              │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Knowledge Graph Preview (d3-force rendered)      │  │
│  │  (appears after extraction completes)             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

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
│  Prereq - Student View (Sam)              [Tutor] btn   │
├─────────────────────────┬───────────────────────────────┤
│                         │                               │
│  Knowledge Graph        │  Tabbed Side Panel            │
│  (d3-force, dark        │  ┌───────────────────────┐    │
│   glass-morphic theme,  │  │ [Poll] [Feedback] ... │    │
│   left-to-right reveal, │  │                       │    │
│   colored nodes with    │  │ Poll Question          │   │
│   gradient fills,       │  │ "Explain in your own   │   │
│   particle effects      │  │  words why..."         │   │
│   along edges,          │  │                        │   │
│   smooth motion         │  │ [textarea]             │   │
│   transitions)          │  │ [Submit]               │   │
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

### Layout: Summaries Page (`/student/[studentId]/summaries`)
```
┌─────────────────────────────────────────────────────────┐
│  Prereq - Lecture Summaries                    [Back]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ▸ Lecture: Introduction to Neural Networks        │  │
│  │   Feb 14, 2026 • 45 min                          │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ▾ Lecture: Gradient Descent & Optimization        │  │
│  │   Feb 12, 2026 • 50 min                          │  │
│  │   • Covered gradient descent algorithm and its...  │  │
│  │   • Explained learning rate selection and...       │  │
│  │   • Introduced SGD as a faster alternative...      │  │
│  │   • Discussed convergence criteria...              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Layout: Study Group Page (`/student/[studentId]/study-group`)
```
┌─────────────────────────────────────────────────────────┐
│  Prereq - Study Groups                         [Back]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Select concepts to study:                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ☑ Chain Rule (Red) ☑ Backpropagation (Yellow)    │  │
│  │ ☐ Gradient Descent (Green) ☐ Matrices (Green)    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [Find Study Partner]                                   │
│                                                         │
│  Status: Waiting for match... (expires in 4:32)         │
│  — OR —                                                 │
│  Matched with Alex! Zoom link: [Join Meeting]           │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Technical Considerations

### Two-Service Architecture

| Service | Tech | Port | Owner | Responsibilities |
| --- | --- | --- | --- | --- |
| **Frontend + Real-time** | Next.js 16.1.6 + Express 5.2.1 + Socket.IO | 3000 | Person 2 (UI), Person 3 (AI routes), Person 4 (server/infra) | All frontend pages, Socket.IO WebSocket server, Zoom RTMS listener, Claude AI calls, Perplexity calls, poll management, tutoring chat |
| **Knowledge Graph API** | Flask (Python) | 8080 (via `$PORT`) | Person 1 | Knowledge graph CRUD, PDF upload + concept extraction via Claude, mastery update endpoints, graph query endpoints, heatmap aggregation, authentication, Redis caching, study groups, learning pages/quizzes |

Both services connect to Supabase via client libraries (`supabase-py` for Flask, `@supabase/supabase-js` for Next.js). The Next.js service calls the Flask API over HTTP for graph/mastery operations using the `FLASK_API_URL` environment variable (localhost:5000 locally, Render service URL in production via `RENDER_EXTERNAL_URL`).

### Database Write Ownership

**Critical: Each table is written to by exactly one service to prevent conflicts.**

| Table | Written by | Read by | Notes |
| --- | --- | --- | --- |
| `courses` | Flask | Both | Person 1 owns course CRUD |
| `concept_nodes` | Flask | Both | Created during PDF upload |
| `concept_edges` | Flask | Both | Created during PDF upload |
| `students` | Flask | Both | Person 1 owns student CRUD |
| `student_mastery` | Flask | Both | **All mastery writes go through Flask's PUT endpoint.** Next.js calls Flask over HTTP to update mastery. |
| `teachers` | Flask | Both | Created during auth signup (role=teacher) |
| `pdf_cache` | Flask | Flask | Caches concept extraction results by file hash |
| `lecture_sessions` | Next.js | Both | Person 4 creates lectures when demo starts or RTMS connects |
| `transcript_chunks` | Next.js | Both | Person 4 writes from RTMS/simulator, Person 3 reads for tutoring |
| `transcript_concepts` | Next.js | Both | Person 3 writes during concept detection |
| `poll_questions` | Next.js | Both | Person 3 writes when generating questions |
| `poll_responses` | Next.js | Both | Person 3 writes when evaluating student answers |
| `tutoring_sessions` | Next.js | Next.js | Person 3 owns tutoring |
| `tutoring_messages` | Next.js | Next.js | Person 3 owns tutoring |
| `learning_pages` | Flask | Both | Generated by Claude Sonnet in Flask |
| `practice_quizzes` | Flask | Both | Generated by Claude Sonnet in Flask |
| `quiz_questions` | Flask | Both | Part of practice quiz generation |
| `quiz_responses` | Flask | Both | Student quiz submissions |
| `study_group_pool` | Flask | Both | Students waiting for matches |
| `study_group_matches` | Flask | Both | Matched study group pairs |

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

### d3-force Knowledge Graph Rendering

The knowledge graph visualization uses raw `d3-force` with custom SVG rendering — NOT `react-force-graph-2d` (which is installed but unused).

**Implementation** (`frontend/src/components/graph/KnowledgeGraph.tsx`):
- **Layout engine:** `d3-force` simulation with `forceLink()`, `forceManyBody()`, `forceCollide()`, `forceX()`, `forceY()`
- **Rendering:** Custom SVG with `motion` (Framer Motion) for smooth color/position transitions
- **Visual theme:** Dark glass-morphic design with gradient node fills
- **Animation:** Left-to-right reveal animation based on topological level (node x position)
- **Effects:** Animated particles flowing along edges
- **Interaction:** Pan, zoom, node click for detail panel
- **Position caching:** Node positions are cached to prevent re-layout on mastery updates (only colors change)
- **Color system:** Uses `confidenceToNodeFill()` and `confidenceToNodeBorder()` from `frontend/src/lib/colors.ts` for gradient fills

**Why not react-force-graph-2d?** The custom d3-force implementation provides finer control over animation, theming, and the reveal effect. `react-force-graph-2d` is still in `package.json` but is not imported or used.

### Zoom RTMS Integration

**Requirements (verified via [Zoom RTMS docs](https://developers.zoom.us/docs/rtms/)):**
1. RTMS must be enabled at account level — this is a paid feature available via "Zoom Developer Pack" (must contact Zoom sales, no public pricing)
2. Register a **General App** (NOT Server-to-Server OAuth) in the Zoom Marketplace
3. Add scopes: `meeting:rtms:read` + meeting-related scopes under both Scopes and Access
4. End users must be on Zoom client 6.5.5+
5. The [`@zoom/rtms` npm package](https://www.npmjs.com/package/@zoom/rtms) (v1.0.2) requires Node.js 20.3.0+

**Multi-tenant credential management:** Zoom credentials (client ID, client secret, secret token) are now stored per-teacher in the `teachers` table rather than as global environment variables. Teachers configure their Zoom credentials via `PUT /api/teachers/:id/zoom-credentials` after signup.

**If RTMS access is obtained:** Person 4 implements the RTMS SDK connection in `frontend/server/rtms.ts`, pipes raw audio to Deepgram's streaming API ([$200 free credits](https://deepgram.com/pricing), no credit card needed), and POSTs transcript chunks to `/api/lectures/:id/transcript`.

**If RTMS access is NOT available:** Person 4 uses the transcript simulator (pre-written text, timed POSTs). The demo is functionally identical — all downstream features work the same way since both paths produce the same transcript chunk format.

### Redis Caching Layer

The Flask API includes an optional Redis caching layer (`api/src/cache.py`) with graceful degradation — if `REDIS_URL` is not set or Redis is unavailable, all cache operations silently no-op.

**Cache utilities:**
- `cache_get(key)` — Get from Redis with JSON parse fallback
- `cache_set(key, value, ttl_seconds)` — Set with TTL
- `cache_delete(*keys)` — Delete specific keys
- `cache_delete_pattern(pattern)` — Delete by glob pattern
- `@cached(ttl, key_func)` — Decorator for route-level caching

**Cache TTLs:**
- Graph data: 60s
- Heatmap: 5s
- Mastery: 10s
- Study group status: cached briefly to reduce DB hits

Cache is invalidated on mastery writes, graph updates, and study group state changes.

### Authentication Architecture

**Flow:** Supabase Auth (email/password) → JWT token → Flask middleware verification

**Frontend (`frontend/src/lib/auth-context.tsx`):**
- React context providing `user`, `role`, `profile`, `courses`, `enrollments`
- `signIn()` / `signUp()` / `signOut()` methods
- Calls Flask `/api/auth/*` endpoints, stores access token
- Role-based routing (teacher → dashboard/upload, student → enrollment/course)

**Flask middleware (`api/src/middleware/auth.py`):**
- `@optional_auth` — Decodes JWT if present, sets `g.user`, never blocks
- `@require_auth` — Decodes JWT, returns 401 if missing/invalid
- Supports both HS256 (legacy) and ES256 (newer Supabase projects) JWT algorithms

### Key Dependencies

**Frontend (Next.js):**
- `next` 16.1.6, `react` 19.2.3, `typescript` 5+
- `tailwindcss` 4, `shadcn` components, `radix-ui`
- `socket.io` 4.8.3, `socket.io-client` 4.8.3
- `@anthropic-ai/sdk` 0.74+ (Claude API)
- `d3-force` 3.0.0, `@types/d3-force` (graph layout)
- `motion` 12.34+ (Framer Motion — smooth graph transitions)
- `react-markdown` 10.1+, `remark-math`, `remark-gfm`, `rehype-katex`, `katex` (LaTeX rendering in tutoring)
- `recharts` 3.7+ (heatmap / charts)
- `@supabase/supabase-js` 2.95+ (Supabase client)
- `express` 5.2.1 (custom server for Socket.IO)
- `ioredis` 5.9+ (Redis client for server-side caching)
- `tsx` 4.21+ (TypeScript execution for custom server)
- `@zoom/rtms` 1.0.2 (if RTMS access obtained)
- `react-force-graph-2d` 1.29+ (installed but NOT actively used — graph uses raw d3-force)

**Knowledge Graph API (Flask):**
- `flask` 3.x, `flask-cors`
- `supabase` (Supabase Python client)
- `anthropic` Python SDK (for concept extraction, learning page generation, quiz generation)
- `pypdf2` (PDF page truncation for Claude's document API)
- `python-dotenv`, `gunicorn`
- `pyjwt[crypto]` (JWT decoding for auth middleware)
- `redis` (optional caching layer)
- `requests` (HTTP calls)

**External APIs:**
- [Anthropic Claude API](https://docs.anthropic.com/) — Model IDs: `claude-sonnet-4-20250514` (Sonnet, used in Flask for extraction/generation), `claude-haiku-4-5-20251001` (Haiku, used in Next.js for detection/evaluation/summaries). Note: the Sonnet model used is `claude-sonnet-4-20250514`, not `claude-sonnet-4-5-20250929`.
- [Perplexity Sonar API](https://docs.perplexity.ai/) — Sonar Pro model for resource search and further reading. Pay-as-you-go, requires prepaid credits.
- [Deepgram](https://deepgram.com/pricing) — $200 free credits, no credit card. Real-time streaming supported.

### Deployment

- **Frontend (Render):** Next.js app (Node.js runtime, build: `cd frontend && npm install && npm run build`, start: `cd frontend && npx tsx server/index.ts`)
- **Flask API (Render):** Python runtime, build: `cd api && pip install -r requirements.txt`, start: `cd api && gunicorn app:app --bind 0.0.0.0:$PORT`
- **Database:** Supabase (hosted, same URL in all environments)
- `FLASK_API_URL` on the Render Next.js service is auto-linked to the Flask API's `RENDER_EXTERNAL_URL` via `render.yaml`
- `NEXT_PUBLIC_FLASK_API_URL` is also auto-linked for client-side API calls
- Set `SUPABASE_URL` and `SUPABASE_KEY` on both services
- **Important:** Custom Express server prevents Vercel deployment. Both services deploy on Render (see `render.yaml`).

---

## 9. Environment Variables

```bash
# .env (root level, shared by both services)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret          # For JWT verification in Flask auth middleware
SUPABASE_SERVICE_ROLE_KEY=your-service-key   # For admin operations (seed scripts, auth signup)
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
DEMO_MODE=true
REDIS_URL=redis://localhost:6379             # Optional — caching degrades gracefully without it

# Next.js needs to know where Flask is
FLASK_API_URL=http://localhost:5000
NEXT_PUBLIC_FLASK_API_URL=http://localhost:5000   # Client-side Flask API URL
NEXT_PUBLIC_APP_URL=http://localhost:3000          # Public app URL

# Zoom (per-teacher credentials stored in DB, but global fallback supported)
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_ACCOUNT_ID=...
FRONTEND_BASE_URL=http://localhost:3000            # For Zoom RTMS callbacks

# Deepgram (for RTMS audio transcription)
DEEPGRAM_API_KEY=...
```

---

## 10. Claude Prompt Contracts

### 1. Concept Extraction (`api/src/services/create_kg.py`)
- **Model:** `claude-sonnet-4-20250514`
- **Input:** PDF document (base64-encoded via Claude's document API, truncated to first 10 pages with PyPDF2)
- **Output:** `{ "nodes": { "snake_case_id": "description", ... }, "edges": [["source_id", "target_id"], ...] }`
- **Prompt authored by:** Person 3, implemented by Person 1. The prompt text is sent alongside the PDF in a multi-content message (document + text). See `api/src/services/create_kg.py` for the pattern.

### 2. Concept Detection (`frontend/src/lib/prompts/concept-detection.ts`)
- **Model:** `claude-haiku-4-5-20251001`
- **Input:** Transcript chunk + list of known concept labels
- **Output:** `{ "detected_concepts": ["label1", "label2"] }`
- **Latency target:** < 1 second

### 3. Question Generation (`frontend/src/lib/prompts/question-generation.ts`)
- **Model:** `claude-sonnet-4-5-20250929`
- **Input:** Concept label + last 5 transcript chunks + optional class mastery distribution
- **Output:** `{ "question": "...", "expected_answer": "..." }`
- **Note:** The prompt includes concept labels for context, but Claude only returns the question and expected answer. The API route already knows the target concept from the request's `conceptId` param (or the most recently detected concept).

### 4. Response Evaluation (`frontend/src/lib/prompts/response-evaluation.ts`)
- **Model:** `claude-haiku-4-5-20251001`
- **Input:** Question text + expected answer + student's answer
- **Output:** `{ "eval_result": "correct" | "partial" | "wrong", "feedback": "...", "reasoning": "..." }`
- **Important:** Returns `eval_result` NOT colors. The API route maps to confidence deltas.
- **Latency target:** < 2 seconds

### 5. Tutoring Agent (`frontend/src/lib/prompts/tutoring.ts`)
- **Model:** `claude-sonnet-4-5-20250929`
- **System prompt includes:** Course name, student's weak concepts with labels and IDs, Socratic method instruction, relevant lecture transcript chunks with timestamps
- **Multi-turn:** Full conversation history sent each request
- **Understanding check** (`frontend/src/lib/prompts/understanding-check.ts`): After each student message, a separate Haiku call evaluates: `{ "understood": boolean, "concept_label": "..." }`. The `concept_label` identifies which target concept the student demonstrated understanding of. If understood, the route resolves label to UUID, calls Flask `PUT /api/students/:id/mastery/:concept_id` with `{ delta: 0.2 }`, and sets `concept_id` on the stored `tutoring_messages` row.

### 6. Lecture Summary (`frontend/src/lib/prompts/lecture-summary.ts`)
- **Model:** `claude-haiku-4-5-20251001`
- **Input:** Full transcript text + course concept labels
- **Output:** `{ "bullets": ["Point 1...", ...], "title_summary": "One-line title" }`
- **Rules:** 4-6 bullet points, 1-2 sentences each, plain student-friendly language. Title 5-8 words.
- **Timeout:** 15 seconds

### 7. Misconception Summary (`frontend/src/lib/prompts/misconception-summary.ts`)
- **Model:** `claude-haiku-4-5-20251001`
- **Input:** Poll question + array of student responses with eval_results
- **Output:** Plain text summary (1-2 sentences) of common misconceptions
- **Called by:** `POST /api/lectures/:id/poll/:pollId/close`

### 8. Learning Page Generation (`api/src/services/generate_content.py`)
- **Model:** `claude-sonnet-4-20250514`
- **Input:** Concept label, description, student context
- **Output:** Structured learning content with explanations, examples, and further reading
- **Note:** Runs in Flask, not Next.js. Experimental feature.

### 9. Practice Quiz Generation (`api/src/services/generate_content.py`)
- **Model:** `claude-sonnet-4-20250514`
- **Input:** Concept label, description, learning page content
- **Output:** 5 multiple-choice questions with options, correct answers, and explanations
- **Note:** Runs in Flask, not Next.js. Experimental feature.

### 10. Intervention Suggestions (`frontend/src/lib/prompts/intervention.ts`)
- **Model:** `claude-sonnet-4-5-20250929`
- **Input:** Struggling concept labels, descriptions, heatmap distribution
- **Output:** Actionable teaching suggestions for the professor

---

## 11. Flask API Endpoints (Port 5000 / $PORT)

### Authentication

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | `{ email, password, name, role }` | `{ access_token, user, role, name }` |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ access_token, user, role, profile }` |
| `POST` | `/api/auth/logout` | — | `{ message }` |
| `GET` | `/api/auth/me` | — (JWT required) | `{ user, role, profile, courses/enrollments }` |
| `POST` | `/api/auth/teacher-profile` | `{ auth_id, name, email }` | `{ id, auth_id, name, email }` |

### Courses

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/courses` | `{ name, description }` | `{ id, name, description, join_code }` |
| `GET` | `/api/courses` | — | `[{ id, name, description }]` |
| `GET` | `/api/courses/:id` | — | `{ id, name, description }` |
| `POST` | `/api/courses/enroll` | `{ join_code }` (JWT required) | `{ student_id, course_id, course_name }` |

### Zoom Credentials (Per-Teacher)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `PUT` | `/api/teachers/:id/zoom-credentials` | `{ zoom_client_id, zoom_client_secret, zoom_secret_token }` | `{ message }` |
| `GET` | `/api/teachers/:id/zoom-credentials` | — | `{ has_credentials, teacher_id }` |

### PDF Upload & Concept Extraction

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/courses/:id/upload` | `multipart/form-data` with PDF file | `{ concepts: [...], edges: [...] }` |

### Knowledge Graph

| Method | Path | Query Params | Response |
| --- | --- | --- | --- |
| `GET` | `/api/courses/:id/graph` | `?student_id=` (optional) | `{ nodes: [...], edges: [...] }` |

### Mastery

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/students/:id/mastery` | — | `[{ concept_id, confidence, color, attempts }]` |
| `PUT` | `/api/students/:id/mastery/:concept_id` | `{ confidence }` or `{ eval_result }` or `{ delta }` | `{ concept_id, old_color, new_color, confidence }` |
| `POST` | `/api/mastery/attendance-boost` | `{ concept_ids: [], student_ids: [] }` | `{ updated: count }` |

### Students

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/courses/:id/students` | — | `[{ id, name, email }]` |
| `POST` | `/api/courses/:id/students` | `{ name, email }` | `{ id, name, email }` |

### Heatmap

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/courses/:id/heatmap` | `{ concepts: [{ id, label, distribution, avg_confidence }], total_students }` |

### Lectures

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures` | `{ course_id, title }` | `{ id, course_id, title, status }` |
| `GET` | `/api/lectures/:id` | — | `{ id, course_id, title, status, ... }` |
| `GET` | `/api/courses/:id/lectures` | — | `[{ id, title, status, started_at }]` |
| `PUT` | `/api/lectures/:id/end` | — | `{ id, status: "completed", ended_at }` |
| `POST` | `/api/lectures/:id/transcript` | `{ text, timestamp, speaker_name? }` | `{ chunk_id }` |
| `GET` | `/api/lectures/:id/transcript` | — | `[{ id, text, timestamp_sec, speaker_name }]` |

### Polls

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures/:id/polls` | `{ concept_id, question, expected_answer }` | `{ id, lecture_id, concept_id, question }` |
| `GET` | `/api/lectures/:id/polls` | — | `[{ id, question, status, concept_id }]` |
| `POST` | `/api/polls/:id/respond` | `{ student_id, answer }` | `{ id, evaluation }` |

### Tutoring

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/tutoring/sessions` | `{ student_id, concept_ids? }` | `{ id, student_id, target_concepts }` |
| `POST` | `/api/tutoring/sessions/:id/messages` | `{ role, content }` | `{ id, role, content }` |
| `GET` | `/api/tutoring/sessions/:id/messages` | — | `[{ id, role, content, created_at }]` |

### Study Groups

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/courses/:id/study-groups/opt-in` | `{ student_id, concept_ids }` | `{ status, match?, pool_entry? }` |
| `POST` | `/api/courses/:id/study-groups/opt-out` | `{ student_id }` | `{ message }` |
| `POST` | `/api/courses/:id/study-groups/clear` | `{ student_id }` | `{ message }` |
| `GET` | `/api/courses/:id/study-groups/status` | `?student_id=` | `{ status, match?, pool_entry? }` |

### Learning Pages & Quizzes (Experimental)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/students/:id/pages/generate` | `{ concept_id }` | `{ id, title, content }` |
| `GET` | `/api/pages/:id` | — | `{ id, title, content, further_reading }` |
| `GET` | `/api/students/:id/pages` | — | `[{ id, title, concept_id, created_at }]` |
| `DELETE` | `/api/pages/:id` | — | `{ message }` |
| `POST` | `/api/pages/:id/quiz/generate` | — | `{ id, questions: [...] }` |
| `GET` | `/api/quizzes/:id` | — | `{ id, questions, status, score? }` |
| `POST` | `/api/quizzes/:id/submit` | `{ answers: [{ question_id, selected_answer }] }` | `{ score, results, mastery_update? }` |
| `GET` | `/api/students/:id/quizzes` | — | `[{ id, concept_id, status, score }]` |
| `DELETE` | `/api/quizzes/:id` | — | `{ message }` |
| `GET` | `/api/concepts/:id/learning-page` | — | `{ content }` |
| `GET` | `/api/concepts/:id/quiz` | — | `{ questions: [...] }` |
| `POST` | `/api/concepts/:id/quiz-submit` | `{ answers, student_id }` | `{ score, mastery_update }` |
| `POST` | `/api/perplexity/query` | `{ query }` | `{ result }` |

### Utility

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/debug/test-claude` | `{ raw_response, api_key_set }` |

---

## 12. Next.js API Routes (Port 3000)

### Lectures (Person 4)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures` | `{ courseId, title }` | `{ id, courseId, title, status: "live" }` |
| `POST` | `/api/lectures/:id/transcript` | `{ text, timestamp, speakerName? }` | `{ chunkId, detectedConcepts: [{ id, label }] }` |
| `POST` | `/api/lectures/:id/summary` | — | `{ bullets: [...], titleSummary: "..." }` |

### Polls (Person 3)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures/:id/poll/generate` | `{ conceptId? }` | `{ pollId, question, expectedAnswer, conceptId, conceptLabel }` |
| `POST` | `/api/lectures/:id/poll/:pollId/activate` | — | `{ status: "active" }` |
| `POST` | `/api/lectures/:id/poll/:pollId/close` | — | `{ status: "closed", distribution, totalResponses, misconceptionSummary? }` |
| `POST` | `/api/polls/:pollId/respond` | `{ studentId, answer }` | `{ evaluation, updated }` |
| `GET` | `/api/polls/:pollId/results` | — | `{ totalResponses, distribution }` |

### Tutoring (Person 3)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/tutoring/sessions` | `{ studentId, lectureId? }` | `{ sessionId, targetConcepts, initialMessage }` |
| `POST` | `/api/tutoring/sessions/:id/messages` | `{ content }` | `{ message, masteryUpdates? }` |
| `GET` | `/api/tutoring/sessions/:id/messages` | — | `{ messages: [...] }` |

### Resources (Person 3)

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/resources/search?concept=...&courseId=...` | `{ resources: [{ title, url, type, snippet }] }` |

### Interventions (Person 3)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures/:id/interventions` | `{ conceptIds: string[] }` | `{ suggestions: [...] }` |

---

## 13. Frontend Pages

| Route | Page | Description |
| --- | --- | --- |
| `/` | Landing / Auth Page | Splash screen → auth form (sign in / sign up with role toggle). Teachers are redirected to course creation or dashboard. Students enter join codes to enroll, then see their course list. |
| `/professor/upload` | PDF Upload Page | Drag-and-drop PDF upload with graph preview. Teachers upload course materials here after creating a course. |
| `/professor/dashboard` | Professor Dashboard | Live transcript, heatmap, student list, poll controls, intervention panel. Requires active lecture. |
| `/student/[studentId]` | Student In-Lecture View | Knowledge graph (d3-force, dark glass-morphic theme) + tabbed side panel (poll questions, feedback) + transcript feed. |
| `/student/[studentId]/tutor` | Post-Lecture Tutoring | Chat interface + weak concepts sidebar. Accessible via "Tutor" button on student view. |
| `/student/[studentId]/summaries` | Lecture Summaries | Expandable lecture cards with AI-generated bullet-point summaries. |
| `/student/[studentId]/study-group` | Study Group Matching | Concept selection, opt-in to matching pool, partner matching with Zoom link. |

---

## 14. Socket.IO Events

| Event Name | Direction | Payload | Who emits | Who listens |
| --- | --- | --- | --- | --- |
| `lecture:join` | Client → Server | `{ lectureId, role, studentId? }` | Client | Person 4's server handler |
| `transcript:chunk` | Server → Lecture Room | `{ text, timestamp, detectedConcepts[] }` | Person 4 | Person 2 (dashboard + student view) |
| `lecture:concept-detected` | Server → Lecture Room | `{ conceptId, label }` | Person 3/4 | Person 2 (timeline + graph pulse) |
| `poll:new-question` | Server → Students in Room | `{ pollId, question, conceptLabel }` | Person 3 | Person 2 (student poll card) |
| `poll:closed` | Server → Lecture Room | `{ pollId, results }` | Person 3 | Person 2 (professor poll results) |
| `mastery:updated` | Server → Specific Student | `{ studentId, conceptId, oldColor, newColor, confidence }` | Person 3 | Person 2 (recolor graph node) |
| `heatmap:updated` | Server → Professor | `{ conceptId }` | Person 3 | Person 2 (re-fetches heatmap from Flask) |
| `study-group:matched` | Server → Specific Student | `{ matchId, partnerId, partnerName, conceptIds, zoomLink }` | Flask (via Socket helper) | Person 2 (study group page) |

---

## 15. Seed Data (Demo)

The seed script (`scripts/seed_demo.py`) creates:

**Course:** CS229 Machine Learning (join code: `CS229M`)

**Auth users:** The seed script creates Supabase Auth users for all participants using the admin API:
- `professor@stanford.edu` / `prereq-demo-2024` (teacher)
- `alex@stanford.edu` / `prereq-demo-2024` (student)
- `jordan@stanford.edu` / `prereq-demo-2024` (student)
- `sam@stanford.edu` / `prereq-demo-2024` (student — live participant)
- `taylor@stanford.edu` / `prereq-demo-2024` (student)

**~35 Concept Nodes** organized by category:
- **Linear Algebra:** Vectors, Matrices, Eigenvalues, Matrix Multiplication
- **Calculus:** Derivatives, Partial Derivatives, Chain Rule, Gradients
- **Probability:** Bayes' Theorem, Distributions, Conditional Probability
- **ML Foundations:** Loss Functions, MSE, Cross-Entropy, Optimization
- **Gradient Descent:** Gradient Descent, Learning Rate, Convergence, SGD
- **Neural Networks:** Perceptron, Activation Functions, Forward Pass, Layers
- **Backpropagation:** Backpropagation, Computational Graphs, Weight Updates
- **Regularization:** Overfitting, L1 Regularization, L2 Regularization, Dropout
- **Evaluation:** Train/Val/Test Split, Cross-Validation, Bias-Variance Tradeoff

**Historical data:** The seed script also creates:
- 1 completed lecture session with 10 transcript chunks
- 2 historical polls with sample responses
- 1 tutoring session with sample messages

**4 Students with pre-seeded confidence values:**

| Student | Profile | Demo Role | Example confidences |
| --- | --- | --- | --- |
| Alex | Strong | Auto-responder (correct) | Most concepts 0.7-0.9 (green), regularization/dropout at 0.5 (yellow) |
| Jordan | Average | Auto-responder (partial) | Fundamentals 0.7+ (green), intermediate 0.4-0.6 (yellow), backprop/regularization 0.15-0.3 (red) |
| Sam | Struggling | **Live participant** | Neural network cluster 0.1-0.2 (red), calculus 0.3-0.5 (yellow/red), basic linear algebra 0.7+ (green) |
| Taylor | Specific gaps | Auto-responder (wrong) | All math concepts 0.8+ (green), all neural network concepts 0.1-0.2 (red) |

**Additional seed utilities:**
- `scripts/seed_bulk_students.py` — Creates 350 students with randomized mastery for heatmap stress testing
- `scripts/clear_sam.py` — Utility to reset Sam's mastery data for repeated demo runs

**Demo note:** Sam is the live participant because their "struggling" profile produces the most dramatic visible changes during the demo (red→yellow→green transitions). The auto-responder (Person 4) sends scripted answers for Alex, Jordan, and Taylor with a 5-15 second random delay.

---

## 16. Success Metrics

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

## 17. Open Questions

1. ~~**Zoom RTMS access:** Can we get the Zoom Developer Pack at the hackathon (talk to Zoom booth)?~~ Resolved: Per-teacher Zoom credential management implemented.
2. **CS229 course reader PDF:** Is the Stanford ML course reader PDF available? Or should we write a smaller synthetic syllabus (~5 pages)?
3. ~~**Perplexity Sonar credits:** Do we have an API key with prepaid credits?~~ Resolved: API key configured.
4. ~~**Deepgram account:** Someone needs to sign up for the $200 free credits.~~ Resolved.
5. ~~**Render + Cloud Run accounts:** Render for frontend deployment, Cloud Run for Flask API.~~ Resolved: Both services deploy on Render (see `render.yaml`).
6. ~~**CodeRabbit:** Set up on the GitHub repo?~~ Resolved.
7. ~~**Anthropic API key:** Who has the key?~~ Resolved.

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
| **Anthropic Claude Agent SDK** | Multi-turn tutoring agent (FR-35 through FR-42), concept extraction, question gen, response eval — 5+ distinct Claude integrations |
| **Render** | Both frontend and Flask API deployed on Render |
| **Perplexity Sonar** | Resource search for student weak nodes (FR-33, FR-40), further reading in learning pages |
| **Decagon** (stretch) | The tutoring agent is a conversational AI |
