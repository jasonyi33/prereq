from dotenv import load_dotenv
from flask import request, jsonify, Blueprint
from ..db import supabase
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set

load_dotenv()
heatmap = Blueprint("heatmap", __name__)


def confidence_to_color(confidence):
    if confidence == 0.0:
        return "gray"
    elif confidence < 0.4:
        return "red"
    elif confidence < 0.7:
        return "yellow"
    else:
        return "green"


@heatmap.route('/api/courses/<course_id>/heatmap', methods=['GET'])
@optional_auth
def get_heatmap(course_id):
    # Check Redis cache
    cache_key = f"heatmap:{course_id}"
    hit = cache_get(cache_key)
    if hit is not None:
        return jsonify(hit), 200

    # Get all concepts for the course
    concepts = supabase.table('concept_nodes').select('id, label, category').eq('course_id', course_id).execute().data

    # Get all students in the course
    students = supabase.table('students').select('id').eq('course_id', course_id).execute().data
    total_students = len(students)

    if not concepts:
        return jsonify({"concepts": [], "total_students": total_students}), 200

    # Batch: fetch ALL mastery records for all concepts in one query
    concept_ids = [c['id'] for c in concepts]
    all_mastery = supabase.table('student_mastery').select('concept_id, confidence').in_(
        'concept_id', concept_ids
    ).limit(5000).execute().data

    # Group mastery records by concept_id in Python
    mastery_by_concept = {}
    for record in all_mastery:
        cid = record['concept_id']
        mastery_by_concept.setdefault(cid, []).append(record['confidence'])

    heatmap_data = []
    for concept in concepts:
        concept_id = concept['id']
        confidences = mastery_by_concept.get(concept_id, [])

        # Count colors
        distribution = {"green": 0, "yellow": 0, "red": 0, "gray": 0}
        total_confidence = 0
        for conf in confidences:
            distribution[confidence_to_color(conf)] += 1
            total_confidence += conf

        avg_confidence = total_confidence / len(confidences) if confidences else 0.0

        heatmap_data.append({
            "id": concept_id,
            "label": concept['label'],
            "category": concept.get('category', ''),
            "distribution": distribution,
            "avg_confidence": round(avg_confidence, 2)
        })

    result = {
        "concepts": heatmap_data,
        "total_students": total_students
    }
    cache_set(cache_key, result, ttl_seconds=5)
    return jsonify(result), 200