# Prereq

**A live interactive learning copilot that turns lectures into personalized, ever-evolving knowledge graphs.**

Each student's graph updates in real time, showing what they've mastered, what they're struggling with, and an actionable plan to close relevant gaps. Professors get a live heatmap of class-wide learning progress, pinpointing exactly which concepts and prerequisites need reinforcement.

---

## The Problem

Traditional lectures are one-size-fits-all. Professors can't see who's lost in real time, and students don't realize they're confused until it's too late. Gaps compound, and by exam time, it's crisis mode for everyone involved.

We believe education should adapt to every individual student's learning experience. When students have different backgrounds and learning speeds, generic content wastes everyone's time. Real-time visibility into understanding turns passive listening into an active, personalized learning experience.

Research shows we retain only 10% of what we hear after three days. Add a visual, and that number jumps to 65%. Yet none of today's classroom tools give students or professors a way to reinforce concurrent understanding. Prereq bridges that gap with dynamic visual aids that provide professors real-time feedback: 12 students understand the chain rule while 8 are lost on gradient descent, so they can adapt their instruction accordingly and give those 8 students immediate, targeted help.

## Inspiration

Stanford's machine learning course (CS229) includes a 200-page reader filled with dense, interconnected concepts. While studying for the midterm, one of our team members manually mapped out all the major topics and their prerequisites to understand how everything fit together.

That exercise reinforced that learning is cumulative and interconnected. You can't understand backpropagation without the chain rule, or convolutional neural networks without linear algebra. That prerequisite chain inspired the real-time knowledge graph we're building to make dependencies visible during lecture.

---

## How It Works

### Live Concept Detection
As the professor speaks, Prereq transcribes the lecture via Zoom's RTMS SDK and automatically identifies concepts being discussed (e.g., "Backpropagation", "Chain Rule"), lighting them up on each student's personal graph.

### AI-Generated Polling
Instead of generic iClicker questions, an AI agent generates contextual polls on-the-fly based on what was just taught, specifically targeting concepts students are struggling with.

### Instant Visual Mastery Updates
Answer a question, and your personal knowledge graph updates immediately. Nodes recolor from red to yellow to green as understanding improves. You know exactly what you need to review before the next lecture.

### Live Class Heatmap Dashboard
The professor sees which concepts are struggling across the entire class in real time ("18 out of 30 students are struggling with Gradient Descent"). AI suggests how to re-teach confusing topics on the spot, enabling immediate course correction instead of waiting for office hours.

### Post-Lecture AI Tutor
After class, chat with an AI that knows your low-confidence nodes and prior learning, references specific timestamps from the recording, and uses course PDFs to fill your exact gaps, skipping generic explanations.

---

## Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  frontend/              │     │  api/                   │
│  Next.js + Socket.IO    │────→│  Flask (Python)         │
│  Port 3000              │HTTP │  Port 5000              │
│                         │     │                         │
│  - All frontend pages   │     │  - Knowledge graph CRUD │
│  - Socket.IO server     │     │  - PDF upload + extract │
│  - Zoom RTMS listener   │     │  - Mastery updates      │
│  - Claude AI calls:     │     │  - Graph queries        │
│    - concept detection  │     │  - Heatmap aggregation  │
│    - question generation│     │  - Concept extraction   │
│    - response evaluation│     │    via Claude            │
│    - tutoring agent     │     │                         │
│  - Perplexity calls     │     │                         │
└────────────┬────────────┘     └────────────┬────────────┘
             │                                │
             └──────────┬─────────────────────┘
                        ▼
              ┌──────────────────┐
              │    Supabase      │
              │  (PostgreSQL)    │
              └──────────────────┘
```

- **Frontend:** Next.js with a custom Express server for Socket.IO support, React, Tailwind CSS, and react-force-graph-2d for interactive knowledge graph visualization
- **Backend API:** Flask (Python) handles knowledge graph CRUD, mastery logic, and confidence scoring
- **Database:** Supabase (hosted PostgreSQL) shared by both services
- **Real-time:** Socket.IO pushes every update instantly to student graphs and the professor's heatmap
- **Deployment:** Render (frontend + API) with Supabase as the managed database

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Claude Sonnet 4.5** | Anthropic | Concept extraction from PDFs, question generation, Socratic tutoring agent — chosen for strong reasoning |
| **Claude Haiku 4.5** | Anthropic | High-frequency tasks (concept detection, response grading) with <1s latency — critical for real-time polling |
| **Zoom RTMS** | Zoom | Captures live audio from lectures for instant transcription and concept detection |
| **Perplexity Sonar** | Perplexity | Searches the web for learning resources matched to specific student knowledge gaps |
| **Next.js + Socket.IO** | Vercel / Socket.IO | Real-time frontend updates — when you answer a poll, your graph recolors instantly without refresh |
| **Flask + Supabase** | Python / PostgreSQL | Backend API manages knowledge graphs, mastery tracking, and confidence scoring |
| **react-force-graph-2d** | npm | Interactive, force-directed knowledge graph visualization |
| **Tailwind CSS** | npm | Utility-first styling |
| **Render** | Render | Deployed with custom Express server for Socket.IO support, web frontend, and Redis cache |

---

## Key Features in Detail

### PDF-to-Knowledge-Graph Pipeline

At the start of the semester, a professor uploads their course material as a PDF. Claude Sonnet extracts every concept and its prerequisites into a structured knowledge graph: 35+ concepts from a 200-page textbook in seconds. Each student gets their own copy, and two students in the same lecture will have completely different graphs by Week 2.

### Confidence-Driven Mastery System

Mastery is tracked as a continuous float (0.0 to 1.0), not binary pass/fail. The confidence algorithm accounts for:

- **Poll accuracy:** Correct answers raise confidence, wrong answers cap it
- **Tutoring breakthroughs:** Demonstrating understanding in the AI tutor boosts confidence by +0.2
- **Lecture attendance:** Passive attendance boosts confidence by +0.05 per detected concept, capped at 0.3 to reward engagement without letting students coast

| Confidence | Color | Meaning |
|-----------|-------|---------|
| 0.0 | Gray | Unvisited |
| 0.01 – 0.39 | Red | Not understood |
| 0.40 – 0.69 | Yellow | Partial understanding |
| 0.70 – 1.0 | Green | Mastery |

### Real-Time Concept Detection Without Hallucination

Early versions had Claude "detecting" concepts that weren't mentioned. The solution: pre-load the full concept list from the knowledge graph, then use Haiku with instructions to "only return labels from this list," turning hallucinations into zero-shot classification.

### Socratic Tutoring Agent

The post-lecture AI tutor knows your exact transcript timestamps, past quiz mistakes, and which prerequisites you're missing. It uses a Socratic method — guiding students to understanding through questions rather than giving answers directly. A separate Haiku call after each student message evaluates whether they've demonstrated understanding, automatically updating mastery when breakthroughs occur.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com) project
- API keys for Anthropic (Claude), Perplexity, and optionally Zoom/Deepgram

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/prereq.git
cd prereq

# 2. Set up Supabase
# Create a project at https://supabase.com, then apply the database schema
# using the Supabase SQL Editor (Dashboard → SQL Editor → paste and run).
# See CLAUDE.md for the full schema.

# 3. Configure environment variables
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, etc.

# 4. Start the Flask API (terminal 1)
cd api
pip install -r requirements.txt
python main.py
# Runs on http://localhost:5000

# 5. Seed the database with demo data (terminal 1, after Flask is running)
python scripts/seed_demo.py

# 6. Start the Next.js frontend (terminal 2)
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Environment Variables

```bash
# .env (root level, shared by both services)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
DEMO_MODE=true
FLASK_API_URL=http://localhost:5000

