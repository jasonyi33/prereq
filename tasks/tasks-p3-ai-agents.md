# Tasks: Person 3 — AI Prompts & Agent Routes

> **Owner:** Person 3
> **Branch:** `feat/p3-ai-agents`
> **Directory:** `frontend/src/lib/prompts/`, `frontend/src/app/api/`
> **Responsibility:** Claude prompt engineering, all AI-powered API routes (concept detection, question generation, response evaluation, tutoring agent), Perplexity resource search, intervention suggestions

## Relevant Files

- `frontend/src/lib/prompts/concept-extraction.ts` - Concept extraction prompt text (handed to Person 1 for Flask integration)
- `frontend/src/lib/prompts/concept-detection.ts` - Concept detection prompt + parsing logic
- `frontend/src/lib/prompts/question-generation.ts` - Question generation prompt + parsing logic
- `frontend/src/lib/prompts/response-evaluation.ts` - Response evaluation prompt + parsing logic
- `frontend/src/lib/prompts/tutoring.ts` - Tutoring agent system prompt builder
- `frontend/src/lib/prompts/understanding-check.ts` - Understanding check prompt (Haiku sidecar)
- `frontend/src/lib/prompts/misconception-summary.ts` - Misconception analysis for poll close
- `frontend/src/lib/prompts/intervention.ts` - Intervention suggestions prompt
- `frontend/src/app/api/lectures/[id]/transcript/route.ts` - Concept detection logic (SHARED with Person 4 — Person 4 writes the data layer, Person 3 adds AI processing)
- `frontend/src/app/api/lectures/[id]/poll/generate/route.ts` - Question generation endpoint
- `frontend/src/app/api/lectures/[id]/poll/[pollId]/activate/route.ts` - Poll activation endpoint
- `frontend/src/app/api/lectures/[id]/poll/[pollId]/close/route.ts` - Poll close + misconception summary
- `frontend/src/app/api/polls/[pollId]/respond/route.ts` - Student response evaluation + mastery update
- `frontend/src/app/api/polls/[pollId]/results/route.ts` - Poll results aggregation
- `frontend/src/app/api/tutoring/sessions/route.ts` - Tutoring session creation
- `frontend/src/app/api/tutoring/sessions/[id]/messages/route.ts` - Tutoring message exchange + understanding check
- `frontend/src/app/api/resources/search/route.ts` - Perplexity resource search
- `frontend/src/app/api/lectures/[id]/interventions/route.ts` - Intervention suggestions
- `frontend/src/lib/prompts/__tests__/parsing.test.ts` - Tests for all prompt output parsing

### Notes

- Use `vitest` to run tests: `cd frontend && npx vitest run`
- All Claude calls use the `@anthropic-ai/sdk` npm package. Import `Anthropic` and create a client with `ANTHROPIC_API_KEY`.
- **Models:** Sonnet (`claude-sonnet-4-5-20250929`) for complex generation, Haiku (`claude-haiku-4-5-20251001`) for fast evaluation/detection.
- Claude outputs must be parsed as JSON. Always wrap parsing in try/catch — if Claude returns malformed JSON, log the raw response and return a sensible default.
- Person 3 does NOT compute confidence values. Pass `{ eval_result }` or `{ delta }` to Flask's mastery PUT endpoint and let Flask handle the math.
- The transcript route file (`/api/lectures/[id]/transcript/route.ts`) is shared with Person 4. Coordinate: Person 4 creates the file and handles DB writes, Person 3 exports a `detectConcepts(text, conceptLabels)` function that Person 4 calls within the route handler.
- Import Socket.IO helpers from `frontend/server/socket-helpers.ts` (provided by Person 4) to emit events after AI processing.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Run `git checkout -b feat/p3-ai-agents` from `main`

