from dotenv import load_dotenv
from flask import request, jsonify, Blueprint
from ..db import supabase
from ..middleware.auth import optional_auth

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
    # Get all concepts for the course
    concepts = supabase.table('concept_nodes').select('id, label, category').eq('course_id', course_id).execute().data

    # Get all students in the course
    students = supabase.table('students').select('id').eq('course_id', course_id).execute().data
    total_students = len(students)

    heatmap_data = []

    for concept in concepts:
        concept_id = concept['id']

        # Get all mastery records for this concept
        mastery_records = supabase.table('student_mastery').select('confidence').eq(
            'concept_id', concept_id
        ).execute().data

        # Count colors
        distribution = {"green": 0, "yellow": 0, "red": 0, "gray": 0}
        total_confidence = 0

        for record in mastery_records:
            confidence = record['confidence']
            color = confidence_to_color(confidence)
            distribution[color] += 1
            total_confidence += confidence

        # Calculate average
        avg_confidence = total_confidence / len(mastery_records) if mastery_records else 0.0

        heatmap_data.append({
            "id": concept_id,
            "label": concept['label'],
            "category": concept.get('category', ''),
            "distribution": distribution,
            "avg_confidence": round(avg_confidence, 2)
        })

    return jsonify({
        "concepts": heatmap_data,
        "total_students": total_students
    }), 200