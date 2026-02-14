# API Endpoint Documentation

**Base URL:** `http://localhost:5000` (development) or `FLASK_API_URL` (production)
**All endpoints return JSON**
**Error responses:** `{ "error": "Error message" }` with appropriate HTTP status codes

---

## Table of Contents

1. [Courses](#courses)
2. [Concepts](#concepts)
3. [Students & Mastery](#students--mastery)
4. [Graph](#graph)
5. [Heatmap](#heatmap)
6. [Lectures](#lectures)
7. [Transcripts](#transcripts)
8. [Polls](#polls)
9. [Tutoring](#tutoring)
10. [Pages & Quizzes](#pages--quizzes)
11. [Create/Upload](#createupload)

---

## Courses

### GET /api/courses
**Type:** CRUD
**Purpose:** Retrieve all courses
**Auth:** None
**Request:** None
**Response:**
```json
[
  {
    "id": "uuid",
    "name": "CS229 Machine Learning",
    "description": "Introduction to machine learning",
    "created_at": "2025-01-15T10:30:00Z"
  }
]
```

### POST /api/courses
**Type:** CRUD
**Purpose:** Create a new course
**Auth:** None
**Request Body:**
```json
{
  "name": "CS229 Machine Learning",
  "description": "Introduction to machine learning"
}
```
**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "CS229 Machine Learning",
  "description": "Introduction to machine learning",
  "created_at": "2025-01-15T10:30:00Z"
}
```

### GET /api/courses/{course_id}
**Type:** CRUD
**Purpose:** Retrieve a single course by ID
**Auth:** None
**Path Parameters:**
- `course_id` (string, uuid): Course identifier

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "CS229 Machine Learning",
  "description": "Introduction to machine learning",
  "created_at": "2025-01-15T10:30:00Z"
}
```
**Error:** `404 Not Found` if course doesn't exist

### POST /api/courses/{course_id}/upload
**Type:** NON-CRUD (Knowledge Graph Generation)
**Purpose:** Upload a PDF and generate knowledge graph for a course
**Auth:** None
**Path Parameters:**
- `course_id` (string, uuid): Course identifier

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (PDF file)

**Process:**
1. Calculates MD5 hash of uploaded file
2. Checks `pdf_cache` table for existing results
3. If cached: Returns cached graph data
4. If not cached:
   - Saves PDF to `/tmp/{hash}_{filename}`
   - Calls `create_kg()` to extract knowledge graph using Claude API
   - Parses knowledge graph markdown into structured format
   - Calculates importance scores for nodes
   - Deletes temporary file
   - Caches result in `pdf_cache` table
5. Updates course with `pdf_cache_hash`
6. Inserts concept nodes into `concept_nodes` table
7. Inserts edges into `concept_edges` table

**Response:** `200 OK`
```json
{
  "graph": {
    "nodes": {
      "Backpropagation": "Algorithm for computing gradients...",
      "Chain Rule": "Calculus rule for derivatives..."
    },
    "edges": [
      ["Chain Rule", "Backpropagation"],
      ["Gradient Descent", "Backpropagation"]
    ]
  },
  "importance": {
    "Backpropagation": 0.85,
    "Chain Rule": 0.72
  }
}
```

**Notes:**
- Uses MD5 hash-based caching to avoid reprocessing identical PDFs
- Knowledge graph extraction is AI-powered (Claude document API)
- Node importance is calculated from graph structure

---

## Concepts

### GET /api/concepts/{concept_id}
**Type:** CRUD
**Purpose:** Get a single concept by ID
**Auth:** None
**Path Parameters:**
- `concept_id` (string, uuid): Concept identifier

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "label": "Backpropagation",
  "description": "Algorithm for computing gradients in neural networks"
}
```
**Error:** `404 Not Found` if concept doesn't exist

### GET /api/concepts
**Type:** CRUD (Batch Query)
**Purpose:** Get multiple concepts by IDs
**Auth:** None
**Query Parameters:**
- `ids` (string, comma-separated): Concept IDs (e.g., `"uuid1,uuid2,uuid3"`)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid1",
    "label": "Backpropagation",
    "description": "Algorithm for computing gradients..."
  },
  {
    "id": "uuid2",
    "label": "Chain Rule",
    "description": "Calculus rule for derivatives..."
  }
]
```

**Notes:**
- Returns empty array if `ids` parameter is missing or empty
- Whitespace in IDs is automatically trimmed

---

## Students & Mastery

### GET /api/courses/{course_id}/students
**Type:** CRUD
**Purpose:** Get all students enrolled in a course
**Auth:** None
**Path Parameters:**
- `course_id` (string, uuid): Course identifier

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Sam Johnson",
    "email": "sam@example.com"
  }
]
```

### POST /api/courses/{course_id}/students
**Type:** NON-CRUD (Student Creation with Auto-Mastery)
**Purpose:** Create a new student and initialize mastery records
**Auth:** None
**Path Parameters:**
- `course_id` (string, uuid): Course identifier

**Request Body:**
```json
{
  "name": "Sam Johnson",
  "email": "sam@example.com"
}
```

**Process:**
1. Creates student record in `students` table
2. Queries all concepts for the course
3. Bulk-inserts `student_mastery` rows with `confidence: 0.0` for every concept
4. Returns created student

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Sam Johnson",
  "email": "sam@example.com",
  "course_id": "course-uuid"
}
```

**Notes:**
- Eager mastery initialization ensures all reads can skip LEFT JOIN logic
- All concepts start at confidence 0.0 (gray/unvisited state)

### GET /api/students/{student_id}/mastery
**Type:** CRUD
**Purpose:** Get mastery data for all concepts for a student
**Auth:** None
**Path Parameters:**
- `student_id` (string, uuid): Student identifier

**Response:** `200 OK`
```json
[
  {
    "concept_id": "uuid1",
    "confidence": 0.85,
    "attempts": 3,
    "color": "green"
  },
  {
    "concept_id": "uuid2",
    "confidence": 0.45,
    "attempts": 2,
    "color": "yellow"
  }
]
```

**Color Mapping:**
- `confidence == 0.0` → `"gray"` (unvisited)
- `confidence 0.01-0.39` → `"red"` (not understood)
- `confidence 0.40-0.69` → `"yellow"` (partial understanding)
- `confidence 0.70-1.0` → `"green"` (mastery)

### PUT /api/students/{student_id}/mastery/{concept_id}
**Type:** NON-CRUD (Smart Mastery Update)
**Purpose:** Update student mastery with intelligent confidence calculation
**Auth:** None
**Path Parameters:**
- `student_id` (string, uuid): Student identifier
- `concept_id` (string, uuid): Concept identifier

**Request Body (3 modes):**

**Mode 1: Absolute Set**
```json
{
  "confidence": 0.75
}
```
- Directly sets confidence value (clamped to [0.0, 1.0])
- Use for manual overrides or seeding

**Mode 2: Evaluation Result (Poll/Quiz)**
```json
{
  "eval_result": "correct" | "partial" | "wrong"
}
```
- `"correct"`: Sets confidence to `max(current, 0.85)`
- `"partial"`: Sets confidence to `max(current, 0.50)`
- `"wrong"`: Sets confidence to `min(current, 0.20)` (or `0.20` if current is `0.0`)
- Increments `attempts` by 1

**Mode 3: Delta (Relative Change)**
```json
{
  "delta": 0.2
}
```
- Adds delta to current confidence
- Result clamped to [0.0, 1.0]
- Use for tutoring boosts or penalties

**Process:**
1. Reads current confidence from database
2. Calculates old color using `confidence_to_color()`
3. Applies appropriate confidence update logic based on mode
4. Calculates new color
5. Writes updated confidence (and attempts if applicable)
6. Returns old/new colors and final confidence

**Response:** `200 OK`
```json
{
  "concept_id": "uuid",
  "old_color": "red",
  "new_color": "yellow",
  "confidence": 0.55
}
```

**Error:** `404 Not Found` if mastery record doesn't exist

**Notes:**
- This endpoint centralizes ALL confidence mutation logic
- Callers never need to know current confidence value
- Color derivation is handled server-side for consistency

### POST /api/mastery/attendance-boost
**Type:** NON-CRUD (Passive Learning Boost)
**Purpose:** Apply small confidence boost for students attending lecture
**Auth:** None
**Request Body:**
```json
{
  "student_ids": ["uuid1", "uuid2"],
  "concept_ids": ["concept-uuid1", "concept-uuid2"]
}
```

**Process:**
1. For each student-concept pair:
   - Reads current confidence
   - Adds 0.05 to confidence
   - Caps at 0.3 (passive boosts cannot exceed yellow zone)
   - Only updates if confidence changed
2. Counts total updates

**Response:** `200 OK`
```json
{
  "updated": 12
}
```

**Notes:**
- Passive learning boost from lecture attendance
- Prevents attendance alone from achieving mastery (0.3 max)
- Students still need active participation (polls/quizzes) to reach green

---

## Graph

### GET /api/courses/{course_id}/graph
**Type:** NON-CRUD (Knowledge Graph with Optional Mastery)
**Purpose:** Retrieve knowledge graph with optional student mastery overlay
**Auth:** None
**Path Parameters:**
- `course_id` (string, uuid): Course identifier

**Query Parameters:**
- `student_id` (string, uuid, optional): Student identifier for mastery overlay

**Process:**
1. Fetches all concept nodes for the course
2. Fetches all concept edges for the course
3. Builds graph structure for importance calculation
4. Calculates importance scores using PageRank-style algorithm
5. If `student_id` provided:
   - Fetches student mastery data
   - Adds confidence and color to each node
6. Returns graph with nodes and edges

**Response (without student_id):** `200 OK`
```json
{
  "nodes": [
    {
      "id": "uuid",
      "label": "Backpropagation",
      "description": "Algorithm for computing gradients...",
      "course_id": "course-uuid",
      "importance": 0.85
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source_id": "uuid1",
      "target_id": "uuid2",
      "course_id": "course-uuid"
    }
  ]
}
```

**Response (with student_id):** `200 OK`
```json
{
  "nodes": [
    {
      "id": "uuid",
      "label": "Backpropagation",
      "description": "Algorithm for computing gradients...",
      "course_id": "course-uuid",
      "importance": 0.85,
      "confidence": 0.65,
      "color": "yellow"
    }
  ],
  "edges": [...]
}
```

**Notes:**
- Importance is dynamically calculated from graph structure (not stored)
- Mastery overlay is optional for flexible use (professor vs student views)
- Color is always derived from confidence thresholds

---

## Heatmap

### GET /api/courses/{course_id}/heatmap
**Type:** NON-CRUD (Class-Wide Mastery Aggregation)
**Purpose:** Get aggregated mastery statistics across all students
**Auth:** None
**Path Parameters:**
- `course_id` (string, uuid): Course identifier

**Process:**
1. Fetches all concepts for the course
2. Fetches all students in the course
3. For each concept:
   - Queries all student mastery records
   - Converts each confidence to color
   - Counts color distribution (green/yellow/red/gray)
   - Calculates average confidence
4. Returns aggregated data

**Response:** `200 OK`
```json
{
  "concepts": [
    {
      "id": "uuid",
      "label": "Backpropagation",
      "distribution": {
        "green": 12,
        "yellow": 8,
        "red": 5,
        "gray": 5
      },
      "avg_confidence": 0.62
    },
    {
      "id": "uuid2",
      "label": "Chain Rule",
      "distribution": {
        "green": 20,
        "yellow": 7,
        "red": 2,
        "gray": 1
      },
      "avg_confidence": 0.78
    }
  ],
  "total_students": 30
}
```

**Notes:**
- Distribution shows color counts, NOT raw confidence values
- Gray count indicates students who haven't engaged with the concept
- Average confidence provides numerical summary
- Used for professor dashboard to identify struggling concepts

---

## Lectures

### POST /api/lectures
**Type:** CRUD
**Purpose:** Create a new lecture session
**Auth:** None
**Request Body:**
```json
{
  "course_id": "uuid",
  "title": "Week 3: Neural Networks",
  "status": "live"
}
```
**Response:** `201 Created`
```json
{
  "id": "uuid",
  "course_id": "course-uuid",
  "title": "Week 3: Neural Networks",
  "status": "live",
  "started_at": "2025-01-15T14:00:00Z"
}
```

### GET /api/lectures/{lecture_id}
**Type:** CRUD
**Purpose:** Get lecture details
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "course_id": "course-uuid",
  "title": "Week 3: Neural Networks",
  "status": "live",
  "started_at": "2025-01-15T14:00:00Z",
  "ended_at": null
}
```
**Error:** `404 Not Found`

### GET /api/courses/{course_id}/lectures
**Type:** CRUD
**Purpose:** Get all lectures for a course
**Auth:** None
**Path Parameters:**
- `course_id` (string, uuid): Course identifier

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "course_id": "course-uuid",
    "title": "Week 3: Neural Networks",
    "status": "live",
    "started_at": "2025-01-15T14:00:00Z"
  }
]
```

### PUT /api/lectures/{lecture_id}
**Type:** CRUD
**Purpose:** Update lecture details
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Request Body:**
```json
{
  "status": "completed",
  "ended_at": "2025-01-15T15:30:00Z"
}
```
**Response:** `200 OK` (updated lecture object)
**Error:** `404 Not Found`

### GET /api/lectures/{lecture_id}/transcript-chunks
**Type:** NON-CRUD (Transcript Query)
**Purpose:** Get transcript chunks for a lecture
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Query Parameters:**
- `limit` (integer, optional): Maximum number of chunks to return

**Process:**
- Queries `transcript_chunks` table
- Orders by `created_at` DESC (most recent first)
- Applies limit if provided

**Response:** `200 OK`
```json
[
  {
    "text": "Now let's discuss backpropagation...",
    "timestamp_sec": 1234.5
  },
  {
    "text": "The chain rule is essential here...",
    "timestamp_sec": 1189.2
  }
]
```

### GET /api/lectures/{lecture_id}/recent-concept
**Type:** NON-CRUD (Real-Time Concept Tracking)
**Purpose:** Get most recently detected concept in lecture
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Process:**
1. Joins `transcript_concepts` with `transcript_chunks`
2. Filters by lecture_id
3. Orders by chunk creation time DESC
4. Returns most recent concept_id

**Response:** `200 OK`
```json
{
  "concept_id": "uuid"
}
```
**Error:** `404 Not Found` if no concepts detected yet

**Notes:**
- Used for highlighting "current concept" on student/professor views
- Updates in real-time as transcript is processed

### GET /api/lectures/{lecture_id}/transcript-excerpts
**Type:** NON-CRUD (Contextual Transcript Retrieval)
**Purpose:** Get transcript excerpts mentioning specific concepts
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Query Parameters:**
- `concept_ids` (string, comma-separated): Concept IDs to search for

**Process:**
1. Parses comma-separated concept IDs
2. Queries `transcript_concepts` joined with `transcript_chunks`
3. Filters by concept IDs
4. Limits to 20 results
5. Returns text excerpts with timestamps

**Response:** `200 OK`
```json
[
  {
    "text": "The chain rule allows us to compute derivatives...",
    "timestamp_sec": 456.8
  },
  {
    "text": "When we apply the chain rule to backpropagation...",
    "timestamp_sec": 892.3
  }
]
```

**Notes:**
- Used for tutoring context and student review
- Returns empty array if no concept_ids provided
- Timestamps allow linking back to specific moments in lecture

---

## Transcripts

### POST /api/lectures/{lecture_id}/transcripts
**Type:** NON-CRUD (Transcript Creation with Concept Linking)
**Purpose:** Add transcript chunk and link detected concepts
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Request Body:**
```json
{
  "text": "Now let's talk about backpropagation and the chain rule...",
  "timestamp_sec": 1234.5,
  "speaker_name": "Professor Smith",
  "concept_ids": ["uuid1", "uuid2"]
}
```

**Process:**
1. Inserts transcript chunk into `transcript_chunks` table
2. If `concept_ids` provided:
   - Bulk-inserts links into `transcript_concepts` table
3. Returns created chunk

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "lecture_id": "lecture-uuid",
  "text": "Now let's talk about backpropagation...",
  "timestamp_sec": 1234.5,
  "speaker_name": "Professor Smith",
  "created_at": "2025-01-15T14:20:30Z"
}
```

**Notes:**
- `concept_ids` is optional (AI detection happens elsewhere)
- Used by transcript simulator and real Zoom RTMS integration

### GET /api/lectures/{lecture_id}/transcripts
**Type:** CRUD
**Purpose:** Get all transcript chunks for a lecture
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "lecture_id": "lecture-uuid",
    "text": "Let's begin with linear algebra...",
    "timestamp_sec": 45.2,
    "speaker_name": "Professor Smith",
    "created_at": "2025-01-15T14:01:00Z"
  }
]
```

**Notes:**
- Ordered by timestamp_sec for chronological playback

### GET /api/transcripts/{chunk_id}/concepts
**Type:** NON-CRUD (Concept Lookup)
**Purpose:** Get concepts detected in a specific transcript chunk
**Auth:** None
**Path Parameters:**
- `chunk_id` (string, uuid): Transcript chunk identifier

**Process:**
1. Queries `transcript_concepts` for chunk_id
2. Gets concept_ids
3. If concepts found, fetches labels from `concept_nodes`
4. Returns array of concepts

**Response:** `200 OK`
```json
[
  {
    "id": "uuid1",
    "label": "Backpropagation"
  },
  {
    "id": "uuid2",
    "label": "Chain Rule"
  }
]
```

**Notes:**
- Returns empty array if no concepts linked
- Used for annotating transcript display

---

## Polls

### POST /api/lectures/{lecture_id}/polls
**Type:** CRUD
**Purpose:** Create a poll question for a lecture
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Request Body:**
```json
{
  "concept_id": "uuid",
  "question": "What is the derivative of x^2?",
  "expected_answer": "2x",
  "status": "draft"
}
```
**Response:** `201 Created`
```json
{
  "id": "uuid",
  "lecture_id": "lecture-uuid",
  "concept_id": "concept-uuid",
  "question": "What is the derivative of x^2?",
  "expected_answer": "2x",
  "status": "draft",
  "generated_at": "2025-01-15T14:25:00Z"
}
```

### GET /api/lectures/{lecture_id}/polls
**Type:** CRUD
**Purpose:** Get all polls for a lecture
**Auth:** None
**Path Parameters:**
- `lecture_id` (string, uuid): Lecture identifier

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "lecture_id": "lecture-uuid",
    "concept_id": "concept-uuid",
    "question": "What is the derivative of x^2?",
    "expected_answer": "2x",
    "status": "active"
  }
]
```

### PUT /api/polls/{poll_id}
**Type:** CRUD
**Purpose:** Update poll details
**Auth:** None
**Path Parameters:**
- `poll_id` (string, uuid): Poll identifier

**Request Body:** (any fields from poll schema)
```json
{
  "status": "closed"
}
```
**Response:** `200 OK` (updated poll)
**Error:** `404 Not Found`

### POST /api/polls
**Type:** CRUD (Alternate Create)
**Purpose:** Create a poll (alternative endpoint)
**Auth:** None
**Request Body:**
```json
{
  "lecture_id": "uuid",
  "concept_id": "uuid",
  "question": "Explain gradient descent",
  "expected_answer": "Iterative optimization algorithm...",
  "status": "draft"
}
```
**Response:** `201 Created`
**Error:** `500 Internal Server Error` if creation fails

### GET /api/polls/{poll_id}
**Type:** CRUD
**Purpose:** Get single poll by ID
**Auth:** None
**Path Parameters:**
- `poll_id` (string, uuid): Poll identifier

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "question": "Explain gradient descent",
  "expected_answer": "Iterative optimization...",
  "concept_id": "concept-uuid",
  "lecture_id": "lecture-uuid",
  "status": "active"
}
```
**Error:** `404 Not Found`

### PUT /api/polls/{poll_id}/status
**Type:** NON-CRUD (Status Transition)
**Purpose:** Update poll status (draft → active → closed)
**Auth:** None
**Path Parameters:**
- `poll_id` (string, uuid): Poll identifier

**Request Body:**
```json
{
  "status": "active"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "active",
  "question": "Explain gradient descent",
  "concept_id": "concept-uuid"
}
```
**Error:** `404 Not Found`

**Notes:**
- Status transitions: `draft` → `active` (opens poll), `active` → `closed` (ends poll)
- Used for controlling poll lifecycle

### POST /api/polls/{poll_id}/responses
**Type:** NON-CRUD (Student Response with Evaluation)
**Purpose:** Submit and evaluate student poll response
**Auth:** None
**Path Parameters:**
- `poll_id` (string, uuid): Poll identifier

**Request Body:**
```json
{
  "student_id": "uuid",
  "answer": "2x",
  "evaluation": {
    "eval_result": "correct",
    "feedback": "Excellent work!",
    "reasoning": "Answer matches expected format"
  }
}
```

**Process:**
1. Inserts response into `poll_responses` table
2. Stores evaluation JSON (from AI processing)

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "question_id": "poll-uuid",
  "student_id": "student-uuid",
  "answer": "2x",
  "evaluation": {
    "eval_result": "correct",
    "feedback": "Excellent work!",
    "reasoning": "Answer matches expected format"
  },
  "answered_at": "2025-01-15T14:30:00Z"
}
```

**Error:** `500 Internal Server Error`

**Notes:**
- Evaluation is typically computed by AI (Claude) before calling this endpoint
- This endpoint only stores the result; AI processing happens in caller

### GET /api/polls/{poll_id}/responses
**Type:** CRUD
**Purpose:** Get all responses for a poll
**Auth:** None
**Path Parameters:**
- `poll_id` (string, uuid): Poll identifier

**Response:** `200 OK`
```json
[
  {
    "answer": "2x",
    "evaluation": {
      "eval_result": "correct",
      "feedback": "Excellent work!"
    }
  },
  {
    "answer": "x^2",
    "evaluation": {
      "eval_result": "wrong",
      "feedback": "That's the original function, not the derivative"
    }
  }
]
```

**Notes:**
- Used for aggregating poll results
- Does not include student_id (for professor anonymized view)

---

## Tutoring

### GET /api/students/{student_id}/tutoring
**Type:** CRUD
**Purpose:** Get all tutoring sessions for a student
**Auth:** None
**Path Parameters:**
- `student_id` (string, uuid): Student identifier

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "student_id": "student-uuid",
    "target_concepts": ["uuid1", "uuid2"],
    "started_at": "2025-01-15T16:00:00Z"
  }
]
```

### POST /api/tutoring/sessions
**Type:** CRUD
**Purpose:** Create a new tutoring session
**Auth:** None
**Request Body:**
```json
{
  "student_id": "uuid",
  "target_concepts": ["uuid1", "uuid2"]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "student_id": "student-uuid",
  "target_concepts": ["uuid1", "uuid2"],
  "started_at": "2025-01-15T16:00:00Z"
}
```

**Error:** `500 Internal Server Error`

### GET /api/tutoring/sessions/{session_id}
**Type:** CRUD
**Purpose:** Get tutoring session details
**Auth:** None
**Path Parameters:**
- `session_id` (string, uuid): Session identifier

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "student_id": "student-uuid",
  "target_concepts": ["uuid1", "uuid2"]
}
```

**Error:** `404 Not Found`

### POST /api/tutoring/sessions/{session_id}/messages
**Type:** NON-CRUD (Conversational Message Storage)
**Purpose:** Add messages to tutoring session (supports batch insert)
**Auth:** None
**Path Parameters:**
- `session_id` (string, uuid): Session identifier

**Request Body (Single Message):**
```json
{
  "role": "user",
  "content": "I don't understand backpropagation",
  "concept_id": "uuid"
}
```

**Request Body (Batch):**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I don't understand backpropagation"
    },
    {
      "role": "assistant",
      "content": "Let's break it down step by step...",
      "concept_id": "uuid"
    }
  ]
}
```

**Process:**
1. Detects single vs batch format
2. Builds insert rows with session_id
3. Bulk-inserts into `tutoring_messages`

**Response:** `201 Created`
```json
[
  {
    "id": "uuid1",
    "session_id": "session-uuid",
    "role": "user",
    "content": "I don't understand backpropagation",
    "concept_id": null,
    "created_at": "2025-01-15T16:05:00Z"
  }
]
```

**Error:** `500 Internal Server Error`

**Notes:**
- `concept_id` is optional and typically set after AI understanding check
- Batch insert used for initializing session with system prompt

### GET /api/tutoring/sessions/{session_id}/messages
**Type:** CRUD (with Filtering)
**Purpose:** Get conversation history
**Auth:** None
**Path Parameters:**
- `session_id` (string, uuid): Session identifier

**Query Parameters:**
- `exclude_role` (string, optional): Role to exclude (e.g., `"system"`)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid1",
    "role": "user",
    "content": "I don't understand backpropagation",
    "concept_id": null,
    "created_at": "2025-01-15T16:05:00Z"
  },
  {
    "id": "uuid2",
    "role": "assistant",
    "content": "Let's break it down...",
    "concept_id": "concept-uuid",
    "created_at": "2025-01-15T16:05:15Z"
  }
]
```

**Notes:**
- Ordered by created_at (chronological conversation)
- `exclude_role` useful for hiding system prompts from display

### PUT /api/tutoring/messages/{message_id}
**Type:** NON-CRUD (Message Annotation)
**Purpose:** Update message metadata (concept linking)
**Auth:** None
**Path Parameters:**
- `message_id` (string, uuid): Message identifier

**Request Body:**
```json
{
  "concept_id": "uuid"
}
```

**Process:**
- Updates only provided fields
- Typically used to link concept_id after understanding check

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "session_id": "session-uuid",
  "role": "assistant",
  "content": "Great explanation!",
  "concept_id": "concept-uuid",
  "created_at": "2025-01-15T16:05:15Z"
}
```

