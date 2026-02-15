-- Add learning content tables
-- Run this in Supabase SQL Editor if tables don't exist yet

CREATE TABLE IF NOT EXISTS concept_learning_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE UNIQUE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer INT NOT NULL,
    explanation TEXT NOT NULL,
    question_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_pages_concept ON concept_learning_pages(concept_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_concept ON concept_quiz_questions(concept_id);