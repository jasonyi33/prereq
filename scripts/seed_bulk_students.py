"""
Seed ~350 bulk students with realistic mastery distributions for heatmap demo.

No auth accounts created — these are display-only students.
Existing 4 demo students are untouched.
Re-running this script cleans up previous bulk students first.

Requires: SUPABASE_URL, SUPABASE_KEY in .env

Usage:
    python scripts/seed_bulk_students.py
"""

import os
import random
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

FIRST_NAMES = [
    "Emily", "Marcus", "Sophia", "Liam", "Olivia", "Noah", "Ava", "Ethan",
    "Isabella", "Mason", "Mia", "Lucas", "Charlotte", "Logan", "Amelia",
    "James", "Harper", "Benjamin", "Evelyn", "Elijah", "Abigail", "William",
    "Ella", "Alexander", "Scarlett", "Henry", "Grace", "Sebastian", "Chloe",
    "Jack", "Victoria", "Daniel", "Riley", "Matthew", "Aria", "Owen",
    "Lily", "David", "Aurora", "Joseph", "Zoey", "Samuel", "Penelope",
    "Carter", "Layla", "John", "Nora", "Luke", "Camila", "Andrew",
    "Hannah", "Isaac", "Addison", "Gabriel", "Eleanor", "Anthony", "Stella",
    "Dylan", "Bella", "Leo", "Lucy", "Lincoln", "Savannah", "Jaxon",
    "Anna", "Asher", "Caroline", "Christopher", "Genesis", "Joshua",
    "Maya", "Ezra", "Willow", "Adrian", "Paisley", "Thomas", "Naomi",
    "Charles", "Elena", "Caleb", "Aaliyah", "Ryan", "Violet", "Nathan",
    "Ariana", "Miles", "Hazel", "Eli", "Audrey", "Nolan", "Brooklyn",
    "Aaron", "Leah", "Cameron", "Natalie", "Connor", "Ellie", "Jeremiah",
    "Ruby", "Easton", "Claire", "Robert", "Skylar", "Hunter", "Madelyn",
    "Kai", "Hailey", "Landon", "Autumn", "Nicholas", "Nevaeh", "Dominic",
    "Quinn", "Austin", "Piper", "Ian", "Sadie", "Colton", "Allison",
    "Jordan", "Gabriella", "Cooper", "Alyssa", "Carson", "Mackenzie",
    "Ryder", "Kennedy", "Micah", "Eva", "Jason", "Luna", "Parker",
    "Madeline", "Chase", "Lydia", "Tyler", "Peyton", "Grayson", "Alexa",
    "Brandon", "Jade", "Eric", "Sophie", "Adam", "Ivy", "Tristan",
    "Brielle", "Xavier", "Valentina", "Maxwell", "Clara", "Evan", "Vivian",
    "Jose", "Reagan", "Kevin", "Kinsley", "Bryan", "Andrea", "Wesley",
    "Isabelle", "Vincent", "Maria", "Derek", "Alice", "Jayden",
    "Trinity", "Gavin", "Jasmine", "Blake", "Morgan", "Cole", "Sara",
]

LAST_INITIALS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

# Confidence ranges per profile type × difficulty level
# Format: (low, high) — the random range for base confidence
PROFILE_RANGES = {
    #                  diff 1        diff 2        diff 3        diff 4
    "strong":      [(0.88, 0.99), (0.78, 0.96), (0.60, 0.85), (0.45, 0.75)],
    "average":     [(0.70, 0.90), (0.55, 0.80), (0.25, 0.55), (0.15, 0.40)],
    "struggling":  [(0.35, 0.60), (0.15, 0.40), (0.05, 0.25), (0.00, 0.15)],
    "gap_strong":  [(0.82, 0.98), (0.72, 0.94), (0.55, 0.80), (0.40, 0.70)],
    "gap_weak":    [(0.15, 0.40), (0.05, 0.25), (0.00, 0.15), (0.00, 0.10)],
}


def get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env")
        raise SystemExit(1)
    return create_client(url, key)


def generate_names(count):
    """Generate unique 'First L.' names."""
    names = set()
    while len(names) < count:
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_INITIALS)
        names.add(f"{first} {last}.")
    return list(names)


def clamp(val, lo=0.0, hi=1.0):
    return max(lo, min(hi, val))


def get_range(profile, difficulty):
    """Get (low, high) confidence range for a profile and difficulty (1-4)."""
    idx = min(difficulty - 1, 3)  # clamp to 0-3
    return PROFILE_RANGES[profile][idx]


