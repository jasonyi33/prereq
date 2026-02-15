# Learning Content Setup

The learn and quiz features require precomputed content stored in the database.

## Step 1: Ensure Tables Exist

The database needs two tables:
- `learning_pages` - Stores markdown learning content
- `quiz_questions` - Stores 5 quiz questions per concept

These tables should already exist in your Supabase database.

## Step 2: Start Flask API

Make sure the Flask API is running:

```bash
cd /Users/shay/PycharmProjects/prereq/api
python main.py
```

The API will be available at `http://localhost:5000`.

## Step 3: Generate Learning Content

Run the generation script to create content for all concepts in your course:

```bash
cd /Users/shay/PycharmProjects/prereq

# List available courses
python scripts/generate_learning_content.py

# By course name or partial name
python scripts/generate_learning_content.py "main_notes.pdf"
python scripts/generate_learning_content.py main

# Or by course ID
python scripts/generate_learning_content.py 3f6627d5-6488-4050-bc34-c7f0586c66f9
```

This will:
1. Fetch all concepts for the course
2. For each concept, use Claude to generate:
   - A comprehensive learning page (markdown with LaTeX)
   - 5 multiple choice quiz questions with explanations
3. Store everything in the database
4. Report progress and any failures

**Note:** This can take 5-10 minutes for a course with 30+ concepts, as it makes 2 Claude API calls per concept.

## Step 4: Test

1. Start the frontend: `cd frontend && npm run dev`
2. Navigate to a student view
3. Click on any concept node
4. Click "Learn" or "Quiz" buttons in the side panel

The learn page should load instantly with markdown/LaTeX content.
The quiz should show 5 multiple choice questions.

## Regenerating Content

To regenerate content for a single concept:

```bash
curl -X POST http://localhost:5000/api/concepts/<concept_id>/learning-page/generate
curl -X POST http://localhost:5000/api/concepts/<concept_id>/quiz/generate
```

To regenerate all content for a course, just run the script again.

## API Endpoints

- `POST /api/concepts/:id/learning-page/generate` - Generate learning page for one concept
- `POST /api/concepts/:id/quiz/generate` - Generate quiz for one concept
- `POST /api/courses/:id/generate-learning-content` - Batch generate for entire course
- `GET /api/concepts/:id/learning-page` - Retrieve stored learning page
- `GET /api/concepts/:id/quiz` - Retrieve stored quiz questions
- `POST /api/concepts/:id/quiz-submit` - Submit quiz and update student confidence