- [x] 1.0 Write concept extraction prompt and hand off to Person 1
  - [x] 1.1 Create `frontend/src/lib/prompts/concept-extraction.ts`. Export a function `buildConceptExtractionPrompt(pdfText: string): string` that returns the full prompt.
  - [x] 1.2 The prompt must instruct Claude to:
    - Analyze the course material text
    - Extract 25-40 concept nodes with: `label` (short, unique name), `description` (1-2 sentences), `category` (grouping label like "Neural Networks"), `difficulty` (1-5 integer)
    - Identify prerequisite edges: `source_label` (prerequisite concept), `target_label` (dependent concept), `relationship` (always "prerequisite")
    - Return valid JSON matching: `{ "concepts": [...], "edges": [...] }`
  - [x] 1.3 Include few-shot examples in the prompt so Claude understands the expected format
  - [x] 1.4 **HANDOFF: Copy the prompt text to Person 1** (or point them to this file). Person 1 will integrate it into `api/services/concept_extraction.py`. The prompt goes into the `messages` array as a `text` content block alongside the base64 PDF `document` content block (Claude's document API). See `knowledge-graph/src/services/create_kg.py` for the multi-content message pattern.
  - [x] 1.5 Verify: test the prompt manually via the Anthropic console or a quick script — paste a small sample PDF text, confirm Claude returns valid JSON with reasonable concepts and edges

> **MERGE POINT 1:** After completing task 1.0, merge to `main` so Person 1 can access the prompt file. This aligns with everyone merging their initial scaffolding.

- [x] 2.0 Build concept detection logic in the transcript route (shared with Person 4)
  - [x] 2.1 Create `frontend/src/lib/prompts/concept-detection.ts`. Export:
    - `buildConceptDetectionPrompt(transcriptChunk: string, conceptLabels: string[]): string` — the prompt
    - `parseConceptDetectionResponse(response: string): string[]` — parses Claude's JSON output into an array of detected concept labels
  - [x] 2.2 The prompt must instruct Claude Haiku to:
    - Read the transcript chunk
    - Identify which of the provided concept labels are being discussed
    - Return `{ "detected_concepts": ["label1", "label2"] }` (empty array if none)
    - Be conservative — only return concepts that are clearly being taught, not just mentioned
  - [x] 2.3 **Write test** in `frontend/src/lib/prompts/__tests__/parsing.test.ts` for `parseConceptDetectionResponse()`:
    - Valid JSON with 2 concepts → returns array of 2
    - Valid JSON with empty array → returns empty array
    - Malformed JSON → returns empty array (graceful fallback)
    - JSON with unexpected keys → still extracts `detected_concepts`
  - [x] 2.4 Export a `detectConcepts(text: string, conceptLabels: string[]): Promise<string[]>` function that makes the Claude Haiku call and returns parsed labels. **DEPENDENCY: Person 4 will import this function in the transcript route handler.** Coordinate the import path.
  - [x] 2.5 Verify: test with a sample transcript chunk and a list of ML concept labels, confirm reasonable detection

- [x] 3.0 Build poll question generation endpoint
  - [x] 3.1 Create `frontend/src/lib/prompts/question-generation.ts`. Export:
    - `buildQuestionGenerationPrompt(conceptLabel: string, conceptDescription: string, recentTranscript: string): string`
    - `parseQuestionGenerationResponse(response: string): { question: string, expectedAnswer: string }`
  - [x] 3.2 The prompt must instruct Claude Sonnet to:
    - Generate a natural language question about the concept that tests real understanding (not trivia)
    - The question should be answerable in 2-3 sentences
    - Return `{ "question": "...", "expected_answer": "..." }`
    - Reference the recent lecture context if possible
  - [x] 3.3 Create `frontend/src/app/api/lectures/[id]/poll/generate/route.ts` (POST handler):
    - Accept `{ conceptId? }`. If no conceptId, use the most recently detected concept for this lecture (query `transcript_concepts` joined with `concept_nodes`, ordered by most recent).
    - Fetch the concept's label and description from the DB (or from Flask `GET /api/courses/:id/graph`)
    - Fetch the last 5 transcript chunks for this lecture from the DB
    - Call Claude Sonnet with the prompt
    - Insert a `poll_questions` row (status='draft') with the question, expected answer, concept_id, lecture_id
    - Return `{ pollId, question, expectedAnswer, conceptId, conceptLabel }`
    - **DEPENDENCY: Person 4's Supabase client** (`frontend/server/db.ts`) for reading transcript_chunks and writing poll_questions. **DEPENDENCY: Person 1's Flask graph endpoint** for concept data (or direct Supabase read).
  - [x] 3.4 Create `frontend/src/app/api/lectures/[id]/poll/[pollId]/activate/route.ts` (POST handler):
    - Update `poll_questions` row status to 'active'
    - Emit Socket.IO event `poll:new-question` to the lecture room with `{ pollId, question, conceptLabel }`. **DEPENDENCY: Person 4's `emitToLectureRoom()` helper.**
    - If `DEMO_MODE` is set, call Person 4's `onPollActivated(pollId, question, conceptLabel)` function from `@server/auto-responder` to trigger auto-responses for simulated students. **DEPENDENCY: Person 4 exports this function** (P4 task 6.1).
    - Return `{ status: "active" }`
  - [x] 3.5 **Write test** for `parseQuestionGenerationResponse()`: valid JSON → returns question + expected answer, malformed JSON → throws or returns default
  - [x] 3.6 Verify: call the generate endpoint, confirm a poll_questions row is created, activate it and confirm Socket.IO event fires

- [x] 4.0 Build poll response evaluation endpoint
  - [x] 4.1 Create `frontend/src/lib/prompts/response-evaluation.ts`. Export:
    - `buildResponseEvaluationPrompt(question: string, expectedAnswer: string, studentAnswer: string): string`
    - `parseResponseEvaluationResponse(response: string): { eval_result: 'correct'|'partial'|'wrong', feedback: string, reasoning: string }`
  - [x] 4.2 The prompt must instruct Claude Haiku to:
    - Compare the student's answer against the expected answer
    - Return `{ "eval_result": "correct"|"partial"|"wrong", "feedback": "...", "reasoning": "..." }`
    - `feedback` should be a student-facing nudge (encouraging, not grading), 1-2 sentences
    - `eval_result` must be exactly one of the three values — NOT a color, NOT a number
  - [x] 4.3 **Write test** for `parseResponseEvaluationResponse()`:
    - Valid "correct" response → parses correctly
    - Valid "partial" response → parses correctly
    - Valid "wrong" response → parses correctly
    - Response with extra keys → still extracts the 3 required fields
    - Malformed JSON → returns a safe default `{ eval_result: "partial", feedback: "...", reasoning: "..." }`
  - [x] 4.4 Create `frontend/src/app/api/polls/[pollId]/respond/route.ts` (POST handler):
    - Accept `{ studentId, answer }`
    - Look up the poll question from DB (get question text, expected answer, concept_id)
    - Call Claude Haiku with the evaluation prompt
    - Parse the response to get `eval_result`, `feedback`, `reasoning`
    - Store the `poll_responses` row with the answer and evaluation JSONB
    - Call Flask `PUT /api/students/:studentId/mastery/:conceptId` with `{ eval_result }` — Flask returns `{ concept_id, old_color, new_color, confidence }`. **DEPENDENCY: Person 1's mastery PUT endpoint must be merged** (Merge Point 2).
    - Look up `lecture_id` from the `poll_questions` row (needed for `emitToProfessor`).
    - Emit `mastery:updated` to the specific student via `emitToStudent(studentId, ...)`. **DEPENDENCY: Person 4's Socket.IO helpers.**
    - Emit `heatmap:updated` with `{ conceptId }` to the professor via `emitToProfessor(lectureId, ...)`. The frontend re-fetches the full heatmap from Flask on this event — no need to compute the distribution here.
    - Return `{ evaluation: { eval_result, feedback, reasoning }, updated: { concept_id, old_color, new_color, confidence } }`
  - [x] 4.5 Verify: submit a student answer, confirm evaluation is stored, mastery is updated in Flask, Socket.IO events fire

> **MERGE POINT 2:** After completing tasks 2.0–4.0, merge to `main`. This is critical — Person 4's auto-responder depends on the `POST /api/polls/:pollId/respond` endpoint being available. Coordinate with Person 1's Merge Point 2 (mastery endpoints) and Person 4's Socket.IO merge.

- [ ] 5.0 Build poll close endpoint with misconception summary
  - [ ] 5.1 Create `frontend/src/lib/prompts/misconception-summary.ts`. Export:
    - `buildMisconceptionSummaryPrompt(question: string, responses: { answer: string, eval_result: string }[]): string`
    - `parseMisconceptionSummaryResponse(response: string): string` (returns a 1-2 sentence summary)
  - [ ] 5.2 Create `frontend/src/app/api/lectures/[id]/poll/[pollId]/close/route.ts` (POST handler):
    - Update `poll_questions` row status to 'closed'
    - Fetch all `poll_responses` for this poll
    - Compute distribution: query Flask `GET /api/courses/:id/heatmap`, filter to this poll's concept, and extract the `distribution` object (`{ green, yellow, red, gray }`). This gives accurate post-update colors (do NOT approximate from eval_results, since a student's prior confidence affects their final color).
    - Call Claude Haiku with the misconception summary prompt (all student answers + eval results)
    - Emit `poll:closed` to the lecture room with `{ pollId, results: { distribution, totalResponses, misconceptionSummary } }`
    - Return `{ status: "closed", distribution, totalResponses, misconceptionSummary }`
  - [ ] 5.3 Create `frontend/src/app/api/polls/[pollId]/results/route.ts` (GET handler):
    - Fetch poll responses, compute distribution of eval_results, return `{ totalResponses, distribution: { green, yellow, red } }`
  - [ ] 5.4 Verify: close a poll, confirm misconception summary is generated, Socket.IO event fires

