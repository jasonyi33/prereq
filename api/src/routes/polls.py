from flask import request, jsonify, Blueprint
from ..db import supabase

polls = Blueprint("polls", __name__)


@polls.route('/api/lectures/<lecture_id>/polls', methods=['POST'])
def create_poll(lecture_id):
    data = request.json
    result = supabase.table('poll_questions').insert({
        'lecture_id': lecture_id,
        'concept_id': data.get('concept_id'),
        'question': data['question'],
        'expected_answer': data.get('expected_answer'),
        'status': data.get('status', 'draft')
    }).execute()

    return jsonify(result.data[0]), 201


@polls.route('/api/polls/<poll_id>', methods=['GET'])
def get_poll(poll_id):
    result = supabase.table('poll_questions').select('*').eq('id', poll_id).execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404

    return jsonify(result.data[0]), 200


@polls.route('/api/lectures/<lecture_id>/polls', methods=['GET'])
def get_lecture_polls(lecture_id):
    result = supabase.table('poll_questions').select('*').eq('lecture_id', lecture_id).execute()
    return jsonify(result.data), 200


@polls.route('/api/polls/<poll_id>', methods=['PUT'])
def update_poll(poll_id):
    data = request.json
    result = supabase.table('poll_questions').update(data).eq('id', poll_id).execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404

    return jsonify(result.data[0]), 200


@polls.route('/api/polls/<poll_id>/responses', methods=['POST'])
def submit_response(poll_id):
    data = request.json
    result = supabase.table('poll_responses').insert({
        'question_id': poll_id,
        'student_id': data['student_id'],
        'answer': data['answer'],
        'evaluation': data.get('evaluation')
    }).execute()

    return jsonify(result.data[0]), 201


@polls.route('/api/polls/<poll_id>/responses', methods=['GET'])
def get_poll_responses(poll_id):
    result = supabase.table('poll_responses').select('*').eq('question_id', poll_id).execute()
    return jsonify(result.data), 200