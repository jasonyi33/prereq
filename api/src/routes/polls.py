from flask import request, jsonify, Blueprint

from ..db import supabase
from ..middleware.auth import optional_auth

polls = Blueprint("polls", __name__)


# --- P1 CRUD endpoints ---

@polls.route('/api/lectures/<lecture_id>/polls', methods=['POST'])
@optional_auth
def create_poll_for_lecture(lecture_id):
    data = request.json
    result = supabase.table('poll_questions').insert({
        'lecture_id': lecture_id,
        'concept_id': data.get('concept_id'),
        'question': data['question'],
        'expected_answer': data.get('expected_answer'),
        'status': data.get('status', 'draft')
    }).execute()

    return jsonify(result.data[0]), 201


@polls.route('/api/lectures/<lecture_id>/polls', methods=['GET'])
@optional_auth
def get_lecture_polls(lecture_id):
    result = supabase.table('poll_questions').select('*').eq('lecture_id', lecture_id).execute()
    return jsonify(result.data), 200


@polls.route('/api/polls/<poll_id>', methods=['PUT'])
@optional_auth
def update_poll(poll_id):
    data = request.json
    result = supabase.table('poll_questions').update(data).eq('id', poll_id).execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404

    return jsonify(result.data[0]), 200


# --- P3 endpoints ---

@polls.route('/api/polls', methods=['POST'])
@optional_auth
def create_poll():
    data = request.json
    result = supabase.table('poll_questions').insert({
        'lecture_id': data['lecture_id'],
        'concept_id': data.get('concept_id'),
        'question': data['question'],
        'expected_answer': data.get('expected_answer'),
        'status': data.get('status', 'draft'),
    }).execute()

    if not result.data:
        return jsonify({'error': 'Failed to create poll'}), 500
    return jsonify(result.data[0]), 201


@polls.route('/api/polls/<poll_id>', methods=['GET'])
@optional_auth
def get_poll(poll_id):
    result = supabase.table('poll_questions').select(
        'id, question, expected_answer, concept_id, lecture_id, status'
    ).eq('id', poll_id).execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404
    return jsonify(result.data[0]), 200


@polls.route('/api/polls/<poll_id>/status', methods=['PUT'])
@optional_auth
def update_poll_status(poll_id):
    try:
        data = request.json
        if not data or 'status' not in data:
            return jsonify({'error': 'status field required'}), 400

        result = supabase.table('poll_questions').update({
            'status': data['status']
        }).eq('id', poll_id).execute()

        if not result.data:
            return jsonify({'error': 'Poll not found'}), 404

        # Fetch the updated poll to return all fields
        poll = supabase.table('poll_questions').select('id, status, question, concept_id').eq('id', poll_id).single().execute()
        return jsonify(poll.data), 200
    except Exception as e:
        print(f"[update_poll_status] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@polls.route('/api/polls/<poll_id>/responses', methods=['POST'])
@optional_auth
def create_poll_response(poll_id):
    data = request.json
    result = supabase.table('poll_responses').insert({
        'question_id': poll_id,
        'student_id': data['student_id'],
        'answer': data['answer'],
        'evaluation': data.get('evaluation'),
    }).execute()

    if not result.data:
        return jsonify({'error': 'Failed to create response'}), 500
    return jsonify(result.data[0]), 201


@polls.route('/api/polls/<poll_id>/responses', methods=['GET'])
@optional_auth
def get_poll_responses(poll_id):
    result = supabase.table('poll_responses').select(
        'answer, evaluation'
    ).eq('question_id', poll_id).execute()
    return jsonify(result.data), 200
