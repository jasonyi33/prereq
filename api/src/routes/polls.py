from flask import request, jsonify, Blueprint

from ..db import supabase

polls = Blueprint("polls", __name__)


@polls.route('/api/polls', methods=['POST'])
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
def get_poll(poll_id):
    result = supabase.table('poll_questions').select(
        'id, question, expected_answer, concept_id, lecture_id, status'
    ).eq('id', poll_id).execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404
    return jsonify(result.data[0]), 200


@polls.route('/api/polls/<poll_id>/status', methods=['PUT'])
def update_poll_status(poll_id):
    data = request.json
    result = supabase.table('poll_questions').update({
        'status': data['status']
    }).eq('id', poll_id).select('id, status, question, concept_id').execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404
    return jsonify(result.data[0]), 200


@polls.route('/api/polls/<poll_id>/responses', methods=['POST'])
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
def get_poll_responses(poll_id):
    result = supabase.table('poll_responses').select(
        'answer, evaluation'
    ).eq('question_id', poll_id).execute()
    return jsonify(result.data), 200
