from flask import request, jsonify, Blueprint

from ..db import supabase

concepts = Blueprint("concepts", __name__)


@concepts.route('/api/concepts/<concept_id>', methods=['GET'])
def get_concept(concept_id):
    result = supabase.table('concept_nodes').select('id, label, description').eq('id', concept_id).execute()
    if not result.data:
        return jsonify({'error': 'Concept not found'}), 404
    return jsonify(result.data[0]), 200


@concepts.route('/api/concepts', methods=['GET'])
def get_concepts():
    ids_param = request.args.get('ids', '')
    if not ids_param:
        return jsonify([]), 200

    ids = [cid.strip() for cid in ids_param.split(',') if cid.strip()]
    if not ids:
        return jsonify([]), 200

    result = supabase.table('concept_nodes').select('id, label, description').in_('id', ids).execute()
    return jsonify(result.data), 200
