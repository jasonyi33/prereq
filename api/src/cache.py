"""
Redis cache layer for Flask API.

Provides get/set/invalidate helpers with graceful fallback
when Redis is unavailable (local dev without Redis).
"""

import json
import os
import redis
from functools import wraps
from flask import request
from dotenv import load_dotenv

load_dotenv()

_redis_url = os.getenv("REDIS_URL")
_client = None

if _redis_url:
    try:
        _client = redis.from_url(_redis_url, decode_responses=True, socket_timeout=2)
        _client.ping()
        print(f"[cache] Redis connected: {_redis_url[:30]}...")
    except Exception as e:
        print(f"[cache] Redis unavailable ({e}), running without cache")
        _client = None
else:
    print("[cache] No REDIS_URL set, running without cache")


def cache_get(key: str):
    """Get a value from Redis. Returns None on miss or if Redis is unavailable."""
    if not _client:
        return None
    try:
        val = _client.get(key)
        if val is not None:
            return json.loads(val)
    except Exception:
        pass
    return None


def cache_set(key: str, value, ttl_seconds: int = 10):
    """Set a value in Redis with TTL. No-op if Redis is unavailable."""
    if not _client:
        return
    try:
        _client.setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        pass


def cache_delete(*keys: str):
    """Delete one or more keys from Redis. No-op if Redis is unavailable."""
    if not _client:
        return
    try:
        _client.delete(*keys)
    except Exception:
        pass


def cache_delete_pattern(pattern: str):
    """Delete all keys matching a glob pattern. No-op if Redis is unavailable."""
    if not _client:
        return
    try:
        cursor = 0
        while True:
            cursor, keys = _client.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                _client.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        pass


def cached(key_func, ttl: int = 10):
    """
    Decorator that caches a Flask route's JSON response in Redis.

    key_func: callable(kwargs) -> str  that returns the cache key
    ttl: cache TTL in seconds
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            cache_key = key_func(request, **kwargs)
            hit = cache_get(cache_key)
            if hit is not None:
                from flask import jsonify
                return jsonify(hit), 200
            result = f(*args, **kwargs)
            # result is a tuple (response, status_code) or just a response
            if isinstance(result, tuple):
                response, status_code = result
                if status_code == 200:
                    try:
                        cache_set(cache_key, response.get_json(), ttl)
                    except Exception:
                        pass
            return result
        return wrapper
    return decorator