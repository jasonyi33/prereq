# Prereq — Shared Development Guide

## Project Overview

Prereq is a live Zoom classroom companion with personalized knowledge graphs per student. Two services, one shared Postgres database, deployed on Render.

**PRD:** `tasks/prd-prereq.md` — read this first for full context on goals, user stories, and functional requirements.

---

## Development Principles

**KISS — Keep It Simple.** This is a 48-hour hackathon. Every line of code should serve the demo. No abstractions "for later," no config systems, no plugin architectures. If a hardcoded string works, use a hardcoded string. If a 10-line function works, don't refactor it into 3 files. Simple code that works beats elegant code that's half-finished.

**YAGNI — You Aren't Gonna Need It.** Don't build anything not in the PRD. No pagination, no error boundaries for edge cases that won't happen in the demo, no user settings, no admin panels. If it's in the Non-Goals section of the PRD, don't build it. If you're thinking "this might be useful," stop — it won't be, not in 48 hours.

**TDD — Write Tests First for Critical Paths.** You don't need 100% coverage, but write tests *before* implementation for:
- Flask mastery endpoints (confidence rules are the most bug-prone logic)
- Confidence-to-color derivation (both Python and TypeScript)
- Claude prompt output parsing (eval_result mapping, concept detection label parsing)
- The attendance-boost capping logic

Skip tests for: UI components, Socket.IO event wiring, Claude prompt text (test the parsing, not the prose). Use `pytest` for Flask, `vitest` for Next.js.

**Prompting — Ask Until You're 100% Sure.** Before writing or modifying any Claude prompt (concept extraction, concept detection, question generation, response evaluation, tutoring agent, understanding check), ask clarifying questions until you have zero ambiguity about: (1) the exact input format, (2) the exact output JSON schema, (3) edge cases (what if Claude returns unexpected keys? what if no concepts are detected?), and (4) which model it runs on. Don't guess — ask. A bad prompt wastes more time than a 2-minute conversation.

---

## Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  frontend/              │     │  api/                   │
│  Next.js + Socket.IO    │────→│  Flask (Python)         │
│  Port 3000              │HTTP │  Port 5000              │
│                         │     │                         │
│  - All frontend pages   │     │  - Knowledge graph CRUD │
│  - Socket.IO server     │     │  - PDF upload + extract │
│  - Zoom RTMS listener   │     │  - Mastery updates      │
│  - Claude AI calls:     │     │  - Graph queries        │
│    - concept detection  │     │  - Heatmap aggregation  │
│    - question generation│     │  - Concept extraction   │
│    - response evaluation│     │    via Claude            │
│    - tutoring agent     │     │                         │
│  - Perplexity calls     │     │                         │
└────────────┬────────────┘     └────────────┬────────────┘
             │                                │
             └──────────┬─────────────────────┘
                        ▼
              ┌──────────────────┐
              │    Supabase      │
              │   (shared DB)    │
              └──────────────────┘
```

**Existing prototype:** The `knowledge-graph/` directory contains a proof-of-concept for PDF → knowledge graph extraction using Supabase, PyPDF2, and Claude's document API — the same core stack. **Person 1 should port this into the canonical `api/` directory structure**, adapting the Supabase schema, adding all missing endpoints (courses, students, mastery, heatmap, graph queries), and switching Claude's output format from markdown to JSON. Reference `knowledge-graph/src/services/create_kg.py` for the Claude document API pattern, `knowledge-graph/src/routes/create.py` for the Supabase client pattern, and `knowledge-graph/result.txt` for a sample CS229 concept graph (27 nodes, 28 edges). The `knowledge-graph/` directory will be removed once `api/` is complete.

**Team ownership:**
- **Person 1 (Flask API):** `api/` directory — knowledge graph CRUD, PDF upload, concept extraction, mastery updates, seed scripts
- **Person 2 (Frontend):** `frontend/src/components/`, `frontend/src/app/` pages — knowledge graph viz, dashboard UI, polling UI, tutoring chat UI
- **Person 3 (AI/Agents):** `frontend/src/lib/prompts/`, `frontend/src/app/api/` routes — Claude prompt engineering, response evaluation, tutoring agent, Perplexity integration
- **Person 4 (Zoom/Infra):** `frontend/server/`, `scripts/` — Socket.IO server, Zoom RTMS, transcript simulator, demo mode, deployment

---

## How to Run Locally

```bash
# 1. Set up Supabase project
# Create a project at https://supabase.com, then apply the schema from the
# "Database Schema" section below using the Supabase SQL Editor (Dashboard → SQL Editor → paste and run).

