# Tasks: Person 1 — Flask Knowledge Graph API

> **Owner:** Person 1
> **Branch:** `feat/p1-flask-api`
> **Directory:** `api/`
> **Responsibility:** Flask API — knowledge graph CRUD, PDF upload + concept extraction, mastery endpoints, student endpoints, heatmap, seed script

## Existing Prototype

The `knowledge-graph/` directory has a working proof-of-concept for PDF→KG extraction using Supabase, PyPDF2, and Claude's document API — the same core stack. Key references to port:
- **`knowledge-graph/src/services/create_kg.py`** — Claude document API call pattern (base64 PDF + prompt). Port this into `api/services/concept_extraction.py`, updating the prompt to return JSON instead of markdown.
- **`knowledge-graph/src/routes/create.py`** — Supabase client setup and PDF upload route. Adapt the Supabase pattern for all new endpoints.
- **`knowledge-graph/result.txt`** — Sample CS229 knowledge graph output (27 nodes, 28 edges) that can inform seed script design.

Build the canonical implementation in `api/` per this spec, adding all missing endpoints (courses, students, mastery, heatmap, graph queries). The `knowledge-graph/` directory will be removed once `api/` is complete.

## Relevant Files

- `api/main.py` - Flask app entry point; registers all blueprints, configures CORS
- ~~`api/models.py`~~ - Not needed. Supabase client returns dictionaries. Schema is managed in Supabase SQL Editor.
- `api/db.py` - Supabase client setup from `SUPABASE_URL` and `SUPABASE_KEY`
- `api/routes/courses.py` - Course CRUD blueprint (POST, GET list, GET by ID)
- `api/routes/students.py` - Student endpoints blueprint (POST with eager mastery creation, GET list)
- `api/routes/upload.py` - PDF upload + concept extraction blueprint
- `api/routes/graph.py` - Knowledge graph query endpoint
- `api/routes/mastery.py` - Mastery GET, PUT (3 modes), attendance-boost
- `api/routes/heatmap.py` - Heatmap aggregation endpoint
- `api/services/concept_extraction.py` - Claude Sonnet call for concept extraction (uses prompt from Person 3)
- `api/utils/colors.py` - `confidence_to_color()` helper
- `api/requirements.txt` - Python dependencies
- `api/tests/test_colors.py` - Tests for confidence-to-color derivation
- `api/tests/test_mastery.py` - Tests for mastery endpoint confidence rules
- `api/tests/conftest.py` - Pytest fixtures (test DB, test client)
- `scripts/seed_demo.py` - Demo seed script (course, ~35 concepts, edges, 4 students with mastery)
- `.env.example` - Template environment variables

### Notes

- Use `pytest` to run tests: `cd api && python -m pytest`
- Tables must be created in Supabase SQL Editor before the app starts. See CLAUDE.md "Database Schema" section.
- Flask uses the `supabase-py` client library — all DB operations go through Supabase's REST API, not direct SQL. See `knowledge-graph/src/routes/create.py` for the pattern.
- The mastery PUT endpoint must handle 3 body formats: `{ confidence }`, `{ eval_result }`, `{ delta }`. See CLAUDE.md "Mastery" section.
- When creating a student, eagerly insert `student_mastery` rows for every concept in the course (confidence 0.0). When uploading a PDF (creating concepts), insert mastery rows for all existing students.
- Concept extraction edges use `source_label` / `target_label` (not UUIDs). You must insert concept_nodes first, build a label→ID map, then insert edges.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [ ] 0.0 Create feature branch
  - [ ] 0.1 Run `git checkout -b feat/p1-flask-api` from `main`

