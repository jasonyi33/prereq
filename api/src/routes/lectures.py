from flask import request, jsonify, Blueprint

from ..db import supabase

lectures = Blueprint("lectures", __name__)


@lectures.route('/api/lectures/<lecture_id>', methods=['GET'])
def get_lecture(lecture_id):
    result = supabase.table('lecture_sessions').select('id, course_id, title, status').eq('id', lecture_id).execute()
    if not result.data:
        return jsonify({'error': 'Lecture not found'}), 404
    return jsonify(result.data[0]), 200


@lectures.route('/api/lectures/<lecture_id>/transcript-chunks', methods=['GET'])
def get_transcript_chunks(lecture_id):
    limit = request.args.get('limit', type=int)
    query = supabase.table('transcript_chunks').select('text, timestamp_sec').eq('lecture_id', lecture_id).order('created_at', desc=True)
    if limit:
        query = query.limit(limit)
    result = query.execute()
    return jsonify(result.data), 200


@lectures.route('/api/lectures/<lecture_id>/recent-concept', methods=['GET'])
def get_recent_concept(lecture_id):
    # Get the most recently detected concept for this lecture
    # Join transcript_concepts with transcript_chunks to filter by lecture
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


@lectures.route('/api/lectures/<lecture_id>/transcript-excerpts', methods=['GET'])
def get_transcript_excerpts(lecture_id):
    concept_ids_param = request.args.get('concept_ids', '')
    if not concept_ids_param:
        return jsonify([]), 200

    concept_ids = [cid.strip() for cid in concept_ids_param.split(',') if cid.strip()]
    if not concept_ids:
        return jsonify([]), 200

    result = supabase.table('transcript_concepts').select(
        'concept_id, transcript_chunks!inner(text, timestamp_sec)'
    ).in_('concept_id', concept_ids).limit(20).execute()

    excerpts = []
    for row in result.data:
        chunk = row.get('transcript_chunks', {})
        excerpts.append({
            'text': chunk.get('text', ''),
            'timestamp_sec': chunk.get('timestamp_sec', 0),
        })

    return jsonify(excerpts), 200
