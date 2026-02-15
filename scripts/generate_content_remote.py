#!/usr/bin/env python3
"""
Generate learning content by calling the Render API.
This calls the deployed API, not localhost.
"""

import requests
import sys

RENDER_API_URL = "https://prereq-api.onrender.com"


def get_courses():
    """Get list of courses from Render API."""
    response = requests.get(f"{RENDER_API_URL}/api/courses", timeout=10)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error fetching courses: {response.status_code}")
        print(response.text)
        return []


def generate_content(course_id):
    """Call Render API to generate content for all concepts."""
    print(f"Calling: {RENDER_API_URL}/api/courses/{course_id}/bulk-generate")
    print("This may take 5-10 minutes for ~30 concepts...\n")

    try:
        response = requests.post(
            f"{RENDER_API_URL}/api/courses/{course_id}/bulk-generate",
            timeout=600  # 10 minute timeout
        )

        if response.status_code == 200:
            results = response.json()
            print(f"\n✅ Successfully generated content for {len(results['success'])} concepts")

            if results['success']:
                print("\nGenerated:")
                for label in results['success']:
                    print(f"  ✓ {label}")

            if results['failed']:
                print(f"\n❌ Failed to generate {len(results['failed'])} concepts:")
                for item in results['failed']:
                    print(f"  ✗ {item['label']}: {item['error']}")

            print(f"\nTotal: {results['total']}")
            print(f"Success: {len(results['success'])}")
            print(f"Failed: {len(results['failed'])}")

        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)

    except requests.exceptions.Timeout:
        print("❌ Request timed out after 10 minutes")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


if __name__ == '__main__':
    print(f"Using Render API: {RENDER_API_URL}\n")

    if len(sys.argv) < 2:
        print("Fetching courses...\n")
        courses = get_courses()

        if not courses:
            print("No courses found")
            sys.exit(1)

        print("Available courses:")
        for c in courses:
            print(f"  {c['name']}")
            print(f"    ID: {c['id']}")
            print()

        if len(courses) == 1:
            print(f"Auto-selecting only course: {courses[0]['name']}\n")
            generate_content(courses[0]['id'])
        else:
            print("Usage: python scripts/generate_content_remote.py <course_id>")

    else:
        course_id = sys.argv[1]
        generate_content(course_id)