# 2. Copy env file and fill in API keys (including SUPABASE_URL and SUPABASE_KEY from Supabase project settings)
cp .env.example .env

# 3. Start Flask API (terminal 1)
cd api
pip install -r requirements.txt
python main.py
# Runs on http://localhost:5000
# Tables must already exist in Supabase (see schema setup in step 1)

# 4. Seed the database (terminal 1, after Flask is running)
python scripts/seed_demo.py

# 5. Start Next.js frontend (terminal 2)
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Technical Setup Notes

- **Schema creation:** Tables must be created in Supabase before either service starts. Use the Supabase SQL Editor (Dashboard → SQL Editor) to run the schema from the "Database Schema" section below. Do this once during project setup.
- **Supabase clients:** Flask uses `supabase-py` and Next.js uses `@supabase/supabase-js`. Person 1 sets up the Python client in `api/db.py`. Person 4 sets up the JS client in `frontend/server/db.ts`. Both use `SUPABASE_URL` and `SUPABASE_KEY` env vars. No ORM — use Supabase client methods for all queries.
- **Path alias for server imports:** Person 4 adds `"@server/*": ["./server/*"]` to `paths` in `frontend/tsconfig.json` so API routes can import server modules cleanly: `import { supabase } from '@server/db'` and `import { emitToStudent } from '@server/socket-helpers'`.
- **`.env` loading:** The `.env` file lives at the project root. Flask loads it via `python-dotenv`. The Express custom server (`frontend/server/index.ts`) loads it via `dotenv` with `path: path.resolve(__dirname, '../../.env')` before Next.js initializes. This ensures all env vars are available to both API routes and the Socket.IO server.
- **Eager mastery rows:** When Person 1's student creation endpoint adds a student, it also bulk-inserts `student_mastery` rows (confidence 0.0) for every concept in the course. When PDF upload creates new concepts, it bulk-inserts mastery rows for all existing students. This means reads never need LEFT JOIN / COALESCE logic.

---

## Environment Variables

```bash
# .env (root level, shared by both services)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
DEMO_MODE=true

# Next.js needs to know where Flask is
FLASK_API_URL=http://localhost:5000

# Zoom (only needed if RTMS access is obtained)
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_ACCOUNT_ID=...

# Deepgram (for RTMS audio transcription)
DEEPGRAM_API_KEY=...
```

**On Render/Cloud Run:** `FLASK_API_URL` on the Render Next.js service should point to the Cloud Run Flask service URL (e.g., `https://prereq-api-xxxxx.run.app`). `SUPABASE_URL` and `SUPABASE_KEY` are the same in all environments (Supabase is a hosted service).

---

## Database Schema

The Flask API owns the schema. Both services connect to Supabase via client libraries. Apply this schema in the Supabase SQL Editor during project setup. See "Database Write Ownership" below for who writes to what.

