#!/usr/bin/env python3
"""
Bulk generate learning pages and quizzes for all concepts in a course.
Uses the existing generate_content service.

Usage:
    python scripts/bulk_generate_content.py [course_id]
"""

import sys
import os
from pathlib import Path

# Add API directory to path so we can import from it
api_path = Path(__file__).parent.parent / "api"
sys.path.insert(0, str(api_path))

from dotenv import load_dotenv
from src.db import supabase
from src.services.generate_content import generate_learning_page, generate_practice_quiz, get_further_reading

load_dotenv()


def list_courses():
    """List all available courses."""
    result = supabase.table('courses').select('id, name, description').execute()

    if not result.data:
        print("No courses found.")
        return []

    print("\nAvailable courses:")
    for c in result.data:
        print(f"  {c['name']} (ID: {c['id']})")
    print()
    return result.data


def bulk_generate(course_id):
    """Generate learning content for all concepts in a course."""
    # Get all concepts
    concepts_result = supabase.table('concept_nodes').select('id, label, description').eq('course_id', course_id).execute()

    if not concepts_result.data:
        print(f"No concepts found for course {course_id}")
        return

    concepts = concepts_result.data
    print(f"\nFound {len(concepts)} concepts. Generating content...\n")

    success = 0
    failed = 0

    for idx, concept in enumerate(concepts, 1):
        concept_id = concept['id']
        label = concept['label']
        description = concept.get('description', '')

        print(f"[{idx}/{len(concepts)}] {label}...", end=' ', flush=True)

        try:
            # Generate learning page (general content, no student-specific context)
            page_result = generate_learning_page(
                concept_label=label,
                concept_description=description,
                past_mistakes=[],
                current_confidence=0.5  # Assume intermediate level for general content
            )

            # Get further reading
            further_reading = get_further_reading(label, description)

            # Check if general page already exists (student_id is NULL)
            existing_page = supabase.table('learning_pages').select('id').eq('concept_id', concept_id).is_('student_id', 'null').execute()

            if existing_page.data:
                # Update existing
                supabase.table('learning_pages').update({
                    'title': page_result['title'],
                    'content': page_result['content'],
                    'further_reading': further_reading
                }).eq('concept_id', concept_id).is_('student_id', 'null').execute()
            else:
                # Insert new
                supabase.table('learning_pages').insert({
                    'student_id': None,
                    'concept_id': concept_id,
                    'title': page_result['title'],
                    'content': page_result['content'],
                    'further_reading': further_reading
                }).execute()

            # Generate quiz
            quiz_result = generate_practice_quiz(
                concept_label=label,
                concept_description=description,
                past_mistakes=[],
                current_confidence=0.5
            )

            # Create a general "practice quiz" (not tied to a student)
            # Delete existing general quiz for this concept first
            existing_quizzes = supabase.table('practice_quizzes').select('id').eq('concept_id', concept_id).is_('student_id', 'null').execute()
            for quiz in existing_quizzes.data:
                supabase.table('practice_quizzes').delete().eq('id', quiz['id']).execute()

            # Insert new quiz
            quiz_resp = supabase.table('practice_quizzes').insert({
                'student_id': None,
                'concept_id': concept_id,
                'page_id': None,
                'status': 'template'  # Mark as template quiz
            }).execute()

            quiz_id = quiz_resp.data[0]['id']

            # Insert questions
            for q_idx, q in enumerate(quiz_result['questions']):
                supabase.table('quiz_questions').insert({
                    'quiz_id': quiz_id,
                    'question_text': q['question_text'],
                    'options': q['options'],
                    'correct_answer': q['correct_answer'],
                    'explanation': q['explanation'],
                    'question_order': q_idx + 1
                }).execute()

            print("✓")
            success += 1

        except Exception as e:
            print(f"✗ ({str(e)[:50]})")
            failed += 1

    print(f"\n✅ Success: {success}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total: {len(concepts)}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/bulk_generate_content.py <course_id>")
        print()
        courses = list_courses()
        if courses and len(courses) == 1:
            print(f"Auto-selecting only course: {courses[0]['name']}")
            bulk_generate(courses[0]['id'])
        sys.exit(0)

    course_id = sys.argv[1]
    bulk_generate(course_id)