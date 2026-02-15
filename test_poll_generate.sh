#!/bin/bash

# Test script for poll generation endpoint
# Usage: ./test_poll_generate.sh

set -e

echo "=== Testing Poll Generation Endpoint ==="
echo ""

# You'll need to replace these IDs with real ones from your database
LECTURE_ID="cb94c1f4-47cc-4643-bead-c77ec1cd94c3"
FRONTEND_URL="http://localhost:3000"

echo "1. Testing poll generation (no conceptId - should pick most recent or random)"
echo "   POST $FRONTEND_URL/api/lectures/$LECTURE_ID/poll/generate"
echo ""

curl -X POST \
  "$FRONTEND_URL/api/lectures/$LECTURE_ID/poll/generate" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v

echo ""
echo ""
echo "2. Testing poll generation with specific concept"
echo "   (Replace CONCEPT_ID_HERE with a real concept ID from your course)"
echo ""

# Uncomment and replace CONCEPT_ID_HERE to test with specific concept
# CONCEPT_ID="CONCEPT_ID_HERE"
# curl -X POST \
#   "$FRONTEND_URL/api/lectures/$LECTURE_ID/poll/generate" \
#   -H "Content-Type: application/json" \
#   -d "{\"conceptId\": \"$CONCEPT_ID\"}" \
#   -v

echo ""
echo "=== Prerequisites for this test to work ==="
echo "1. Flask API must be running on port 5000 (cd api && python app.py)"
echo "2. Next.js must be running on port 3000 (cd frontend && npm run dev)"
echo "3. The lecture ID '$LECTURE_ID' must exist in your database"
echo "4. ANTHROPIC_API_KEY must be set in your .env file"
echo "5. The course must have at least one concept in the graph"