- [ ] 6.0 Build tutoring session creation and message endpoints
  - [ ] 6.1 Create `frontend/src/lib/prompts/tutoring.ts`. Export:
    - `buildTutoringSystemPrompt(courseName: string, weakConcepts: { label: string, description: string, confidence: number }[], transcriptExcerpts: { text: string, timestampSec: number }[]): string`
  - [ ] 6.2 The system prompt must instruct Claude Sonnet to:
    - Act as a patient tutor using the Socratic method (ask guiding questions, don't lecture)
    - Focus on the student's specific weak concepts (listed with descriptions)
    - Reference lecture timestamps when relevant (e.g., "At minute 12, the professor explained...")
    - Keep responses concise (2-4 sentences max per turn)
  - [ ] 6.3 Create `frontend/src/lib/prompts/understanding-check.ts`. Export:
    - `buildUnderstandingCheckPrompt(studentMessage: string, targetConcepts: { label: string, description: string }[]): string`
    - `parseUnderstandingCheckResponse(response: string): { understood: boolean, concept_label: string }`
  - [ ] 6.4 **Write test** for `parseUnderstandingCheckResponse()`:
    - `{ understood: true, concept_label: "Chain Rule" }` → parses correctly
    - `{ understood: false, concept_label: "" }` → parses correctly
    - Malformed JSON → returns `{ understood: false, concept_label: "" }`
  - [ ] 6.5 Create `frontend/src/app/api/tutoring/sessions/route.ts` (POST handler):
    - Accept `{ studentId, lectureId? }`
    - Fetch the student's mastery from Flask `GET /api/students/:id/mastery`
    - Filter for weak concepts: confidence < 0.7 (red + yellow nodes)
    - If `lectureId` is provided, fetch relevant transcript chunks from the DB for those weak concepts (join `transcript_concepts` with `transcript_chunks`)
    - Build the system prompt with weak concepts and transcript excerpts
    - Make an initial Claude Sonnet call to generate an opening message (e.g., "I noticed you struggled with X during the lecture. Let's work through it together.")
    - Insert `tutoring_sessions` row with `target_concepts` UUID array
    - Insert the system message and assistant's opening message into `tutoring_messages`
    - Return `{ sessionId, targetConcepts: [{ id, label, confidence, color }], initialMessage: { role: "assistant", content: "..." } }`
  - [ ] 6.6 Create `frontend/src/app/api/tutoring/sessions/[id]/messages/route.ts`:
    - **GET handler:** Fetch all `tutoring_messages` for this session, ordered by `created_at`. Return `{ messages: [{ id, role, content, createdAt }] }`
    - **POST handler** — the full tutoring flow:
      1. Accept `{ content }` (student's message)
      2. Insert `tutoring_messages` row (role='user')
      3. Load full conversation history from DB
      4. Rebuild system prompt (same as session creation — course context, weak concepts, transcript excerpts)
      5. Call Claude Sonnet with system prompt + full message history
      6. Insert assistant's response as `tutoring_messages` row (role='assistant')
      7. Make a SECOND call to Claude Haiku with the understanding check prompt: pass the student's latest message and the target concepts. Parse response: `{ understood: boolean, concept_label: string }`
      8. If `understood` is true: resolve `concept_label` to a concept UUID (from the session's `target_concepts` list or a label→ID lookup), call Flask `PUT /api/students/:studentId/mastery/:conceptId` with `{ delta: 0.2 }`, set `concept_id` on the stored assistant `tutoring_messages` row, emit `mastery:updated` via Socket.IO
      9. Return `{ message: { role: "assistant", content: "..." }, masteryUpdates?: [{ conceptId, conceptLabel, oldColor, newColor, confidence }] }`
  - [ ] 6.7 Verify: create a tutoring session, exchange 3-5 messages, confirm multi-turn context is maintained, confirm understanding check triggers mastery boost when student demonstrates understanding

> **MERGE POINT 3:** After completing tasks 5.0–6.0, merge to `main`. This aligns with Person 2 merging UI and Person 4 merging the simulator. After this merge, the full demo loop should work end-to-end.

- [ ] 7.0 Build Perplexity resource search endpoint
  - [ ] 7.1 Create `frontend/src/app/api/resources/search/route.ts` (GET handler):
    - Accept query params: `concept` (label string), `courseId`
    - Call Perplexity Sonar API (`https://api.perplexity.ai/chat/completions`) with model `sonar` and a prompt: "Find 3-5 learning resources (YouTube videos, articles, textbook chapters) for understanding [concept] in the context of [course name]. Return JSON: { resources: [{ title, url, type, snippet }] }"
    - Use `PERPLEXITY_API_KEY` from env
    - Parse and return `{ resources: [{ title, url, type, snippet }] }`
  - [ ] 7.2 If `PERPLEXITY_API_KEY` is not set, return a hardcoded fallback with 2-3 generic resources (for testing without API credits)
  - [ ] 7.3 Verify: call the endpoint with a concept name, confirm resources are returned

- [ ] 8.0 Build intervention suggestions endpoint
  - [ ] 8.1 Create `frontend/src/lib/prompts/intervention.ts`. Export:
    - `buildInterventionPrompt(concepts: { label: string, description: string, distribution: { green: number, yellow: number, red: number, gray: number } }[]): string`
  - [ ] 8.2 The prompt must instruct Claude Sonnet to:
    - Analyze which concepts have high red/yellow counts
    - Suggest specific teaching strategies (e.g., "Try a visual analogy for Chain Rule", "Use a code example for Backpropagation")
    - Return `{ "suggestions": [{ "concept_label": "...", "suggestion": "..." }] }`
  - [ ] 8.3 Create `frontend/src/app/api/lectures/[id]/interventions/route.ts` (POST handler):
    - Accept `{ conceptIds: string[] }`
    - Fetch concept details and heatmap distribution from Flask (`GET /api/courses/:id/heatmap`)
    - Filter to the requested concept IDs
    - Call Claude Sonnet with the intervention prompt
    - Return `{ suggestions: [{ conceptId, conceptLabel, suggestion }] }`
  - [ ] 8.4 Verify: call the endpoint with concept IDs that have high red counts, confirm useful suggestions

- [ ] 9.0 Write tests for prompt output parsing and eval_result mapping
  - [ ] 9.1 Ensure all parsing tests from tasks 2.3, 3.5, 4.3, 6.4 are in `frontend/src/lib/prompts/__tests__/parsing.test.ts`
  - [ ] 9.2 Run full test suite: `npx vitest run`
  - [ ] 9.3 Fix any parsing edge cases discovered during integration

> **MERGE POINT 4 (Final):** Merge any remaining fixes to `main`. All 4 devs should be on `main` for end-to-end demo testing. Focus on: does the full loop work? Transcript → concept detection → poll → evaluation → mastery update → graph recolor → heatmap update → tutoring.
