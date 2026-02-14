"""
Seed script for Prereq demo.
Creates auth users, CS229 course with teacher/join code, ~35 concepts, edges,
4 students with mastery, historical lecture, polls, and tutoring session.

Requires: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY in .env

Usage:
    python scripts/seed_demo.py
"""

import requests
import sys
import os
import json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

FLASK_URL = os.getenv("FLASK_API_URL", "http://localhost:5000")
# If FLASK_URL points to prod, use localhost for seeding
if "run.app" in FLASK_URL or "render" in FLASK_URL:
    FLASK_URL = "http://localhost:5000"

DEMO_PASSWORD = "prereq-demo-2024"
JOIN_CODE = "CS229M"


def api(method, path, json_data=None):
    url = f"{FLASK_URL}{path}"
    resp = getattr(requests, method)(url, json=json_data)
    if not resp.ok:
        print(f"  FAILED {method.upper()} {path}: {resp.status_code} {resp.text}")
        sys.exit(1)
    return resp.json()


def get_supabase_admin():
    """Create admin Supabase client using service role key."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not service_key:
        print("WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Skipping auth user creation.")
        print("  Set it from Supabase Dashboard > Settings > API > service_role key")
        return None
    return create_client(url, service_key)


def get_supabase():
    """Create regular Supabase client."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    return create_client(url, key)


def create_auth_user(admin_client, email, password, name, role):
    """Create a Supabase auth user via admin API. Returns user ID or None."""
    if not admin_client:
        return None
    try:
        result = admin_client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"name": name, "role": role},
        })
        return result.user.id
    except Exception as e:
        # User might already exist
        if "already been registered" in str(e) or "already exists" in str(e):
            # Look up existing user
            users = admin_client.auth.admin.list_users()
            for u in users:
                if u.email == email:
                    return u.id
        print(f"  WARNING: Could not create auth user {email}: {e}")
        return None