# Zoom (optional, for live lecture integration)
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_ACCOUNT_ID=...

# Deepgram (for RTMS audio transcription)
DEEPGRAM_API_KEY=...
```

---

## Demo Walkthrough

The seed script creates a CS229 Machine Learning course with ~35 concepts organized across categories (Linear Algebra, Calculus, Probability, ML Foundations, Neural Networks, etc.) and 4 demo students with pre-seeded mastery profiles:

| Student | Profile | Behavior |
|---------|---------|----------|
| **Alex** | Strong overall | Most concepts green, some yellow in regularization |
| **Jordan** | Average | Fundamentals green, intermediate yellow, advanced red |
| **Sam** | Struggling | Neural networks red, calculus mixed, basic algebra green |
| **Taylor** | Specific gaps | All math green, all neural network concepts red |

Sam is the live participant — their "struggling" profile produces the most dramatic visible changes during the demo (red → yellow → green transitions).

---

## Challenges We Faced

**Confidence Scoring is Harder Than It Looks.** We initially stored mastery as "good/ok/bad" strings but realized we needed granular float values (0.0–1.0) to capture partial understanding and avoid binary thinking. Mapping poll results to confidence deltas (correct → +0.35, wrong → cap at 0.2) required extensive testing.

**Balancing Passive vs. Active Mastery.** Should attending a lecture increase your score even if you don't answer polls? We added attendance boosts (+0.05 per detected concept), capped at 0.3 to reward engagement without letting students coast. You still need to prove understanding via polls to go green.

**Real-Time Latency.** Building for real-time taught us to obsess over latency. Every 500ms delay in poll feedback killed the "live" feeling. Haiku's speed made real-time polling feel instant: evaluate → update graph → visual feedback in under 2 seconds.

---

## What We Learned

Context is the new gold. The magic wasn't just "AI tutoring" — it was AI tutoring that knew your exact transcript timestamps, your past quiz mistakes, and which prerequisite you were missing. Generic content dies when personalization becomes free.

Effective AI education tools don't replace teachers — they give teachers superpowers (real-time class dashboards) while giving students individualized attention that scales infinitely.

---

## What's Next

- **Expand Beyond Zoom:** Integrate with Canvas, Blackboard, and Google Classroom so knowledge graphs persist across all course materials
- **Collaborative Learning Networks:** Match students based on complementary knowledge graphs for peer tutoring sessions with tailored worksheets
- **Predictive Analytics:** Use historical mastery data to predict at-risk students weeks before exams and surface early intervention recommendations
- **Hyper-Personalized Micro-Lessons:** Generate custom 2-minute review sessions tailored to each student's exact learning patterns and preferred modalities
- **Mobile App:** Review graphs, chat with the AI tutor, and access timestamped lecture clips on the go

---

## Project Structure

```
prereq/
├── api/                    # Flask backend (Python)
│   ├── src/
│   │   ├── routes/         # API endpoint handlers
│   │   ├── services/       # Business logic (concept extraction, etc.)
│   │   └── middleware/      # Request middleware
│   ├── app.py              # Flask application entry point
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile
├── frontend/               # Next.js frontend (TypeScript)
│   ├── server/             # Custom Express + Socket.IO server
│   ├── src/
│   │   ├── app/            # Next.js pages and API routes
│   │   ├── components/     # React components
│   │   └── lib/            # Shared utilities and prompt templates
│   ├── package.json
│   └── Dockerfile
├── scripts/                # Seed data and utility scripts
├── tasks/                  # Project documentation and planning
├── CLAUDE.md               # Detailed development guide
├── render.yaml             # Render deployment configuration
└── .env.example            # Environment variable template
```

---

## License

This project was built as a hackathon prototype. All rights reserved.
