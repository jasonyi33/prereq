from flask import request, jsonify, Blueprint
from supabase import create_client, Client
import os
from werkzeug.utils import secure_filename
import hashlib
import tempfile
import requests

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


@create.route('/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Generate hash for caching
    file_hash = get_file_hash(file)

    # Check cache in Supabase
    cached = supabase.table('pdf_cache').select('*').eq('file_hash', file_hash).execute()

    if cached.data:
        return jsonify({
            'cached': True,
            'result': cached.data[0]['result']
        }), 200

    # Upload to Supabase Storage
    filename = secure_filename(file.filename)
    storage_path = f"{file_hash}/{filename}"

    file.seek(0)
    supabase.storage.from_(BUCKET_NAME).upload(
        storage_path,
        file.read(),
        file_options={"content-type": "application/pdf"}
    )

    # Get public URL
    file_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)

    response = requests.get(file_url)
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    # TODO: Implement
    # result = func(tmp_path)

    os.remove(tmp_path)  # Clean up

    # Cache result in database
    supabase.table('pdf_cache').insert({
        'file_hash': file_hash,
        'filename': filename,
        'storage_path': storage_path,
        'result': result
    }).execute()

    return jsonify({
        'cached': False,
        'result': result,
        'storage_path': storage_path
    }), 200