```sql
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE concept_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),       -- e.g., "Neural Networks", "Optimization"
    difficulty INT DEFAULT 3,    -- 1-5
    x FLOAT,                     -- optional layout hint
    y FLOAT
);

CREATE TABLE concept_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    source_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    target_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    relationship VARCHAR(50) DEFAULT 'prerequisite'
);

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE
);

-- MASTERY: confidence is the SINGLE SOURCE OF TRUTH.
-- Display color is DERIVED from confidence (see thresholds below).
-- There is NO mastery VARCHAR column.
CREATE TABLE student_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 0.0,  -- 0.0 to 1.0
    attempts INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, concept_id)
);

-- Color thresholds (apply in code, not stored in DB):
--   confidence == 0.0       → gray (unvisited)
--   confidence 0.01 - 0.39  → red (not understood)
--   confidence 0.40 - 0.69  → yellow (partial)
--   confidence 0.70 - 1.0   → green (mastery)

CREATE TABLE lecture_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'live',  -- 'live' | 'completed'
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

CREATE TABLE transcript_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lecture_sessions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    timestamp_sec FLOAT,
    speaker_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transcript_concepts (
    transcript_chunk_id UUID REFERENCES transcript_chunks(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (transcript_chunk_id, concept_id)
);

CREATE TABLE poll_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lecture_sessions(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES concept_nodes(id),
    question TEXT NOT NULL,
    expected_answer TEXT,
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft' | 'active' | 'closed'
    generated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES poll_questions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    evaluation JSONB,        -- { feedback, eval_result, reasoning }
    answered_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tutoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    target_concepts UUID[],  -- concept IDs being targeted
    started_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tutoring_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES tutoring_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    concept_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Database Write Ownership

Each table is written to by exactly ONE service. Both can read anything.

| Table | Written by | Owner |
| --- | --- | --- |
| `courses` | Flask | Person 1 |
| `concept_nodes` | Flask | Person 1 |
| `concept_edges` | Flask | Person 1 |
| `students` | Flask | Person 1 |
| `student_mastery` | Flask | Person 1 (Next.js calls Flask HTTP endpoint to write) |
| `lecture_sessions` | Next.js | Person 4 |
| `transcript_chunks` | Next.js | Person 4 |
| `transcript_concepts` | Next.js | Person 3 |
| `poll_questions` | Next.js | Person 3 |
| `poll_responses` | Next.js | Person 3 |
| `tutoring_sessions` | Next.js | Person 3 |
| `tutoring_messages` | Next.js | Person 3 |

---

## Flask API Endpoints (Port 5000)

**Person 1 owns these.** The Next.js frontend calls these over HTTP.

### Courses

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/courses` | `{ name, description }` | `{ id, name, description }` |
| `GET` | `/api/courses` | — | `[{ id, name, description }]` |
| `GET` | `/api/courses/:id` | — | `{ id, name, description }` |

### PDF Upload & Concept Extraction

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/courses/:id/upload` | `multipart/form-data` with PDF file | `{ concepts: [...], edges: [...] }` |

Steps: (1) Truncate PDF to first 10 pages with PyPDF2, encode as base64. (2) Send to Claude Sonnet via the document API with concept extraction prompt as a multi-content message (Person 3 authors the prompt text). (3) Parse JSON response. (4) Insert concept_nodes and concept_edges into Supabase. (5) Return full graph.

### Knowledge Graph

| Method | Path | Query Params | Response |
| --- | --- | --- | --- |
| `GET` | `/api/courses/:id/graph` | `?student_id=` (optional) | See below |

```json
{
  "nodes": [
    {
      "id": "uuid",
      "label": "Backpropagation",
      "description": "Algorithm for computing gradients...",
      "category": "Neural Networks",
      "difficulty": 4,
      "confidence": 0.55,
      "color": "yellow"
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source": "concept-uuid-1",
      "target": "concept-uuid-2",
      "relationship": "prerequisite"
    }
  ]
}
```

When `student_id` is provided, each node includes `confidence` (float) and `color` (derived from confidence thresholds). When omitted, nodes have no mastery data.

### Mastery

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/students/:id/mastery` | — | `[{ concept_id, confidence, color, attempts }]` |
| `PUT` | `/api/students/:id/mastery/:concept_id` | See below | `{ concept_id, old_color, new_color, confidence }` |
| `POST` | `/api/mastery/attendance-boost` | `{ concept_ids: [], student_ids: [] }` | `{ updated: count }` |

The PUT endpoint accepts one of three body formats:
- `{ confidence: float }` — absolute set (e.g., for manual overrides or seed script)
- `{ eval_result: "correct"|"partial"|"wrong" }` — applies poll confidence rules: correct → `max(current, 0.85)`, partial → `max(current, 0.50)`, wrong → `min(current, 0.20)` (exception: if current is 0.0, set to 0.20 — answering wrong can never raise your score). Also increments `attempts` by 1.
- `{ delta: float }` — relative change, clamped to [0.0, 1.0] (e.g., tutoring boost `{ delta: 0.2 }`)

For all modes, the endpoint: (1) reads current confidence, (2) computes new confidence per the rules, (3) writes it, (4) derives old and new colors from thresholds, (5) returns `{ concept_id, old_color, new_color, confidence }`. This centralizes all confidence mutation logic in Flask — callers never need to know current confidence.

The attendance-boost endpoint adds +0.05 to confidence for each student/concept pair, capped so confidence cannot exceed 0.3 from passive boosts alone.

