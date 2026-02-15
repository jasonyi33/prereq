import math
import tempfile

from PyPDF2 import PdfReader, PdfWriter
import anthropic
import os
import base64


def create_kg(file_path: str) -> str:
    # Extract first 10 pages
    reader = PdfReader(file_path)
    writer = PdfWriter()

    # Add first 10 pages (or fewer if PDF is shorter)
    for i in range(min(10, len(reader.pages))):
        writer.add_page(reader.pages[i])

    # Write to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        writer.write(tmp)
        tmp_path = tmp.name

    # Read and encode the truncated PDF
    with open(tmp_path, 'rb') as f:
        pdf_data = base64.standard_b64encode(f.read()).decode('utf-8')

    os.remove(tmp_path)

    client = anthropic.Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        timeout=120.0,
    )

    prompt = """Analyze this course document and create a prerequisite knowledge graph.

STRICT CONSTRAINT: Produce exactly 30-40 concept nodes. NEVER exceed 40 nodes.

Each node should represent a MAJOR TOPIC that would take 1-3 lectures to cover, NOT a single definition, formula, or minor subtopic. Aggressively group related subtopics into a single node. For example:
- GOOD: "Regularization Techniques" (covers L1, L2, dropout, early stopping)
- BAD: Separate nodes for "L1 Regularization", "L2 Regularization", "Dropout", "Early Stopping"
- GOOD: "Matrix Operations" (covers multiplication, transpose, inverse)
- BAD: Separate nodes for "Matrix Multiplication", "Matrix Transpose", "Matrix Inverse"

TASK:
Create a DAG where:
1. Each node = a broad topic or family of techniques from the course
2. Each edge = "A is a prerequisite for B" (A must be learned before B)
3. Nodes should follow temporal/conceptual dependencies

NODE SELECTION GUIDELINES:
- Include: Major algorithms and technique families
- Include: Foundational mathematical/conceptual building blocks
- Combine: Always merge closely related subtopics into one node (e.g., "Optimization Methods" not separate nodes for SGD, Adam, momentum)
- Skip: Specialized optional topics unless they're prerequisites for other concepts
- If you find yourself creating more than 40 nodes, you are being too granular — merge related concepts

EDGE GUIDELINES:
- Only add edges for TRUE prerequisite relationships (concept A needed to understand B)
- Foundational math/concepts should precede applied techniques
- Basic methods should precede advanced methods that build on them
- Only create edges where there's a genuine dependency, not just topical similarity

Return ONLY valid JSON with this exact structure:
{
  "nodes": {
    "linear_reg": "Statistical method for modeling relationships between variables using linear equations",
    "gradient_descent": "Iterative optimization algorithm that minimizes functions by moving in the direction of steepest descent"
  },
  "edges": [
    ["gradient_descent", "linear_reg"],
    ["linear_reg", "logistic_reg"]
  ]
}

Requirements:
- 30-40 concept nodes (HARD LIMIT: never exceed 40)
- Edges form a connected DAG (no cycles)
- EVERY node must have at least one edge (incoming or outgoing). No isolated nodes.
- Use concise snake_case IDs (e.g., linear_reg, svm, k_means)
- Each edge: source is prerequisite for target
- Only include edges that represent genuine prerequisite relationships

Return ONLY the JSON object.
"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_data
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    )

    return message.content[0].text


def parse_kg(markdown: str) -> dict:
    import json
    text = markdown.strip()

    # Strip markdown code blocks if present
    if '```' in text:
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]
        text = text.strip()

    return json.loads(text)


def sigmoid(x):
    return 1 / (1 + math.e ** (-1 * x))


def calculate_importance(graph: dict) -> dict:
    """Calculate importance based on in-degree (how many nodes depend on this)"""

    # Count in-degrees (how many nodes have this as prerequisite)
    in_degree = {node: 0 for node in graph['nodes'].keys()}
    out_degree = {node: 0 for node in graph['nodes'].keys()}

    for edge in graph['edges']:
        source, target = edge[0], edge[1]
        if source in in_degree and target in in_degree:
            out_degree[source] += 1
            in_degree[target] += 1

    # Importance = foundational-ness (high in-degree = many depend on it)
    max_in = max(in_degree.values()) if in_degree.values() else 1

    importance = {}
    for node in graph['nodes'].keys():
        # Normalize in-degree to 0-1 range
        score = in_degree[node] / max_in if max_in > 0 else 0.5
        importance[node] = sigmoid(round(score, 3) + 1)

    return importance


if __name__ == '__main__':
    kg_markdown = create_kg("main_notes.pdf")
    graph = parse_kg(kg_markdown)
    print(graph)
