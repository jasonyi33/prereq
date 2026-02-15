"""
Seed study group pool with dummy waiting students for demo.
Run this to always have someone available to match with.
Uses Flask API endpoints instead of direct Supabase access.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("FLASK_API_URL", "https://prereq-api.onrender.com/")

def seed_study_pool():
    print("[seed_study_pool] Starting...")

    # Get courses
    resp = requests.get(f"{API_URL}/api/courses")
    if resp.status_code != 200 or not resp.json():
        print("No courses found. Run seed_demo.py first.")
        return

    courses = resp.json()
    course_id = courses[0]['id']
    print(f"Course: {courses[0]['name']} ({course_id})")

    # Get all students
    resp = requests.get(f"{API_URL}/api/courses/{course_id}/students")
    if resp.status_code != 200 or len(resp.json()) < 2:
        print("Need at least 2 students. Run seed_demo.py first.")
        return

    students = resp.json()

    # Get graph to get concept IDs
    resp = requests.get(f"{API_URL}/api/courses/{course_id}/graph")
    if resp.status_code != 200:
        print("Failed to fetch concepts")
        return

    concepts = resp.json()['nodes']
    if len(concepts) < 3:
        print("Need concepts. Run seed_demo.py first.")
        return

    # Use ALL concepts to maximize matching opportunities
    all_concept_ids = [c['id'] for c in concepts]
    print(f"Total concepts: {len(all_concept_ids)}")

    # Add students to pool via opt-in endpoint
    # Exclude Sam - Sam will be live demo
    demo_students = [s for s in students if s['name'] != 'Sam'][:100]

    if len(demo_students) < 2:
        # Fallback: use first 2 students
        demo_students = students[:2]

    import random

    for i, student in enumerate(demo_students):
        # Each student opts in for 5-10 random concepts to maximize overlap
        num_concepts = random.randint(5, min(10, len(all_concept_ids)))
        random.seed(hash(student['id']) + i)  # Consistent results
        student_concepts = random.sample(all_concept_ids, num_concepts)
        random.seed()  # Reset

        # Call opt-in endpoint with skipMatching flag so they all stay in waiting
        resp = requests.post(
            f"{API_URL}/api/courses/{course_id}/study-groups/opt-in",
            json={
                'studentId': student['id'],
                'conceptIds': student_concepts,
                'skipMatching': True  # Keep in pool, don't match yet
            }
        )

        if resp.status_code == 200:
            result = resp.json()
            if result['status'] == 'waiting':
                concept_labels = [c['label'] for c in concepts if c['id'] in student_concepts]
                print(f"✓ Added {student['name']} to pool ({num_concepts} concepts: {', '.join(concept_labels[:2])}...)")
            elif result['status'] == 'matched':
                print(f"✓ {student['name']} was immediately matched with {result['partner']['name']}")
        else:
            print(f"✗ Failed to add {student['name']}: {resp.text}")

    print("\n[seed_study_pool] Done!")
    print("✓ Sam is GUARANTEED to match (backed by fallback logic even if pool is empty).")

if __name__ == '__main__':
    seed_study_pool()