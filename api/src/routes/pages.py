from flask import Blueprint, request, jsonify
from ..db import supabase
from ..services.generate_content import generate_learning_page, generate_practice_quiz
from datetime import datetime

pages = Blueprint('pages', __name__)


@pages.route('/api/debug/test-claude', methods=['GET'])
def test_claude():
    """Debug endpoint to test Claude directly"""
    import anthropic
    import os

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=100,
        messages=[{"role": "user", "content": "Return only JSON: {\"test\": \"hello\"}"}]
    )

    return jsonify({
        "raw_response": message.content[0].text,
        "response_length": len(message.content[0].text),
        "api_key_set": bool(os.getenv("ANTHROPIC_API_KEY"))
    }), 200


@pages.route('/api/students/<student_id>/pages/generate', methods=['POST'])
@pages.route('/api/students/<student_id>/pages/generate', methods=['POST'])
def generate_page(student_id):
    """Generate personalized learning page based on mastery & past mistakes"""
    data = request.json
    concept_id = data.get('concept_id')

    if not concept_id:
        return jsonify({'error': 'concept_id required'}), 400

    # Get concept details
    concept_resp = supabase.table('concept_nodes').select('*').eq('id', concept_id).single().execute()
    if not concept_resp.data:
        return jsonify({'error': 'Concept not found'}), 404

    concept = concept_resp.data  # FIX: Extract data here

    # Get student's current mastery
    try:
        mastery_resp = supabase.table('student_mastery').select('confidence').eq('student_id', student_id).eq(
            'concept_id', concept_id).single().execute()
        current_confidence = mastery_resp.data['confidence'] if mastery_resp.data else 0.0
    except:
        current_confidence = 0.0

    # Get past quiz mistakes
    past_mistakes = []
    responses_resp = supabase.table('quiz_responses').select('quiz_questions(question_text, explanation)').eq(
        'is_correct', False).execute()

    if responses_resp.data:
        past_mistakes = [r['quiz_questions']['explanation'] for r in responses_resp.data if r.get('quiz_questions')]

    # Generate page using Claude
    result = generate_learning_page(
        concept['label'],  # FIX: Use concept directly
        concept.get('description', ''),
        past_mistakes,
        current_confidence
    )

    # Save to database
    page_resp = supabase.table('learning_pages').insert({
        'student_id': student_id,
        'concept_id': concept_id,
        'title': result['title'],
        'content': result['content']
    }).execute()

    return jsonify(page_resp.data[0]), 201


@pages.route('/api/pages/<page_id>', methods=['GET'])
def get_page(page_id):
    """Get learning page by ID"""
    page = supabase.table('learning_pages').select('*').eq('id', page_id).single().execute()

    if not page.data:
        return jsonify({'error': 'Page not found'}), 404

    return jsonify(page.data), 200


@pages.route('/api/students/<student_id>/pages', methods=['GET'])
def list_student_pages(student_id):
    """List all pages for a student"""
    pages_data = supabase.table('learning_pages').select('*, concept_nodes(label)').eq('student_id', student_id).order(
        'created_at', desc=True).execute()

    return jsonify(pages_data.data), 200


@pages.route('/api/pages/<page_id>', methods=['DELETE'])
def delete_page(page_id):
    """Delete learning page"""
    supabase.table('learning_pages').delete().eq('id', page_id).execute()
    return jsonify({'success': True}), 200


# ==================== PRACTICE QUIZZES ====================

@pages.route('/api/pages/<page_id>/quiz/generate', methods=['POST'])
@pages.route('/api/pages/<page_id>/quiz/generate', methods=['POST'])
def generate_quiz(page_id):
    """Generate practice quiz for a learning page"""
    # Get page details
    page_resp = supabase.table('learning_pages').select('*, concept_nodes(label, description)').eq('id',
                                                                                                   page_id).single().execute()

    if not page_resp.data:
        return jsonify({'error': 'Page not found'}), 404

    page = page_resp.data  # FIX: Extract data here

    student_id = page['student_id']
    concept_id = page['concept_id']

    # Get student mastery
    mastery_resp = supabase.table('student_mastery').select('confidence').eq('student_id', student_id).eq('concept_id',
                                                                                                          concept_id).single().execute()
    current_confidence = mastery_resp.data['confidence'] if mastery_resp.data else 0.0

    # Get past mistakes
    past_mistakes = []
    responses_resp = supabase.table('quiz_responses').select('quiz_questions(question_text, explanation)').eq(
        'is_correct', False).execute()

    if responses_resp.data:
        past_mistakes = [r['quiz_questions']['explanation'] for r in responses_resp.data if r.get('quiz_questions')]

    # Generate quiz using Claude
    result = generate_practice_quiz(
        page['concept_nodes']['label'],  # FIX: Use page directly
        page['concept_nodes'].get('description', ''),
        past_mistakes,
        current_confidence
    )

    # Create quiz
    quiz_resp = supabase.table('practice_quizzes').insert({
        'page_id': page_id,
        'student_id': student_id,
        'concept_id': concept_id,
        'status': 'pending'
    }).execute()

    quiz_id = quiz_resp.data[0]['id']

    # Insert questions
    for idx, q in enumerate(result['questions']):
        supabase.table('quiz_questions').insert({
            'quiz_id': quiz_id,
            'question_text': q['question_text'],
            'options': q['options'],
            'correct_answer': q['correct_answer'],
            'explanation': q['explanation'],
            'question_order': idx + 1
        }).execute()

    # Return quiz with questions
    full_quiz_resp = supabase.table('practice_quizzes').select('*, quiz_questions(*)').eq('id',
                                                                                          quiz_id).single().execute()

    return jsonify(full_quiz_resp.data), 201


