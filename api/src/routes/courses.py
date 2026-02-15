from flask import request, jsonify, Blueprint, g
from supabase import create_client, Client
import os
import string
import random
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import hashlib
import threading

from ..db import supabase

from ..services.create_kg import create_kg, parse_kg, calculate_importance
from ..middleware.auth import optional_auth, require_auth
from ..cache import cache_delete_pattern

load_dotenv()
courses = Blueprint("courses", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def _generate_join_code(length=6):
    """Generate a random alphanumeric join code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def get_file_hash(file):
    file.seek(0)
    file_hash = hashlib.md5(file.read()).hexdigest()
    file.seek(0)
    return file_hash


@courses.route('/api/courses', methods=['POST'])
@optional_auth
def create_course():
    data = request.json
    row = {
        'name': data['name'],
        'description': data.get('description'),
    }

    # If authenticated teacher, set teacher_id and generate join code
    if g.user:
        teacher = supabase.table('teachers').select('id').eq('auth_id', g.user['sub']).execute().data
        if teacher:
            row['teacher_id'] = teacher[0]['id']
            row['join_code'] = _generate_join_code()

    result = supabase.table('courses').insert(row).execute()
    return jsonify(result.data[0]), 201


@courses.route('/api/courses', methods=['GET'])
@optional_auth
def get_courses():
    if g.user:
        # Teacher: filter to their courses
        teacher = supabase.table('teachers').select('id').eq('auth_id', g.user['sub']).execute().data
        if teacher:
            result = supabase.table('courses').select('*').eq('teacher_id', teacher[0]['id']).execute()
            if result.data:
                return jsonify(result.data), 200
            # Teacher has no courses — fall through to return all (picks up seeded courses)

        # Student: filter to enrolled courses
        students = supabase.table('students').select('course_id').eq('auth_id', g.user['sub']).execute().data
        if students:
            course_ids = [s['course_id'] for s in students]
            result = supabase.table('courses').select('*').in_('id', course_ids).execute()
            return jsonify(result.data), 200

    # No auth or no profile: return all (backward compat)
    result = supabase.table('courses').select('*').execute()
    return jsonify(result.data), 200


@courses.route('/api/courses/<course_id>', methods=['GET'])
@optional_auth
def get_course(course_id):
    result = supabase.table('courses').select('*').eq('id', course_id).execute()

    if not result.data:
        return jsonify({'error': 'Course not found'}), 404

    return jsonify(result.data[0]), 200


@courses.route('/api/courses/enroll', methods=['POST'])
@require_auth
def enroll_student():
    """Enroll an authenticated student in a course via join code."""
    data = request.json
    join_code = data.get('join_code', '').strip().upper()

    if not join_code:
        return jsonify({'error': 'join_code is required'}), 400

    # Look up course by join code
    course = supabase.table('courses').select('id, name').eq('join_code', join_code).execute().data
    if not course:
        return jsonify({'error': 'Invalid join code'}), 404

    course_row = course[0]
    auth_id = g.user['sub']
    email = g.user.get('email', '')
    name = g.user.get('user_metadata', {}).get('name', email.split('@')[0])

    # Check if already enrolled
    existing = supabase.table('students').select('id').eq('auth_id', auth_id).eq(
        'course_id', course_row['id']
    ).execute().data
    if existing:
        return jsonify({
            'student_id': existing[0]['id'],
            'course_id': course_row['id'],
            'course_name': course_row['name'],
        }), 200

    # Create student row
    student = supabase.table('students').insert({
        'name': name,
        'email': email,
        'course_id': course_row['id'],
        'auth_id': auth_id,
    }).execute().data[0]

    # Bulk-insert mastery rows for all concepts in the course
    concepts = supabase.table('concept_nodes').select('id').eq('course_id', course_row['id']).execute().data
    mastery_rows = [{
        'student_id': student['id'],
        'concept_id': c['id'],
        'confidence': 0.0,
    } for c in concepts]
    if mastery_rows:
        supabase.table('student_mastery').insert(mastery_rows).execute()

    return jsonify({
        'student_id': student['id'],
        'course_id': course_row['id'],
        'course_name': course_row['name'],
    }), 201


@courses.route('/api/courses/<course_id>/upload', methods=['POST'])
@optional_auth
def upload_course_pdf(course_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Check cache
    file_hash = get_file_hash(file)
    cached = supabase.table('pdf_cache').select('result').eq('file_hash', file_hash).execute()

    if cached.data:
        graph_data = cached.data[0]['result']
    else:
        # Process PDF
        filename = secure_filename(file.filename)
        temp_path = f"/tmp/{file_hash}_{filename}"
        file.save(temp_path)

        try:
            kg_markdown = create_kg(temp_path)
            graph = parse_kg(kg_markdown)
            importance = calculate_importance(graph)
        except Exception as e:
            # Clean up temp file and return the actual error
            if os.path.exists(temp_path):
                os.remove(temp_path)
            print(f"[upload] PDF processing failed: {e}")
            return jsonify({'error': f'PDF processing failed: {str(e)}'}), 500

        os.remove(temp_path)

        graph_data = {'graph': graph, 'importance': importance}

        # Cache result
        supabase.table('pdf_cache').insert({
            'file_hash': file_hash,
            'filename': filename,
            'result': graph_data
        }).execute()

    demo_mode = request.args.get('demo') == 'true'

    # Demo mode: just return the graph data without touching DB (preserves seeded data)
    if demo_mode:
        return jsonify(graph_data), 200

    # --- Non-demo: persist to DB ---

    # Update course
    supabase.table('courses').update({
        'pdf_cache_hash': file_hash
    }).eq('id', course_id).execute()

    # Clear old concepts before inserting (replace, not append)
    supabase.table('concept_edges').delete().eq('course_id', course_id).execute()
    # Delete mastery rows for old concepts
    old_concepts = supabase.table('concept_nodes').select('id').eq('course_id', course_id).execute().data
    if old_concepts:
        old_ids = [c['id'] for c in old_concepts]
        for i in range(0, len(old_ids), 100):
            batch = old_ids[i:i+100]
            supabase.table('student_mastery').delete().in_('concept_id', batch).execute()
    supabase.table('concept_nodes').delete().eq('course_id', course_id).execute()

    # Insert nodes
    node_id_map = {}
    for label, description in graph_data['graph']['nodes'].items():
        result = supabase.table('concept_nodes').insert({
            'course_id': course_id,
            'label': label,
            'description': description,
        }).execute()
        node_id_map[label] = result.data[0]['id']

    # Insert edges
    for source_label, target_label in graph_data['graph']['edges']:
        if source_label in node_id_map and target_label in node_id_map:
            supabase.table('concept_edges').insert({
                'course_id': course_id,
                'source_id': node_id_map[source_label],
                'target_id': node_id_map[target_label]
            }).execute()

    # Re-create eager mastery rows for all students in this course
    students = supabase.table('students').select('id').eq('course_id', course_id).execute().data
    if students and node_id_map:
        mastery_rows = [
            {'student_id': s['id'], 'concept_id': cid, 'confidence': 0.0}
            for s in students for cid in node_id_map.values()
        ]
        for i in range(0, len(mastery_rows), 500):
            supabase.table('student_mastery').insert(mastery_rows[i:i+500]).execute()

    # Invalidate graph cache for this course
    cache_delete_pattern(f"graph:{course_id}:*")

    # Trigger async content generation for all concepts
    def generate_content_async():
        """Background thread to generate learning content"""
        from ..services.generate_content import generate_learning_page, generate_practice_quiz, get_further_reading
        import sys

        print(f"[async] Starting content generation for course {course_id}", file=sys.stderr, flush=True)

        concepts_result = supabase.table('concept_nodes').select('id, label, description').eq('course_id', course_id).execute()

        for concept in concepts_result.data:
            concept_id = concept['id']
            label = concept['label']
            description = concept.get('description', '')

            try:
                # Generate learning page
                page_result = generate_learning_page(
                    concept_label=label,
                    concept_description=description,
                    past_mistakes=[],
                    current_confidence=0.5
                )

                further_reading = get_further_reading(label, description)

                # Insert learning page
                supabase.table('learning_pages').insert({
                    'student_id': None,
                    'concept_id': concept_id,
                    'title': page_result['title'],
                    'content': page_result['content'],
                    'further_reading': further_reading
                }).execute()

                # Generate quiz
                quiz_result = generate_practice_quiz(
                    concept_label=label,
                    concept_description=description,
                    past_mistakes=[],
                    current_confidence=0.5
                )

                # Create quiz
                quiz_resp = supabase.table('practice_quizzes').insert({
                    'student_id': None,
                    'concept_id': concept_id,
                    'page_id': None,
                    'status': 'template'
                }).execute()

                quiz_id = quiz_resp.data[0]['id']

                # Insert questions
                for q_idx, q in enumerate(quiz_result['questions']):
                    supabase.table('quiz_questions').insert({
                        'quiz_id': quiz_id,
                        'question_text': q['question_text'],
                        'options': q['options'],
                        'correct_answer': q['correct_answer'],
                        'explanation': q['explanation'],
                        'question_order': q_idx + 1
                    }).execute()

                print(f"[async] ✓ Generated content for {label}", file=sys.stderr, flush=True)

            except Exception as e:
                print(f"[async] ✗ Failed for {label}: {str(e)}", file=sys.stderr, flush=True)

        print(f"[async] Content generation complete for course {course_id}", file=sys.stderr, flush=True)

    # Start background thread
    thread = threading.Thread(target=generate_content_async, daemon=True)
    thread.start()
    print(f"[upload] Started async content generation for {len(node_id_map)} concepts", flush=True)

    return jsonify(graph_data), 200
