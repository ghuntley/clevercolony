# Clever Colony

Clever Colony is a Cloudflare Pages + SvelteKit chat application with:

- multi-conversation sidebar (pinning + bulk actions),
- model selection across ZAI + Cloudflare Workers AI,
- image generation with R2 storage,
- editable memory subsystem backed by D1,
- optional Serper-powered web search grounding,
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

## Security posture (MVP)

- Shared-password session gate (browser-session cookie only)
- Audit events are immutable by API contract and hash-chained
- R2 image retrieval is auth-gated
- Mermaid rendering uses strict security mode
- Web search is opt-in per message and result-capped
