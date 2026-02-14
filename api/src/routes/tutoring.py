from flask import request, jsonify, Blueprint

from ..db import supabase

tutoring = Blueprint("tutoring", __name__)


@tutoring.route('/api/tutoring/sessions', methods=['POST'])
def create_session():
    data = request.json
    result = supabase.table('tutoring_sessions').insert({
        'student_id': data['student_id'],
        'target_concepts': data.get('target_concepts', []),
    }).execute()

    if not result.data:
        return jsonify({'error': 'Failed to create session'}), 500
    return jsonify(result.data[0]), 201


@tutoring.route('/api/tutoring/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    result = supabase.table('tutoring_sessions').select(
        'id, student_id, target_concepts'
    ).eq('id', session_id).execute()

    if not result.data:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify(result.data[0]), 200


@tutoring.route('/api/tutoring/sessions/<session_id>/messages', methods=['POST'])
def create_messages(session_id):
    data = request.json

    # Support both single message and batch insert
    if 'messages' in data:
        messages = data['messages']
    else:
        messages = [data]

    rows = []
    for msg in messages:
        rows.append({
            'session_id': session_id,
            'role': msg['role'],
            'content': msg['content'],
            'concept_id': msg.get('concept_id'),
        })

    result = supabase.table('tutoring_messages').insert(rows).execute()

    if not result.data:
        return jsonify({'error': 'Failed to create messages'}), 500
    return jsonify(result.data), 201


@tutoring.route('/api/tutoring/sessions/<session_id>/messages', methods=['GET'])
def get_messages(session_id):
    exclude_role = request.args.get('exclude_role')

    query = supabase.table('tutoring_messages').select(
        'id, role, content, concept_id, created_at'
    ).eq('session_id', session_id).order('created_at')

    if exclude_role:
        query = query.neq('role', exclude_role)

    result = query.execute()
    return jsonify(result.data), 200


@tutoring.route('/api/tutoring/messages/<message_id>', methods=['PUT'])
def update_message(message_id):
    data = request.json
    update_fields = {}
    if 'concept_id' in data:
        update_fields['concept_id'] = data['concept_id']

    if not update_fields:
        return jsonify({'error': 'No fields to update'}), 400

    result = supabase.table('tutoring_messages').update(
        update_fields
    ).eq('id', message_id).select().execute()

    if not result.data:
        return jsonify({'error': 'Message not found'}), 404
    return jsonify(result.data[0]), 200
