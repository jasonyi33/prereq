import { describe, it, expect } from "vitest";
import { parseConceptDetectionResponse } from "../concept-detection";
import { parseQuestionGenerationResponse } from "../question-generation";
import { parseResponseEvaluationResponse } from "../response-evaluation";
import { parseUnderstandingCheckResponse } from "../understanding-check";
import { parseMisconceptionSummaryResponse } from "../misconception-summary";
import { parseInterventionResponse } from "../intervention";

describe("parseConceptDetectionResponse", () => {
  it("parses valid JSON with 2 concepts", () => {
    const input = JSON.stringify({
      detected_concepts: ["Gradient Descent", "Loss Functions"],
    });
    expect(parseConceptDetectionResponse(input)).toEqual([
      "Gradient Descent",
      "Loss Functions",
    ]);
  });

  it("parses valid JSON with empty array", () => {
    const input = JSON.stringify({ detected_concepts: [] });
    expect(parseConceptDetectionResponse(input)).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseConceptDetectionResponse("not json")).toEqual([]);
  });

  it("returns empty array for JSON with unexpected keys", () => {
    const input = JSON.stringify({
      detected_concepts: ["Chain Rule"],
      extra_field: true,
    });
    expect(parseConceptDetectionResponse(input)).toEqual(["Chain Rule"]);
  });

  it("returns empty array when detected_concepts key is missing", () => {
    const input = JSON.stringify({ concepts: ["Chain Rule"] });
    expect(parseConceptDetectionResponse(input)).toEqual([]);
  });
});

describe("parseQuestionGenerationResponse", () => {
  it("parses valid JSON with question and expected answer", () => {
    const input = JSON.stringify({
      question: "Explain how gradient descent works.",
      expected_answer:
        "Gradient descent iteratively updates parameters in the direction of negative gradient.",
    });
    const result = parseQuestionGenerationResponse(input);
    expect(result.question).toBe("Explain how gradient descent works.");
    expect(result.expectedAnswer).toBe(
      "Gradient descent iteratively updates parameters in the direction of negative gradient."
    );
  });

  it("throws on malformed JSON", () => {
    expect(() => parseQuestionGenerationResponse("not json")).toThrow();
  });

  it("handles extra keys gracefully", () => {
    const input = JSON.stringify({
      question: "What is backprop?",
      expected_answer: "Computing gradients via chain rule.",
      difficulty: "medium",
    });
    const result = parseQuestionGenerationResponse(input);
    expect(result.question).toBe("What is backprop?");
    expect(result.expectedAnswer).toBe(
      "Computing gradients via chain rule."
    );
  });
});

describe("parseResponseEvaluationResponse", () => {
  it('parses valid "correct" response', () => {
    const input = JSON.stringify({
      eval_result: "correct",
      feedback: "Great understanding!",
      reasoning: "Student correctly identified the key points.",
    });
    const result = parseResponseEvaluationResponse(input);
    expect(result.eval_result).toBe("correct");
    expect(result.feedback).toBe("Great understanding!");
    expect(result.reasoning).toBe(
      "Student correctly identified the key points."
    );
  });

  it('parses valid "partial" response', () => {
    const input = JSON.stringify({
      eval_result: "partial",
      feedback: "Good start, but consider the chain rule.",
      reasoning: "Missed the connection to derivatives.",
    });
    const result = parseResponseEvaluationResponse(input);
    expect(result.eval_result).toBe("partial");
  });

  it('parses valid "wrong" response', () => {
    const input = JSON.stringify({
      eval_result: "wrong",
      feedback: "Review the lecture notes on this topic.",
      reasoning: "Student confused gradient descent with gradient.",
    });
    const result = parseResponseEvaluationResponse(input);
    expect(result.eval_result).toBe("wrong");
  });

  it("extracts 3 required fields when extra keys present", () => {
    const input = JSON.stringify({
      eval_result: "correct",
      feedback: "Nice!",
      reasoning: "All correct.",
      confidence_delta: 0.3,
      extra: true,
    });
    const result = parseResponseEvaluationResponse(input);
    expect(result.eval_result).toBe("correct");
    expect(result.feedback).toBe("Nice!");
    expect(result.reasoning).toBe("All correct.");
    expect(result).not.toHaveProperty("confidence_delta");
  });

  it("returns safe default for malformed JSON", () => {
    const result = parseResponseEvaluationResponse("not json at all");
    expect(result.eval_result).toBe("partial");
    expect(result.feedback).toBeTruthy();
    expect(result.reasoning).toBeTruthy();
  });

  it("returns safe default for invalid eval_result value", () => {
    const input = JSON.stringify({
      eval_result: "maybe",
      feedback: "Hmm",
      reasoning: "Unclear",
    });
    const result = parseResponseEvaluationResponse(input);
    expect(result.eval_result).toBe("partial");
  });
});

