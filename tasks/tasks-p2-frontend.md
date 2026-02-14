# Tasks: Person 2 — Frontend UI

> **Owner:** Person 2
> **Branch:** `feat/p2-frontend`
> **Directory:** `frontend/src/components/`, `frontend/src/app/`
> **Responsibility:** All frontend pages — landing page, professor dashboard, student in-lecture view, tutoring view, knowledge graph visualization, real-time Socket.IO listeners

## Relevant Files

- `frontend/src/app/page.tsx` - Landing page (student dropdown + professor mode button)
- `frontend/src/app/professor/dashboard/page.tsx` - Professor dashboard page
- `frontend/src/app/student/[studentId]/page.tsx` - Student in-lecture view page
- `frontend/src/app/student/[studentId]/tutor/page.tsx` - Post-lecture tutoring view page
- `frontend/src/app/layout.tsx` - Root layout with shared providers (Socket.IO context)
- `frontend/src/components/graph/KnowledgeGraph.tsx` - Force-directed graph (react-force-graph-2d, dynamic import with ssr:false)
- `frontend/src/components/graph/NodeDetailPanel.tsx` - Clicked-node detail panel (description, confidence, resources)
- `frontend/src/components/dashboard/TranscriptFeed.tsx` - Scrolling transcript with concept tags
- `frontend/src/components/dashboard/ConceptHeatmap.tsx` - Grid of concepts colored by class mastery distribution
- `frontend/src/components/dashboard/ConceptTimeline.tsx` - Horizontal chronological concept pills
- `frontend/src/components/dashboard/StudentList.tsx` - Student names with colored mastery dots
- `frontend/src/components/dashboard/PollControls.tsx` - Generate / preview / send / close poll + results display
- `frontend/src/components/dashboard/InterventionPanel.tsx` - AI suggestion panel with "Get Suggestions" button
- `frontend/src/components/student/PollCard.tsx` - Poll question display + textarea + submit + feedback
- `frontend/src/components/tutor/ChatInterface.tsx` - Chat message list + input
- `frontend/src/components/tutor/WeakConceptsSidebar.tsx` - Sidebar listing weak concepts with live color updates
- `frontend/src/lib/colors.ts` - `confidenceToColor()` and hex map
- `frontend/src/lib/colors.test.ts` - Tests for confidenceToColor
- `frontend/src/lib/socket.ts` - Socket.IO client singleton + hooks
- `frontend/src/lib/api.ts` - Fetch wrappers for Flask and Next.js API routes

### Notes

- Use `vitest` to run tests: `cd frontend && npx vitest run`
- `react-force-graph-2d` MUST be imported with `next/dynamic` and `{ ssr: false }` — it uses browser APIs (`window`, `document`) and will crash during SSR.
- All pages are `'use client'` components since they use Socket.IO, interactive state, and browser APIs.
- Use `shadcn/ui` for buttons, cards, inputs, dropdowns, dialog, etc. Initialize with `npx shadcn-ui@latest init` (Tailwind must be configured first).
- Until Person 1 and Person 4 merge their work, use hardcoded mock JSON for graph data and manually emit Socket.IO events for testing.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [ ] 0.0 Create feature branch
  - [ ] 0.1 Run `git checkout -b feat/p2-frontend` from `main`

- [ ] 1.0 Set up Next.js pages, Tailwind CSS, and shadcn/ui component library
  - [ ] 1.1 Verify `frontend/` directory exists with Next.js 14+ (App Router). If not, run `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir`. **DEPENDENCY: Coordinate with Person 4** who is also setting up the frontend directory for the custom Express server. Person 4 should create the Next.js project first, then Person 2 adds UI scaffolding on top.
  - [ ] 1.2 Initialize shadcn/ui: `cd frontend && npx shadcn-ui@latest init`. Select defaults (New York style, zinc base color). Add core components: `npx shadcn-ui@latest add button card input textarea select dropdown-menu dialog badge`
  - [ ] 1.3 Install additional dependencies: `npm install react-force-graph-2d recharts socket.io-client`
  - [ ] 1.4 Create `frontend/src/lib/colors.ts` with `confidenceToColor()` function and a hex map constant:
    ```
    gray → #94a3b8, red → #ef4444, yellow → #eab308, green → #22c55e, active → #3b82f6
    ```
  - [ ] 1.5 Create `frontend/src/lib/api.ts` with fetch helpers: `flaskApi.get(path)`, `flaskApi.put(path, body)`, `nextApi.post(path, body)` — these prepend `FLASK_API_URL` or `/api` and handle JSON parsing. Keep it simple, no axios.
  - [ ] 1.6 Create the 4 page files as empty shells (just a div with the page name) so routing works:
    - `frontend/src/app/page.tsx` (landing)
    - `frontend/src/app/professor/dashboard/page.tsx`
    - `frontend/src/app/student/[studentId]/page.tsx`
    - `frontend/src/app/student/[studentId]/tutor/page.tsx`
  - [ ] 1.7 Verify: `npm run dev` starts without errors, all 4 routes render their shell content

