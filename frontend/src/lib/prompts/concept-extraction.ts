/**
 * Concept Extraction Prompt
 *
 * Used by Person 1 in Flask (api/services/concept_extraction.py).
 * This prompt is sent alongside a base64-encoded PDF via Claude's document API.
 *
 * Model: claude-sonnet-4-5-20250929
 * Input: PDF document (first 10 pages, base64) + this prompt text
 * Output: JSON matching { concepts: [...], edges: [...] }
 *
 * Integration pattern (Python, see knowledge-graph/src/services/create_kg.py):
 *   messages=[{
 *     "role": "user",
 *     "content": [
 *       { "type": "document", "source": { "type": "base64", "media_type": "application/pdf", "data": pdf_base64 } },
 *       { "type": "text", "text": buildConceptExtractionPrompt() }
 *     ]
 *   }]
 */

export function buildConceptExtractionPrompt(): string {
  return `Analyze the attached course document and extract a prerequisite knowledge graph.

TASK:
1. Identify 25-40 key concepts/algorithms/techniques from the course material.
2. For each concept, provide a short label, description, category, and difficulty rating.
3. Identify prerequisite relationships between concepts (concept A must be understood before concept B).

CONCEPT NODE GUIDELINES:
- Label: Short, human-readable name (e.g., "Gradient Descent", "Backpropagation", "Chain Rule")
- Description: 1-2 sentence explanation of the concept
- Category: A grouping label (e.g., "Linear Algebra", "Neural Networks", "Optimization")
- Difficulty: Integer 1-5 (1=introductory, 3=intermediate, 5=advanced)
- Include foundational math concepts that the course assumes or teaches
- Include major algorithms and techniques
- Group very closely related subtopics into a single node rather than splitting them

EDGE GUIDELINES:
- Only add edges for TRUE prerequisite relationships (A must be learned before B)
- source_label is the prerequisite, target_label is the dependent concept
- relationship is always "prerequisite"
- The graph must be a valid DAG (no cycles)
- Don't create edges for weak or tangential relationships

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema (no markdown, no explanation, no wrapping):

{
  "concepts": [
    {
      "label": "Gradient Descent",
      "description": "Iterative optimization algorithm that moves in the direction of steepest descent to minimize a loss function.",
      "category": "Optimization",
      "difficulty": 2
    },
    {
      "label": "Backpropagation",
      "description": "Algorithm for computing gradients of the loss function with respect to neural network weights using the chain rule.",
      "category": "Neural Networks",
      "difficulty": 4
    }
  ],
  "edges": [
    {
      "source_label": "Gradient Descent",
      "target_label": "Backpropagation",
      "relationship": "prerequisite"
    },
    {
      "source_label": "Chain Rule",
      "target_label": "Backpropagation",
      "relationship": "prerequisite"
    }
  ]
}

EXAMPLE (partial, for a machine learning course):

{
  "concepts": [
    { "label": "Vectors", "description": "Ordered arrays of numbers representing points or directions in space.", "category": "Linear Algebra", "difficulty": 1 },
    { "label": "Matrices", "description": "2D arrays of numbers used for linear transformations and data representation.", "category": "Linear Algebra", "difficulty": 1 },
    { "label": "Matrix Multiplication", "description": "Operation combining two matrices to produce a third, fundamental to linear transformations.", "category": "Linear Algebra", "difficulty": 2 },
    { "label": "Derivatives", "description": "Rate of change of a function, measuring how output changes with respect to input.", "category": "Calculus", "difficulty": 1 },
    { "label": "Partial Derivatives", "description": "Derivatives of multivariable functions with respect to one variable while holding others constant.", "category": "Calculus", "difficulty": 2 },
    { "label": "Gradients", "description": "Vector of partial derivatives pointing in the direction of steepest increase of a function.", "category": "Calculus", "difficulty": 2 },
    { "label": "Loss Functions", "description": "Functions measuring the difference between predicted and actual values, guiding model optimization.", "category": "ML Foundations", "difficulty": 2 },
    { "label": "Gradient Descent", "description": "Iterative optimization algorithm that updates parameters in the direction of negative gradient.", "category": "Optimization", "difficulty": 2 },
    { "label": "Linear Regression", "description": "Supervised learning method fitting a linear model to minimize squared error.", "category": "ML Foundations", "difficulty": 2 }
  ],
  "edges": [
    { "source_label": "Vectors", "target_label": "Matrices", "relationship": "prerequisite" },
    { "source_label": "Matrices", "target_label": "Matrix Multiplication", "relationship": "prerequisite" },
    { "source_label": "Derivatives", "target_label": "Partial Derivatives", "relationship": "prerequisite" },
    { "source_label": "Partial Derivatives", "target_label": "Gradients", "relationship": "prerequisite" },
    { "source_label": "Gradients", "target_label": "Gradient Descent", "relationship": "prerequisite" },
    { "source_label": "Loss Functions", "target_label": "Gradient Descent", "relationship": "prerequisite" },
    { "source_label": "Gradient Descent", "target_label": "Linear Regression", "relationship": "prerequisite" }
  ]
}

IMPORTANT:
- Return ONLY the JSON object. No markdown code fences, no preamble, no explanation.
- Every label in an edge must exactly match a label in the concepts array.
- Aim for 25-40 concepts covering the full breadth of the course material.
- Ensure the graph is a valid DAG (no circular dependencies).`;
}
