import os
import functools
from flask import request, jsonify, g
import jwt

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def _decode_token():
    """Decode JWT from Authorization header. Returns decoded payload or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    if not SUPABASE_JWT_SECRET:
        return None

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def optional_auth(f):
    """Decorator: decode JWT if present, set g.user (or None). Never blocks."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        g.user = _decode_token()
        return f(*args, **kwargs)
    return wrapper


def require_auth(f):
    """Decorator: decode JWT, return 401 if missing/invalid."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        g.user = _decode_token()
        if g.user is None:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return wrapper
