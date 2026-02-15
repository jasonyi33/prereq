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

    # Get learning page content from database (student_id is null for general content)
    page_result = supabase.table('learning_pages').select('content').eq('concept_id', concept_id).is_('student_id', 'null').execute()

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
    questions_result = supabase.table('quiz_questions').select('*').eq('concept_id', concept_id).order('question_order').execute()

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


def _generate_learning_page_content(concept_id):
    """Helper function to generate learning page content."""
    # Get concept details
    concept_result = supabase.table('concept_nodes').select('label, description, category').eq('id', concept_id).execute()
    if not concept_result.data:
        raise ValueError('Concept not found')

    concept = concept_result.data[0]

    # Generate learning page using Claude
    prompt = f"""Create a comprehensive learning page for the concept: {concept['label']}

Description: {concept.get('description', 'N/A')}
Category: {concept.get('category', 'N/A')}

Generate a well-structured markdown document that includes:
1. A clear explanation of what the concept is
2. Key points and important details
3. Mathematical formulas using LaTeX notation ($inline$ and $$display$$)
4. Practical examples or applications
5. Common pitfalls or misconceptions

Keep it concise but thorough (aim for 200-400 words). Use markdown formatting with headers (##, ###), bold, lists, and LaTeX for math.

Return ONLY the markdown content, no additional commentary."""

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text

    # Check if already exists
    existing = supabase.table('concept_learning_pages').select('id').eq('concept_id', concept_id).execute()

    if existing.data:
        # Update existing
        supabase.table('concept_learning_pages').update({
            'content': content
        }).eq('concept_id', concept_id).execute()
    else:
        # Insert new
        supabase.table('concept_learning_pages').insert({
            'concept_id': concept_id,
            'content': content
        }).execute()

    return {'concept_id': concept_id, 'concept_label': concept['label'], 'content': content}


@concepts.route('/api/concepts/<concept_id>/learning-page/generate', methods=['POST'])
@optional_auth
def generate_learning_page(concept_id):
    """Generate and store learning page content for a concept using Claude."""
    if not anthropic_client:
        return jsonify({'error': 'Anthropic API not configured'}), 500

    try:
        result = _generate_learning_page_content(concept_id)
        return jsonify({**result, 'status': 'generated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _generate_quiz_questions(concept_id):
    """Helper function to generate quiz questions."""
    import json

    # Get concept details
    concept_result = supabase.table('concept_nodes').select('label, description, category').eq('id', concept_id).execute()
    if not concept_result.data:
        raise ValueError('Concept not found')

    concept = concept_result.data[0]

    # Generate quiz questions using Claude
    prompt = f"""Create 5 multiple choice quiz questions for the concept: {concept['label']}

Description: {concept.get('description', 'N/A')}
Category: {concept.get('category', 'N/A')}

Generate 5 questions that test understanding of this concept. Each question should:
- Have 4 options (A, B, C, D)
- Have exactly one correct answer
- Include a brief explanation of why the answer is correct
- Range from basic understanding to deeper application

Return your response as a JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "option_a": "First option",
    "option_b": "Second option",
    "option_c": "Third option",
    "option_d": "Fourth option",
    "correct_answer": 0,
    "explanation": "Explanation of the correct answer"
  }}
]

Note: correct_answer is 0 for A, 1 for B, 2 for C, 3 for D.
Return ONLY the JSON array, no additional text."""

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text

    # Parse JSON response (handle markdown code blocks)
    if '```json' in content:
        content = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        content = content.split('```')[1].split('```')[0].strip()

    questions = json.loads(content)

    if not isinstance(questions, list) or len(questions) != 5:
        raise ValueError('Invalid response format from Claude')

    # Delete existing questions for this concept
    supabase.table('quiz_questions').delete().eq('concept_id', concept_id).execute()

    # Insert new questions
    for idx, q in enumerate(questions):
        supabase.table('quiz_questions').insert({
            'concept_id': concept_id,
            'question': q['question'],
            'option_a': q['option_a'],
            'option_b': q['option_b'],
            'option_c': q['option_c'],
            'option_d': q['option_d'],
            'correct_answer': q['correct_answer'],
            'explanation': q['explanation'],
            'question_order': idx
        }).execute()

    return {'concept_id': concept_id, 'concept_label': concept['label'], 'questions_generated': len(questions)}


@concepts.route('/api/concepts/<concept_id>/quiz/generate', methods=['POST'])
@optional_auth
def generate_quiz(concept_id):
    """Generate and store quiz questions for a concept using Claude."""
    if not anthropic_client:
        return jsonify({'error': 'Anthropic API not configured'}), 500

    try:
        result = _generate_quiz_questions(concept_id)
        return jsonify({**result, 'status': 'generated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@concepts.route('/api/courses/<course_id>/generate-learning-content', methods=['POST'])
@optional_auth
def generate_course_learning_content(course_id):
    """Generate learning pages and quizzes for all concepts in a course."""
    if not anthropic_client:
        return jsonify({'error': 'Anthropic API not configured'}), 500

    try:
        # Get all concepts for this course
        concepts_result = supabase.table('concept_nodes').select('id, label').eq('course_id', course_id).execute()

        if not concepts_result.data:
            return jsonify({'error': 'No concepts found for this course'}), 404

        concepts = concepts_result.data
        results = {
            'total': len(concepts),
            'generated': [],
            'failed': []
        }

        # Generate content for each concept
        for concept in concepts:
            print(f"Generating content for: {concept['label']}")
            try:
                # Generate learning page
                _generate_learning_page_content(concept['id'])

                # Generate quiz
                _generate_quiz_questions(concept['id'])

                results['generated'].append({
                    'concept_id': concept['id'],
                    'label': concept['label']
                })

            except Exception as e:
                print(f"Failed to generate content for {concept['label']}: {str(e)}")
                results['failed'].append({
                    'concept_id': concept['id'],
                    'label': concept['label'],
                    'error': str(e)
                })

        return jsonify(results), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