**Error:** `404 Not Found` or `400 Bad Request` if no fields to update

---

## Pages & Quizzes

### GET /api/debug/test-claude
**Type:** DEBUG
**Purpose:** Test Claude API connectivity
**Auth:** None
**Response:** `200 OK`
```json
{
  "raw_response": "{\"test\": \"hello\"}",
  "response_length": 18,
  "api_key_set": true
}
```

**Notes:**
- Debug endpoint for verifying Claude API setup
- Not for production use

### POST /api/students/{student_id}/pages/generate
**Type:** NON-CRUD (AI Content Generation)
**Purpose:** Generate personalized learning page for student
**Auth:** None
**Path Parameters:**
- `student_id` (string, uuid): Student identifier

**Request Body:**
```json
{
  "concept_id": "uuid"
}
```

**Process:**
1. Fetches concept details (label, description)
2. Fetches student's current mastery confidence
3. Queries past quiz mistakes (misconceptions and explanations)
4. Calls `generate_learning_page()` with Claude Sonnet
5. Saves generated page to database
6. Returns page

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "student_id": "student-uuid",
  "concept_id": "concept-uuid",
  "title": "Understanding Backpropagation",
  "content": "# Introduction\n\nBackpropagation is...",
  "created_at": "2025-01-15T17:00:00Z"
}
```

**Error:** `400 Bad Request` if concept_id missing, `404 Not Found` if concept doesn't exist

**Notes:**
- Content is personalized based on student's confidence level and past mistakes
- Uses Claude Sonnet for high-quality explanations
- Content is markdown-formatted

### GET /api/pages/{page_id}
**Type:** CRUD
**Purpose:** Get learning page by ID
**Auth:** None
**Path Parameters:**
- `page_id` (string, uuid): Page identifier

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "student_id": "student-uuid",
  "concept_id": "concept-uuid",
  "title": "Understanding Backpropagation",
  "content": "# Introduction\n\nBackpropagation is...",
  "created_at": "2025-01-15T17:00:00Z"
}
```