describe("parseUnderstandingCheckResponse", () => {
  it("parses understood: true with concept label", () => {
    const input = JSON.stringify({
      understood: true,
      concept_label: "Chain Rule",
    });
    const result = parseUnderstandingCheckResponse(input);
    expect(result.understood).toBe(true);
    expect(result.concept_label).toBe("Chain Rule");
  });

  it("parses understood: false with empty label", () => {
    const input = JSON.stringify({
      understood: false,
      concept_label: "",
    });
    const result = parseUnderstandingCheckResponse(input);
    expect(result.understood).toBe(false);
    expect(result.concept_label).toBe("");
  });

  it("returns safe default for malformed JSON", () => {
    const result = parseUnderstandingCheckResponse("not json");
    expect(result.understood).toBe(false);
    expect(result.concept_label).toBe("");
  });

  it("handles missing concept_label key", () => {
    const input = JSON.stringify({ understood: true });
    const result = parseUnderstandingCheckResponse(input);
    expect(result.understood).toBe(true);
    expect(result.concept_label).toBe("");
  });
});

describe("parseMisconceptionSummaryResponse", () => {
  it("returns plain text as-is", () => {
    const input =
      "Students confused gradient descent with the gradient vector itself.";
    expect(parseMisconceptionSummaryResponse(input)).toBe(input);
  });

  it("strips wrapping quotes", () => {
    const input =
      '"Most students missed the chain rule connection."';
    expect(parseMisconceptionSummaryResponse(input)).toBe(
      "Most students missed the chain rule connection."
    );
  });

  it("returns default for empty string", () => {
    expect(parseMisconceptionSummaryResponse("")).toBe(
      "No clear misconception pattern detected."
    );
  });

  it("trims whitespace", () => {
    expect(
      parseMisconceptionSummaryResponse("  Some summary.  ")
    ).toBe("Some summary.");
  });
});

describe("parseInterventionResponse", () => {
  it("parses valid JSON with suggestions", () => {
    const input = JSON.stringify({
      suggestions: [
        { concept_label: "Chain Rule", suggestion: "Use a visual diagram." },
        { concept_label: "Backpropagation", suggestion: "Walk through a code example." },
      ],
    });
    const result = parseInterventionResponse(input);
    expect(result).toHaveLength(2);
    expect(result[0].concept_label).toBe("Chain Rule");
    expect(result[0].suggestion).toBe("Use a visual diagram.");
    expect(result[1].concept_label).toBe("Backpropagation");
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseInterventionResponse("not json")).toEqual([]);
  });

  it("returns empty array when suggestions key is missing", () => {
    const input = JSON.stringify({ advice: [] });
    expect(parseInterventionResponse(input)).toEqual([]);
  });

  it("handles missing fields in suggestion objects", () => {
    const input = JSON.stringify({
      suggestions: [{ concept_label: "Gradients" }],
    });
    const result = parseInterventionResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].concept_label).toBe("Gradients");
    expect(result[0].suggestion).toBe("");
  });
});