- [ ] 1.0 Set up Flask project structure with Supabase client
  - [ ] 1.1 Create `api/` directory with `main.py`, `db.py`, `models.py`, `requirements.txt`
  - [ ] 1.2 In `requirements.txt`, add: `flask`, `flask-cors`, `supabase`, `anthropic`, `pypdf2`, `python-dotenv`, `gunicorn`, `pytest`
  - [ ] 1.3 In `db.py`, set up Supabase client using `SUPABASE_URL` and `SUPABASE_KEY` from env (loaded via `python-dotenv` from `../.env`): `supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))`
  - [ ] 1.4 No `models.py` needed — Supabase client returns dictionaries. The schema is applied directly in Supabase SQL Editor (see CLAUDE.md "Database Schema" section). Ensure all tables are created before starting the Flask app.
  - [ ] 1.5 In `main.py`, create Flask app, enable CORS (`flask-cors`), register blueprints, and set up a basic health check route `GET /api/health` → `{ status: "ok" }`. No table creation needed — schema is managed in Supabase.
  - [ ] 1.6 Create `api/utils/colors.py` with the `confidence_to_color(confidence: float) -> str` helper function (thresholds: 0.0 → gray, <0.4 → red, <0.7 → yellow, else green)
  - [ ] 1.7 Create `.env.example` at project root with all env vars (SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, FLASK_API_URL, DEMO_MODE)
  - [ ] 1.8 Verify: run `python main.py`, confirm health check returns 200, confirm Supabase tables are accessible (test a simple query from db.py)

- [ ] 2.0 Implement course CRUD and student endpoints
  - [ ] 2.1 Create `api/routes/courses.py` blueprint with: `POST /api/courses` (create course), `GET /api/courses` (list all), `GET /api/courses/:id` (get by ID)
  - [ ] 2.2 Create `api/routes/students.py` blueprint with: `GET /api/courses/:id/students` (list students in course), `POST /api/courses/:id/students` (create student)
  - [ ] 2.3 In the student creation endpoint, after inserting the student row, bulk-insert a `student_mastery` row (confidence=0.0, attempts=0) for every `concept_node` that belongs to the same course. This is the "eager mastery creation" pattern — it means downstream reads never need LEFT JOINs.
  - [ ] 2.4 Register both blueprints in `main.py`
  - [ ] 2.5 Verify: use `curl` or Postman to create a course, create a student, and list students

- [ ] 3.0 Implement PDF upload and concept extraction endpoint
  - [ ] 3.1 Create `api/routes/upload.py` blueprint with `POST /api/courses/:id/upload` accepting `multipart/form-data` with a PDF file
  - [ ] 3.2 Use `PyPDF2` to truncate the uploaded PDF to the first 10 pages, then encode the truncated PDF as base64 (same approach as the `knowledge-graph/` prototype)
  - [ ] 3.3 Create `api/services/concept_extraction.py`. This calls Claude Sonnet (`claude-sonnet-4-5-20250929`) using the document API — send the base64 PDF as a `document` content block alongside the prompt text as a `text` content block (same pattern as `knowledge-graph/src/services/create_kg.py`). **DEPENDENCY: Person 3 must provide the prompt text** (see task P3 1.0). Until then, use a placeholder prompt that asks Claude to extract concepts and return JSON.
  - [ ] 3.4 Parse Claude's JSON response: `{ concepts: [{ label, description, category, difficulty }], edges: [{ source_label, target_label, relationship }] }`
  - [ ] 3.5 Insert `concept_nodes` rows into Supabase from the concepts array. Build a `label → UUID` map from the inserted rows (Supabase insert returns the created rows with IDs).
  - [ ] 3.6 Bulk-insert `concept_edges` rows using the label→UUID map to resolve `source_label` and `target_label` to `source_id` and `target_id`
  - [ ] 3.7 After inserting concepts, bulk-insert `student_mastery` rows (confidence=0.0) for every existing student in the course × every new concept. This is the other half of the "eager mastery creation" pattern.
  - [ ] 3.8 Return `{ concepts: [...], edges: [...] }` with the full graph data
  - [ ] 3.9 Register blueprint in `main.py`
  - [ ] 3.10 Verify: upload a small test PDF, confirm concepts and edges are created in DB