**Error:** `404 Not Found`

### GET /api/students/{student_id}/pages
**Type:** CRUD
**Purpose:** List all learning pages for a student
**Auth:** None
**Path Parameters:**
- `student_id` (string, uuid): Student identifier

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "student_id": "student-uuid",
    "concept_id": "concept-uuid",
    "title": "Understanding Backpropagation",
    "content": "# Introduction...",
    "created_at": "2025-01-15T17:00:00Z",
    "concept_nodes": {
      "label": "Backpropagation"
    }
  }
]
```

**Notes:**
- Ordered by created_at DESC (most recent first)
- Includes concept label via join

### DELETE /api/pages/{page_id}
**Type:** CRUD
**Purpose:** Delete learning page
**Auth:** None
**Path Parameters:**
- `page_id` (string, uuid): Page identifier

**Response:** `200 OK`
```json
{
  "success": true
}
```

### POST /api/pages/{page_id}/quiz/generate
**Type:** NON-CRUD (AI Quiz Generation)
**Purpose:** Generate practice quiz for a learning page
**Auth:** None
**Path Parameters:**
- `page_id` (string, uuid): Page identifier

**Process:**
1. Fetches page details (student_id, concept_id, concept label/description)
2. Fetches student's current mastery confidence
3. Queries past quiz mistakes
4. Calls `generate_practice_quiz()` with Claude Sonnet
5. Creates quiz record with status 'pending'
6. Inserts questions with options, correct answers, explanations
7. Returns quiz with questions

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "page_id": "page-uuid",
  "student_id": "student-uuid",
  "concept_id": "concept-uuid",
  "status": "pending",
  "score": null,
  "created_at": "2025-01-15T17:10:00Z",
  "completed_at": null,
  "quiz_questions": [
    {
      "id": "uuid1",
      "quiz_id": "quiz-uuid",
      "question_text": "What is the derivative chain?",
      "options": ["A) x^2", "B) 2x", "C) x", "D) 0"],
      "correct_answer": "B",
      "explanation": "The derivative of x^2 is 2x",
      "question_order": 1
    }
  ]
}
```

