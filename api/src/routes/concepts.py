from flask import request, jsonify, Blueprint
import os
from dotenv import load_dotenv
from anthropic import Anthropic

from ..db import supabase
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set

load_dotenv()
concepts = Blueprint("concepts", __name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


@concepts.route('/api/concepts/<concept_id>', methods=['GET'])
@optional_auth
def get_concept(concept_id):
    result = supabase.table('concept_nodes').select('id, label, description').eq('id', concept_id).execute()
    if not result.data:
        return jsonify({'error': 'Concept not found'}), 404
    return jsonify(result.data[0]), 200


@concepts.route('/api/concepts', methods=['GET'])
@optional_auth
def get_concepts():
    ids_param = request.args.get('ids', '')
    if not ids_param:
        return jsonify([]), 200

    ids = [cid.strip() for cid in ids_param.split(',') if cid.strip()]
    if not ids:
        return jsonify([]), 200

    result = supabase.table('concept_nodes').select('id, label, description').in_('id', ids).execute()
    return jsonify(result.data), 200


@concepts.route('/api/concepts/<concept_id>/learning-page', methods=['GET'])
@optional_auth
def get_learning_page(concept_id):
    """Get precomputed learning page for a concept from database."""
    # Get concept details
    concept_result = supabase.table('concept_nodes').select('label').eq('id', concept_id).execute()
    if not concept_result.data:
        return jsonify({'error': 'Concept not found'}), 404

    concept = concept_result.data[0]

    # Get learning page content from database
    page_result = supabase.table('concept_learning_pages').select('content').eq('concept_id', concept_id).execute()

    if not page_result.data:
        return jsonify({
            'concept_label': concept['label'],
            'content': '## Coming Soon\n\nLearning content for this concept is being prepared. Check back soon!'
        }), 200

    return jsonify({
        'concept_label': concept['label'],
        'content': page_result.data[0]['content']
    }), 200


@concepts.route('/api/concepts/<concept_id>/quiz', methods=['GET'])
@optional_auth
def get_quiz(concept_id):
    """Get precomputed quiz questions for a concept from database."""
    # Get concept details
    concept_result = supabase.table('concept_nodes').select('label').eq('id', concept_id).execute()
    if not concept_result.data:
        return jsonify({'error': 'Concept not found'}), 404

    concept = concept_result.data[0]

    # Get quiz questions from database
    questions_result = supabase.table('concept_quiz_questions').select('*').eq('concept_id', concept_id).order('question_order').execute()

    if not questions_result.data:
        return jsonify({
            'concept_label': concept['label'],
            'questions': []
        }), 200

    # Format questions for frontend
    questions = []
    for q in questions_result.data:
        questions.append({
            'question': q['question'],
            'options': [
                f"A) {q['option_a']}",
                f"B) {q['option_b']}",
                f"C) {q['option_c']}",
                f"D) {q['option_d']}"
            ],
            'correct_answer': q['correct_answer'],
            'explanation': q['explanation']
        })

    return jsonify({
        'concept_label': concept['label'],
        'questions': questions
    }), 200


@concepts.route('/api/concepts/<concept_id>/quiz-submit', methods=['POST'])
@optional_auth
def submit_quiz(concept_id):
    """Submit quiz answers and update student confidence."""
    data = request.json
    student_id = data.get('studentId')
    answers = data.get('answers', [])  # List of selected answer indices
    total_questions = data.get('totalQuestions', 5)

    if not student_id:
        return jsonify({'error': 'Student ID required'}), 400

    # Calculate score
    correct_count = data.get('correctCount', 0)
    score_percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0

    # Calculate confidence boost based on score
    # 100% = +0.15, 80% = +0.10, 60% = +0.05, 40% = +0.02, 20% = 0
    if score_percentage >= 80:
        confidence_delta = 0.15
    elif score_percentage >= 60:
        confidence_delta = 0.10
    elif score_percentage >= 40:
        confidence_delta = 0.05
    else:
        confidence_delta = 0.02

    # Update student mastery
    try:
        # Get current confidence
        current = supabase.table('student_mastery').select('confidence').eq(
            'student_id', student_id
        ).eq('concept_id', concept_id).execute()

        if not current.data:
            return jsonify({'error': 'Mastery record not found'}), 404

        old_confidence = current.data[0]['confidence']
        new_confidence = min(1.0, old_confidence + confidence_delta)

        # Update confidence
        supabase.table('student_mastery').update({
            'confidence': new_confidence,
            'last_updated': 'NOW()'
        }).eq('student_id', student_id).eq('concept_id', concept_id).execute()

        # Compute colors
        def confidence_to_color(conf):
            if conf == 0.0:
                return "gray"
            elif conf < 0.4:
                return "red"
            elif conf < 0.7:
                return "yellow"
            else:
                return "green"

        return jsonify({
            'score': correct_count,
            'total': total_questions,
            'percentage': score_percentage,
            'confidence_boost': confidence_delta,
            'old_confidence': old_confidence,
            'new_confidence': new_confidence,
            'old_color': confidence_to_color(old_confidence),
            'new_color': confidence_to_color(new_confidence)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
