from flask import request, jsonify, Blueprint
from ..db import supabase

tutoring = Blueprint("tutoring", __name__)


@tutoring.route('/api/tutoring/sessions', methods=['POST'])
def create_session():
    data = request.json
    result = supabase.table('tutoring_sessions').insert({
        'student_id': data['student_id'],
        'target_concepts': data.get('target_concepts', [])
    }).execute()

    return jsonify(result.data[0]), 201


@tutoring.route('/api/tutoring/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    result = supabase.table('tutoring_sessions').select('*').eq('id', session_id).execute()

    if not result.data:
        return jsonify({'error': 'Session not found'}), 404

    return jsonify(result.data[0]), 200


@tutoring.route('/api/students/<student_id>/tutoring', methods=['GET'])
def get_student_sessions(student_id):
    result = supabase.table('tutoring_sessions').select('*').eq('student_id', student_id).execute()
    return jsonify(result.data), 200


@tutoring.route('/api/tutoring/sessions/<session_id>/messages', methods=['POST'])
def create_message(session_id):
    data = request.json
    result = supabase.table('tutoring_messages').insert({
        'session_id': session_id,
        'role': data['role'],
        'content': data['content'],
        'concept_id': data.get('concept_id')
    }).execute()

    return jsonify(result.data[0]), 201


@tutoring.route('/api/tutoring/sessions/<session_id>/messages', methods=['GET'])
def get_messages(session_id):
    result = supabase.table('tutoring_messages').select('*').eq('session_id', session_id).order('created_at').execute()
    return jsonify(result.data), 200