**Error:** `404 Not Found` if page doesn't exist

**Notes:**
- Questions personalized based on student mastery and past mistakes
- Correct answers ARE included in response (for storage)
- When quiz is fetched via GET while pending, correct answers are hidden

### GET /api/quizzes/{quiz_id}
**Type:** CRUD (with Smart Filtering)
**Purpose:** Get quiz with questions
**Auth:** None
**Path Parameters:**
- `quiz_id` (string, uuid): Quiz identifier

**Response (pending status):** `200 OK`
```json
{
  "id": "uuid",
  "page_id": "page-uuid",
  "student_id": "student-uuid",
  "concept_id": "concept-uuid",
  "status": "pending",
  "score": null,
  "quiz_questions": [
    {
      "id": "uuid1",
      "question_text": "What is the derivative chain?",
      "options": ["A) x^2", "B) 2x", "C) x", "D) 0"],
      "question_order": 1
    }
  ]
}
```

**Response (completed status):** `200 OK`
```json
{
  "id": "uuid",
  "status": "completed",
  "score": 0.75,
  "quiz_questions": [
    {
      "id": "uuid1",
      "question_text": "What is the derivative chain?",
      "options": ["A) x^2", "B) 2x", "C) x", "D) 0"],
      "correct_answer": "B",
      "explanation": "The derivative of x^2 is 2x",
      "question_order": 1
    }
  ]
}
```

