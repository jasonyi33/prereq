"""
Seed script for Prereq demo.
Creates CS229 course, ~35 concepts, edges, 4 students, and pre-seeded mastery.
Requires Flask API running on http://localhost:5000.

Usage:
    python scripts/seed_demo.py
"""

import requests
import sys

FLASK_URL = "http://localhost:5000"


def api(method, path, json=None):
    url = f"{FLASK_URL}{path}"
    resp = getattr(requests, method)(url, json=json)
    if not resp.ok:
        print(f"  FAILED {method.upper()} {path}: {resp.status_code} {resp.text}")
        sys.exit(1)
    return resp.json()


def main():
    print("=== Prereq Demo Seed ===\n")

    # 1. Create course
    print("Creating course...")
    course = api("post", "/api/courses", {"name": "CS229 Machine Learning", "description": "Stanford CS229 — Machine Learning"})
    course_id = course["id"]
    print(f"  Course: {course_id}\n")

    # 2. Define concepts by category
    concepts_spec = [
        # Linear Algebra
        {"label": "Vectors", "description": "Mathematical objects with magnitude and direction", "category": "Linear Algebra", "difficulty": 1},
        {"label": "Matrices", "description": "Rectangular arrays of numbers used for linear transformations", "category": "Linear Algebra", "difficulty": 2},
        {"label": "Eigenvalues", "description": "Scalar values associated with linear transformations", "category": "Linear Algebra", "difficulty": 4},
        {"label": "Matrix Multiplication", "description": "Operation combining two matrices to produce a third", "category": "Linear Algebra", "difficulty": 2},
        # Calculus
        {"label": "Derivatives", "description": "Rate of change of a function", "category": "Calculus", "difficulty": 2},
        {"label": "Partial Derivatives", "description": "Derivatives of functions with multiple variables", "category": "Calculus", "difficulty": 3},
        {"label": "Chain Rule", "description": "Rule for differentiating composite functions", "category": "Calculus", "difficulty": 3},
        {"label": "Gradients", "description": "Vector of partial derivatives indicating direction of steepest ascent", "category": "Calculus", "difficulty": 3},
        # Probability
        {"label": "Bayes' Theorem", "description": "Formula for updating probabilities given new evidence", "category": "Probability", "difficulty": 3},
        {"label": "Distributions", "description": "Mathematical functions describing probability of outcomes", "category": "Probability", "difficulty": 2},
        {"label": "Conditional Probability", "description": "Probability of an event given another event has occurred", "category": "Probability", "difficulty": 2},
        # ML Foundations
        {"label": "Loss Functions", "description": "Functions that measure model prediction error", "category": "ML Foundations", "difficulty": 3},
        {"label": "MSE", "description": "Mean squared error — average of squared prediction differences", "category": "ML Foundations", "difficulty": 2},
        {"label": "Cross-Entropy", "description": "Loss function for classification measuring divergence from true distribution", "category": "ML Foundations", "difficulty": 4},
        {"label": "Optimization", "description": "Process of finding parameters that minimize a loss function", "category": "ML Foundations", "difficulty": 3},
        # Gradient Descent
        {"label": "Gradient Descent", "description": "Iterative optimization algorithm following negative gradient", "category": "Gradient Descent", "difficulty": 3},
        {"label": "Learning Rate", "description": "Hyperparameter controlling step size in gradient descent", "category": "Gradient Descent", "difficulty": 2},
        {"label": "Convergence", "description": "Process of approaching an optimal solution during training", "category": "Gradient Descent", "difficulty": 3},
        {"label": "SGD", "description": "Stochastic gradient descent using random mini-batches", "category": "Gradient Descent", "difficulty": 3},
        # Neural Networks
        {"label": "Perceptron", "description": "Simplest neural network unit — weighted sum plus activation", "category": "Neural Networks", "difficulty": 2},
        {"label": "Activation Functions", "description": "Non-linear functions applied to neuron outputs (ReLU, sigmoid, tanh)", "category": "Neural Networks", "difficulty": 3},
        {"label": "Forward Pass", "description": "Computing output by propagating input through network layers", "category": "Neural Networks", "difficulty": 2},
        {"label": "Layers", "description": "Groups of neurons that process data at each stage of the network", "category": "Neural Networks", "difficulty": 2},
        # Backpropagation
        {"label": "Backpropagation", "description": "Algorithm for computing gradients by applying chain rule through computational graph", "category": "Backpropagation", "difficulty": 4},
        {"label": "Computational Graphs", "description": "Directed graphs representing the sequence of operations in a neural network", "category": "Backpropagation", "difficulty": 3},
        {"label": "Weight Updates", "description": "Adjusting model parameters using computed gradients", "category": "Backpropagation", "difficulty": 3},
        # Regularization
        {"label": "Overfitting", "description": "Model memorizes training data and fails to generalize", "category": "Regularization", "difficulty": 2},
        {"label": "L1 Regularization", "description": "Adds absolute value of weights as penalty to loss function", "category": "Regularization", "difficulty": 3},
        {"label": "L2 Regularization", "description": "Adds squared weights as penalty to loss function", "category": "Regularization", "difficulty": 3},
        {"label": "Dropout", "description": "Randomly deactivating neurons during training to prevent overfitting", "category": "Regularization", "difficulty": 3},
        # Evaluation
        {"label": "Train/Val/Test Split", "description": "Dividing data into training, validation, and test sets", "category": "Evaluation", "difficulty": 1},
        {"label": "Cross-Validation", "description": "Technique for assessing model performance using multiple data splits", "category": "Evaluation", "difficulty": 3},
        {"label": "Bias-Variance Tradeoff", "description": "Balancing model complexity between underfitting and overfitting", "category": "Evaluation", "difficulty": 4},
    ]

    # Insert concepts via Flask graph endpoint (which uses concept_nodes table)
    # Flask doesn't have a bulk concept insert, so we use individual inserts via Supabase
    # Actually, we need to use the courses upload endpoint or insert directly.
    # The simplest approach: use the existing POST endpoint patterns.
    # Looking at the Flask routes, there's no direct POST /api/concepts endpoint.
    # The concepts are normally created via PDF upload.
    # We'll need to insert via the courses graph endpoint or directly.
    # Since the seed script is a one-time thing, let's call Supabase directly via Flask.
    # Actually, let's just POST to a minimal endpoint. Since there isn't one, we'll
    # use the Supabase REST API directly (the anon key allows inserts).

    import os
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

    from supabase import create_client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    # 3. Insert concepts
    print("Creating concepts...")
    label_to_id = {}
    for c in concepts_spec:
        result = supabase.table("concept_nodes").insert({
            "course_id": course_id,
            "label": c["label"],
            "description": c["description"],
            "category": c["category"],
            "difficulty": c["difficulty"],
        }).execute()
        node_id = result.data[0]["id"]
        label_to_id[c["label"]] = node_id
        print(f"  {c['label']} → {node_id}")

    print(f"\n  Total concepts: {len(label_to_id)}\n")

    # 4. Insert edges (prerequisite relationships)
    edges_spec = [
        ("Vectors", "Matrices"),
        ("Matrices", "Matrix Multiplication"),
        ("Matrices", "Eigenvalues"),
        ("Derivatives", "Partial Derivatives"),
        ("Partial Derivatives", "Gradients"),
        ("Derivatives", "Chain Rule"),
        ("Chain Rule", "Backpropagation"),
        ("Gradients", "Gradient Descent"),
        ("Conditional Probability", "Bayes' Theorem"),
        ("Distributions", "Conditional Probability"),
        ("Loss Functions", "MSE"),
        ("Loss Functions", "Cross-Entropy"),
        ("Loss Functions", "Optimization"),
        ("Optimization", "Gradient Descent"),
        ("Gradient Descent", "Learning Rate"),
        ("Gradient Descent", "Convergence"),
        ("Gradient Descent", "SGD"),
        ("Perceptron", "Activation Functions"),
        ("Perceptron", "Layers"),
        ("Activation Functions", "Forward Pass"),
        ("Layers", "Forward Pass"),
        ("Forward Pass", "Backpropagation"),
        ("Backpropagation", "Computational Graphs"),
        ("Backpropagation", "Weight Updates"),
        ("Weight Updates", "Gradient Descent"),
        ("Overfitting", "L1 Regularization"),
        ("Overfitting", "L2 Regularization"),
        ("Overfitting", "Dropout"),
        ("Train/Val/Test Split", "Cross-Validation"),
        ("Cross-Validation", "Bias-Variance Tradeoff"),
        ("Gradients", "Backpropagation"),
        ("Matrix Multiplication", "Forward Pass"),
    ]

    print("Creating edges...")
    edge_count = 0
    for source_label, target_label in edges_spec:
        if source_label in label_to_id and target_label in label_to_id:
            supabase.table("concept_edges").insert({
                "course_id": course_id,
                "source_id": label_to_id[source_label],
                "target_id": label_to_id[target_label],
                "relationship": "prerequisite",
            }).execute()
            edge_count += 1
    print(f"  Total edges: {edge_count}\n")

    # 5. Create students
    print("Creating students...")
    students_spec = [
        {"name": "Alex", "email": "alex@stanford.edu"},
        {"name": "Jordan", "email": "jordan@stanford.edu"},
        {"name": "Sam", "email": "sam@stanford.edu"},
        {"name": "Taylor", "email": "taylor@stanford.edu"},
    ]

    student_ids = {}
    for s in students_spec:
        result = api("post", f"/api/courses/{course_id}/students", s)
        student_ids[s["name"]] = result["id"]
        print(f"  {s['name']} → {result['id']}")

    print()

    # 6. Seed mastery values per student profile
    # Alex: Strong — most 0.7-0.9, regularization/dropout at 0.5
    # Jordan: Average — fundamentals 0.7+, intermediate 0.4-0.6, backprop/reg 0.15-0.3
    # Sam: Struggling — neural net cluster 0.1-0.2, calculus 0.3-0.5, basic linear algebra 0.7+
    # Taylor: Specific gaps — all math 0.8+, all neural network concepts 0.1-0.2

    mastery_profiles = {
        "Alex": {
            "Vectors": 0.9, "Matrices": 0.85, "Eigenvalues": 0.75, "Matrix Multiplication": 0.9,
            "Derivatives": 0.9, "Partial Derivatives": 0.85, "Chain Rule": 0.8, "Gradients": 0.85,
            "Bayes' Theorem": 0.75, "Distributions": 0.8, "Conditional Probability": 0.8,
            "Loss Functions": 0.85, "MSE": 0.9, "Cross-Entropy": 0.75, "Optimization": 0.8,
            "Gradient Descent": 0.85, "Learning Rate": 0.8, "Convergence": 0.75, "SGD": 0.7,
            "Perceptron": 0.9, "Activation Functions": 0.8, "Forward Pass": 0.85, "Layers": 0.85,
            "Backpropagation": 0.7, "Computational Graphs": 0.7, "Weight Updates": 0.75,
            "Overfitting": 0.8, "L1 Regularization": 0.5, "L2 Regularization": 0.5, "Dropout": 0.5,
            "Train/Val/Test Split": 0.9, "Cross-Validation": 0.75, "Bias-Variance Tradeoff": 0.7,
        },
        "Jordan": {
            "Vectors": 0.8, "Matrices": 0.75, "Eigenvalues": 0.45, "Matrix Multiplication": 0.7,
            "Derivatives": 0.75, "Partial Derivatives": 0.6, "Chain Rule": 0.5, "Gradients": 0.55,
            "Bayes' Theorem": 0.5, "Distributions": 0.7, "Conditional Probability": 0.65,
            "Loss Functions": 0.6, "MSE": 0.7, "Cross-Entropy": 0.4, "Optimization": 0.5,
            "Gradient Descent": 0.55, "Learning Rate": 0.6, "Convergence": 0.4, "SGD": 0.35,
            "Perceptron": 0.7, "Activation Functions": 0.45, "Forward Pass": 0.5, "Layers": 0.6,
            "Backpropagation": 0.2, "Computational Graphs": 0.25, "Weight Updates": 0.3,
            "Overfitting": 0.55, "L1 Regularization": 0.15, "L2 Regularization": 0.15, "Dropout": 0.2,
            "Train/Val/Test Split": 0.8, "Cross-Validation": 0.5, "Bias-Variance Tradeoff": 0.3,
        },
        "Sam": {
            "Vectors": 0.75, "Matrices": 0.7, "Eigenvalues": 0.3, "Matrix Multiplication": 0.65,
            "Derivatives": 0.5, "Partial Derivatives": 0.35, "Chain Rule": 0.3, "Gradients": 0.35,
            "Bayes' Theorem": 0.3, "Distributions": 0.45, "Conditional Probability": 0.4,
            "Loss Functions": 0.35, "MSE": 0.4, "Cross-Entropy": 0.15, "Optimization": 0.25,
            "Gradient Descent": 0.3, "Learning Rate": 0.35, "Convergence": 0.15, "SGD": 0.1,
            "Perceptron": 0.4, "Activation Functions": 0.15, "Forward Pass": 0.2, "Layers": 0.3,
            "Backpropagation": 0.1, "Computational Graphs": 0.1, "Weight Updates": 0.15,
            "Overfitting": 0.3, "L1 Regularization": 0.1, "L2 Regularization": 0.1, "Dropout": 0.1,
            "Train/Val/Test Split": 0.6, "Cross-Validation": 0.2, "Bias-Variance Tradeoff": 0.1,
        },
        "Taylor": {
            "Vectors": 0.9, "Matrices": 0.85, "Eigenvalues": 0.8, "Matrix Multiplication": 0.9,
            "Derivatives": 0.9, "Partial Derivatives": 0.85, "Chain Rule": 0.85, "Gradients": 0.9,
            "Bayes' Theorem": 0.85, "Distributions": 0.9, "Conditional Probability": 0.85,
            "Loss Functions": 0.8, "MSE": 0.85, "Cross-Entropy": 0.8, "Optimization": 0.8,
            "Gradient Descent": 0.85, "Learning Rate": 0.8, "Convergence": 0.8, "SGD": 0.15,
            "Perceptron": 0.15, "Activation Functions": 0.1, "Forward Pass": 0.15, "Layers": 0.15,
            "Backpropagation": 0.1, "Computational Graphs": 0.1, "Weight Updates": 0.15,
            "Overfitting": 0.2, "L1 Regularization": 0.15, "L2 Regularization": 0.15, "Dropout": 0.1,
            "Train/Val/Test Split": 0.85, "Cross-Validation": 0.8, "Bias-Variance Tradeoff": 0.2,
        },
    }

    print("Seeding mastery values...")
    for student_name, profile in mastery_profiles.items():
        sid = student_ids[student_name]
        count = 0
        for concept_label, confidence in profile.items():
            cid = label_to_id.get(concept_label)
            if not cid:
                continue
            api("put", f"/api/students/{sid}/mastery/{cid}", {"confidence": confidence})
            count += 1
        print(f"  {student_name}: {count} mastery values set")

    print("\n=== Seed Complete ===")
    print(f"\nCourse ID: {course_id}")
    print("\nStudent IDs:")
    for name, sid in student_ids.items():
        print(f"  {name}: {sid}")
    print("\nNext: Fill in .env with real keys, start Flask (cd api && python app.py), then run this script.")


if __name__ == "__main__":
    main()
