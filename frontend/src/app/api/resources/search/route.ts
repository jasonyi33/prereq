import { NextRequest, NextResponse } from "next/server";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const FALLBACK_RESOURCES = [
  {
    title: "3Blue1Brown: Neural Networks",
    url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi",
    type: "video",
    snippet: "Visual, intuitive explanations of neural networks and deep learning fundamentals.",
  },
  {
    title: "Stanford CS229 Lecture Notes",
    url: "https://cs229.stanford.edu/main_notes.pdf",
    type: "article",
    snippet: "Official lecture notes covering supervised learning, deep learning, and generalization.",
  },
  {
    title: "Khan Academy: Linear Algebra",
    url: "https://www.khanacademy.org/math/linear-algebra",
    type: "article",
    snippet: "Comprehensive linear algebra course covering vectors, matrices, and transformations.",
  },
];

/**
 * GET /api/resources/search
 *
 * Searches for relevant learning resources using Perplexity Sonar API.
 * Returns curated educational materials (videos, articles, documentation) to help
 * students understand specific concepts.
 *
 * @query concept (required) - Concept name/label to search for
 * @query courseId (optional) - Course UUID for additional context (currently unused)
 *
 * @returns JSON response with resources array
 * Success: { resources: [{ title, url, type, snippet }] }
 * Error: { error: string }
 *
 * Process:
 * 1. Validates required 'concept' query parameter
 * 2. Checks for PERPLEXITY_API_KEY environment variable
 * 3. If no API key, returns hardcoded FALLBACK_RESOURCES
 * 4. Calls Perplexity Sonar API with concept search query
 * 5. Parses JSON response from AI-generated content
 * 6. Returns 3-5 learning resources (videos, articles, textbooks)
 * 7. Falls back to hardcoded resources on any error
 *
 * Resource types:
 * - "video": YouTube tutorials, recorded lectures
 * - "article": Blog posts, web tutorials, documentation
 * - "textbook": Academic papers, textbook chapters
 *
 * Used by:
 * - Student tutoring view (when student struggles with a concept)
 * - Concept detail modals (additional learning materials)
 * - Professor interventions (suggesting resources to struggling students)
 *
 * @example
 * GET /api/resources/search?concept=Backpropagation
 * GET /api/resources/search?concept=Chain%20Rule&courseId=uuid
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const concept = searchParams.get("concept");
  const courseId = searchParams.get("courseId");

  if (!concept) {
    return NextResponse.json(
      { error: "concept query param is required" },
      { status: 400 }
    );
  }

  // If no API key, return hardcoded fallback
  if (!PERPLEXITY_API_KEY) {
    return NextResponse.json({ resources: FALLBACK_RESOURCES });
  }

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: `Find 3-5 learning resources (YouTube videos, articles, textbook chapters) for understanding "${concept}" in the context of a machine learning course. Return JSON only, no markdown: { "resources": [{ "title": "...", "url": "...", "type": "video|article|textbook", "snippet": "..." }] }`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Perplexity API error:", res.status, res.statusText);
      return NextResponse.json({ resources: FALLBACK_RESOURCES });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*"resources"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.resources)) {
        return NextResponse.json({ resources: parsed.resources });
      }
    }

    // Parsing failed — return fallback
    console.error("Failed to parse Perplexity response:", content);
    return NextResponse.json({ resources: FALLBACK_RESOURCES });
  } catch (e) {
    console.error("Perplexity API call failed:", e);
    return NextResponse.json({ resources: FALLBACK_RESOURCES });
  }
}
