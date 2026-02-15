#!/bin/bash

# Comprehensive local test for poll generation
# This script tests the full chain: Next.js API -> Flask API -> Claude API

set -e

FLASK_URL="${FLASK_API_URL:-http://localhost:8080}"

# Get a valid lecture ID from the API
if [ -z "$LECTURE_ID" ]; then
    echo "Fetching a valid lecture ID..."
    COURSES=$(curl -s "$FLASK_URL/api/courses")
    COURSE_ID=$(echo "$COURSES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -z "$COURSE_ID" ]; then
        echo "✗ No courses found. Create a course first."
        exit 1
    fi

    LECTURES=$(curl -s "$FLASK_URL/api/courses/$COURSE_ID/lectures")
    LECTURE_ID=$(echo "$LECTURES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -z "$LECTURE_ID" ]; then
        echo "✗ No lectures found. Create a lecture first:"
        echo "  curl -X POST $FLASK_URL/api/lectures -H 'Content-Type: application/json' -d '{\"course_id\":\"$COURSE_ID\",\"title\":\"Test Lecture\"}'"
        exit 1
    fi

    echo "✓ Using lecture: $LECTURE_ID"
    echo ""
fi
NEXT_URL="http://localhost:3000"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Poll Generation Endpoint Test Suite                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check Flask health
echo "━━━ Step 1: Checking Flask API health ━━━"
if curl -s "$FLASK_URL/api/health" | grep -q "ok"; then
    echo "✓ Flask API is running on $FLASK_URL"
else
    echo "✗ Flask API is NOT running on $FLASK_URL"
    echo "  Start it with: cd api && python app.py"
    exit 1
fi
echo ""

# Step 2: Check Next.js health
echo "━━━ Step 2: Checking Next.js health ━━━"
if curl -s "$NEXT_URL/api/health" > /dev/null 2>&1; then
    echo "✓ Next.js is running on $NEXT_URL"
else
    echo "✗ Next.js is NOT running on $NEXT_URL"
    echo "  Start it with: cd frontend && npm run dev"
    exit 1
fi
echo ""

# Step 3: Check if lecture exists
echo "━━━ Step 3: Checking if lecture exists ━━━"
echo "Lecture ID: $LECTURE_ID"
LECTURE_RESPONSE=$(curl -s "$FLASK_URL/api/lectures/$LECTURE_ID")
if echo "$LECTURE_RESPONSE" | grep -q "error"; then
    echo "✗ Lecture not found: $LECTURE_RESPONSE"
    echo ""
    echo "Get a valid lecture ID by running this SQL in Supabase:"
    echo "  SELECT id, title FROM lecture_sessions ORDER BY started_at DESC LIMIT 1;"
    echo ""
    echo "Then run: LECTURE_ID=<your-lecture-id> ./test_poll_locally.sh"
    exit 1
fi

COURSE_ID=$(echo "$LECTURE_RESPONSE" | grep -o '"course_id":"[^"]*"' | cut -d'"' -f4)
echo "✓ Lecture exists"
echo "  Course ID: $COURSE_ID"
echo ""

# Step 4: Check if course has concepts
echo "━━━ Step 4: Checking if course has concepts ━━━"
GRAPH_RESPONSE=$(curl -s "$FLASK_URL/api/courses/$COURSE_ID/graph")
CONCEPT_COUNT=$(echo "$GRAPH_RESPONSE" | grep -o '"id"' | wc -l | xargs)
if [ "$CONCEPT_COUNT" -eq 0 ]; then
    echo "✗ Course has no concepts"
    echo "  Upload a PDF or run seed script: python scripts/seed_demo.py"
    exit 1
fi
echo "✓ Course has $CONCEPT_COUNT concepts"
echo ""

# Step 5: Check ANTHROPIC_API_KEY
echo "━━━ Step 5: Checking ANTHROPIC_API_KEY ━━━"
if grep -q "ANTHROPIC_API_KEY=" ../../.env 2>/dev/null || grep -q "ANTHROPIC_API_KEY=" .env 2>/dev/null; then
    echo "✓ ANTHROPIC_API_KEY found in .env"
else
    echo "✗ ANTHROPIC_API_KEY not found in .env"
    echo "  Add it to your .env file: ANTHROPIC_API_KEY=sk-ant-..."
    exit 1
fi
echo ""

# Step 6: Test the endpoint
echo "━━━ Step 6: Testing poll generation endpoint ━━━"
echo "POST $NEXT_URL/api/lectures/$LECTURE_ID/poll/generate"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$NEXT_URL/api/lectures/$LECTURE_ID/poll/generate" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ SUCCESS!"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""

    POLL_ID=$(echo "$BODY" | grep -o '"pollId":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$POLL_ID" ]; then
        echo "━━━ Poll created successfully! ━━━"
        echo "Poll ID: $POLL_ID"
        echo ""
        echo "Next steps to test:"
        echo "1. Activate poll:"
        echo "   curl -X POST $NEXT_URL/api/lectures/$LECTURE_ID/poll/$POLL_ID/activate"
        echo ""
        echo "2. Check poll status in database:"
        echo "   SELECT * FROM poll_questions WHERE id = '$POLL_ID';"
    fi
else
    echo "✗ FAILED with status $HTTP_CODE"
    echo ""
    echo "Response body:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""

    # Debug hints based on error
    if echo "$BODY" | grep -q "Lecture not found"; then
        echo "Debug: Lecture lookup failed. Check Flask logs."
    elif echo "$BODY" | grep -q "Failed to fetch course graph"; then
        echo "Debug: Graph fetch failed. Check Flask /api/courses/$COURSE_ID/graph endpoint."
    elif echo "$BODY" | grep -q "No concepts available"; then
        echo "Debug: Course has no concepts. Upload a PDF or run seed script."
    elif echo "$BODY" | grep -q "Failed to generate question"; then
        echo "Debug: Claude API call failed. Check ANTHROPIC_API_KEY and Next.js logs."
    fi
    exit 1
fi