**Error:** `404 Not Found`

**Notes:**
- Correct answers and explanations HIDDEN when status is 'pending'
- Correct answers and explanations SHOWN when status is 'completed'
- Prevents cheating while allowing review after submission

### POST /api/quizzes/{quiz_id}/submit
**Type:** NON-CRUD (Quiz Grading & Mastery Update)
**Purpose:** Submit quiz answers, grade them, update mastery
**Auth:** None
**Path Parameters:**
- `quiz_id` (string, uuid): Quiz identifier

**Request Body:**
```json
{
  "answers": {
    "question-uuid-1": "B",
    "question-uuid-2": "A",
    "question-uuid-3": "C"
  }
}
```

**Process:**
1. Fetches quiz with questions
2. Validates quiz is not already completed
3. Grades each answer (correct/incorrect)
4. For wrong answers, generates misconception text
5. Saves each response to `quiz_responses`
6. Calculates score (correct / total)
7. Updates quiz status to 'completed' with score
8. Maps score to confidence:
   - score >= 0.8 → confidence 0.85 (green)
   - score >= 0.6 → confidence 0.60 (yellow)
   - score < 0.6 → confidence 0.30 (red)
9. Only updates mastery if new confidence is HIGHER than current
10. Increments attempts counter

**Response:** `200 OK`
```json
{
  "score": 0.75,
  "correct": 3,
  "total": 4,
  "questions": [
    {
      "id": "uuid1",
      "question_text": "What is the derivative chain?",
      "options": ["A) x^2", "B) 2x", "C) x", "D) 0"],
      "correct_answer": "B",
      "explanation": "The derivative of x^2 is 2x"
    }
  ]
}
```