### Students

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/courses/:id/students` | — | `[{ id, name, email }]` |
| `POST` | `/api/courses/:id/students` | `{ name, email }` | `{ id, name, email }` |

### Heatmap

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/courses/:id/heatmap` | See below |

```json
{
  "concepts": [
    {
      "id": "uuid",
      "label": "Chain Rule",
      "distribution": { "green": 12, "yellow": 8, "red": 5, "gray": 5 },
      "avg_confidence": 0.62
    }
  ],
  "total_students": 30
}
```

The heatmap endpoint computes distributions by applying confidence thresholds across all students.

---

## Next.js API Routes (Port 3000)

**Person 3 (AI) and Person 4 (Infra) own these.**

### Lectures (Person 4)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures` | `{ courseId, title }` | `{ id, courseId, title, status: "live" }` |
| `POST` | `/api/lectures/:id/transcript` | `{ text, timestamp, speakerName? }` | `{ chunkId, detectedConcepts: [{ id, label }] }` |

The transcript route: (1) Person 4 stores the transcript chunk in DB. (2) Person 3's concept detection logic runs (Claude Haiku call with known concept labels). (3) Detected concept labels are resolved to UUIDs using a label→ID map (pre-fetched from Flask `GET /api/courses/:id/graph` when the lecture starts, cached in-memory per lecture). (4) Detected concepts are linked in `transcript_concepts`. (5) Person 4 calls Flask `POST /api/mastery/attendance-boost` with detected concept IDs and present student IDs (from `getStudentsInLecture()` helper). (6) Socket.IO events emitted (`transcript:chunk` and `lecture:concept-detected`). Both Person 3 and Person 4 contribute to this route handler.

### Polls (Person 3)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures/:id/poll/generate` | `{ conceptId? }` | `{ pollId, question, expectedAnswer, conceptId, conceptLabel }` |
| `POST` | `/api/lectures/:id/poll/:pollId/activate` | — | `{ status: "active" }` |
| `POST` | `/api/lectures/:id/poll/:pollId/close` | — | `{ status: "closed", distribution: { green, yellow, red }, totalResponses, misconceptionSummary? }` |
| `POST` | `/api/polls/:pollId/respond` | `{ studentId, answer }` | `{ evaluation: { eval_result, feedback, reasoning }, updated: { concept_id, old_color, new_color, confidence } }` |
| `GET` | `/api/polls/:pollId/results` | — | `{ totalResponses, distribution: { green, yellow, red } }` |

The respond route: (1) Call Claude Haiku with question + expected answer + student answer. (2) Claude returns `{ eval_result: "correct"|"partial"|"wrong", feedback, reasoning }`. (3) Call Flask `PUT /api/students/:id/mastery/:concept_id` with `{ eval_result }` — Flask applies the confidence rules internally and returns old/new colors. (4) Look up `lecture_id` from the `poll_questions` row (needed for `emitToProfessor`). (5) Emit Socket.IO events: `mastery:updated` to student via `emitToStudent()`, `heatmap:updated` with `{ conceptId }` to professor via `emitToProfessor(lectureId, ...)` — the frontend re-fetches the full heatmap from Flask on this event.

### Tutoring (Person 3)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/tutoring/sessions` | `{ studentId, lectureId? }` | `{ sessionId, targetConcepts: [...], initialMessage: { role, content } }` |
| `POST` | `/api/tutoring/sessions/:id/messages` | `{ content }` | `{ message: { role, content }, masteryUpdates?: [...] }` |
| `GET` | `/api/tutoring/sessions/:id/messages` | — | `{ messages: [{ id, role, content, createdAt }] }` |

The messages route: (1) Load conversation history. (2) Build system prompt (course context, student weak nodes with IDs, lecture transcript excerpts with timestamps). (3) Call Claude Sonnet. (4) Store assistant message. (5) Make a SECOND Claude Haiku call: "Did the student demonstrate understanding? Return `{ understood: boolean, concept_label: string }`." (6) If understood, resolve concept_label to UUID, call Flask `PUT /api/students/:id/mastery/:concept_id` with `{ delta: 0.2 }`, and set `concept_id` on the stored `tutoring_messages` row. (7) Emit Socket.IO `mastery:updated` if mastery changed.

