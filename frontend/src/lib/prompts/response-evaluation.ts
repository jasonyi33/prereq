/**
 * Response Evaluation — evaluates a student's free-form answer to a poll question.
 *
 * Model: claude-haiku-4-5-20251001
 * Called by: POST /api/polls/[pollId]/respond
 *
 * Returns eval_result (NOT colors, NOT confidence values).
 * Flask applies confidence rules internally.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export type EvalResult = "correct" | "partial" | "wrong";

export interface ResponseEvaluation {
  eval_result: EvalResult;
  feedback: string;
  reasoning: string;
}

export function buildResponseEvaluationPrompt(
  question: string,
  expectedAnswer: string,
  studentAnswer: string
): string {
  return `You are evaluating a student's answer to a poll question during a live lecture.

QUESTION: ${question}

EXPECTED ANSWER: ${expectedAnswer}

STUDENT'S ANSWER: ${studentAnswer}

TASK:
Evaluate the student's answer and classify it as one of three levels:
- "correct": The student demonstrates clear understanding of the key concepts. Minor wording differences are fine.
- "partial": The student shows some understanding but has gaps or misconceptions. They're on the right track but missing key points.
- "wrong": The student shows fundamental misunderstanding, gives an irrelevant answer, or clearly doesn't know the material.

Also provide:
- "feedback": A brief, encouraging student-facing nudge (1-2 sentences). Don't grade — guide. Example: "Good intuition about gradients! Pay extra attention to how the chain rule connects the layers."
- "reasoning": A brief internal explanation of why you chose this eval_result (not shown to the student).

Return ONLY valid JSON (no markdown, no explanation):
{ "eval_result": "correct"|"partial"|"wrong", "feedback": "...", "reasoning": "..." }`;
}

export function parseResponseEvaluationResponse(
  response: string
): ResponseEvaluation {
  try {
    const parsed = JSON.parse(response);
    const evalResult = parsed.eval_result;
    if (!["correct", "partial", "wrong"].includes(evalResult)) {
      throw new Error(`Invalid eval_result: ${evalResult}`);
    }
    return {
      eval_result: evalResult as EvalResult,
      feedback: parsed.feedback || "Thanks for your answer!",
      reasoning: parsed.reasoning || "",
    };
  } catch (e) {
    console.error(
      "Failed to parse response evaluation:",
      response,
      e
    );
    return {
      eval_result: "partial",
      feedback:
        "We had trouble evaluating your answer. The professor will review it.",
      reasoning: "Parse error — defaulting to partial",
    };
  }
}

export async function evaluateResponse(
  question: string,
  expectedAnswer: string,
  studentAnswer: string
): Promise<ResponseEvaluation> {
  const prompt = buildResponseEvaluationPrompt(
    question,
    expectedAnswer,
    studentAnswer
  );

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return parseResponseEvaluationResponse("{}");
  }

  return parseResponseEvaluationResponse(content.text);
}
