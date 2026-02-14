from flask import request, jsonify, Blueprint
import os
from dotenv import load_dotenv

from ..db import supabase
from ..middleware.auth import optional_auth

load_dotenv()
students = Blueprint("students", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def confidence_to_color(confidence):
    if confidence == 0.0:
        return "gray"
    elif confidence < 0.4:
        return "red"
    elif confidence < 0.7:
        return "yellow"
    else:
        return "green"


@students.route('/api/courses/<course_id>/students', methods=['GET'])
@optional_auth
def get_students(course_id):
    result = supabase.table('students').select('id, name, email').eq('course_id', course_id).execute()
    return jsonify(result.data), 200


@students.route('/api/courses/<course_id>/students/summary', methods=['GET'])
@optional_auth
def get_students_summary(course_id):
    """Return students with mastery distributions computed server-side (2 queries total)."""
    limit = request.args.get('limit', 30, type=int)

    students_data = supabase.table('students').select('id, name').eq('course_id', course_id).limit(limit).execute().data
    if not students_data:
        return jsonify([]), 200

    student_ids = [s['id'] for s in students_data]

    # Fetch all mastery records for these students in one query (max ~30*33 = 990 rows)
    all_mastery = supabase.table('student_mastery').select('student_id, confidence').in_('student_id', student_ids).execute().data

    by_student = {}
    for m in all_mastery:
        by_student.setdefault(m['student_id'], []).append(m['confidence'])

    result = []
    for s in students_data:
        confidences = by_student.get(s['id'], [])
        dist = {'green': 0, 'yellow': 0, 'red': 0, 'gray': 0}
        for conf in confidences:
            dist[confidence_to_color(conf)] += 1
        result.append({
            'id': s['id'],
            'name': s['name'],
            'masteryDistribution': dist,
        })

    return jsonify(result), 200


@students.route('/api/courses/<course_id>/students', methods=['POST'])
@optional_auth
def create_student(course_id):
    data = request.json

    # Create student
    student = supabase.table('students').insert({
        'name': data['name'],
        'email': data.get('email'),
        'course_id': course_id
    }).execute().data[0]

    # Create mastery rows for all concepts
    concepts = supabase.table('concept_nodes').select('id').eq('course_id', course_id).execute().data

    mastery_rows = [{
        'student_id': student['id'],
        'concept_id': concept['id'],
        'confidence': 0.0
    } for concept in concepts]

    if mastery_rows:
        supabase.table('student_mastery').insert(mastery_rows).execute()

    return jsonify(student), 201


@students.route('/api/students/<student_id>/mastery', methods=['GET'])
@optional_auth
def get_mastery(student_id):
    result = supabase.table('student_mastery').select('concept_id, confidence, attempts').eq('student_id',
                                                                                             student_id).execute()

    mastery = result.data
    for m in mastery:
        m['color'] = confidence_to_color(m['confidence'])

    return jsonify(mastery), 200


@students.route('/api/students/<student_id>/mastery/<concept_id>', methods=['PUT'])
@optional_auth
def update_mastery(student_id, concept_id):
    data = request.json

    # Get current mastery
    current = supabase.table('student_mastery').select('confidence').eq('student_id', student_id).eq('concept_id',
                                                                                                     concept_id).execute().data

    if not current:
        return jsonify({'error': 'Mastery record not found'}), 404

    old_confidence = current[0]['confidence']
    old_color = confidence_to_color(old_confidence)

    # Calculate new confidence
    if 'confidence' in data:
        new_confidence = max(0.0, min(1.0, data['confidence']))
    elif 'eval_result' in data:
        if data['eval_result'] == 'correct':
            new_confidence = max(old_confidence, 0.85)
        elif data['eval_result'] == 'partial':
            new_confidence = max(old_confidence, 0.50)
        else:  # wrong
            new_confidence = 0.20 if old_confidence == 0.0 else min(old_confidence, 0.20)
    elif 'delta' in data:
        new_confidence = max(0.0, min(1.0, old_confidence + data['delta']))
    else:
        return jsonify({'error': 'Must provide confidence, eval_result, or delta'}), 400

    new_color = confidence_to_color(new_confidence)

    # Update
    supabase.table('student_mastery').update({
        'confidence': new_confidence,
        'attempts': supabase.table('student_mastery').select('attempts').eq('student_id', student_id).eq('concept_id',
                                                                                                         concept_id).execute().data[
                        0]['attempts'] + (1 if 'eval_result' in data else 0)
    }).eq('student_id', student_id).eq('concept_id', concept_id).execute()

    return jsonify({
        'concept_id': concept_id,
        'old_color': old_color,
        'new_color': new_color,
        'confidence': new_confidence
    }), 200


@students.route('/api/mastery/attendance-boost', methods=['POST'])
@optional_auth
def attendance_boost():
    data = request.json
    student_ids = data['student_ids']
    concept_ids = data['concept_ids']

    updated = 0
    for student_id in student_ids:
        for concept_id in concept_ids:
            # Get current confidence
            current = supabase.table('student_mastery').select('confidence').eq(
                'student_id', student_id
            ).eq('concept_id', concept_id).execute().data

            if current:
                old_conf = current[0]['confidence']
                # Add 0.05, but cap at 0.3 for passive boosts
                new_conf = min(old_conf + 0.05, 0.3) if old_conf < 0.3 else old_conf

                if new_conf != old_conf:
                    supabase.table('student_mastery').update({
                        'confidence': new_conf
                    }).eq('student_id', student_id).eq('concept_id', concept_id).execute()
                    updated += 1

    return jsonify({'updated': updated}), 200