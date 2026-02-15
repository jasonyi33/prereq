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
    "That's a good question! Let me think about that for a sec.",
    "Oh interesting point! Have you looked at the lecture notes on that?",
    "Yeah I struggled with that too. Want to work through an example together?",
    "Good observation! That concept really clicked for me when I drew it out.",
    "I'm not 100% sure either. Should we look it up together?",
    "That makes sense! I think the key is understanding how it relates to the other concepts.",
  ];

  // If no Anthropic key, use fallback
  if (!anthropic) {
    const reply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    return NextResponse.json({ reply });
  }

  try {
    // Build conversation context for Claude
    const systemPrompt = `You are ${partnerName}, a student in a peer study group. You're working together on these concepts: ${(concepts || []).join(", ")}.

IMPORTANT INSTRUCTIONS:
- Keep responses VERY SHORT (1-3 sentences max)
- Be helpful but concise
- Ask clarifying questions when needed
- Share quick insights or examples
- Be friendly and collaborative
- Never write long explanations - this is a chat, not a lecture
- Use casual student language

Examples of good responses:
- "Oh interesting! Have you tried thinking about it geometrically?"
- "Yeah that confused me too. The key is understanding the chain rule first."
- "Wait, can you clarify what you mean by that?"
- "Totally! It's like how momentum keeps things moving even after you stop pushing."`;

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
      max_tokens: 150,
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