### Resources (Person 3)

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/resources/search?concept=...&courseId=...` | `{ resources: [{ title, url, type, snippet }] }` |

Calls Perplexity Sonar API with the concept label + course context to find relevant learning resources.

### Interventions (Person 3)

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/lectures/:id/interventions` | `{ conceptIds: string[] }` | `{ suggestions: [{ conceptId, conceptLabel, suggestion }] }` |

Professor-initiated. Calls Claude Sonnet with the struggling concepts' labels, descriptions, and heatmap distribution. Returns actionable teaching suggestions. Triggered by a "Get Suggestions" button on the professor dashboard.

---

## Socket.IO Events

| Event Name | Direction | Payload | Who emits | Who listens |
| --- | --- | --- | --- | --- |
| `lecture:join` | Client → Server | `{ lectureId, role, studentId? }` | Client | Person 4's server handler |
| `transcript:chunk` | Server → Lecture Room | `{ text, timestamp, detectedConcepts[] }` | Person 4 | Person 2 (dashboard + student view) |
| `lecture:concept-detected` | Server → Lecture Room | `{ conceptId, label }` | Person 3/4 | Person 2 (timeline + graph pulse) |
| `poll:new-question` | Server → Students in Room | `{ pollId, question, conceptLabel }` | Person 3 | Person 2 (student poll card) |
| `poll:closed` | Server → Lecture Room | `{ pollId, results }` | Person 3 | Person 2 (professor poll results) |
| `mastery:updated` | Server → Specific Student | `{ studentId, conceptId, oldColor, newColor, confidence }` | Person 3 | Person 2 (recolor graph node) |
| `heatmap:updated` | Server → Professor | `{ conceptId }` | Person 3 | Person 2 (re-fetches heatmap from Flask) |

**Person 4 provides** helper functions in `frontend/server/socket-helpers.ts`:
```typescript
export function emitToLectureRoom(lectureId: string, event: string, data: any): void;
export function emitToStudent(studentId: string, event: string, data: any): void;
export function emitToProfessor(lectureId: string, event: string, data: any): void;
export function getStudentsInLecture(lectureId: string): string[];  // returns connected student IDs from Socket.IO room
```

Person 3's API routes import and call these helpers after AI processing.

---

## Frontend Pages (Person 2)

| Route | Page | Description |
| --- | --- | --- |
| `/` | Landing Page | Student dropdown selector + "Professor Mode" button. Selected student ID stored in `localStorage` + `studentId` cookie. |
| `/professor/dashboard` | Professor Dashboard | Live transcript, heatmap, student list, poll controls, intervention panel. Requires active lecture. |
| `/student/[studentId]` | Student In-Lecture View | Knowledge graph + active panel (poll questions, feedback) + small transcript feed. |
| `/student/[studentId]/tutor` | Post-Lecture Tutoring | Chat interface + weak concepts sidebar. Accessible via "Tutor" button on student view. |

**Navigation:** Landing page → professor dashboard OR student view. Student view → tutoring view (after lecture ends or via button). No back-navigation needed for the demo.

---

## Mastery System (Confidence-Driven)

**Single source of truth:** `confidence` float in `student_mastery`. No separate mastery string.

| Confidence | Display Color | Hex |
| --- | --- | --- |
| 0.0 exactly | Gray | #94a3b8 |
| 0.01 - 0.39 | Red | #ef4444 |
| 0.40 - 0.69 | Yellow | #eab308 |
| 0.70 - 1.0 | Green | #22c55e |

