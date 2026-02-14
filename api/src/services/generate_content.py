import anthropic
import os
import json

import anthropic
import os
import json
import sys


def generate_learning_page(concept_label: str, concept_description: str,
                           past_mistakes: list, current_confidence: float) -> dict:
    """Generate personalized learning page using Claude"""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    mistakes_context = ""
    if past_mistakes:
        mistakes_context = f"\n\nStudent's past mistakes on this topic:\n" + "\n".join(
            [f"- {m}" for m in past_mistakes[:5]]
        )

    confidence_level = "beginner" if current_confidence < 0.4 else "intermediate" if current_confidence < 0.7 else "advanced"

    prompt = f"""Create a concise learning page for the concept: {concept_label}

Concept description: {concept_description}
Student's current level: {confidence_level} (confidence: {current_confidence})
{mistakes_context}

Return ONLY valid JSON with this structure:
{{
  "title": "Clear, engaging title",
  "content": "Well-structured markdown content (300-500 words). Include:\\n- Core definition\\n- Key intuition\\n- 2-3 concrete examples\\n- Common pitfalls (especially addressing past mistakes if provided)\\n- Visual analogies where helpful"
}}

Requirements:
- Use markdown formatting (headers, lists, code blocks)
- Adjust complexity to student's level
- Address specific past mistakes if provided
- Be concise but thorough
- No fluff or excessive motivation
- Return ONLY valid JSON, no markdown code blocks"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    # Check if message has content
    if not message.content or len(message.content) == 0:
        print(f"[ERROR] Empty response from Claude API", file=sys.stderr)
        sys.stderr.flush()
        raise ValueError("Claude returned empty response")

    response_text = message.content[0].text.strip()

    if not response_text:
        raise ValueError("Claude returned empty text")

    # Remove markdown code blocks if present
    if '```' in response_text:
        parts = response_text.split('```')
        if len(parts) >= 3:
            response_text = parts[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
            response_text = response_text.strip()

    return json.loads(response_text)


def generate_practice_quiz(concept_label: str, concept_description: str,
                           past_mistakes: list, current_confidence: float) -> dict:
    """Generate 5-question practice quiz using Claude"""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    mistakes_context = ""
    if past_mistakes:
        mistakes_context = f"\n\nStudent struggled with:\n" + "\n".join(
            [f"- {m}" for m in past_mistakes[:5]]
        )

    confidence_level = "beginner" if current_confidence < 0.4 else "intermediate" if current_confidence < 0.7 else "advanced"

    prompt = f"""Create a 5-question multiple choice quiz for: {concept_label}

Concept description: {concept_description}
Student's level: {confidence_level} (confidence: {current_confidence})
{mistakes_context}

Return ONLY valid JSON with this structure:
{{
  "questions": [
    {{
      "question_text": "Clear question stem",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_answer": "A",
      "explanation": "Why this is correct and others are wrong"
    }}
  ]
}}

Requirements:
- Exactly 5 questions
- Mix difficulty: 2 easy, 2 medium, 1 challenging
- Test conceptual understanding, not just recall
- Include questions targeting past mistakes if provided
- Make distractors plausible but clearly wrong
- Explanations should teach, not just state correctness
- Options should be roughly same length
- Return ONLY valid JSON, no markdown code blocks"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Check if message has content
        if not message.content or len(message.content) == 0:
            print(f"[ERROR] Empty quiz response from Claude API", file=sys.stderr)
            sys.stderr.flush()
            raise ValueError("Claude returned empty response")

        response_text = message.content[0].text.strip()

        if not response_text:
            raise ValueError("Claude returned empty text")

        # Remove markdown code blocks if present
        if '```' in response_text:
            parts = response_text.split('```')
            if len(parts) >= 3:
                response_text = parts[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
                response_text = response_text.strip()

        return json.loads(response_text)

    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse quiz JSON. Response was: {response_text}", file=sys.stderr)
        sys.stderr.flush()
        raise ValueError(f"Claude returned invalid JSON: {str(e)}")
    except Exception as e:
        print(f"[ERROR] Claude quiz API error: {type(e).__name__}: {str(e)}", file=sys.stderr)
        sys.stderr.flush()
        raise
