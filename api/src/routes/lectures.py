from flask import request, jsonify, Blueprint
from ..db import supabase

lectures = Blueprint("lectures", __name__)


@lectures.route('/api/lectures', methods=['POST'])
def create_lecture():
    data = request.json
    result = supabase.table('lecture_sessions').insert({
        'course_id': data['course_id'],
        'title': data['title'],
        'status': data.get('status', 'live')
    }).execute()

    return jsonify(result.data[0]), 201


@lectures.route('/api/lectures/<lecture_id>', methods=['GET'])
def get_lecture(lecture_id):
    result = supabase.table('lecture_sessions').select('*').eq('id', lecture_id).execute()

    if not result.data:
        return jsonify({'error': 'Lecture not found'}), 404

    return jsonify(result.data[0]), 200


@lectures.route('/api/courses/<course_id>/lectures', methods=['GET'])
def get_course_lectures(course_id):
    result = supabase.table('lecture_sessions').select('*').eq('course_id', course_id).execute()
    return jsonify(result.data), 200


@lectures.route('/api/lectures/<lecture_id>', methods=['PUT'])
def update_lecture(lecture_id):
    data = request.json
    result = supabase.table('lecture_sessions').update(data).eq('id', lecture_id).execute()

    if not result.data:
        return jsonify({'error': 'Lecture not found'}), 404

    return jsonify(result.data[0]), 200