- [ ] 4.0 Implement knowledge graph query endpoint
  - [ ] 4.1 Create `api/routes/graph.py` blueprint with `GET /api/courses/:id/graph?student_id=` (optional query param)
  - [ ] 4.2 Query all `concept_nodes` for the course from Supabase. If `student_id` is provided, also fetch that student's `student_mastery` rows and merge confidence values onto the nodes in Python. Derive `color` from confidence using `confidence_to_color()`.
  - [ ] 4.3 Query all `concept_edges` for the course. Map `source_id` → `source` and `target_id` → `target` in the response (the frontend expects `source`/`target`, not `source_id`/`target_id`).
  - [ ] 4.4 Return the JSON structure from CLAUDE.md: `{ nodes: [{ id, label, description, category, difficulty, confidence?, color? }], edges: [{ id, source, target, relationship }] }`
  - [ ] 4.5 Register blueprint in `main.py`
  - [ ] 4.6 Verify: with seeded data, call the endpoint with and without `student_id`, confirm correct node colors

> **MERGE POINT 1:** After completing tasks 1.0–4.0, merge `feat/p1-flask-api` to `main`. Person 2 and Person 3 both depend on the graph and course endpoints being available. Coordinate with Person 4 who should also merge their server scaffolding at this point. From here on, Person 2 can fetch real graph data and Person 3 can call the mastery endpoint.

- [ ] 5.0 Implement mastery endpoints (GET, PUT with 3 modes, attendance-boost)
  - [ ] 5.1 **Write tests first** in `api/tests/test_mastery.py`. Test cases for the PUT endpoint:
    - `{ eval_result: "correct" }` when current confidence is 0.0 → should become 0.85
    - `{ eval_result: "correct" }` when current confidence is 0.90 → should stay 0.90 (max rule)
    - `{ eval_result: "partial" }` when current confidence is 0.20 → should become 0.50
    - `{ eval_result: "partial" }` when current confidence is 0.60 → should stay 0.60 (max rule)
    - `{ eval_result: "wrong" }` when current confidence is 0.60 → should become 0.20
    - `{ eval_result: "wrong" }` when current confidence is 0.0 → should become 0.20 (NOT stay 0.0)
    - `{ eval_result: "wrong" }` when current confidence is 0.10 → should stay 0.10 (already below 0.20)
    - `{ confidence: 0.75 }` → should set to exactly 0.75
    - `{ delta: 0.2 }` when current is 0.5 → should become 0.7
    - `{ delta: 0.2 }` when current is 0.95 → should clamp to 1.0
    - Verify `attempts` increments only for `eval_result` mode
    - Verify response includes correct `old_color` and `new_color`
  - [ ] 5.2 **Write tests first** in `api/tests/test_colors.py` for `confidence_to_color()`: test 0.0→gray, 0.01→red, 0.39→red, 0.4→yellow, 0.69→yellow, 0.7→green, 1.0→green
  - [ ] 5.3 Create `api/tests/conftest.py` with pytest fixtures: mock Supabase client (use `unittest.mock` to mock Supabase responses), test Flask client, seed helper functions
  - [ ] 5.4 Create `api/routes/mastery.py` blueprint with `GET /api/students/:id/mastery` — return all mastery records for the student with derived colors: `[{ concept_id, confidence, color, attempts }]`
  - [ ] 5.5 Implement `PUT /api/students/:id/mastery/:concept_id` with 3 body modes:
    - If body has `confidence` key: set absolute value
    - If body has `eval_result` key: read current confidence, apply rules (correct→max(cur,0.85), partial→max(cur,0.50), wrong→0.20 if cur==0.0 else min(cur,0.20)), increment `attempts`
    - If body has `delta` key: read current, add delta, clamp to [0.0, 1.0]
    - For all modes: compute old_color and new_color, update `last_updated`, return `{ concept_id, old_color, new_color, confidence }`
  - [ ] 5.6 Implement `POST /api/mastery/attendance-boost` — accepts `{ concept_ids: [], student_ids: [] }`, adds +0.05 to confidence for each pair, but ONLY if the result would not exceed 0.3 (cap for passive boosts). Return `{ updated: count }`.
  - [ ] 5.7 **Write test for attendance-boost**: confidence at 0.0 → 0.05, at 0.25 → 0.30, at 0.28 → 0.30 (capped), at 0.30 → 0.30 (no change), at 0.5 → 0.5 (no change, already above cap from active assessment)
  - [ ] 5.8 Register blueprint in `main.py`
  - [ ] 5.9 Run all tests: `python -m pytest api/tests/ -v`. All must pass.

