from flask import request, jsonify, Blueprint
from supabase import create_client, Client
import os
from werkzeug.utils import secure_filename
import hashlib
from dotenv import load_dotenv

from ..services.create_kg import create_kg, calculate_importance, parse_kg

load_dotenv()
create = Blueprint(
    "create",
    __name__,
)
# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BUCKET_NAME = "kg-pdfs"


def get_file_hash(file):
    """Generate hash for cache lookup"""
    file.seek(0)
    file_hash = hashlib.md5(file.read()).hexdigest()
    file.seek(0)
    return file_hash


@create.route('/api/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Get course metadata from form
    course_name = request.form.get('name', file.filename)
    course_description = request.form.get('description', '')

    # Check cache
    file_hash = get_file_hash(file)
    cached = supabase.table('pdf_cache').select('result').eq('file_hash', file_hash).execute()

    if cached.data:
        result = cached.data[0]['result']
    else:
        # Process file
        filename = secure_filename(file.filename)
        temp_path = f"/tmp/{file_hash}_{filename}"
        file.save(temp_path)

        kg_markdown = create_kg(temp_path)
        graph = parse_kg(kg_markdown)
        importance = calculate_importance(graph)

        result = {'graph': graph, 'importance': importance}

        os.remove(temp_path)

        # Add to cache
        supabase.table('pdf_cache').insert({
            'file_hash': file_hash,
            'filename': filename,
            'result': result
        }).execute()

    # Create course
    course = supabase.table('courses').insert({
        'name': course_name,
        'description': course_description
    }).execute().data[0]

    course_id = course['id']

    # Insert nodes and build label->ID map
    node_id_map = {}
    for label, description in result['graph']['nodes'].items():
        node = supabase.table('concept_nodes').insert({
            'course_id': course_id,
            'label': label,
            'description': description
        }).execute().data[0]
        node_id_map[label] = node['id']

    # Insert edges
    for edge in result['graph']['edges']:
        source_label, target_label = edge[0], edge[1]
        if source_label in node_id_map and target_label in node_id_map:
            supabase.table('concept_edges').insert({
                'course_id': course_id,
                'source_id': node_id_map[source_label],
                'target_id': node_id_map[target_label]
            }).execute()

    return jsonify({
        'cached': bool(cached.data),
        'course': course,
        'graph': result['graph'],
        'importance': result['importance']
    }), 200
