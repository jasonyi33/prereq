from flask import request, jsonify, Blueprint
from supabase import create_client, Client
import os
from werkzeug.utils import secure_filename
import hashlib
import tempfile
import requests
from dotenv import load_dotenv

from ..services.create_kg import create_kg

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


@create.route('/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Check cache
    file_hash = get_file_hash(file)
    cached = supabase.table('pdf_cache').select('result').eq('file_hash', file_hash).execute()

    if cached.data:
        return jsonify({'cached': True, 'result': cached.data[0]['result']}), 200

    # Process file
    filename = secure_filename(file.filename)
    temp_path = f"/tmp/{file_hash}_{filename}"
    file.save(temp_path)

    result = create_kg(temp_path)
    os.remove(temp_path)

    # Add to cache
    supabase.table('pdf_cache').insert({
        'file_hash': file_hash,
        'filename': filename,
        'result': result
    }).execute()

    return jsonify({'cached': False, 'result': result}), 200