def main():
    print("=== Prereq Demo Seed ===\n")

    supabase = get_supabase()
    admin = get_supabase_admin()

    # -------------------------------------------------------------------
    # 1. Create auth users
    # -------------------------------------------------------------------
    print("Creating auth users...")

    teacher_auth_id = create_auth_user(admin, "professor@stanford.edu", DEMO_PASSWORD, "Professor Andrew", "teacher")
    if teacher_auth_id:
        print(f"  Teacher: professor@stanford.edu -> {teacher_auth_id}")

    student_auth = {}
    for name, email in [("Alex", "alex@stanford.edu"), ("Jordan", "jordan@stanford.edu"),
                         ("Sam", "sam@stanford.edu"), ("Taylor", "taylor@stanford.edu")]:
        auth_id = create_auth_user(admin, email, DEMO_PASSWORD, name, "student")
        if auth_id:
            student_auth[name] = auth_id
            print(f"  {name}: {email} -> {auth_id}")

    print()

    # -------------------------------------------------------------------
    # 2. Create teacher row
    # -------------------------------------------------------------------
    teacher_id = None
    if teacher_auth_id:
        print("Creating teacher profile...")
        existing = supabase.table("teachers").select("id").eq("auth_id", teacher_auth_id).execute().data
        if existing:
            teacher_id = existing[0]["id"]
            print(f"  Teacher row already exists: {teacher_id}")
        else:
            result = supabase.table("teachers").insert({
                "auth_id": teacher_auth_id,
                "name": "Professor Andrew",
                "email": "professor@stanford.edu",
            }).execute()
            teacher_id = result.data[0]["id"]
            print(f"  Teacher row: {teacher_id}")
        print()

    # -------------------------------------------------------------------
    # 3. Create course with teacher_id and join_code
    # -------------------------------------------------------------------
    print("Creating course...")
    course_row = {
        "name": "CS229 Machine Learning",
        "description": "Stanford CS229 — Machine Learning",
        "join_code": JOIN_CODE,
    }
    if teacher_id:
        course_row["teacher_id"] = teacher_id

    result = supabase.table("courses").insert(course_row).execute()
    course_id = result.data[0]["id"]
    print(f"  Course: {course_id} (join code: {JOIN_CODE})\n")

    # -------------------------------------------------------------------
    # 4. Insert concepts
    # -------------------------------------------------------------------
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
    print(f"  Total concepts: {len(label_to_id)}\n")

    # -------------------------------------------------------------------
    # 5. Insert edges
    # -------------------------------------------------------------------
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

    # -------------------------------------------------------------------
    # 6. Create students (with auth_id if available)
    # -------------------------------------------------------------------
    print("Creating students...")
    students_spec = [
        {"name": "Alex", "email": "alex@stanford.edu"},
        {"name": "Jordan", "email": "jordan@stanford.edu"},
        {"name": "Sam", "email": "sam@stanford.edu"},
        {"name": "Taylor", "email": "taylor@stanford.edu"},
    ]

    student_ids = {}
    for s in students_spec:
        row = {
            "name": s["name"],
            "email": s["email"],
            "course_id": course_id,
        }
        auth_id = student_auth.get(s["name"])
        if auth_id:
            row["auth_id"] = auth_id

        student = supabase.table("students").insert(row).execute().data[0]
        student_ids[s["name"]] = student["id"]
        print(f"  {s['name']} -> {student['id']}")

    # Create mastery rows for all students
    for sname, sid in student_ids.items():
        mastery_rows = [{
            "student_id": sid,
            "concept_id": cid,
            "confidence": 0.0,
        } for cid in label_to_id.values()]
        if mastery_rows:
            supabase.table("student_mastery").insert(mastery_rows).execute()
    print()

    # -------------------------------------------------------------------
    # 7. Seed mastery values
    # -------------------------------------------------------------------
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
            supabase.table("student_mastery").update({
                "confidence": confidence
            }).eq("student_id", sid).eq("concept_id", cid).execute()
            count += 1
        print(f"  {student_name}: {count} mastery values set")
    print()

    # -------------------------------------------------------------------
    # 8. Historical completed lecture
    # -------------------------------------------------------------------
    print("Creating historical lecture...")
    lecture = supabase.table("lecture_sessions").insert({
        "course_id": course_id,
        "title": "CS229 Lecture 12: Intro to Neural Networks",
        "status": "completed",
    }).execute().data[0]
    lecture_id = lecture["id"]
    print(f"  Lecture: {lecture_id}\n")

    # Transcript chunks
    transcript_chunks_data = [
        {"text": "Today we're going to talk about neural networks, starting from the basic building block — the perceptron.", "timestamp_sec": 0, "speaker_name": "Professor Andrew"},
        {"text": "A perceptron takes a weighted sum of its inputs, adds a bias, and passes it through an activation function.", "timestamp_sec": 45, "speaker_name": "Professor Andrew"},
        {"text": "The most common activation functions are ReLU, sigmoid, and tanh. ReLU is the most popular in modern networks.", "timestamp_sec": 120, "speaker_name": "Professor Andrew"},
        {"text": "When we stack multiple layers of neurons together, we get a deep neural network. Each layer transforms the data.", "timestamp_sec": 210, "speaker_name": "Professor Andrew"},
        {"text": "The forward pass computes the output by propagating the input through each layer sequentially.", "timestamp_sec": 300, "speaker_name": "Professor Andrew"},
        {"text": "To train the network, we need to compute gradients of the loss with respect to each weight. This is where backpropagation comes in.", "timestamp_sec": 420, "speaker_name": "Professor Andrew"},
        {"text": "Backpropagation applies the chain rule recursively through the computational graph to compute all gradients efficiently.", "timestamp_sec": 510, "speaker_name": "Professor Andrew"},
        {"text": "Once we have the gradients, we update the weights using gradient descent — moving each weight in the direction that reduces the loss.", "timestamp_sec": 600, "speaker_name": "Professor Andrew"},
        {"text": "The learning rate controls how large each step is. Too large and you overshoot, too small and training is slow.", "timestamp_sec": 690, "speaker_name": "Professor Andrew"},
        {"text": "In practice, we use stochastic gradient descent with mini-batches rather than computing the gradient over the entire dataset.", "timestamp_sec": 780, "speaker_name": "Professor Andrew"},
    ]

    # Concept associations for transcript chunks
    chunk_concepts = [
        ["Perceptron"],
        ["Perceptron", "Activation Functions"],
        ["Activation Functions"],
        ["Layers"],
        ["Forward Pass"],
        ["Backpropagation", "Gradients"],
        ["Backpropagation", "Chain Rule", "Computational Graphs"],
        ["Weight Updates", "Gradient Descent"],
        ["Learning Rate"],
        ["SGD"],
    ]

    print("Creating transcript chunks...")
    chunk_ids = []
    for i, chunk in enumerate(transcript_chunks_data):
        result = supabase.table("transcript_chunks").insert({
            "lecture_id": lecture_id,
            "text": chunk["text"],
            "timestamp_sec": chunk["timestamp_sec"],
            "speaker_name": chunk["speaker_name"],
        }).execute()
        chunk_id = result.data[0]["id"]
        chunk_ids.append(chunk_id)

        # Link concepts
        for label in chunk_concepts[i]:
            cid = label_to_id.get(label)
            if cid:
                supabase.table("transcript_concepts").insert({
                    "transcript_chunk_id": chunk_id,
                    "concept_id": cid,
                }).execute()
    print(f"  {len(chunk_ids)} transcript chunks with concept links\n")

    # -------------------------------------------------------------------
    # 9. Historical closed polls
    # -------------------------------------------------------------------
    print("Creating historical polls...")

    # Poll 1: about Backpropagation
    poll1 = supabase.table("poll_questions").insert({
        "lecture_id": lecture_id,
        "concept_id": label_to_id["Backpropagation"],
        "question": "What is the primary purpose of backpropagation in neural networks?",
        "expected_answer": "To efficiently compute gradients of the loss function with respect to each weight in the network by applying the chain rule through the computational graph.",
        "status": "closed",
    }).execute().data[0]

    # Poll 2: about Activation Functions
    poll2 = supabase.table("poll_questions").insert({
        "lecture_id": lecture_id,
        "concept_id": label_to_id["Activation Functions"],
        "question": "Why do neural networks need non-linear activation functions?",
        "expected_answer": "Without non-linear activation functions, stacking multiple layers would be equivalent to a single linear transformation, making the network unable to learn complex non-linear relationships.",
        "status": "closed",
    }).execute().data[0]

    # Poll responses matching student profiles
    poll_responses = [
        # Poll 1 (Backpropagation)
        {"poll_id": poll1["id"], "student": "Alex", "answer": "Backpropagation computes the gradients of the loss with respect to every weight by applying the chain rule through the computational graph, allowing efficient gradient descent.", "eval": "correct"},
        {"poll_id": poll1["id"], "student": "Jordan", "answer": "It propagates the error backwards through the network to update the weights somehow.", "eval": "partial"},
        {"poll_id": poll1["id"], "student": "Sam", "answer": "It makes the network learn by going backwards.", "eval": "wrong"},
        {"poll_id": poll1["id"], "student": "Taylor", "answer": "Backpropagation is the backward pass that computes all partial derivatives of the loss using the chain rule on the computational graph.", "eval": "correct"},
        # Poll 2 (Activation Functions)
        {"poll_id": poll2["id"], "student": "Alex", "answer": "Without non-linear activations, stacking layers would just be one big linear transformation, so the network couldn't learn non-linear decision boundaries.", "eval": "correct"},
        {"poll_id": poll2["id"], "student": "Jordan", "answer": "They add non-linearity which helps the network learn more complex patterns.", "eval": "partial"},
        {"poll_id": poll2["id"], "student": "Sam", "answer": "They make the neurons fire or not fire.", "eval": "wrong"},
        {"poll_id": poll2["id"], "student": "Taylor", "answer": "I'm not sure, maybe to speed up training?", "eval": "wrong"},
    ]

    for pr in poll_responses:
        evaluation = {
            "eval_result": pr["eval"],
            "feedback": f"{'Good understanding!' if pr['eval'] == 'correct' else 'Partially correct.' if pr['eval'] == 'partial' else 'Not quite right.'}",
            "reasoning": f"Student response evaluated as {pr['eval']}.",
        }
        supabase.table("poll_responses").insert({
            "question_id": pr["poll_id"],
            "student_id": student_ids[pr["student"]],
            "answer": pr["answer"],
            "evaluation": json.dumps(evaluation),
        }).execute()

    print(f"  2 polls with {len(poll_responses)} responses\n")

    # -------------------------------------------------------------------
    # 10. Historical tutoring session for Sam
    # -------------------------------------------------------------------
    print("Creating tutoring session for Sam...")
    session = supabase.table("tutoring_sessions").insert({
        "student_id": student_ids["Sam"],
        "target_concepts": [label_to_id["Backpropagation"], label_to_id["Chain Rule"]],
    }).execute().data[0]
    session_id = session["id"]

    tutoring_messages = [
        {"role": "assistant", "content": "Hi Sam! I noticed you're working on understanding backpropagation. Let's start with the basics — can you tell me what you know about how a neural network computes its output?"},
        {"role": "user", "content": "I know it goes through layers and does some math but I'm not really sure about the details."},
        {"role": "assistant", "content": "That's a good start! The forward pass is where the input data flows through each layer. At each neuron, the inputs are multiplied by weights, summed up, and then passed through an activation function. Now, backpropagation is essentially the reverse of this — it figures out how much each weight contributed to the error. Do you remember the chain rule from calculus?"},
        {"role": "user", "content": "Kind of — it's when you multiply derivatives together for composed functions right?"},
    ]

    rows = []
    for msg in tutoring_messages:
        rows.append({
            "session_id": session_id,
            "role": msg["role"],
            "content": msg["content"],
        })
    supabase.table("tutoring_messages").insert(rows).execute()
    print(f"  Session {session_id} with {len(tutoring_messages)} messages\n")

    # -------------------------------------------------------------------
    # Done!
    # -------------------------------------------------------------------
    print("=" * 50)
    print("=== Seed Complete ===")
    print("=" * 50)
    print(f"\nCourse ID: {course_id}")
    print(f"Join Code: {JOIN_CODE}")
    print(f"\nStudent IDs:")
    for name, sid in student_ids.items():
        print(f"  {name}: {sid}")

    if teacher_auth_id:
        print(f"\n--- Demo Credentials ---")
        print(f"Teacher:  professor@stanford.edu / {DEMO_PASSWORD}")
        print(f"Alex:     alex@stanford.edu / {DEMO_PASSWORD}")
        print(f"Jordan:   jordan@stanford.edu / {DEMO_PASSWORD}")
        print(f"Sam:      sam@stanford.edu / {DEMO_PASSWORD}  (live participant)")
        print(f"Taylor:   taylor@stanford.edu / {DEMO_PASSWORD}")
        print(f"Join Code: {JOIN_CODE}")
    else:
        print(f"\n(Auth users not created — set SUPABASE_SERVICE_ROLE_KEY to enable)")


if __name__ == "__main__":
    main()
