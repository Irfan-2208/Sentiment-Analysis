# Social Pulse 🔮

> Real-time YouTube comment & Flipkart product review sentiment analysis platform powered by Gemini AI.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-green)](https://mongodb.com)

## Features

- 🎬 **YouTube integration** — Paste any video URL (watch, shorts, live, embed, youtu.be)
- 🛒 **Flipkart Reviews** — Upload CSV/JSON/TXT files or paste reviews directly (no scraping)
- 🤖 **Gemini AI analysis** — Per-comment sentiment, emotion, sarcasm, language, aspects, keywords
- 🇮🇳 **Hinglish support** — Understands Romanized Hindi, Devanagari, and English mixed text
- 📊 **Real-time dashboard** — Live progress via SSE, charts, keyword cloud, emotion radar
- ⭐ **Review aspects** — Quality, price, delivery, packaging, battery, camera, service, fit/size, durability, genuineness
- 🚨 **Rating-vs-text mismatch** — Detects when star rating contradicts review text (sarcasm / fake reviews)
- 📈 **Rating distribution** — 1★–5★ breakdown with average and pros/cons summary
- 🔍 **125-item gold set** — Eval suite with accuracy/F1 metrics
- 📋 **Export** — JSON and CSV download
- ↔️ **Compare** — Side-by-side delta analysis for two videos
- 🔒 **SSRF-safe** — URL parser blocks internal IPs and non-YouTube hosts
- 🧪 **Demo mode** — Works without any API keys using bundled fixture data (YouTube + 200 Flipkart reviews)

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
using 300 built-in fixture YouTube comments. No API calls are made.

For Flipkart, demo mode serves 200 built-in reviews (English / Hindi / Hinglish) from
`server/src/fixtures/demoReviews.json`.

## Architecture

```
social-pulse/
├── shared/          # Zod schemas + TypeScript types (shared by client & server)
├── server/          # Express + Mongoose backend
│   ├── src/
│   │   ├── config/       # Environment config + DB connection
│   │   ├── models/       # Mongoose models (Analysis, Comment, AnalysisCache)
│   │   ├── services/
│   │   │   ├── sources/  # Platform adapter interface + adapters
│   │   │   │   ├── types.ts              # SourceAdapter interface
│   │   │   │   ├── adapterRegistry.ts    # getSourceAdapter(platform)
│   │   │   │   ├── youtubeAdapter.ts     # YouTube wrapped as SourceAdapter
│   │   │   │   ├── flipkartCsvAdapter.ts # CSV/JSON/paste upload (default)
│   │   │   │   ├── flipkartProviderAdapter.ts  # Optional 3rd-party (OFF by default)
│   │   │   │   ├── flipkartAffiliate.ts  # Optional affiliate meta
│   │   │   │   └── flipkartUrlParser.ts  # Extract productId for display only
│   │   │   ├── preprocess/  # Normalizer, deduplicator, spam detector
│   │   │   ├── ai/       # Provider interface, Gemini, OpenAI, local ensemble
│   │   │   └── aggregate/   # Stats computation (rating dist, mismatch, aspects)
│   │   ├── queue/        # SSE emitter + job runner (platform-aware)
│   │   ├── routes/       # REST API routes
│   │   ├── fixtures/     # demoReviews.json (200 Flipkart demo reviews)
│   │   └── eval/         # Gold-set evaluation suite
└── client/          # React 18 + Vite + Tailwind frontend
    └── src/
        ├── api/     # Axios client + TanStack Query hooks
        ├── hooks/   # SSE hook, theme hook
        ├── components/
        │   └── dashboard/  # AspectBreakdown, ProductHeader, RatingDistribution,
        │                   # ProsConsList, RatingMismatchBanner, CommentFeed
        └── pages/   # Home (platform switcher), Dashboard, History, Compare
```

## Platform Adapter Pattern

All data sources implement the `SourceAdapter` interface:

```ts
interface SourceAdapter {
  id: string;
  validateInput(input: SourceInput): Promise<void>;
  fetchMeta(input: SourceInput): Promise<SourceMeta>;
  fetchItems(input: SourceInput, opts: FetchOptions, onProgress: ProgressFn): AsyncGenerator<RawItem>;
}
```

Adding a new platform:
1. Implement `SourceAdapter` in `server/src/services/sources/`
2. Register it in `adapterRegistry.ts`
3. Add `platform` value to `PlatformSchema` in `shared/src/schemas/index.ts`
4. Add UI tab in `client/src/pages/HomePage.tsx`

No changes to AI providers, preprocessing, or aggregation are needed.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server + DB health |
| POST | `/api/analyses` | Create analysis — JSON body or multipart/form-data (file upload) |
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

### Creating a Flipkart Analysis (file upload)

```bash
curl -X POST http://localhost:4000/api/analyses \
  -F "platform=flipkart" \
  -F "file=@reviews.csv" \
  -F 'options={"provider":"gemini"}'
```

### Creating a Flipkart Analysis (pasted text)

```bash
curl -X POST http://localhost:4000/api/analyses \
  -H "Content-Type: application/json" \
  -d '{"platform":"flipkart","pastedText":"Great product!\nTerrible quality, broke in 2 days."}'
```

## Running Tests

```bash
# Unit tests (URL parser, preprocessing, local analyzer, Flipkart CSV, mismatch)
cd server && npm test

# Gold-set evaluation (125 hand-labeled comments)
npm run eval        # from /server
```

**Current test results:** 8 test files, 107 passed, 9 skipped (integration tests skipped in CI)

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
| `FLIPKART_PROVIDER` | `none` | `none` \| `apify` \| `custom` — enables optional 3rd-party provider |
| `FLIPKART_PROVIDER_KEY` | — | API key for the optional provider (never sent to client) |
| `FLIPKART_AFFILIATE_ID` | — | Flipkart Affiliate ID (optional — for product metadata) |
| `FLIPKART_AFFILIATE_TOKEN` | — | Flipkart Affiliate token (optional) |

---

## 📋 Data Access & Compliance

This section documents exactly how each data source is accessed, which paths are official,
and what you must verify before enabling optional features.

### YouTube (Official API)

- **Method:** YouTube Data API v3 (`/commentThreads`, `/videos`)
- **Status:** ✅ Official & fully compliant
- **Requirement:** `YOUTUBE_API_KEY` — obtain from [Google Cloud Console](https://console.cloud.google.com/)
- **Limits:** Subject to standard YouTube API quota (10,000 units/day default)
- **Terms:** [YouTube API Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)

### Flipkart — CSV / JSON / Paste Upload (Default)

- **Method:** User uploads their own exported review file (`.csv`, `.json`, `.txt`) or pastes review text
- **Status:** ✅ Official & fully compliant — your own data, no third-party involved
- **Limits:** 5 MB file size, 5,000 rows per upload
- **Scraping:** ❌ **No scraping of flipkart.com is performed anywhere in this codebase**
- **Requirements:** None (works out of the box)

### Flipkart — Optional Third-Party Provider (`FLIPKART_PROVIDER`)

- **Method:** Calls an external API (e.g., Apify actor) to fetch reviews — **OFF by default**
- **Status:** ⚠️ Optional — requires explicit opt-in via `FLIPKART_PROVIDER=apify|custom`
- **Requirements:** `FLIPKART_PROVIDER_KEY` — API key for the chosen provider
- **Security:** Key is server-side only, never exposed to the client
- **⚠️ User responsibility:** Before enabling this feature, you **must** verify that:
  1. The chosen provider's terms of service permit the use case
  2. Flipkart's terms of service are satisfied for your usage
  3. Any applicable data protection regulations (GDPR, IT Act, etc.) are met
- **Scraping:** This adapter calls the provider's API. The provider may or may not scrape Flipkart. **We do not build or maintain any scraper.**

### Flipkart — Affiliate Product Metadata (`FLIPKART_AFFILIATE_*`)

- **Method:** Flipkart Affiliate Program API — fetches product title, price, image for the dashboard header
- **Status:** ✅ Official Flipkart API (when credentials are valid)
- **Requirements:** `FLIPKART_AFFILIATE_ID` + `FLIPKART_AFFILIATE_TOKEN` — from [Flipkart Affiliate Program](https://affiliate.flipkart.com/)
- **Fallback:** If credentials are absent, product name from the upload form is used instead
- **Terms:** [Flipkart Affiliate Terms](https://affiliate.flipkart.com/static/termsconditions)

### Flipkart URL Parsing

- **Method:** Local regex parsing of flipkart.com URLs — **no HTTP request is made**
- **Purpose:** Display only (extracts `productId` and `titleSlug` for the dashboard header)
- **Scraping:** ❌ No requests to flipkart.com are made during URL parsing

---

## License

MIT