**Error:**
- `404 Not Found` if quiz doesn't exist
- `400 Bad Request` if quiz already completed

**Notes:**
- Misconception text includes student's selected answer and explanation
- Mastery only improves (never decreases) from quiz completion
- Returns full questions with correct answers for student review

### GET /api/students/{student_id}/quizzes
**Type:** CRUD
**Purpose:** List all quizzes for a student
**Auth:** None
**Path Parameters:**
- `student_id` (string, uuid): Student identifier

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "page_id": "page-uuid",
    "student_id": "student-uuid",
    "concept_id": "concept-uuid",
    "status": "completed",
    "score": 0.75,
    "created_at": "2025-01-15T17:10:00Z",
    "completed_at": "2025-01-15T17:15:00Z",
    "concept_nodes": {
      "label": "Backpropagation"
    }
  }
]
```

**Notes:**
- Ordered by created_at DESC
- Includes concept label via join

### DELETE /api/quizzes/{quiz_id}
**Type:** CRUD
**Purpose:** Delete quiz (cascades to questions and responses)
**Auth:** None
**Path Parameters:**
- `quiz_id` (string, uuid): Quiz identifier

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Notes:**
- Cascade delete removes related quiz_questions and quiz_responses

---

## Create/Upload

### POST /api/upload
**Type:** NON-CRUD (Course Creation + Knowledge Graph)
**Purpose:** Upload PDF, extract knowledge graph, create course
**Auth:** None
**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file` (PDF file, required)
  - `name` (string, optional): Course name (defaults to filename)
  - `description` (string, optional): Course description

