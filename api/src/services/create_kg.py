import tempfile

import networkx as nx
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

    prompt = prompt = """Analyze this CS229 Machine Learning course document and create a prerequisite knowledge graph with 20-30 nodes.

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

OUTPUT FORMAT (strict markdown):

## Nodes
- linear_reg: Linear Regression & Normal Equations
- gradient_descent: Gradient Descent Optimization
- logistic_reg: Logistic Regression & Classification
- neural_nets: Neural Networks & Deep Learning
...

## Edges
- linear_reg -> logistic_reg
- gradient_descent -> linear_reg
- gradient_descent -> logistic_reg
- linear_reg -> neural_nets
...

REQUIREMENTS:
- MUST be a valid DAG (no cycles)
- Use concise snake_case IDs (e.g., linear_reg, svm, k_means)
- Node descriptions should be 2-8 words, capturing the main concept
- 20-30 nodes total
- Only include edges that represent genuine prerequisite relationships"""

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
    """Parse markdown KG into dictionary format"""
    lines = markdown.strip().split('\n')
    nodes = {}
    edges = []

    section = None
    for line in lines:
        line = line.strip()
        if line == "## Nodes":
            section = "nodes"
        elif line == "## Edges":
            section = "edges"
        elif line.startswith('- ') and section == "nodes":
            # Parse: - node_id: Module Name
            parts = line[2:].split(': ', 1)
            if len(parts) == 2:
                node_id = parts[0].strip()
                node_info = parts[1].strip()
                nodes[node_id] = node_info
        elif line.startswith('- ') and section == "edges":
            # Parse: - source -> target
            parts = line[2:].split(' -> ')
            if len(parts) == 2:
                edges.append((parts[0].strip(), parts[1].strip()))

    return {"nodes": nodes, "edges": edges}


def calculate_importance(graph: dict) -> dict:
    """Calculate importance scores based on graph structure"""
    G = nx.DiGraph()

    for node_id in graph['nodes'].keys():
        G.add_node(node_id)
    for source, target in graph['edges']:
        G.add_edge(source, target)

    pagerank = nx.pagerank(G)

    max_score = max(pagerank.values())
    min_score = min(pagerank.values())

    importance = {}
    for node, score in pagerank.items():
        normalized = (score - min_score) / (max_score - min_score) if max_score > min_score else 0.5
        importance[node] = round(normalized, 3)

    return importance


if __name__ == '__main__':
    kg_markdown = create_kg("main_notes.pdf")
    graph = parse_kg(kg_markdown)
    print(graph)
