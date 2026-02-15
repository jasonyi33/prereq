from flask import request, jsonify, Blueprint
import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

from ..db import supabase
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set, cache_delete_pattern

load_dotenv()
study_groups = Blueprint("study_groups", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"


def confidence_to_color(confidence):
    """Helper: derive color from confidence."""
    if confidence == 0.0:
        return "gray"
    elif confidence < 0.4:
        return "red"
    elif confidence < 0.7:
        return "yellow"
    else:
        return "green"


def calculate_complementarity(mastery1, mastery2, concept_ids):
    """
    Calculate how complementary two students are (0.0-1.0).
    Higher score = more opposite experience levels.
    """
    if not concept_ids:
        return 0.0

    total_diff = 0.0
    valid = 0

    for cid in concept_ids:
        c1 = mastery1.get(cid, 0.0)
        c2 = mastery2.get(cid, 0.0)
        total_diff += abs(c1 - c2)
        valid += 1

    return total_diff / valid if valid > 0 else 0.0


def generate_zoom_link():
    """Generate dummy Zoom link for MVP."""
    room_id = random.randint(100000000, 999999999)
    return f"https://zoom.us/j/{room_id}?pwd=prereq"


def _find_match(student_id, course_id, concept_ids):
    """
    Internal helper: try to find a match for student.
    Returns match details dict or None.
    """
    # Fetch student's mastery
    my_mastery_rows = supabase.table('student_mastery').select('concept_id, confidence').eq(
        'student_id', student_id
    ).in_('concept_id', concept_ids).execute().data

    my_mastery = {row['concept_id']: row['confidence'] for row in my_mastery_rows}

    # Fetch all waiting pool entries for course (exclude self)
    pool_entries = supabase.table('study_group_pool').select('id, student_id, concept_ids').eq(
        'course_id', course_id
    ).eq('status', 'waiting').neq('student_id', student_id).execute().data

    if not pool_entries:
        # FALLBACK: No one waiting - pick ANY other student in course for instant match
        all_students = supabase.table('students').select('id, name').eq(
            'course_id', course_id
        ).neq('id', student_id).limit(10).execute().data

        if not all_students:
            return None  # No other students exist

        # Pick a random student
        import random
        partner_student = random.choice(all_students)

        # Use first few of my concepts as shared concepts
        shared_concepts = concept_ids[:min(3, len(concept_ids))]

        # Create match directly without pool entry
        s1, s2 = sorted([student_id, partner_student['id']])
        zoom_link = generate_zoom_link()

        match = supabase.table('study_group_matches').insert({
            'course_id': course_id,
            'student1_id': s1,
            'student2_id': s2,
            'concept_ids': shared_concepts,
            'zoom_link': zoom_link,
            'complementarity_score': 0.5,
            'status': 'active'
        }).execute().data[0]

        # Fetch concept labels
        concept_labels_rows = supabase.table('concept_nodes').select('label').in_('id', shared_concepts).execute().data
        labels = [c['label'] for c in concept_labels_rows]

        cache_delete_pattern(f"study_group_status:{course_id}:*")

        return {
            'matchId': match['id'],
            'partner': partner_student,
            'conceptLabels': labels,
            'zoomLink': zoom_link,
            'complementarityScore': 0.5
        }

    # Calculate complementarity for each candidate
    candidates = []
    for entry in pool_entries:
        # Find overlapping concepts
        overlap = set(concept_ids) & set(entry['concept_ids'])
        if not overlap:
            continue  # no shared concepts = no match

        # Fetch candidate's mastery
        candidate_mastery_rows = supabase.table('student_mastery').select('concept_id, confidence').eq(
            'student_id', entry['student_id']
        ).in_('concept_id', list(overlap)).execute().data

        candidate_mastery = {row['concept_id']: row['confidence'] for row in candidate_mastery_rows}

        # Calculate score
        score = calculate_complementarity(my_mastery, candidate_mastery, list(overlap))

        if score >= 0.3:  # minimum threshold
            candidates.append({
                'pool_id': entry['id'],
                'student_id': entry['student_id'],
                'concept_ids': list(overlap),
                'score': score
            })

    if not candidates:
        # FALLBACK: No good complementarity match found
        # Pick ANY random student from pool for demo (always match someone)
        if pool_entries:
            import random
            random_entry = random.choice(pool_entries)
            # Find ANY overlapping concepts (or all if none overlap)
            overlap = set(concept_ids) & set(random_entry['concept_ids'])
            if not overlap:
                overlap = set(concept_ids[:2])  # Use first 2 of student's concepts as fallback

            candidates.append({
                'pool_id': random_entry['id'],
                'student_id': random_entry['student_id'],
                'concept_ids': list(overlap),
                'score': 0.3  # Minimum acceptable score
            })
        else:
            return None

    # Select best match
    best = max(candidates, key=lambda c: c['score'])

    # Create match
    s1, s2 = sorted([student_id, best['student_id']])  # canonical ordering
    zoom_link = generate_zoom_link()

    match = supabase.table('study_group_matches').insert({
        'course_id': course_id,
        'student1_id': s1,
        'student2_id': s2,
        'concept_ids': best['concept_ids'],
        'zoom_link': zoom_link,
        'status': 'active'
    }).execute().data[0]

    # Update pool entries to matched
    supabase.table('study_group_pool').update({'status': 'matched'}).eq(
        'student_id', student_id
    ).eq('course_id', course_id).execute()

    supabase.table('study_group_pool').update({'status': 'matched'}).eq(
        'student_id', best['student_id']
    ).eq('course_id', course_id).execute()

    # Fetch partner details
    partner_id = best['student_id']
    partner = supabase.table('students').select('id, name, email').eq('id', partner_id).execute().data[0]

    # Fetch concept labels
    concept_labels_rows = supabase.table('concept_nodes').select('label').in_('id', best['concept_ids']).execute().data
    labels = [c['label'] for c in concept_labels_rows]

    # Invalidate caches
    cache_delete_pattern(f"study_group_status:{course_id}:*")

    return {
        'matchId': match['id'],
        'partner': partner,
        'conceptLabels': labels,
        'zoomLink': zoom_link,
        'complementarityScore': best['score']
    }


@study_groups.route('/api/courses/<course_id>/study-groups/opt-in', methods=['POST'])
@optional_auth
def opt_in(course_id):
    """Join study group pool and try to find immediate match."""
    if MOCK_MODE:
        # Return mock match data
        return jsonify({
            'status': 'matched',
            'matchId': 'mock-match-1',
            'partner': {
                'id': 'student-alex-id',
                'name': 'Alex',
                'email': 'alex@stanford.edu'
            },
            'conceptLabels': ['Backpropagation', 'Dropout'],
            'zoomLink': 'https://zoom.us/j/123456789',
            'complementarityScore': 0.68
        }), 200

    data = request.json
    student_id = data['studentId']
    concept_ids = data['conceptIds']

    if not concept_ids:
        return jsonify({'error': 'Must select at least one concept'}), 400

    # Validate concepts belong to course
    valid_concepts = supabase.table('concept_nodes').select('id').eq('course_id', course_id).in_(
        'id', concept_ids
    ).execute().data

    if len(valid_concepts) != len(concept_ids):
        return jsonify({'error': 'Invalid concept IDs'}), 400

    # Upsert pool entry (delete old, insert new)
    supabase.table('study_group_pool').delete().eq('student_id', student_id).eq('course_id', course_id).execute()

    expires_at = (datetime.utcnow() + timedelta(minutes=5)).isoformat()
    pool_entry = supabase.table('study_group_pool').insert({
        'student_id': student_id,
        'course_id': course_id,
        'concept_ids': concept_ids,
        'status': 'waiting',
        'expires_at': expires_at
    }).execute().data[0]

    # Try to find match immediately
    match_details = _find_match(student_id, course_id, concept_ids)

    if match_details:
        return jsonify({
            'status': 'matched',
            **match_details
        }), 200
    else:
        # Fetch concept labels for waiting response
        concept_labels_rows = supabase.table('concept_nodes').select('label').in_('id', concept_ids).execute().data
        labels = [c['label'] for c in concept_labels_rows]

        return jsonify({
            'status': 'waiting',
            'poolId': pool_entry['id'],
            'conceptLabels': labels,
            'expiresAt': pool_entry['expires_at']
        }), 200


@study_groups.route('/api/courses/<course_id>/study-groups/opt-out', methods=['POST'])
@optional_auth
def opt_out(course_id):
    """Leave study group pool."""
    if MOCK_MODE:
        return jsonify({'status': 'opted_out'}), 200

    data = request.json
    student_id = data['studentId']

    supabase.table('study_group_pool').update({'status': 'expired'}).eq(
        'student_id', student_id
    ).eq('course_id', course_id).eq('status', 'waiting').execute()

    cache_delete_pattern(f"study_group_status:{course_id}:{student_id}")

    return jsonify({'status': 'opted_out'}), 200


@study_groups.route('/api/courses/<course_id>/study-groups/clear', methods=['POST'])
@optional_auth
def clear_student(course_id):
    """Remove a student from all study groups (pool and matches)."""
    if MOCK_MODE:
        return jsonify({'status': 'cleared'}), 200

    data = request.json
    student_id = data['studentId']

    # Remove from pool
    supabase.table('study_group_pool').delete().eq(
        'student_id', student_id
    ).eq('course_id', course_id).execute()

    # Set matches to inactive
    supabase.table('study_group_matches').update({'status': 'inactive'}).eq(
        'course_id', course_id
    ).or_(f"student1_id.eq.{student_id},student2_id.eq.{student_id}").execute()

    cache_delete_pattern(f"study_group_status:{course_id}:{student_id}")

    return jsonify({'status': 'cleared'}), 200


@study_groups.route('/api/courses/<course_id>/study-groups/status', methods=['GET'])
@optional_auth
def get_status(course_id):
    """Check current study group status for a student."""
    if MOCK_MODE:
        return jsonify({'status': 'none'}), 200

    student_id = request.args.get('studentId')

    cache_key = f"study_group_status:{course_id}:{student_id}"
    hit = cache_get(cache_key)
    if hit:
        return jsonify(hit), 200

    # Check for active match
    matches = supabase.table('study_group_matches').select('*').eq('course_id', course_id).or_(
        f"student1_id.eq.{student_id},student2_id.eq.{student_id}"
    ).eq('status', 'active').execute().data

    if matches:
        match = matches[0]
        partner_id = match['student2_id'] if match['student1_id'] == student_id else match['student1_id']
        partner = supabase.table('students').select('id, name, email').eq('id', partner_id).execute().data[0]

        concept_labels_rows = supabase.table('concept_nodes').select('label').in_('id', match['concept_ids']).execute().data
        labels = [c['label'] for c in concept_labels_rows]

        result = {
            'status': 'matched',
            'matchId': match['id'],
            'partner': partner,
            'conceptLabels': labels,
            'zoomLink': match['zoom_link'],
            'createdAt': match['created_at']
        }
        cache_set(cache_key, result, ttl_seconds=30)
        return jsonify(result), 200

    # Check pool status
    pool = supabase.table('study_group_pool').select('*').eq('student_id', student_id).eq(
        'course_id', course_id
    ).eq('status', 'waiting').execute().data

    if pool:
        entry = pool[0]
        concept_labels_rows = supabase.table('concept_nodes').select('label').in_('id', entry['concept_ids']).execute().data
        labels = [c['label'] for c in concept_labels_rows]

        result = {
            'status': 'waiting',
            'conceptLabels': labels,
            'expiresAt': entry['expires_at']
        }
        cache_set(cache_key, result, ttl_seconds=10)
        return jsonify(result), 200

    result = {'status': 'none'}
    cache_set(cache_key, result, ttl_seconds=10)
    return jsonify(result), 200