# Social Pulse 🔮

> Real-time YouTube comment sentiment analysis platform powered by Gemini AI.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-green)](https://mongodb.com)

## Features

- 🎬 **YouTube integration** — Paste any video URL (watch, shorts, live, embed, youtu.be)
- 🤖 **Gemini AI analysis** — Per-comment sentiment, emotion, sarcasm, language, aspects, keywords
- 🇮🇳 **Hinglish support** — Understands Romanized Hindi mixed with English
- 📊 **Real-time dashboard** — Live progress via SSE, charts, keyword cloud, emotion radar
- 🔍 **125-item gold set** — Eval suite with accuracy/F1 metrics
- 📋 **Export** — JSON and CSV download
- ↔️ **Compare** — Side-by-side delta analysis for two videos
- 🔒 **SSRF-safe** — URL parser blocks internal IPs and non-YouTube hosts
- 🧪 **Demo mode** — Works without any API keys using bundled fixture comments

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB (Docker recommended)
- YouTube Data API v3 key (or run without one in Demo Mode)
- Google Gemini API key (or run with `AI_PROVIDER=local`)

### Setup

```bash
# 1. Clone & install
git clone <repo>
cd social-pulse
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start MongoDB
docker compose up -d

# 4. Start development servers
npm run dev          # starts both server (port 4000) & client (port 5173)
```

### Demo Mode (no keys required)

Leave `YOUTUBE_API_KEY` empty in `.env` — the server automatically switches to demo mode
using 300 built-in fixture comments. No API calls are made.

## Architecture

```
social-pulse/
├── shared/          # Zod schemas + TypeScript types (shared by client & server)
├── server/          # Express + Mongoose backend
│   ├── src/
│   │   ├── config/       # Environment config + DB connection
│   │   ├── models/       # Mongoose models (Analysis, Comment, AnalysisCache)
│   │   ├── services/
│   │   │   ├── youtube/  # URL parser, video meta, comment fetcher
│   │   │   ├── preprocess/  # Normalizer, deduplicator, spam detector
│   │   │   ├── ai/       # Provider interface, Gemini, OpenAI, local
│   │   │   └── aggregate/   # Stats computation
│   │   ├── queue/        # SSE emitter + job runner
│   │   ├── routes/       # REST API routes
│   │   └── eval/         # Gold-set evaluation suite
└── client/          # React 18 + Vite + Tailwind frontend
    └── src/
        ├── api/     # Axios client + TanStack Query hooks
        ├── hooks/   # SSE hook, theme hook
        ├── components/  # Layout, cards, progress view, all dashboard charts
        └── pages/   # Home, Dashboard, History, Compare
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server + DB health |
| POST | `/api/analyses` | Create analysis (starts background job) |
| GET | `/api/analyses` | List analyses (paginated) |
| GET | `/api/analyses/:id` | Get analysis detail |
| GET | `/api/analyses/:id/events` | SSE stream for live progress |
| GET | `/api/analyses/:id/comments` | Filtered + paginated comments |
| GET | `/api/analyses/:id/export` | Export as JSON or CSV |
| POST | `/api/analyses/:id/reanalyze` | Re-run analysis |
| DELETE | `/api/analyses/:id/job` | Cancel running job |
| DELETE | `/api/analyses/:id` | Delete analysis + comments |
| GET | `/api/analyses/compare/run?a=&b=` | Compare two analyses |
| PATCH | `/api/analyses/:id/comments/:cid/override` | Override comment sentiment |

## Running Tests

```bash
# Unit tests (URL parser, preprocessing, local analyzer)
cd server && npm test

# Gold-set evaluation (125 hand-labeled comments)
npm run eval        # from /server
```

## Environment Variables

See [.env.example](.env.example) for all options.

| Variable | Default | Description |
|----------|---------|-------------|
| `YOUTUBE_API_KEY` | — | YouTube Data API v3 key. Empty = demo mode |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `AI_PROVIDER` | `gemini` | `gemini` \| `openai` \| `local` |
| `DEMO_MODE` | auto | Force demo mode |
| `BATCH_SIZE` | `25` | Comments per LLM batch |
| `AI_CONCURRENCY` | `3` | Concurrent batch requests |
| `MAX_COMMENTS_LIMIT` | `1000` | Hard cap per analysis |

## Adding a New Platform (e.g., Twitter/X)

1. Implement the `PlatformAdapter` interface (same shape as YouTube services)
2. Add a new URL parser that validates the platform's URL format
3. Add a new comment fetcher returning `RawComment[]`
4. Register in the job runner with a platform discriminator
5. No changes to AI providers, preprocessing, or aggregation needed

## License

MIT