def main():
    print("=== Prereq Bulk Student Seed ===\n")

    supabase = get_supabase()

    # 1. Find the CS229 course
    print("Looking up CS229 course...")
    courses = supabase.table("courses").select("id, name").eq("name", "CS229 Machine Learning").execute().data
    if not courses:
        print("ERROR: CS229 course not found. Run seed_demo.py first.")
        raise SystemExit(1)
    course_id = courses[0]["id"]
    print(f"  Course: {courses[0]['name']} ({course_id})")

    # 2. Clean up previous bulk students (those without email, not the 4 demo students)
    print("\nCleaning up previous bulk students...")
    old_bulk = supabase.table("students").select("id").eq("course_id", course_id).is_("email", "null").execute().data
    if old_bulk:
        old_ids = [s["id"] for s in old_bulk]
        # Delete in batches (CASCADE removes mastery rows automatically)
        for i in range(0, len(old_ids), 50):
            batch_ids = old_ids[i:i + 50]
            supabase.table("students").delete().in_("id", batch_ids).execute()
        print(f"  Removed {len(old_ids)} previous bulk students")
    else:
        print("  No previous bulk students found")

    # 3. Get all concepts for this course
    print("\nLoading concepts...")
    concepts_raw = supabase.table("concept_nodes").select("id, label, difficulty, category").eq("course_id", course_id).execute().data
    if not concepts_raw:
        print("ERROR: No concepts found. Run seed_demo.py first.")
        raise SystemExit(1)
    print(f"  {len(concepts_raw)} concepts found")

    # 4. Generate student names
    num_students = 350
    names = generate_names(num_students)
    print(f"\nGenerated {len(names)} unique student names")

    # 5. Assign profile types with weighted randomness
    profile_weights = [
        ("strong", 0.20),
        ("average", 0.50),
        ("struggling", 0.20),
        ("gap", 0.10),
    ]
    profile_types = [p for p, _ in profile_weights]
    profile_probs = [w for _, w in profile_weights]

    assignments = random.choices(profile_types, weights=profile_probs, k=num_students)

    profile_counts = {p: assignments.count(p) for p in profile_types}
    print(f"  Profile distribution: {profile_counts}\n")

    # 6. Batch insert students
    print("Inserting students...")
    student_rows = [{"name": name, "course_id": course_id} for name in names]

    all_student_ids = []
    batch_size = 50
    for i in range(0, len(student_rows), batch_size):
        batch = student_rows[i:i + batch_size]
        result = supabase.table("students").insert(batch).execute()
        batch_ids = [row["id"] for row in result.data]
        all_student_ids.extend(batch_ids)
        print(f"  Inserted students {i + 1}-{i + len(batch)} ({len(all_student_ids)} total)")

    print(f"  Total students created: {len(all_student_ids)}\n")

    # 7. Pre-generate gap student strong categories
    all_categories = list(set(c["category"] for c in concepts_raw if c.get("category")))
    gap_strong_cats = {}
    for idx, profile in enumerate(assignments):
        if profile == "gap":
            gap_strong_cats[idx] = set(random.sample(all_categories, random.randint(3, 4)))

    # 8. Generate and batch insert mastery rows
    print("Generating mastery data...")

    all_mastery_rows = []
    for idx, (student_id, profile) in enumerate(zip(all_student_ids, assignments)):
        for c in concepts_raw:
            difficulty = c["difficulty"]

            if profile == "gap":
                is_strong_cat = c.get("category") in gap_strong_cats.get(idx, set())
                key = "gap_strong" if is_strong_cat else "gap_weak"
                lo, hi = get_range(key, difficulty)
            else:
                lo, hi = get_range(profile, difficulty)

            conf = random.uniform(lo, hi)

            # Add per-concept noise (±0.08)
            conf += random.uniform(-0.08, 0.08)
            conf = clamp(conf)

            # Small chance of being exactly 0 (unvisited) for struggling students
            if profile == "struggling" and random.random() < 0.08:
                conf = 0.0
            elif profile == "average" and random.random() < 0.03:
                conf = 0.0

            all_mastery_rows.append({
                "student_id": student_id,
                "concept_id": c["id"],
                "confidence": round(conf, 3),
            })

    print(f"  Total mastery rows to insert: {len(all_mastery_rows)}")

    mastery_batch_size = 500
    for i in range(0, len(all_mastery_rows), mastery_batch_size):
        batch = all_mastery_rows[i:i + mastery_batch_size]
        supabase.table("student_mastery").insert(batch).execute()
        print(f"  Inserted mastery rows {i + 1}-{i + len(batch)}")

    # 9. Print summary with expected averages per difficulty
    print(f"\n{'=' * 50}")
    print("=== Bulk Seed Complete ===")
    print(f"{'=' * 50}")
    print(f"\nStudents created: {len(all_student_ids)}")
    print(f"Mastery rows created: {len(all_mastery_rows)}")
    print(f"Profile distribution: {profile_counts}")

    # Compute actual averages by difficulty for verification
    from collections import defaultdict
    by_diff = defaultdict(list)
    for row in all_mastery_rows:
        cid = row["concept_id"]
        diff = next(c["difficulty"] for c in concepts_raw if c["id"] == cid)
        by_diff[diff].append(row["confidence"])

    print("\nAverage confidence by difficulty:")
    for d in sorted(by_diff.keys()):
        vals = by_diff[d]
        avg = sum(vals) / len(vals)
        print(f"  Difficulty {d}: {avg:.3f} ({len(vals)} rows)")


if __name__ == "__main__":
    main()
