-- Migration: Add auth support (teachers, join codes, student auth linking)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Teachers table (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add teacher ownership and join codes to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS join_code VARCHAR(8) UNIQUE;

-- Add auth linking to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_teachers_auth_id ON teachers(auth_id);
CREATE INDEX IF NOT EXISTS idx_students_auth_id ON students(auth_id);
CREATE INDEX IF NOT EXISTS idx_courses_join_code ON courses(join_code);
