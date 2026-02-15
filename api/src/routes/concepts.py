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
def generate_learning_page(concept_id):
    """Generate a comprehensive learning page for a concept using Claude."""
    cache_key = f"learning_page:{concept_id}"
    cached = cache_get(cache_key)
    if cached:
        return jsonify(cached), 200

    # Get concept details
    concept_result = supabase.table('concept_nodes').select('label, description, category').eq('id', concept_id).execute()
    if not concept_result.data:
        return jsonify({'error': 'Concept not found'}), 404

    concept = concept_result.data[0]

    # Generate learning page using Claude
    if not anthropic_client:
        return jsonify({'error': 'AI service not configured'}), 503

    try:
        prompt = f"""Generate a comprehensive learning page for the concept: **{concept['label']}**

Description: {concept.get('description', 'N/A')}
Category: {concept.get('category', 'N/A')}

Create an engaging, educational page that includes:

1. **Overview** (2-3 sentences): What is this concept and why is it important?

2. **Key Ideas** (3-4 bullet points): The core principles students must understand

3. **Intuitive Explanation**: Explain the concept in simple terms, as if teaching someone for the first time. Use analogies where helpful.

4. **Mathematical Foundation** (if applicable): Present the key formulas or mathematical relationships using LaTeX notation. Inline math: $formula$, Display math: $$formula$$

5. **Practical Example**: A concrete example showing how this concept is used, with step-by-step reasoning

6. **Common Misconceptions**: 2-3 things students often get wrong about this concept

7. **Connection to Other Topics**: How this concept relates to other areas (mention 2-3 related concepts)

Format your response in markdown with proper headings, bullet points, and LaTeX for mathematical expressions. Make it engaging and accessible."""

        message = anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        content = message.content[0].text if message.content else "Failed to generate content"

        result = {
            'concept_label': concept['label'],
            'content': content
        }

        cache_set(cache_key, result, ttl_seconds=3600)  # Cache for 1 hour
        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@concepts.route('/api/concepts/<concept_id>/quiz', methods=['GET'])
@optional_auth
def generate_quiz(concept_id):
    """Generate a 5-question quiz for a concept using Claude."""
    cache_key = f"quiz:{concept_id}"
    cached = cache_get(cache_key)
    if cached:
        return jsonify(cached), 200

    # Get concept details
    concept_result = supabase.table('concept_nodes').select('label, description, category').eq('id', concept_id).execute()
    if not concept_result.data:
        return jsonify({'error': 'Concept not found'}), 404

    concept = concept_result.data[0]

    # Generate quiz using Claude
    if not anthropic_client:
        return jsonify({'error': 'AI service not configured'}), 503

    try:
        prompt = f"""Generate a 5-question multiple choice quiz for the concept: **{concept['label']}**

Description: {concept.get('description', 'N/A')}
Category: {concept.get('category', 'N/A')}

Create 5 multiple choice questions that:
- Progress from basic understanding to application
- Test different aspects of the concept
- Have 4 options each (A, B, C, D)
- Include one clearly correct answer
- Have plausible but incorrect distractors

Return ONLY a valid JSON object (no markdown, no code blocks) in this exact format:
{{
  "questions": [
    {{
      "question": "Question text here",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correct_answer": 0,
      "explanation": "Why this is correct"
    }}
  ]
}}

The correct_answer field should be the index (0-3) of the correct option."""

        message = anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )

        content = message.content[0].text if message.content else "{}"

        # Parse JSON from response
        import json
        try:
            quiz_data = json.loads(content)
            result = {
                'concept_label': concept['label'],
                'questions': quiz_data.get('questions', [])
            }
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            result = {
                'concept_label': concept['label'],
                'questions': []
            }

        cache_set(cache_key, result, ttl_seconds=3600)  # Cache for 1 hour
        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