> **MERGE POINT 1:** After completing tasks 0.0–1.0, merge to `main`. This aligns with Person 1 merging Flask scaffolding and Person 4 merging the Express server. After this merge, the full project structure exists on `main`.

- [ ] 2.0 Build the landing page with student selector and professor mode
  - [ ] 2.1 In `frontend/src/app/page.tsx`, build the landing page UI: app title "Prereq", a dropdown/select listing the 4 students (Alex, Jordan, Sam, Taylor), and a "Professor Mode" button
  - [ ] 2.2 On page load, fetch the student list from Flask: `GET /api/courses/:id/students`. **DEPENDENCY: Person 1's student endpoint must be merged** (Merge Point 1). Until then, hardcode the 4 student names and IDs.
  - [ ] 2.3 When a student is selected and confirmed, store the student ID in `localStorage.setItem('studentId', id)` and set a `studentId` cookie (`document.cookie = 'studentId=...'`), then navigate to `/student/[studentId]`
  - [ ] 2.4 When "Professor Mode" is clicked, navigate to `/professor/dashboard`
  - [ ] 2.5 The course ID can be hardcoded for the demo (single course). Store it in a constant or env var.
  - [ ] 2.6 Verify: landing page renders, selecting a student navigates correctly, professor button works

- [ ] 3.0 Build the knowledge graph visualization component (react-force-graph-2d)
  - [ ] 3.1 Create `frontend/src/components/graph/KnowledgeGraph.tsx` as a `'use client'` component
  - [ ] 3.2 Import `react-force-graph-2d` using dynamic import with SSR disabled:
    ```tsx
    const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });
    ```
  - [ ] 3.3 Accept props: `{ nodes, edges, activeConceptId?, onNodeClick? }`. The `nodes` array has `{ id, label, color, confidence }` and `edges` has `{ source, target }`.
  - [ ] 3.4 Map node colors to hex values using the color hex map from `colors.ts`. If a node's ID matches `activeConceptId`, render it with the blue glow (#3b82f6) — use a pulsing animation (CSS keyframes or canvas draw).
  - [ ] 3.5 Configure the graph: enable node labels, set node size proportional to difficulty (or fixed), set link color to a subtle gray, enable zoom/pan.
  - [ ] 3.6 On node click, call `onNodeClick(node)` so the parent page can show the detail panel.
  - [ ] 3.7 Create `frontend/src/components/graph/NodeDetailPanel.tsx` — displays: concept label, description, confidence score, mastery color badge, and a "Find Resources" button (which calls `GET /api/resources/search?concept=...`). **DEPENDENCY: Person 3's resource search endpoint.** Until then, show a placeholder.
  - [ ] 3.8 Verify: render the graph with mock data (hardcoded 5-10 nodes), confirm nodes are colored, clickable, and the active glow works
  - [ ] 3.9 Fetch real data from `GET /api/courses/:id/graph?student_id=` when Person 1's endpoint is available (after Merge Point 1). Verify with seeded data.

