# Learning Content System

## Overview

The learning content system allows students to view custom learning pages and take quizzes for any concept in the knowledge graph. Content is **precomputed** using Claude and stored in the database for instant retrieval.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Flask API Endpoints                        │
│  - POST /api/courses/:id/generate-learning  │ ← One-time batch generation
│  - POST /api/concepts/:id/learning-page/gen │ ← Individual generation
│  - POST /api/concepts/:id/quiz/generate     │
│  - GET  /api/concepts/:id/learning-page     │ ← Fast retrieval (ms)
│  - GET  /api/concepts/:id/quiz              │
│  - POST /api/concepts/:id/quiz-submit       │
└─────────────────────────────────────────────┘
                      ↓
          ┌───────────────────────┐
          │  Claude Sonnet 4.5    │
          │  - Generate learning  │
          │  - Generate 5 quizzes │
          └───────────────────────┘
                      ↓
          ┌───────────────────────────────┐
          │  Supabase Tables              │
          │  - concept_learning_pages     │
          │  - concept_quiz_questions     │
          └───────────────────────────────┘
                      ↓
          ┌───────────────────────────────┐
          │  Frontend Components          │
          │  - ConceptLearning.tsx        │
          │  - ReactMarkdown + KaTeX      │
          │  - Quiz interface             │
          └───────────────────────────────┘
```

## Files

### Backend (Flask API)

**`/api/src/routes/concepts.py`** - Learning content endpoints
- `_generate_learning_page_content(concept_id)` - Helper to generate learning page
- `_generate_quiz_questions(concept_id)` - Helper to generate 5 quiz questions
- `GET /api/concepts/:id/learning-page` - Retrieve stored content (fast)
- `GET /api/concepts/:id/quiz` - Retrieve stored questions (fast)
- `POST /api/concepts/:id/learning-page/generate` - Generate new content
- `POST /api/concepts/:id/quiz/generate` - Generate new questions
- `POST /api/courses/:id/generate-learning-content` - Batch generate for all concepts
- `POST /api/concepts/:id/quiz-submit` - Submit quiz and update student confidence

### Frontend

**`/frontend/src/components/student/ConceptLearning.tsx`** - Dialog component
- Dual-mode tabs: Learning / Quiz
- ReactMarkdown with KaTeX for LaTeX rendering
- Interactive quiz with progress tracking
- Results screen with confidence boost display

**`/frontend/src/components/student/SidePanel.tsx`** - Integration
- "Learn" and "Quiz" buttons in concept detail panel
- Opens ConceptLearning dialog

### Scripts

**`/scripts/generate_learning_content.py`** - Content generation script
- Calls Flask API to generate content for all concepts in a course
- Supports lookup by course name or ID
- Progress reporting and error handling

**`/scripts/add_learning_tables.sql`** - Database migration
- Creates `concept_learning_pages` and `concept_quiz_questions` tables

**`/scripts/LEARNING_CONTENT_SETUP.md`** - Setup instructions

## Database Schema

### concept_learning_pages

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| concept_id | UUID | Foreign key (UNIQUE) |
| content | TEXT | Markdown content with LaTeX |
| created_at | TIMESTAMP | Creation time |

### concept_quiz_questions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| concept_id | UUID | Foreign key |
| question | TEXT | Question text |
| option_a | TEXT | Option A |
| option_b | TEXT | Option B |
| option_c | TEXT | Option C |
| option_d | TEXT | Option D |
| correct_answer | INT | 0=A, 1=B, 2=C, 3=D |
| explanation | TEXT | Why the answer is correct |
| question_order | INT | Order within concept (0-4) |
| created_at | TIMESTAMP | Creation time |

## Claude Prompts

### Learning Page Generation

```
Create a comprehensive learning page for the concept: {label}

Description: {description}
Category: {category}

Generate a well-structured markdown document that includes:
1. A clear explanation of what the concept is
2. Key points and important details
3. Mathematical formulas using LaTeX notation ($inline$ and $$display$$)
4. Practical examples or applications
5. Common pitfalls or misconceptions

Keep it concise but thorough (aim for 200-400 words).
Return ONLY the markdown content, no additional commentary.
```

### Quiz Generation

```
Create 5 multiple choice quiz questions for the concept: {label}

Generate 5 questions that test understanding. Each question should:
- Have 4 options (A, B, C, D)
- Have exactly one correct answer
- Include a brief explanation of why the answer is correct
- Range from basic understanding to deeper application

Return JSON array with structure:
[
  {
    "question": "Question text?",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": 0,
    "explanation": "..."
  }
]
```

## Confidence Boost Rules

After quiz submission, student confidence is updated based on score:

| Score | Confidence Boost |
|-------|-----------------|
| 80-100% | +0.15 |
| 60-79% | +0.10 |
| 40-59% | +0.05 |
| 0-39% | +0.02 |

Confidence is clamped to [0.0, 1.0] and affects node color on the knowledge graph.

## Performance

- **Learning page retrieval:** < 10ms (database query)
- **Quiz retrieval:** < 10ms (database query)
- **Content generation:** 5-10 seconds per concept (Claude API call)
- **Batch generation:** 5-10 minutes for 30 concepts (2 calls each)

## Usage Flow

### One-Time Setup (Per Course)

1. Teacher uploads course PDF → concepts extracted
2. Admin runs: `python scripts/generate_learning_content.py "Course Name"`
3. Script generates learning pages + quizzes for all concepts
4. Content stored in database

### Student Usage (Fast)

1. Student clicks concept node on graph
2. Clicks "Learn" → Instant markdown page with LaTeX
3. Clicks "Quiz" → Instant 5-question quiz
4. Submits quiz → Confidence updated, node color changes

## Extensibility

- **Custom prompts:** Edit prompts in `concepts.py` to adjust content style
- **More questions:** Change `len(questions) != 5` to support variable quiz lengths
- **Additional content types:** Add new tables + endpoints for videos, exercises, etc.
- **Content review:** Add admin UI to review/edit generated content before publishing