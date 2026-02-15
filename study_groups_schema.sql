-- Study Groups Schema for Supabase
-- Run this in Supabase SQL Editor

-- Table for students in the matching pool (waiting for a partner)
CREATE TABLE study_group_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    concept_ids UUID[] NOT NULL,  -- Array of concept UUIDs they want to study
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, course_id)  -- One pool entry per student per course
);

-- Table for matched study groups
CREATE TABLE study_group_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    student1_id UUID REFERENCES students(id) ON DELETE CASCADE,
    student2_id UUID REFERENCES students(id) ON DELETE CASCADE,
    concept_ids UUID[] NOT NULL,  -- Overlapping concepts they're studying together
    zoom_link TEXT,  -- Generated Zoom meeting link
    complementarity_score FLOAT,  -- 0.0-1.0 score of how well they complement each other
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,  -- Optional: when the match expires
    CHECK (student1_id != student2_id)
);

-- Index for faster lookups
CREATE INDEX idx_study_group_pool_student ON study_group_pool(student_id);
CREATE INDEX idx_study_group_pool_course ON study_group_pool(course_id);
CREATE INDEX idx_study_group_matches_students ON study_group_matches(student1_id, student2_id);
CREATE INDEX idx_study_group_matches_course ON study_group_matches(course_id);