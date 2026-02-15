"""
Generate learning pages and quiz questions for all concepts in a course.
This calls the Flask API to use Claude to generate content.

Usage:
    python scripts/generate_learning_content.py [course_id_or_name]

Examples:
    python scripts/generate_learning_content.py a1b2c3d4-e5f6-7890-abcd-ef1234567890
    python scripts/generate_learning_content.py "CS229"
    python scripts/generate_learning_content.py  # Lists available courses
"""

import sys
import requests
import os
from dotenv import load_dotenv

load_dotenv()

FLASK_API_URL = os.getenv('FLASK_API_URL', 'http://localhost:8080')


def list_courses():
    """List
    all available courses via Flask API."""
    try:
        response = requests.get(f"{FLASK_API_URL}/api/courses", timeout=5)

        if response.status_code != 200:
            print(f"❌ Error fetching courses: {response.status_code}")
            return []

        courses = response.json()

        if not courses:
            print("No courses found in database.")
            return []

        print("Available courses:")
        print()
        for c in courses:
            print(f"  Name: {c['name']}")
            print(f"  ID: {c['id']}")
            if c.get('description'):
                print(f"  Description: {c['description']}")
            print()

        return courses

    except requests.exceptions.ConnectionError:
        print(f"❌ Error: Cannot connect to Flask API at {FLASK_API_URL}")
        print("Make sure the Flask API is running:")
        print("  cd api && python main.py")
        return []
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return []


def get_course_by_name(course_name):
    """Get course by exact or partial name match via Flask API."""
    try:
        response = requests.get(f"{FLASK_API_URL}/api/courses", timeout=5)

        if response.status_code != 200:
            return None

        courses = response.json()

        if not courses:
            return None

        # Try exact match first
        for c in courses:
            if c['name'].lower() == course_name.lower():
                return c

        # Try partial match
        for c in courses:
            if course_name.lower() in c['name'].lower():
                return c

        return None

    except Exception as e:
        print(f"Error fetching courses: {e}")
        return None


def generate_content(course_id, course_name=None):
    """Generate learning content for all concepts in a course."""
    print(f"Generating learning content for course: {course_name or course_id}")
    print(f"API: {FLASK_API_URL}")
    print()

    try:
        # First, get all concepts for this course
        response = requests.get(f"{FLASK_API_URL}/api/courses/{course_id}/graph", timeout=10)
        if response.status_code != 200:
            print(f"❌ Error fetching concepts: {response.status_code}")
            sys.exit(1)

        graph_data = response.json()
        concepts = graph_data.get('nodes', [])

        if not concepts:
            print("❌ No concepts found in course")
            sys.exit(1)

        print(f"📊 Found {len(concepts)} concepts")
        print()

        # Generate content for each concept individually
        results = {
            'total': len(concepts),
            'generated': [],
            'failed': []
        }

        for i, concept in enumerate(concepts, 1):
            concept_id = concept['id']
            label = concept['label']

            print(f"[{i}/{len(concepts)}] {label}")

            # Generate learning page
            try:
                resp = requests.post(
                    f"{FLASK_API_URL}/api/concepts/{concept_id}/learning-page/generate",
                    timeout=30
                )
                if resp.status_code == 200:
                    print(f"  ✅ Learning page generated")
                else:
                    error_msg = f"{resp.status_code}"
                    try:
                        error_data = resp.json()
                        if 'error' in error_data:
                            error_msg = f"{resp.status_code} - {error_data['error'][:100]}"
                    except:
                        pass
                    print(f"  ❌ Learning page failed: {error_msg}")
                    results['failed'].append({'label': label, 'error': f'Page: {error_msg}'})
                    continue
            except Exception as e:
                print(f"  ❌ Learning page error: {str(e)}")
                results['failed'].append({'label': label, 'error': f'Page: {str(e)}'})
                continue

            # Generate quiz
            try:
                resp = requests.post(
                    f"{FLASK_API_URL}/api/concepts/{concept_id}/quiz/generate",
                    timeout=30
                )
                if resp.status_code == 200:
                    print(f"  ✅ Quiz generated")
                    results['generated'].append({'concept_id': concept_id, 'label': label})
                else:
                    print(f"  ❌ Quiz failed: {resp.status_code}")
                    results['failed'].append({'label': label, 'error': f'Quiz: {resp.status_code}'})
            except Exception as e:
                print(f"  ❌ Quiz error: {str(e)}")
                results['failed'].append({'label': label, 'error': f'Quiz: {str(e)}'})

            print()

        # Print summary
        print("=" * 60)
        print(f"✅ Successfully generated content for {len(results['generated'])} concepts")

        if results['failed']:
            print()
            print(f"⚠️  Failed to generate {len(results['failed'])} concepts:")
            for item in results['failed']:
                print(f"  - {item['label']}: {item['error']}")

        print()
        print(f"Total: {results['total']} concepts")
        print(f"Success: {len(results['generated'])}")
        print(f"Failed: {len(results['failed'])}")

    except requests.exceptions.ConnectionError:
        print(f"❌ Error: Cannot connect to Flask API at {FLASK_API_URL}")
        print("Make sure the Flask API is running")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    # No arguments - list courses
    if len(sys.argv) < 2:
        list_courses()
        print("Usage: python scripts/generate_learning_content.py <course_id_or_name>")
        sys.exit(0)

    course_arg = sys.argv[1]

    # Check if it looks like a UUID
    if '-' in course_arg and len(course_arg) == 36:
        course_id = course_arg
        course_name = None
    else:
        # Try to find by name
        print(f"Looking up course: {course_arg}")
        course = get_course_by_name(course_arg)
        if not course:
            print(f"❌ Course not found: {course_arg}")
            print()
            list_courses()
            sys.exit(1)
        course_id = course['id']
        course_name = course['name']
        print(f"Found: {course_name}")
        print(f"ID: {course_id}")
        print()

    generate_content(course_id, course_name)