- [ ] 4.0 Build the professor dashboard page
  - [ ] 4.1 In `frontend/src/app/professor/dashboard/page.tsx`, create the layout matching the wireframe in the PRD: transcript feed (left), concept heatmap (center), student list (right), concept timeline (bottom strip), poll controls (bottom), intervention panel (bottom)
  - [ ] 4.2 Create `frontend/src/components/dashboard/TranscriptFeed.tsx` — a scrollable list of transcript chunks. Each chunk shows the text, and any detected concept labels are rendered as colored badges inline. Auto-scrolls to bottom on new chunks.
  - [ ] 4.3 Create `frontend/src/components/dashboard/ConceptHeatmap.tsx` — a grid/table. Each row is a concept label. The cells show the distribution as a stacked color bar (green/yellow/red/gray segments proportional to counts). Fetch from `GET /api/courses/:id/heatmap`. **DEPENDENCY: Person 1's heatmap endpoint** (available after Merge Point 3). Until then, use hardcoded JSON.
  - [ ] 4.4 Create `frontend/src/components/dashboard/ConceptTimeline.tsx` — a horizontal row of pill badges, each showing a concept label that was detected during the lecture, in chronological order. New concepts appear on the right.
  - [ ] 4.5 Create `frontend/src/components/dashboard/StudentList.tsx` — a vertical list of student names, each with small colored dots representing their overall mastery (e.g., the average color across all concepts, or the count of green/yellow/red). Clicking a student navigates to `/student/[studentId]` to see their individual graph.
  - [ ] 4.6 Create `frontend/src/components/dashboard/PollControls.tsx`:
    - "Generate Question" button → calls `POST /api/lectures/:id/poll/generate` → shows preview (question text + concept label)
    - "Send to Students" button → calls `POST /api/lectures/:id/poll/:pollId/activate`
    - "Close Poll" button → calls `POST /api/lectures/:id/poll/:pollId/close` → shows results (distribution bar + misconception summary)
    - Display total responses count while poll is active
    - **DEPENDENCY: Person 3's poll endpoints** (available after Merge Point 3). Until then, wire the buttons with console.log stubs.
  - [ ] 4.7 Create `frontend/src/components/dashboard/InterventionPanel.tsx` — a panel with a "Get Suggestions" button. When clicked, calls `POST /api/lectures/:id/interventions` with concept IDs that have high red counts (from heatmap data). Displays the returned suggestions. **DEPENDENCY: Person 3's intervention endpoint.**
  - [ ] 4.8 In demo mode (`DEMO_MODE=true`), add a "Start Demo" button in the dashboard header. When clicked, it calls `POST /api/lectures` to create a lecture session, then starts the transcript flow. **DEPENDENCY: Person 4's lecture creation endpoint and transcript simulator.** Until then, the button can be a stub.
  - [ ] 4.9 Verify: dashboard renders all panels, layout matches wireframe, mock data displays correctly

> **MERGE POINT 2:** After completing tasks 2.0–4.0 (or at least 2.0–3.0), merge to `main`. This gives the team a working UI to test against. Coordinate timing with Person 1's Merge Point 2 (mastery endpoints) so the full data flow can be tested.

- [ ] 5.0 Build the student in-lecture view page
  - [ ] 5.1 In `frontend/src/app/student/[studentId]/page.tsx`, create the layout matching the PRD wireframe: knowledge graph (left, ~60% width), active panel (right, ~40% width)
  - [ ] 5.2 Render the `KnowledgeGraph` component with the student's personalized data: fetch from `GET /api/courses/:id/graph?student_id=[studentId]`
  - [ ] 5.3 In the active panel, show the `PollCard` component when a poll is active, and a small `TranscriptFeed` when no poll is active
  - [ ] 5.4 Create `frontend/src/components/student/PollCard.tsx`:
    - Shows the question text and concept label
    - Has a textarea for the student's free-form answer
    - "Submit" button → calls `POST /api/polls/:pollId/respond` with `{ studentId, answer }`
    - After submission, shows the feedback nudge from the evaluation response (not a grade, just guidance)
    - Disable textarea + button after submission
    - **DEPENDENCY: Person 3's respond endpoint.** Until then, mock the response.
  - [ ] 5.5 Add a "Start Tutoring" button in the header that navigates to `/student/[studentId]/tutor`
  - [ ] 5.6 Verify: student view renders graph with correct colors, poll card appears and is submittable

