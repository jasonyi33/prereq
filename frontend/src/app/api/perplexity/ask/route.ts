import { NextRequest, NextResponse } from "next/server";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

/**
 * POST /api/perplexity/ask
 *
 * Conversational AI endpoint for students to ask questions about concepts they're struggling with.
 * Uses Perplexity Sonar Pro for detailed, educational responses.
 *
 * @body {
 *   question: string;      // Student's question
 *   conceptLabel: string;  // The concept they're asking about
 *   conceptDescription?: string; // Optional context
 *   lectureContext?: string; // Optional transcript excerpts
 * }
 *
 * @returns {
 *   response: string;   // AI-generated explanation
 *   citations?: string[]; // Source citations if available
 * }
 *
 * Used by: SidePanel.tsx "Ask Perplexity AI" button
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { question, conceptLabel, conceptDescription, lectureContext } = body;

  if (!question || !conceptLabel) {
    return NextResponse.json(
      { error: "question and conceptLabel are required" },
      { status: 400 }
    );
  }

  if (!PERPLEXITY_API_KEY) {
    return NextResponse.json(
      {
        error: "Perplexity API not configured",
        response:
          "The AI assistant is temporarily unavailable. Please try the recommended resources below or ask your professor for help.",
      },
      { status: 503 }
    );
  }

  // Build context-aware prompt
  let prompt = `You are an expert teaching assistant helping a student understand "${conceptLabel}" in a machine learning course.

${conceptDescription ? `CONCEPT DESCRIPTION:\n${conceptDescription}\n\n` : ""}${
    lectureContext
      ? `RELEVANT LECTURE EXCERPTS:\n${lectureContext}\n\n`
      : ""
  }STUDENT'S QUESTION:
${question}

Provide a clear, concise explanation that:
1. Directly answers their question
2. Uses examples and analogies where helpful
3. Connects to the lecture material if provided
4. Suggests next steps for deeper understanding

Keep your response under 300 words and use a friendly, encouraging tone.`;

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
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      console.error("Perplexity API error:", res.status, res.statusText);
      return NextResponse.json(
        {
          error: "Failed to get AI response",
          response:
            "I'm having trouble connecting right now. Please try again in a moment or check out the recommended resources below.",
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    return NextResponse.json({
      response: content,
      citations: citations.length > 0 ? citations : undefined,
    });
  } catch (e) {
    console.error("Perplexity API call failed:", e);
    return NextResponse.json(
      {
        error: "Network error",
        response:
          "I couldn't connect to the AI assistant. Please check your internet connection and try again.",
      },
      { status: 500 }
    );
  }
}