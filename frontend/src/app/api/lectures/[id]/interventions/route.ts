import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FLASK_API_URL = process.env.FLASK_API_URL || "http://localhost:8080";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lectureId } = await params;

    // Get recent transcript (last 500 chars)
    const transcriptRes = await fetch(
      `${FLASK_API_URL}/api/lectures/${lectureId}/transcript`
    );

    if (!transcriptRes.ok) {
      throw new Error("Failed to fetch transcript");
    }

    const transcriptData = await transcriptRes.json();

    if (!transcriptData.chunks || transcriptData.chunks.length === 0) {
      return NextResponse.json({
        suggestions: [
          {
            conceptId: "general",
            conceptLabel: "Getting Started",
            suggestion: "Start explaining the topic to see feedback here.",
          },
        ],
      });
    }

    // Get last ~500 chars of transcript
    const recentChunks = transcriptData.chunks.slice(-5); // Last 5 chunks
    const recentText = recentChunks
      .map((c: { text: string }) => c.text)
      .join(" ")
      .slice(-500);

    // Call Claude for a single, relevant teaching suggestion
    const prompt = `You are an expert teaching assistant analyzing a live lecture transcript.

Here's what the professor just said:
"${recentText}"

Give ONE short, actionable teaching suggestion (1 sentence max) that is DIRECTLY relevant to what was just explained. Focus on:
- A concrete example or analogy they could mention right now
- A common misconception to address
- A clarifying question to ask
- A visual or diagram to draw

Be SPECIFIC to the actual content, not generic advice.

Return ONLY valid JSON (no markdown):
{ "suggestion": "your one-sentence suggestion here" }`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const content =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse response
    let suggestion = "Continue explaining the current concept.";
    try {
      const jsonMatch = content.match(/\{[\s\S]*"suggestion"[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      suggestion = parsed.suggestion || suggestion;
    } catch (e) {
      console.error("Failed to parse intervention response:", e);
    }

    return NextResponse.json({
      suggestions: [
        {
          conceptId: "current",
          conceptLabel: "Right Now",
          suggestion: suggestion,
        },
      ],
    });
  } catch (error) {
    console.error("Intervention generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 }
    );
  }
}