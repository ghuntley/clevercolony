# Clever Colony

Clever Colony is a Cloudflare Pages + SvelteKit chat application with:

- multi-conversation sidebar (pinning + bulk actions + recency groups + auto-title),
- model selection across ZAI + Cloudflare Workers AI,
- image generation with R2 storage,
- editable memory subsystem backed by D1,
- optional Serper-powered web search grounding (graceful fallback when unavailable),
- Mermaid diagram rendering,
- immutable audit trail (append-only + hash-chain).

## Tech stack

- SvelteKit (Svelte 5 + TypeScript)
- Cloudflare Pages adapter
- Cloudflare D1 + R2 + AI bindings
- Storybook for component development

## Local development

Install dependencies:

```bash
npm install
```

Run app:

```bash
npm run dev
```

Run checks:

```bash
npm run check
```

Run unit and property-based tests:

```bash
npm test
```

Run Storybook:

```bash
npm run storybook
```

Build app:

```bash
npm run build
```

Run the pre-deploy smoke suite:

```bash
npm run test:smoke
```

Run the full release smoke suite (includes Storybook production build):

```bash
npm run test:smoke:full
```

## Continuous integration

GitHub Actions runs two jobs on pushes and pull requests:

- `npm run test:smoke` (unit tests + type checks + app build)
- `npm run build-storybook`

## Health endpoint

For deploy health checks, an unauthenticated endpoint is available:

- `GET /api/health` → `{ status: "ok", timestamp }`

## Auth gate allowlist

Unauthenticated access is intentionally limited to:

- `/login`
- `/api/auth/*`
- `/api/health`
- compiled app assets under `/_app/*`
- explicit static metadata assets (`/robots.txt`, `/favicon.ico`, `/manifest.webmanifest`, `/site.webmanifest`)

## Environment variables

Configure these in Cloudflare Pages project settings (and locally through Wrangler where needed):

- `APP_ACCESS_PASSWORD_HASH` (required)
- `APP_SESSION_SECRET` (required)
- `ZAI_API_KEY` (required for ZAI model/image usage)
- `SERPER_API_KEY` (required when web search toggle is used)
- `CF_ACCOUNT_ID` + `CF_API_TOKEN` (optional fallback path for Workers AI REST usage)

You can start from the checked-in template:

```bash
cp .env.example .env
```

### Password hash format

Password hash format is:

```text
pbkdf2_sha256$<iterations>$<salt-base64url>$<digest-base64url>
```

Use PBKDF2-SHA256 with at least `100000` iterations.

Generate a compatible hash quickly:

```bash
npm run hash:password -- "your-shared-password"
```

## Cloudflare bindings

`wrangler.toml` expects:

- D1 binding: `DB`
- R2 binding: `MEDIA_BUCKET`
- AI binding: `AI`

Apply D1 schema migrations:

```bash
npx wrangler d1 migrations apply clever-colony --local
```

## Cloudflare Pages deployment checklist

1. Create a Cloudflare Pages project connected to this repository/branch.
2. Configure build settings:
   - Build command: `npm run build`
   - Build output directory: `.svelte-kit/cloudflare`
3. Add bindings in Pages settings matching `wrangler.toml`:
   - D1 database binding `DB`
   - R2 bucket binding `MEDIA_BUCKET`
   - AI binding `AI`
4. Add required environment variables:
   - `APP_ACCESS_PASSWORD_HASH`
   - `APP_SESSION_SECRET`
   - `ZAI_API_KEY` (if using ZAI models)
   - `SERPER_API_KEY` (if using web search)
5. Apply D1 migrations to the remote database before first production traffic:

```bash
npx wrangler d1 migrations apply clever-colony --remote
```

6. Run smoke checks before shipping:

```bash
npm run test:smoke
```

## Security posture (MVP)

- Shared-password session gate (browser-session cookie only)
- Audit events are immutable by API contract and hash-chained
- R2 image retrieval is auth-gated
- Mermaid rendering uses strict security mode
- Web search is opt-in per message and result-capped

## Runtime policies (best-practice defaults)

### R2 image policy

- Bucket is treated as private; images are served through authenticated app endpoints.
- Generated image objects are stored under app-managed keys and linked in D1 (`image_assets`).
- Default retention target is **90 days**, with manual deletion available through app-level delete flows.
- For production, set an R2 lifecycle rule to enforce expiry and limit storage growth.

### Web search policy (Serper)

- Search is **manual per message** (toggle in composer); default is off.
- Scope is the Serper `search` endpoint only.
- Result depth is capped at top 5 normalized citations to control token and quota usage.
- If Serper is unavailable or key is missing, chat still runs without search grounding.

### Mermaid policy

- Mermaid blocks are normalized server-side and rendered client-side.
- Rendering runs in strict security mode.
- Oversized/invalid Mermaid payloads are rejected or rendered as source fallback.
- Diagram source is available for copy/inspection in the UI.

### Request validation policy

- API request bodies are schema-validated server-side (Zod).
- Provider/model mismatches are rejected.
- Prompt limits:
  - Chat prompts: `12000` chars max
  - Image prompts: `4000` chars max
- Memory limits:
  - Content max: `4000` chars
  - Tags max: `16` entries, `64` chars each
  - Score range: `0` to `10`

### Audit policy

- All authenticated users can view the audit trail.
- Prompt-submit events store full prompt text.
- Audit events are append-only by contract and protected by DB triggers.
- Hash-chain fields (`prev_hash`, `event_hash`) are available for tamper-evidence verification.
- Audit API supports server-side filtering by `actionType`, `conversationId`/`conversationQuery`, and date window (`dateFrom`, `dateTo`).
- Date filter parameters use `YYYY-MM-DD` format and are interpreted as UTC day bounds.

## Keyboard shortcuts

- `Ctrl/Cmd + Shift + O`: create a new chat.
- `Ctrl/Cmd + Shift + ↑`: switch to previous thread in current filtered list.
- `Ctrl/Cmd + Shift + ↓`: switch to next thread in current filtered list.
- `Enter`: send message (when composer focused).
- `Shift + Enter`: newline in composer.