@pages.route('/api/quizzes/<quiz_id>', methods=['GET'])
def get_quiz(quiz_id):
    """Get quiz with questions (but not correct answers if pending)"""
    quiz = supabase.table('practice_quizzes').select('*, quiz_questions(*)').eq('id', quiz_id).single().execute()

    if not quiz.data:
        return jsonify({'error': 'Quiz not found'}), 404

    # If quiz is pending, hide correct answers
    if quiz.data['status'] == 'pending':
        for q in quiz.data['quiz_questions']:
            q.pop('correct_answer', None)
            q.pop('explanation', None)

    return jsonify(quiz.data), 200


@pages.route('/api/quizzes/<quiz_id>/submit', methods=['POST'])
def submit_quiz(quiz_id):
    """Submit quiz answers and calculate score"""
    data = request.json
    answers = data.get('answers', {})  # {question_id: "A", ...}

    # Get quiz
    quiz = supabase.table('practice_quizzes').select('*, quiz_questions(*)').eq('id', quiz_id).single().execute()

    if not quiz.data:
        return jsonify({'error': 'Quiz not found'}), 404

    if quiz.data['status'] == 'completed':
        return jsonify({'error': 'Quiz already completed'}), 400

    # Grade answers
    correct_count = 0
    total_questions = len(quiz.data['quiz_questions'])

    for question in quiz.data['quiz_questions']:
        question_id = question['id']
        selected = answers.get(question_id, '')
        is_correct = selected == question['correct_answer']

        if is_correct:
            correct_count += 1

        # Save response
        supabase.table('quiz_responses').insert({
            'quiz_id': quiz_id,
            'question_id': question_id,
            'selected_answer': selected,
            'is_correct': is_correct
        }).execute()

    # Calculate score
    score = correct_count / total_questions if total_questions > 0 else 0.0

    # Update quiz status
    supabase.table('practice_quizzes').update({
        'status': 'completed',
        'score': score,
        'completed_at': datetime.utcnow().isoformat()
    }).eq('id', quiz_id).execute()

    # Update student mastery based on score
    student_id = quiz.data['student_id']
    concept_id = quiz.data['concept_id']

    if score >= 0.8:
        new_confidence = 0.85
    elif score >= 0.6:
        new_confidence = 0.60
    else:
        new_confidence = 0.30

    # Get current confidence
    mastery = supabase.table('student_mastery').select('confidence').eq('student_id', student_id).eq('concept_id',
                                                                                                     concept_id).single().execute()
    current = mastery.data['confidence'] if mastery.data else 0.0

    # Only update if new score is better
    if new_confidence > current:
        supabase.table('student_mastery').update({
            'confidence': new_confidence,
            'attempts':
                supabase.table('student_mastery').select('attempts').eq('student_id', student_id).eq('concept_id',
                                                                                                     concept_id).single().execute().data[
                    'attempts'] + 1
        }).eq('student_id', student_id).eq('concept_id', concept_id).execute()

    # Return results with correct answers
    return jsonify({
        'score': score,
        'correct': correct_count,
        'total': total_questions,
        'questions': quiz.data['quiz_questions']
    }), 200


@pages.route('/api/students/<student_id>/quizzes', methods=['GET'])
def list_student_quizzes(student_id):
    """List all quizzes for a student"""
    quizzes = supabase.table('practice_quizzes').select('*, concept_nodes(label)').eq('student_id', student_id).order(
        'created_at', desc=True).execute()

    return jsonify(quizzes.data), 200


@pages.route('/api/quizzes/<quiz_id>', methods=['DELETE'])
def delete_quiz(quiz_id):
    """Delete quiz (cascades to questions and responses)"""
    supabase.table('practice_quizzes').delete().eq('id', quiz_id).execute()
    return jsonify({'success': True}), 200