**Process:**
1. Validates file exists
2. Extracts course metadata from form
3. Calculates MD5 hash for caching
4. Checks `pdf_cache` for existing results
5. If not cached:
   - Saves PDF to `/tmp/{hash}_{filename}`
   - Calls `create_kg()` to extract knowledge graph with Claude
   - Parses graph structure
   - Calculates importance scores
   - Deletes temporary file
   - Caches result in `pdf_cache`
6. Creates course record
7. Inserts concept nodes with label→ID mapping
8. Inserts concept edges using ID map
9. Returns course + graph data

**Response:** `200 OK`
```json
{
  "cached": false,
  "course": {
    "id": "uuid",
    "name": "CS229 Machine Learning",
    "description": "Stanford course on ML fundamentals"
  },
  "graph": {
    "nodes": {
      "Backpropagation": "Algorithm for computing gradients...",
      "Chain Rule": "Calculus rule for derivatives..."
    },
    "edges": [
      ["Chain Rule", "Backpropagation"],
      ["Gradient Descent", "Backpropagation"]
    ]
  },
  "importance": {
    "Backpropagation": 0.85,
    "Chain Rule": 0.72
  }
}
```

**Error:** `400 Bad Request` if file missing or invalid

**Notes:**
- Single endpoint for complete course setup
- Caching prevents reprocessing duplicate PDFs
- Graph extraction uses Claude Sonnet (high quality)
- Importance scores calculated from graph topology