**Blue glow** (#3b82f6) = active concept overlay (not stored).

**Color derivation helper** (implement in both services):
```python
# Python (Flask)
def confidence_to_color(confidence: float) -> str:
    if confidence == 0.0:
        return "gray"
    elif confidence < 0.4:
        return "red"
    elif confidence < 0.7:
        return "yellow"
    else:
        return "green"
```
```typescript
// TypeScript (Next.js)
function confidenceToColor(confidence: number): string {
  if (confidence === 0) return "gray";
  if (confidence < 0.4) return "red";
  if (confidence < 0.7) return "yellow";
  return "green";
}
```

---

## Claude Prompt Contracts

### 1. Concept Extraction (`api/services/concept_extraction.py`)
- **Model:** `claude-sonnet-4-5-20250929`
- **Input:** PDF document (base64-encoded via Claude's document API, truncated to first 10 pages with PyPDF2)
- **Output:** `{ "concepts": [{ "label", "description", "category", "difficulty" }], "edges": [{ "source_label", "target_label", "relationship" }] }`
- **Prompt authored by:** Person 3, implemented by Person 1. The prompt text is sent alongside the PDF in a multi-content message (document + text). See `knowledge-graph/src/services/create_kg.py` for the pattern.

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
- **Understanding check:** After each student message, a separate Haiku call evaluates: `{ "understood": boolean, "concept_label": "..." }`. The `concept_label` identifies which target concept the student demonstrated understanding of. If understood, the route resolves label to UUID, calls Flask `PUT /api/students/:id/mastery/:concept_id` with `{ delta: 0.2 }`, and sets `concept_id` on the stored `tutoring_messages` row.

---

## Seed Data (Demo)

The seed script (`scripts/seed_demo.py`) creates:

**Course:** CS229 Machine Learning

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

**4 Students with pre-seeded confidence values:**

| Student | Profile | Demo Role | Example confidences |
| --- | --- | --- | --- |
| Alex | Strong | Auto-responder (correct) | Most concepts 0.7-0.9 (green), regularization/dropout at 0.5 (yellow) |
| Jordan | Average | Auto-responder (partial) | Fundamentals 0.7+ (green), intermediate 0.4-0.6 (yellow), backprop/regularization 0.15-0.3 (red) |
| Sam | Struggling | **Live participant** | Neural network cluster 0.1-0.2 (red), calculus 0.3-0.5 (yellow/red), basic linear algebra 0.7+ (green) |
| Taylor | Specific gaps | Auto-responder (wrong) | All math concepts 0.8+ (green), all neural network concepts 0.1-0.2 (red) |

**Demo note:** Sam is the live participant because their "struggling" profile produces the most dramatic visible changes during the demo (red→yellow→green transitions). The auto-responder (Person 4) sends scripted answers for Alex, Jordan, and Taylor with a 5-15 second random delay.

---

## Cross-Team Dependencies

| Provider | Consumer | What | Interface | Mock strategy |
| --- | --- | --- | --- | --- |
| Person 1 | Person 2 | Graph data | `GET /api/courses/:id/graph?student_id=` | Hardcoded JSON file |
| Person 1 | Person 3 | Mastery writes | `PUT /api/students/:id/mastery/:concept_id` | Function returning `{ old_color: "red", new_color: "yellow", confidence: 0.5 }` |
| Person 1 | Person 2 | Heatmap data | `GET /api/courses/:id/heatmap` | Hardcoded JSON |
| Person 3 | Person 1 | Concept extraction prompt | Prompt text string | Copy-paste |
| Person 3 | Person 4 | Poll respond endpoint | `POST /api/polls/:pollId/respond` | Must be working for demo auto-responder |
| Person 4 | Person 2 | Socket.IO events | `emitToRoom()` helpers | Client subscribes; test with manual emits |
| Person 4 | Person 3 | Transcript chunks | `POST /api/lectures/:id/transcript` | Simulator + AI processing share this route |

---

## Git Workflow

- **Main branch:** `main`
- **Feature branches:** `feat/[person]-[feature]` (e.g., `feat/p1-flask-api`, `feat/p2-knowledge-graph-viz`)
- **PR reviews:** CodeRabbit enabled
- **Commits:** Present tense ("Add concept extraction endpoint", "Wire Socket.IO mastery events")
- Merge to main frequently. Small PRs.

---

## Deployment

- **Frontend (Render):** Next.js (Node.js, build: `cd frontend && npm install && npm run build`, start: `cd frontend && npx tsx server/index.ts`)
- **Flask API (Cloud Run):** Dockerfile in `api/`, start: `gunicorn app:app --bind 0.0.0.0:$PORT`
- **Database:** Supabase (hosted, no deployment needed — same URL in all environments)
- Set `FLASK_API_URL` on the Render Next.js service → Cloud Run Flask service URL (e.g., `https://prereq-api-xxxxx.run.app`)
- Set `SUPABASE_URL` and `SUPABASE_KEY` on both services
- Custom Express server means the frontend **cannot deploy on Vercel**. Render for frontend, Cloud Run for Flask API.
