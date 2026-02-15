# Prereq

**Your personal knowledge graph in every lecture.**

A live learning copilot that turns lectures into personalized knowledge graphs. Students see their understanding update in real time as concepts are discussed and polls are answered; professors get a heatmap of class mastery and polls tied to the lecture.

## Features

- **PDF → knowledge graph** — Upload course material; Claude extracts concepts and prerequisites (e.g. 35+ nodes from a 200-page textbook). Each student has their own graph; mastery is a confidence score (0–1) driven by polls, tutoring, and attendance.
- **Live concept detection** — Zoom RTMS captures lecture audio; transcripts are run through concept detection (Claude Haiku) and pushed to student graphs and professor heatmap in real time via Socket.IO.
- **Contextual polling** — AI generates poll questions from what was just said and targets concepts the class is struggling with. Responses update mastery and graph colors (red → yellow → green) instantly.
- **Aaron (AI tutor)** — Post-lecture Socratic tutor (Claude Sonnet) personalized to each student’s weak nodes; Perplexity Sonar surfaces learning resources (articles, videos) for specific gaps.
- **Study groups** — Match students by complementary strengths/weaknesses; one-click Zoom link and view of who can teach what.
- **Professor dashboard** — Live heatmap by concept, per-student graphs, and in-lecture reinforcement suggestions (what to re-explain, which examples to add).

## Tech stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js, React, Tailwind CSS, react-force-graph-2d, Socket.IO |
| Backend | Flask (Python), Supabase (PostgreSQL) |
| AI | Claude Sonnet 4.5 (extraction, questions, tutoring), Claude Haiku 4.5 (detection, grading) |
| Live | Zoom RTMS (audio/transcription), Perplexity Sonar (resources) |
| Deploy | Render (frontend + API + Redis) |

## Prerequisites

- Python 3.10+
- Node.js 18+
- [Supabase](https://supabase.com) project
- API keys: Anthropic (Claude), Perplexity; optionally Zoom, Deepgram

## Installation

```bash
git clone https://github.com/jasonyi33/prereq.git
cd prereq
cp .env.example .env
```

Edit `.env` with `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, and `FLASK_API_URL` (your Flask API base URL). Zoom keys for live RTMS with their SDK.

Create the database tables in Supabase (SQL Editor).

## Running locally

**Terminal 1 — Flask API**

```bash
cd api
pip install -r requirements.txt
python main.py
```

Then seed demo data (CS229-style course, ~35 concepts, 4 students):

```bash
python scripts/seed_demo.py
```

**Terminal 2 — Next.js frontend**

```bash
cd frontend
npm install
npm run dev
```

## Project structure

```
prereq/
├── api/                 # Flask backend
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── frontend/            # Next.js + Socket.IO
│   ├── server/          # Express + Socket.IO
│   ├── src/app/         # Pages and API routes
│   ├── src/components/
│   └── ...
├── scripts/             # seed_demo.py, etc.
├── CLAUDE.md            # Dev guide and full schema
├── render.yaml          # Render config
└── .env.example
```

## License

Hackathon prototype. All rights reserved.