- [ ] 6.0 Build the post-lecture tutoring view page
  - [ ] 6.1 In `frontend/src/app/student/[studentId]/tutor/page.tsx`, create the layout matching the PRD wireframe: weak concepts sidebar (left, ~20% width), chat interface (right, ~80% width)
  - [ ] 6.2 On page load, create a tutoring session: `POST /api/tutoring/sessions` with `{ studentId, lectureId }`. The response includes `targetConcepts` (the student's weak concepts) and an `initialMessage` from the AI. **DEPENDENCY: Person 3's tutoring session endpoint.**
  - [ ] 6.3 Create `frontend/src/components/tutor/WeakConceptsSidebar.tsx` — lists each target concept with its label and a colored dot (from confidence). These colors must update in real-time when the student demonstrates understanding during the chat (via Socket.IO `mastery:updated` events).
  - [ ] 6.4 Create `frontend/src/components/tutor/ChatInterface.tsx`:
    - Scrollable message list showing alternating user/assistant messages
    - Text input + "Send" button at the bottom
    - On send: `POST /api/tutoring/sessions/:id/messages` with `{ content }`. Display the AI's response. If `masteryUpdates` is in the response, show a subtle notification ("Your understanding of [concept] improved!").
    - Auto-scroll to bottom on new messages
  - [ ] 6.5 Verify: tutoring page loads, creates session, displays initial AI message, user can send messages and receive responses

- [ ] 7.0 Wire Socket.IO event listeners for real-time updates across all pages
  - [ ] 7.1 Create `frontend/src/lib/socket.ts` — a Socket.IO client singleton. Connect to the server on `window.location.origin` (same host, since Express serves both). Export a `useSocket()` hook that returns the socket instance.
  - [ ] 7.2 On the professor dashboard and student view pages, emit `lecture:join` with `{ lectureId, role: 'professor'|'student', studentId? }` when the page mounts. **DEPENDENCY: Person 4's Socket.IO room management must be merged** (Merge Point 1).
  - [ ] 7.3 On the professor dashboard, listen for:
    - `transcript:chunk` → append to TranscriptFeed, update ConceptTimeline with any new detected concepts
    - `lecture:concept-detected` → add pill to ConceptTimeline, trigger glow on the graph node if professor is viewing a student's graph
    - `poll:closed` → update PollControls with results
    - `heatmap:updated` → re-fetch full heatmap data from Flask `GET /api/courses/:id/heatmap` (the event payload is just `{ conceptId }` as a trigger, not the full distribution)
    - `mastery:updated` → update StudentList dots for the specific student
  - [ ] 7.4 On the student view, listen for:
    - `transcript:chunk` → append to small transcript feed
    - `lecture:concept-detected` → trigger blue glow on the matching graph node (set `activeConceptId`)
    - `poll:new-question` → show PollCard with the question data
    - `mastery:updated` (filtered to this student) → recolor the affected graph node with smooth CSS transition
  - [ ] 7.5 On the tutoring view, listen for:
    - `mastery:updated` (filtered to this student) → update WeakConceptsSidebar colors
  - [ ] 7.6 Implement smooth color transitions on graph nodes: when a node's color changes, animate from old color to new color over ~500ms. This can be done via the `nodeCanvasObject` callback in react-force-graph-2d with an interpolation.
  - [ ] 7.7 Verify: open professor dashboard and student view side by side. Have Person 4 run the transcript simulator. Confirm transcript appears on both, concepts are detected, graph nodes glow.

> **MERGE POINT 3:** After completing tasks 5.0–7.0, merge to `main`. This aligns with Person 3 merging AI routes and Person 4 merging the transcript simulator. After this merge, the full end-to-end demo flow should work.

- [ ] 8.0 Write tests for confidence-to-color helper and key UI logic
  - [ ] 8.1 Create `frontend/src/lib/colors.test.ts` testing `confidenceToColor()`: 0→gray, 0.01→red, 0.39→red, 0.4→yellow, 0.69→yellow, 0.7→green, 1.0→green
  - [ ] 8.2 Run tests: `npx vitest run`
  - [ ] 8.3 Fix any issues found during integration testing (layout, color mismatches, Socket.IO event handling)

> **MERGE POINT 4 (Final):** Merge any UI polish and fixes to `main`. All 4 devs should be on `main` for end-to-end demo rehearsal.
