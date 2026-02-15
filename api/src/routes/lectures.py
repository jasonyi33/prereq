from flask import request, jsonify, Blueprint

from ..db import supabase
from ..middleware.auth import optional_auth

lectures = Blueprint("lectures", __name__)


# --- P1 CRUD endpoints ---

@lectures.route('/api/lectures', methods=['POST'])
@optional_auth
def create_lecture():
    data = request.json
    result = supabase.table('lecture_sessions').insert({
        'course_id': data['course_id'],
        'title': data['title'],
        'status': data.get('status', 'live')
    }).execute()

    return jsonify(result.data[0]), 201


@lectures.route('/api/lectures/<lecture_id>', methods=['GET'])
@optional_auth
def get_lecture(lecture_id):
    result = supabase.table('lecture_sessions').select('*').eq('id', lecture_id).execute()

    if not result.data:
        return jsonify({'error': 'Lecture not found'}), 404

    return jsonify(result.data[0]), 200


@lectures.route('/api/courses/<course_id>/lectures', methods=['GET'])
@optional_auth
def get_course_lectures(course_id):
    result = supabase.table('lecture_sessions').select('*').eq('course_id', course_id).order('started_at', desc=True).execute()
    return jsonify(result.data), 200


@lectures.route('/api/lectures/<lecture_id>', methods=['PUT'])
@optional_auth
def update_lecture(lecture_id):
    data = request.json
    result = supabase.table('lecture_sessions').update(data).eq('id', lecture_id).execute()

    if not result.data:
        return jsonify({'error': 'Lecture not found'}), 404

    return jsonify(result.data[0]), 200


# --- P3 endpoints ---

@lectures.route('/api/lectures/<lecture_id>/transcript-chunks', methods=['GET'])
@optional_auth
def get_transcript_chunks(lecture_id):
    limit = request.args.get('limit', type=int)
    query = supabase.table('transcript_chunks').select('text, timestamp_sec').eq('lecture_id', lecture_id).order('created_at', desc=True)
    if limit:
        query = query.limit(limit)
    result = query.execute()
    return jsonify(result.data), 200


@lectures.route('/api/lectures/<lecture_id>/recent-concept', methods=['GET'])
@optional_auth
def get_recent_concept(lecture_id):
    result = supabase.table('transcript_concepts').select(
        'concept_id, transcript_chunks!inner(lecture_id, created_at)'
    ).eq(
        'transcript_chunks.lecture_id', lecture_id
    ).order(
        'transcript_chunks(created_at)', desc=True
    ).limit(1).execute()

    if not result.data:
        return jsonify({'error': 'No concepts detected yet'}), 404

    return jsonify({'concept_id': result.data[0]['concept_id']}), 200


@lectures.route('/api/lectures/<lecture_id>/covered-concepts', methods=['GET'])
@optional_auth
def get_covered_concepts(lecture_id):
    """Get unique concept IDs detected in a lecture's transcript."""
    result = supabase.table('transcript_concepts').select(
        'concept_id, transcript_chunks!inner(lecture_id)'
    ).eq(
        'transcript_chunks.lecture_id', lecture_id
    ).execute()

    concept_ids = list(set(row['concept_id'] for row in result.data))
    return jsonify({'concept_ids': concept_ids}), 200


@lectures.route('/api/lectures/<lecture_id>/transcript-excerpts', methods=['GET'])
@optional_auth
def get_transcript_excerpts(lecture_id):
    concept_ids_param = request.args.get('concept_ids', '')
    if not concept_ids_param:
        return jsonify([]), 200

    concept_ids = [cid.strip() for cid in concept_ids_param.split(',') if cid.strip()]
    if not concept_ids:
        return jsonify([]), 200

    # Fetch lecture title
    lecture_result = supabase.table('lecture_sessions').select('title').eq('id', lecture_id).execute()
    lecture_title = lecture_result.data[0]['title'] if lecture_result.data else ''

    # Filter by lecture_id (BUG FIX: was previously returning chunks from ALL lectures)
    result = supabase.table('transcript_concepts').select(
        'concept_id, transcript_chunks!inner(text, timestamp_sec, lecture_id)'
    ).eq(
        'transcript_chunks.lecture_id', lecture_id
    ).in_('concept_id', concept_ids).order(
        'transcript_chunks(timestamp_sec)'
    ).limit(20).execute()

    excerpts = []
    for row in result.data:
        chunk = row.get('transcript_chunks', {})
        excerpts.append({
            'text': chunk.get('text', ''),
            'timestamp_sec': chunk.get('timestamp_sec', 0),
            'lecture_title': lecture_title,
        })

    return jsonify(excerpts), 200
