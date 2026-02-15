import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/study-groups/chat
 *
 * Chat endpoint for study group partners.
 * Uses Claude Haiku to simulate partner responses with short, concise messages.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[study-groups/chat] Received:", body);

    const { message, partnerName, concepts, conversationHistory } = body;

    if (!message || !partnerName) {
      console.error("[study-groups/chat] Missing required fields");
      return NextResponse.json(
        { error: "message and partnerName required" },
        { status: 400 }
      );
    }

    // Build conversation context for Claude
    const systemPrompt = `You are ${partnerName}, a student in a peer study group. You're working together on these concepts: ${concepts.join(", ")}.

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

    if (conversationHistory && conversationHistory.length > 0) {
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
      max_tokens: 150,  // Keep responses short
      system: systemPrompt,
      messages,
    }, { timeout: 5000 });

    const reply = response.content[0].type === "text"
      ? response.content[0].text
      : "I'm not sure what to say about that.";

    console.log("[study-groups/chat] Reply:", reply);
    return NextResponse.json({ reply });

  } catch (err) {
    console.error("[study-groups/chat] Error:", err);
    console.error("[study-groups/chat] Error stack:", err instanceof Error ? err.stack : "No stack");
    return NextResponse.json(
      {
        error: "Failed to get response",
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}