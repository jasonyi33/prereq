from flask import request, jsonify, Blueprint, g

from ..db import supabase
from ..middleware.auth import require_auth

auth = Blueprint("auth", __name__)


@auth.route('/api/auth/signup', methods=['POST'])
def signup():
    """Sign up a new user via Supabase Auth (server-side). Returns access token."""
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")
    name = data.get("name", "")
    role = data.get("role", "student")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        res = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"name": name, "role": role}},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    if not res.session:
        # Supabase may require email confirmation
        return jsonify({"error": "Signup succeeded but no session returned. Check email confirmation settings."}), 400

    access_token = res.session.access_token
    user = res.user

    # If teacher, auto-create teacher profile
    if role == "teacher":
        existing = supabase.table("teachers").select("id").eq("auth_id", user.id).execute().data
        if not existing:
            supabase.table("teachers").insert({
                "auth_id": user.id,
                "name": name,
                "email": email,
            }).execute()

    return jsonify({
        "access_token": access_token,
        "user": {"id": user.id, "email": user.email},
        "role": role,
    }), 200


@auth.route('/api/auth/login', methods=['POST'])
def login():
    """Log in via Supabase Auth (server-side). Returns access token + profile."""
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        res = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    if not res.session:
        return jsonify({"error": "Login failed — no session returned"}), 401

    access_token = res.session.access_token
    user = res.user
    auth_id = user.id

    # Build profile response (same logic as get_me)
    teacher = supabase.table("teachers").select("id, name, email").eq("auth_id", auth_id).execute().data
    if teacher:
        teacher_row = teacher[0]
        courses = supabase.table("courses").select("id, name, description, join_code").eq(
            "teacher_id", teacher_row["id"]
        ).execute().data
        return jsonify({
            "access_token": access_token,
            "user": {"id": user.id, "email": user.email},
            "role": "teacher",
            "profile": teacher_row,
            "courses": courses,
        }), 200

    students = supabase.table("students").select("id, name, email, course_id").eq("auth_id", auth_id).execute().data
    if students:
        enrollments = []
        for s in students:
            course = supabase.table("courses").select("id, name").eq("id", s["course_id"]).execute().data
            enrollments.append({
                "student_id": s["id"],
                "course_id": s["course_id"],
                "course_name": course[0]["name"] if course else "Unknown",
            })
        return jsonify({
            "access_token": access_token,
            "user": {"id": user.id, "email": user.email},
            "role": "student",
            "profile": {"name": students[0]["name"], "email": students[0]["email"]},
            "enrollments": enrollments,
        }), 200

    # Authenticated but no profile — return role hint from metadata
    role_hint = (user.user_metadata or {}).get("role", "unknown")
    return jsonify({
        "access_token": access_token,
        "user": {"id": user.id, "email": user.email},
        "role": role_hint,
        "profile": None,
        "courses": [] if role_hint == "teacher" else None,
        "enrollments": [] if role_hint == "student" else None,
    }), 200


@auth.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    """Sign out the user server-side (best effort)."""
    try:
        supabase.auth.admin.sign_out(g.user["sub"])
    except Exception:
        pass  # Best effort — frontend drops token regardless
    return jsonify({"ok": True}), 200


@auth.route('/api/auth/me', methods=['GET'])
@require_auth
def get_me():
    """Look up teacher or student profile for the authenticated user."""
    auth_id = g.user["sub"]

    # Check if teacher
    teacher = supabase.table("teachers").select("id, name, email").eq("auth_id", auth_id).execute().data
    if teacher:
        teacher_row = teacher[0]
        # Get teacher's courses
        courses = supabase.table("courses").select("id, name, description, join_code").eq(
            "teacher_id", teacher_row["id"]
        ).execute().data
        return jsonify({
            "role": "teacher",
            "profile": teacher_row,
            "courses": courses,
        }), 200

    # Check if student (may have multiple enrollments across courses)
    students = supabase.table("students").select("id, name, email, course_id").eq("auth_id", auth_id).execute().data
    if students:
        enrollments = []
        for s in students:
            course = supabase.table("courses").select("id, name").eq("id", s["course_id"]).execute().data
            enrollments.append({
                "student_id": s["id"],
                "course_id": s["course_id"],
                "course_name": course[0]["name"] if course else "Unknown",
            })
        return jsonify({
            "role": "student",
            "profile": {"name": students[0]["name"], "email": students[0]["email"]},
            "enrollments": enrollments,
        }), 200

    # Authenticated but no profile yet — check user_metadata for role hint
    role_hint = g.user.get("user_metadata", {}).get("role", "unknown")
    return jsonify({
        "role": role_hint,
        "profile": None,
        "courses": [] if role_hint == "teacher" else None,
        "enrollments": [] if role_hint == "student" else None,
    }), 200


@auth.route('/api/auth/teacher-profile', methods=['POST'])
@require_auth
def create_teacher_profile():
    """Create teacher row linked to auth user. Idempotent."""
    auth_id = g.user["sub"]
    email = g.user.get("email", "")
    data = request.json or {}
    name = data.get("name", g.user.get("user_metadata", {}).get("name", "Professor"))

    # Check if already exists
    existing = supabase.table("teachers").select("id, name, email").eq("auth_id", auth_id).execute().data
    if existing:
        return jsonify(existing[0]), 200

    result = supabase.table("teachers").insert({
        "auth_id": auth_id,
        "name": name,
        "email": email,
    }).execute()

    return jsonify(result.data[0]), 201