> **MERGE POINT 2:** After completing task 5.0, merge to `main`. This is critical — Person 3's poll respond route and tutoring route both call the mastery PUT endpoint. Person 3 is blocked on this for end-to-end evaluation flow.

- [ ] 6.0 Implement heatmap aggregation endpoint
  - [ ] 6.1 Create `api/routes/heatmap.py` blueprint with `GET /api/courses/:id/heatmap`
  - [ ] 6.2 For each concept in the course, query all `student_mastery` rows, compute the distribution by applying `confidence_to_color()` to each student's confidence, and count green/yellow/red/gray. Also compute `avg_confidence`.
  - [ ] 6.3 Return: `{ concepts: [{ id, label, distribution: { green, yellow, red, gray }, avg_confidence }], total_students: N }`
  - [ ] 6.4 Register blueprint in `main.py`
  - [ ] 6.5 Verify: with seeded data, confirm distribution counts match expected values

- [ ] 7.0 Create seed demo script
  - [ ] 7.1 Create `scripts/seed_demo.py` that uses Flask API endpoints (via HTTP requests to localhost:5000) or direct Supabase client to create all demo data
  - [ ] 7.2 Create the CS229 Machine Learning course via `POST /api/courses`
  - [ ] 7.3 Create ~35 concept nodes organized by category (see CLAUDE.md Seed Data section for exact list: Linear Algebra, Calculus, Probability, ML Foundations, Gradient Descent, Neural Networks, Backpropagation, Regularization, Evaluation)
  - [ ] 7.4 Create prerequisite edges between concepts (e.g., Vectors → Matrix Multiplication, Derivatives → Chain Rule, Chain Rule → Backpropagation, etc.). Design edges to form a meaningful dependency graph.
  - [ ] 7.5 Create 4 students: Alex, Jordan, Sam, Taylor — each in the CS229 course
  - [ ] 7.6 Set pre-seeded confidence values per the student profiles in CLAUDE.md:
    - **Alex (Strong):** Most concepts 0.7-0.9, regularization/dropout at 0.5
    - **Jordan (Average):** Fundamentals 0.7+, intermediate 0.4-0.6, backprop/regularization 0.15-0.3
    - **Sam (Struggling, LIVE PARTICIPANT):** Neural network cluster 0.1-0.2, calculus 0.3-0.5, basic linear algebra 0.7+
    - **Taylor (Specific gaps):** All math 0.8+, all neural network concepts 0.1-0.2
  - [ ] 7.7 Make the script idempotent: check if data exists before inserting (or drop and recreate)
  - [ ] 7.8 Verify: run the seed script, then call `GET /api/courses/:id/graph?student_id=<sam_id>` and confirm Sam's nodes have correct colors

> **MERGE POINT 3:** After completing tasks 6.0–7.0, merge to `main`. Person 2 needs heatmap data for the dashboard. The seed script is needed by everyone for testing. This should align with Person 3 and Person 4 merging their core routes.

- [ ] 8.0 Write tests for mastery logic and confidence rules
  - [ ] 8.1 If not already done in 5.1/5.2, ensure all mastery tests pass: `python -m pytest api/tests/ -v`
  - [ ] 8.2 Add any edge case tests discovered during integration (e.g., what happens if PUT is called for a student/concept pair that doesn't have a mastery row yet? It should return 404 since we use eager creation.)
  - [ ] 8.3 Run final test suite and confirm 100% of mastery tests pass before final merge

> **MERGE POINT 4 (Final):** Merge any remaining fixes to `main` for integration testing. All 4 devs should be on `main` at this point for end-to-end demo testing.
