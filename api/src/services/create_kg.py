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

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = """Analyze this CS229 Machine Learning course document and create a prerequisite knowledge graph with 20-30 nodes.

COURSE STRUCTURE (for context):
- Part I: Supervised Learning (Linear Regression → Logistic Regression → GLMs → Generative Models → Kernels → SVMs)
- Part II: Deep Learning (Neural Networks, Backpropagation)
- Part III: Generalization & Regularization (Bias-Variance, Overfitting, Cross-Validation)
- Part IV: Unsupervised Learning (K-Means, EM, PCA, ICA, Self-Supervised Learning)
- Part V: Reinforcement Learning (MDPs, Value/Policy Iteration, LQR, Policy Gradient)

TASK:
Create a DAG where:
1. Each node = major concept/algorithm/technique from the course
2. Each edge = "A is a prerequisite for B" (A must be learned before B)
3. Nodes should follow temporal/conceptual dependencies
4. ~20-30 nodes total (cover all major topics, but group related subtopics)

NODE SELECTION GUIDELINES:
- Include: Major algorithms (Linear Regression, Logistic Regression, Neural Networks, SVM, K-Means, PCA, etc.)
- Include: Foundational concepts (Gradient Descent, MLE, Regularization, Kernels, Backprop)
- Combine: Related subtopics into single nodes (e.g., "Normal Equations & Matrix Calculus" vs separate nodes)
- Skip: Very specialized optional topics unless they're prerequisites for other concepts

EDGE GUIDELINES:
- Only add edges for TRUE prerequisite relationships (concept A needed to understand B)
- Linear Regression should be a prerequisite for most other supervised learning methods
- Gradient Descent is a prerequisite for many optimization-based methods
- Basic supervised learning concepts should precede deep learning
- Generalization concepts can be learned after basic supervised learning
- Unsupervised learning largely independent from supervised (except foundational math)

TEMPORAL ORDERING:
- Early course topics (Ch 1-3) should generally come before later topics (Ch 7-17)
- But only create edges where there's a genuine prerequisite relationship
- A topic from Ch 2 can have no incoming edges if it doesn't require Ch 1 concepts

Return ONLY valid JSON with this exact structure:
{
  "nodes": {
    "linear_reg": "Linear Regression & Normal Equations",
    "gradient_descent": "Gradient Descent Optimization",
    ...
  },
  "edges": [
    ["gradient_descent", "linear_reg"],
    ["linear_reg", "logistic_reg"],
    ...
  ]
}

Requirements:
- 20-30 concept nodes covering all major topics
- Edges form a DAG (no cycles)
- Use concise snake_case IDs (e.g., linear_reg, svm, k_means)
- Each edge: source is prerequisite for target
- Only include edges that represent genuine prerequisite relationships
- Difficulty: 1-5 scale

Return ONLY the JSON object.
"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
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
        importance[node] = round(score, 3)

    return importance


if __name__ == '__main__':
    kg_markdown = create_kg("main_notes.pdf")
    graph = parse_kg(kg_markdown)
    print(graph)
