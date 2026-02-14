from flask import request, jsonify, Blueprint
from ..db import supabase

transcripts = Blueprint("transcripts", __name__)


@transcripts.route('/api/lectures/<lecture_id>/transcripts', methods=['POST'])
def create_transcript(lecture_id):
    data = request.json

    # Insert transcript chunk
    chunk = supabase.table('transcript_chunks').insert({
        'lecture_id': lecture_id,
        'text': data['text'],
        'timestamp_sec': data.get('timestamp_sec'),
        'speaker_name': data.get('speaker_name')
    }).execute().data[0]

    # Link detected concepts if provided
    if 'concept_ids' in data:
        links = [{
            'transcript_chunk_id': chunk['id'],
            'concept_id': concept_id
        } for concept_id in data['concept_ids']]

        if links:
            supabase.table('transcript_concepts').insert(links).execute()

    return jsonify(chunk), 201


@transcripts.route('/api/lectures/<lecture_id>/transcripts', methods=['GET'])
def get_transcripts(lecture_id):
    result = supabase.table('transcript_chunks').select('*').eq('lecture_id', lecture_id).order(
        'timestamp_sec').execute()
    return jsonify(result.data), 200


@transcripts.route('/api/transcripts/<chunk_id>/concepts', methods=['GET'])
def get_transcript_concepts(chunk_id):
    result = supabase.table('transcript_concepts').select('concept_id').eq('transcript_chunk_id', chunk_id).execute()
    concept_ids = [r['concept_id'] for r in result.data]

    if concept_ids:
        concepts = supabase.table('concept_nodes').select('id, label').in_('id', concept_ids).execute()
        return jsonify(concepts.data), 200

    return jsonify([]), 200