-- ============================================================
-- Prereq: Complete Schema (base tables + auth extension)
-- Run this in Supabase SQL Editor as a single block
-- ============================================================

-- Core tables
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
    category VARCHAR(100),
    difficulty INT DEFAULT 3,
    x FLOAT,
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

CREATE TABLE student_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 0.0,
    attempts INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, concept_id)
);

CREATE TABLE lecture_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'live',
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
    status VARCHAR(20) DEFAULT 'draft',
    generated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES poll_questions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    evaluation JSONB,
    answered_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tutoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    target_concepts UUID[],
    started_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tutoring_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES tutoring_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    concept_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Auth extension: teachers table + course/student auth columns
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS join_code VARCHAR(8) UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_teachers_auth_id ON teachers(auth_id);
CREATE INDEX IF NOT EXISTS idx_students_auth_id ON students(auth_id);
CREATE INDEX IF NOT EXISTS idx_courses_join_code ON courses(join_code);