---

## Error Responses

All endpoints return JSON error responses with appropriate HTTP status codes:

**400 Bad Request:**
```json
{
  "error": "concept_id required"
}
```

**404 Not Found:**
```json
{
  "error": "Course not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create session"
}
```

---

## Key Patterns

### Confidence-to-Color Mapping
Applied consistently across all mastery-related endpoints:
```
0.0 exactly    → "gray"   (unvisited)
0.01 - 0.39    → "red"    (not understood)
0.40 - 0.69    → "yellow" (partial understanding)
0.70 - 1.0     → "green"  (mastery)
```

### Mastery Update Modes
The `PUT /api/students/{student_id}/mastery/{concept_id}` endpoint supports:
1. **Absolute:** `{ "confidence": 0.75 }`
2. **Evaluation:** `{ "eval_result": "correct" }` → applies scoring rules
3. **Delta:** `{ "delta": 0.2 }` → relative adjustment

### Eager Mastery Initialization
- Student creation auto-creates mastery rows for ALL concepts (confidence 0.0)
- PDF upload auto-creates mastery rows for ALL existing students
- Result: No NULL confidence values, no LEFT JOIN needed

### Caching Strategy
- PDF processing results cached by MD5 hash
- Prevents expensive reprocessing of identical documents
- Cache key: file content hash (not filename)

### AI Integration Points
Non-CRUD endpoints that use Claude API:
1. **PDF Upload** - Knowledge graph extraction (Sonnet)
2. **Page Generation** - Personalized learning content (Sonnet)
3. **Quiz Generation** - Practice questions (Sonnet)
4. **Concept Detection** - Real-time transcript analysis (Haiku, in frontend)
5. **Response Evaluation** - Answer grading (Haiku, in frontend)
6. **Tutoring** - Conversational teaching (Sonnet, in frontend)

---

## Usage Examples

### Creating a Student and Updating Mastery
```bash
# 1. Create student
curl -X POST http://localhost:5000/api/courses/{course_id}/students \
  -H "Content-Type: application/json" \
  -d '{"name": "Sam", "email": "sam@example.com"}'
# Returns: { "id": "student-uuid", ... }

# 2. Update mastery after poll (correct answer)
curl -X PUT http://localhost:5000/api/students/student-uuid/mastery/concept-uuid \
  -H "Content-Type: application/json" \
  -d '{"eval_result": "correct"}'
# Returns: { "old_color": "red", "new_color": "green", "confidence": 0.85 }
```

### Uploading Course PDF
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@cs229-notes.pdf" \
  -F "name=CS229 Machine Learning" \
  -F "description=Stanford ML course"
# Returns: { "cached": false, "course": {...}, "graph": {...}, "importance": {...} }
```

### Generating Personalized Content
```bash
# 1. Generate learning page
curl -X POST http://localhost:5000/api/students/student-uuid/pages/generate \
  -H "Content-Type: application/json" \
  -d '{"concept_id": "concept-uuid"}'
# Returns: { "id": "page-uuid", "title": "...", "content": "..." }

# 2. Generate quiz for page
curl -X POST http://localhost:5000/api/pages/page-uuid/quiz/generate
# Returns: { "id": "quiz-uuid", "quiz_questions": [...] }

# 3. Submit quiz
curl -X POST http://localhost:5000/api/quizzes/quiz-uuid/submit \
  -H "Content-Type: application/json" \
  -d '{"answers": {"q1-uuid": "B", "q2-uuid": "A"}}'
# Returns: { "score": 0.5, "correct": 1, "total": 2, "questions": [...] }
```

---

## Database Table Reference

**Ownership (Write Access):**
- Flask API writes: `courses`, `concept_nodes`, `concept_edges`, `students`, `student_mastery`, `pdf_cache`
- Next.js writes: `lecture_sessions`, `transcript_chunks`, `transcript_concepts`, `poll_questions`, `poll_responses`, `tutoring_sessions`, `tutoring_messages`, `learning_pages`, `practice_quizzes`, `quiz_questions`, `quiz_responses`

**Both services read all tables**

---

## Performance Notes

- **Graph queries:** Importance calculated on-the-fly (not cached)
- **Heatmap queries:** Aggregates across all students (scales O(students * concepts))
- **PDF processing:** First upload is slow (~10-30s), subsequent uploads instant if cached
- **Mastery updates:** Single row updates, fast
- **Batch operations:** Student creation and PDF upload use bulk inserts for mastery rows

---

## Future Considerations

This API is designed for a 48-hour hackathon demo. Production considerations include:
- Authentication/authorization
- Rate limiting
- Input validation and sanitization
- Pagination for large datasets
- WebSocket integration for real-time updates
- Error logging and monitoring
- Database connection pooling
- API versioning
- Request/response compression