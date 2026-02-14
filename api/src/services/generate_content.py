import anthropic
import os
import json

from dotenv import load_dotenv

load_dotenv()

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
- Use markdown formatting
- Adjust complexity to student's level
- Be concise but thorough
- No fluff or excessive motivation
- Return ONLY valid JSON, no markdown code blocks"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text.strip()

    if response_text.startswith('```'):
        lines = response_text.split('\n')
        lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        response_text = '\n'.join(lines).strip()

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
- Mix difficulty: 1 easy, 2 medium, 1 hard, 1 challenging
- Mix the answer choices (not all same letters)
- Test conceptual understanding, not just recall
- Explanations should teach, not just state correctness
- Options should be roughly same length
- Return ONLY valid JSON, no markdown code blocks"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text.strip()

    if response_text.startswith('```'):
        lines = response_text.split('\n')
        lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        response_text = '\n'.join(lines).strip()

    return json.loads(response_text)


def get_further_reading(concept_label: str, concept_description: str) -> list:
    """Get 3 relevant links using Perplexity"""
    import requests

    perplexity_key = os.getenv("PERPLEXITY_API_KEY")
    if not perplexity_key:
        return []

    prompt = f"""Find 3 high-quality educational resources for learning about: {concept_label}

Context: {concept_description}

Requirements:
- Mix of formats (articles, tutorials, videos)
- Authoritative sources (Wikipedia, educational sites, .edu domains)
- Free and accessible
- Return as JSON array with title, url, and source name

Return ONLY valid JSON:
[
  {{"title": "Resource title", "url": "https://...", "source": "Source name"}},
  {{"title": "Resource title", "url": "https://...", "source": "Source name"}},
  {{"title": "Resource title", "url": "https://...", "source": "Source name"}}
]"""

    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {perplexity_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-sonar-small-128k-online",
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=15
        )

        if response.status_code != 200:
            return []

        result = response.json()
        content = result['choices'][0]['message']['content'].strip()

        # Remove markdown if present
        if content.startswith('```'):
            lines = content.split('\n')
            lines = lines[1:]
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            content = '\n'.join(lines).strip()

        return json.loads(content)

    except Exception as e:
        print(f"[ERROR] Perplexity API failed: {e}")
        return []