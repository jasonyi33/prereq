from flask import request, jsonify, Blueprint
from supabase import create_client, Client
import os
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import hashlib

from ...db import supabase

from ..services.create_kg import create_kg, parse_kg, calculate_importance

load_dotenv()
courses = Blueprint("courses", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_file_hash(file):
    file.seek(0)
    file_hash = hashlib.md5(file.read()).hexdigest()
    file.seek(0)
    return file_hash


@courses.route('/api/courses', methods=['POST'])
def create_course():
    data = request.json
    result = supabase.table('courses').insert({
        'name': data['name'],
        'description': data.get('description'),
    }).execute()

    return jsonify(result.data[0]), 201


@courses.route('/api/courses', methods=['GET'])
def get_courses():
    result = supabase.table('courses').select('*').execute()
    return jsonify(result.data), 200


@courses.route('/api/courses/<course_id>', methods=['GET'])
def get_course(course_id):
    result = supabase.table('courses').select('*').eq('id', course_id).execute()

    if not result.data:
        return jsonify({'error': 'Course not found'}), 404

    return jsonify(result.data[0]), 200


@courses.route('/api/courses/<course_id>/upload', methods=['POST'])
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

        kg_markdown = create_kg(temp_path)
        graph = parse_kg(kg_markdown)
        importance = calculate_importance(graph)

        os.remove(temp_path)

        graph_data = {'graph': graph, 'importance': importance}

        # Cache result
        supabase.table('pdf_cache').insert({
            'file_hash': file_hash,
            'filename': filename,
            'result': graph_data
        }).execute()

    # Update course
    supabase.table('courses').update({
        'pdf_cache_hash': file_hash
    }).eq('id', course_id).execute()

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

    return jsonify(graph_data), 200


@courses.route('/api/courses/<course_id>/graph', methods=['GET'])
def get_graph(course_id):
    student_id = request.args.get('student_id')

    # Get nodes
    nodes_query = supabase.table('concept_nodes').select('*').eq('course_id', course_id)
    nodes = nodes_query.execute().data

    # Get mastery if student provided
    if student_id:
        mastery = supabase.table('student_mastery').select('concept_id, confidence').eq('student_id',
                                                                                        student_id).execute().data
        mastery_map = {m['concept_id']: m['confidence'] for m in mastery}

        for node in nodes:
            confidence = mastery_map.get(node['id'], 0.0)
            node['confidence'] = confidence
            node['color'] = confidence_to_color(confidence)

    # Get edges
    edges = supabase.table('concept_edges').select('*').eq('course_id', course_id).execute().data

    return jsonify({'nodes': nodes, 'edges': edges}), 200


def confidence_to_color(confidence):
    if confidence == 0.0:
        return "gray"
    elif confidence < 0.4:
        return "red"
    elif confidence < 0.7:
        return "yellow"
    else:
        return "green"