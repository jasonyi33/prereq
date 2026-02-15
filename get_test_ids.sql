-- Run this in Supabase SQL Editor to get IDs for testing
-- Copy the results and use them in the test script

-- Get the first course
SELECT id, name FROM courses LIMIT 1;

-- Get a live lecture (or any lecture)
SELECT id, course_id, title, status
FROM lecture_sessions
WHERE status = 'live'
ORDER BY started_at DESC
LIMIT 1;

-- If no live lecture, get any lecture
SELECT id, course_id, title, status
FROM lecture_sessions
ORDER BY started_at DESC
LIMIT 1;

-- Get some concept IDs from the course
SELECT cn.id, cn.label, cn.course_id
FROM concept_nodes cn
WHERE cn.course_id = (SELECT id FROM courses LIMIT 1)
LIMIT 5;

-- Check if there are any transcript chunks for the lecture
SELECT COUNT(*) as chunk_count, lecture_id
FROM transcript_chunks
GROUP BY lecture_id;

-- Check if ANTHROPIC_API_KEY is accessible
-- (You can't check this in SQL - verify in your .env file)