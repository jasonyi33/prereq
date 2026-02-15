"""
Fix missing mastery data for students.
Creates mastery rows for all students with varied, realistic confidence patterns.

Usage:
    python scripts/fix_student_mastery.py <course_id>

Example:
    python scripts/fix_student_mastery.py 721a7783-99af-4392-9ad2-f54c483eeb1b
"""

import sys
import requests
import random
from typing import List, Dict

API_URL = "https://prereq-api.onrender.com"

# Student profiles with realistic confidence patterns
PROFILES = [
    {
        "name": "Strong",
        "description": "High achiever, understands most concepts",
        "weights": {"mastered": 0.5, "good": 0.3, "partial": 0.15, "struggling": 0.05}
    },
    {
        "name": "Average",
        "description": "Typical student, mixed understanding",
        "weights": {"mastered": 0.2, "good": 0.3, "partial": 0.3, "struggling": 0.2}
    },
    {
        "name": "Struggling",
        "description": "Having difficulty, needs help",
        "weights": {"mastered": 0.05, "good": 0.15, "partial": 0.3, "struggling": 0.5}
    },
    {
        "name": "Focused Gaps",
        "description": "Good at basics, struggles with advanced",
        "weights": {"mastered": 0.3, "good": 0.25, "partial": 0.25, "struggling": 0.2}
    }
]

def assign_confidence_by_profile(profile: Dict) -> float:
    """Generate a random confidence value based on profile weights."""
    rand = random.random()
    weights = profile["weights"]

    if rand < weights["struggling"]:
        return round(random.uniform(0.05, 0.35), 2)
    elif rand < weights["struggling"] + weights["partial"]:
        return round(random.uniform(0.40, 0.65), 2)
    elif rand < weights["struggling"] + weights["partial"] + weights["good"]:
        return round(random.uniform(0.70, 0.85), 2)
    else:
        return round(random.uniform(0.85, 0.95), 2)


def get_students(course_id: str) -> List[Dict]:
    """Get all students in a course."""
    resp = requests.get(f"{API_URL}/api/courses/{course_id}/students", timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_concepts(course_id: str) -> List[Dict]:
    """Get all concepts in a course."""
    resp = requests.get(f"{API_URL}/api/courses/{course_id}/graph", timeout=10)
    resp.raise_for_status()
    return resp.json()["nodes"]


def check_student_mastery(student_id: str) -> tuple[int, int]:
    """Return (total_rows, non_zero_rows) for a student."""
    try:
        resp = requests.get(f"{API_URL}/api/students/{student_id}/mastery", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        total = len(data)
        non_zero = sum(1 for m in data if m.get("confidence", 0) > 0)
        return (total, non_zero)
    except:
        return (0, 0)


def set_student_mastery(student_id: str, concept_id: str, confidence: float):
    """Set mastery confidence for a student/concept pair."""
    resp = requests.put(
        f"{API_URL}/api/students/{student_id}/mastery/{concept_id}",
        json={"confidence": confidence},
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/fix_student_mastery.py <course_id>")
        sys.exit(1)

    course_id = sys.argv[1]
    print(f"🔍 Checking students in course: {course_id}")
    print()

    # Get all students and concepts
    students = get_students(course_id)
    concepts = get_concepts(course_id)

    print(f"📊 Found {len(students)} students and {len(concepts)} concepts")
    print()

    # Check each student
    students_to_fix = []
    for student in students:
        total_rows, non_zero_rows = check_student_mastery(student["id"])

        # Fix if missing rows OR all zeros (empty graph)
        if total_rows < len(concepts) or non_zero_rows == 0:
            students_to_fix.append(student)
            print(f"⚠️  {student['name']}: {non_zero_rows}/{total_rows} non-zero ({total_rows}/{len(concepts)} total)")

    if not students_to_fix:
        print("✅ All students have valid mastery data!")
        return

    print()
    print(f"🔧 Fixing {len(students_to_fix)} students...")
    print()

    # Assign profiles evenly
    for i, student in enumerate(students_to_fix):
        profile = PROFILES[i % len(PROFILES)]
        student_name = student["name"]
        student_id = student["id"]

        print(f"[{i+1}/{len(students_to_fix)}] {student_name} ({profile['name']} profile)")

        success_count = 0
        for concept in concepts:
            confidence = assign_confidence_by_profile(profile)
            try:
                set_student_mastery(student_id, concept["id"], confidence)
                success_count += 1
            except Exception as e:
                print(f"  ❌ Failed for {concept['label']}: {str(e)}")

        print(f"  ✅ Set {success_count}/{len(concepts)} concepts")

    print()
    print("=" * 60)
    print("✅ COMPLETE")
    print(f"Fixed mastery data for {len(students_to_fix)} students")
    print("=" * 60)


if __name__ == "__main__":
    main()
