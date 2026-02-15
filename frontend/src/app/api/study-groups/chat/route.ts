import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
}) : null;

/**
 * POST /api/study-groups/chat
 *
 * Chat endpoint for study group partners.
 * Uses Claude Haiku to simulate partner responses with short, concise messages.
 */
export async function POST(request: NextRequest) {
  let body;

  try {
    body = await request.json();
  } catch (parseError) {
    console.error("[study-groups/chat] JSON parse error:", parseError);
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { message, partnerName, concepts, conversationHistory } = body;

  if (!message || !partnerName) {
    return NextResponse.json(
      { error: "message and partnerName required" },
      { status: 400 }
    );
  }

  // Fallback responses if Claude isn't available
  const fallbackResponses = [
    "hmm let me think about that",
    "oh yeah i remember that part",
    "wait can you explain that again?",
    "yeah that one confused me too lol",
    "ohhh okay that makes sense",
    "try drawing it out maybe?",
    "yeah i think so",
    "hmm not sure, wanna look it up?",
  ];

  // If no Anthropic key, use fallback
  if (!anthropic) {
    const reply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    return NextResponse.json({ reply });
  }

  try {
    // Build conversation context for Claude
    const systemPrompt = `You're ${partnerName}, texting with a study partner about: ${(concepts || []).join(", ")}

TEXT LIKE A REAL STUDENT:
- Super short (1-2 sentences)
- Casual, friendly
- Use "yeah", "oh", "wait", "hmm", "lol" etc.
- Ask quick questions
- No formal language or long explanations

Examples:
- "oh wait do you mean the derivative?"
- "yeah that one tripped me up too lol"
- "hmm try drawing it out maybe?"
- "ohhh that makes sense now"
- "wait can you explain that part again"`;

    // Format conversation history
    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
      }
    }

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    // Call Claude Haiku
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,  // Keep it short like real texts
      system: systemPrompt,
      messages,
    }, { timeout: 5000 });

    const reply = response.content[0].type === "text"
      ? response.content[0].text
      : "I'm not sure what to say about that.";

    return NextResponse.json({ reply });

  } catch (err) {
    console.error("[study-groups/chat] Error:", err);
    // Return a fallback response instead of erroring
    const reply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    return NextResponse.json({ reply });
  }
}