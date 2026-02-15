"""
Clear Sam from study group matches so he can be the live demo student.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("FLASK_API_URL", "https://prereq-api.onrender.com")


def clear_sam():
    print("[clear_sam] Starting...")

    # Get courses
    resp = requests.get(f"{API_URL}/api/courses")
    if resp.status_code != 200 or not resp.json():
        print("No courses found.")
        return

    courses = resp.json()
    course_id = courses[0]['id']

    # Get students to find Sam
    resp = requests.get(f"{API_URL}/api/courses/{course_id}/students")
    if resp.status_code != 200:
        print("Failed to fetch students")
        return

    students = resp.json()
    sam = next((s for s in students if s['name'] == 'Sam'), None)

    if not sam:
        print("Sam not found in students")
        return

    print(f"Found Sam: {sam['id']}")

    # Clear Sam from study groups
    resp = requests.post(
        f"{API_URL}/api/courses/{course_id}/study-groups/clear",
        json={'studentId': sam['id']}
    )

    if resp.status_code == 200:
        print("✓ Sam cleared from all study groups and pool")
    else:
        print(f"✗ Failed to clear Sam: {resp.text}")


if __name__ == '__main__':
    clear_sam()