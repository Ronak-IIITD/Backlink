# SEO Agent — Your AI SEO Employee

ANALYZE → RECOMMEND → GENERATE → EXECUTE → MONITOR

Not another metrics dashboard. Give us a website, we crawl it, find what matters, explain in plain language, draft copy-paste fixes, you approve in one click, we keep monitoring.

## Frontend — design system

Restrained neutral foundation (white / slate-50 surfaces, slate-200 borders, slate-900 text) + one indigo-600 accent reserved for AI drafts, active states, and primary highlights. Primary CTAs are slate-900 (grayscale-beautiful). Radii 8/10/14/16, subtle shadows, 150–300ms fade/rise motion with reduced-motion support.

- Tokens + primitives: `src/app/globals.css` (`.btn`, `.input`, `.card`, `.ai-chip`, skeletons, focus rings)
- Components (single source): `src/components/ui.tsx` — Button, Input/Textarea/Select, Badge/SevBadge/AIChip, Tabs, Stat, Progress/ScoreBar, Alert, Skeleton/Loading/Empty/Error, Modal/Drawer/Dropdown, Table, Breadcrumb, Pagination, Toast
- Shell: `src/components/shell.tsx` — project switcher, calm sidebar, ⌘K command menu, mobile drawer, user footer
- Marketing: `src/components/marketing.tsx` — shared nav + auth layout

Routes: `/` (URL-first hero + real product preview + agent action-stream), `/signup?url=`, `/login`, `/projects` (5-step wizard), `/dashboard` (decision-first), `/projects/:id` (audit + issue drawer with before/after + approve/edit/reject), `/issues`, `/agent` (3-pane workspace: tasks/activity/approvals), `/content`, `/keywords`, `/competitors`, `/backlinks`, `/reports` (timeline), `/settings` (conventional sections), `/help`, `/pricing`. Tables collapse to cards on mobile; no fake testimonials, metrics, or logos anywhere.

## Quickstart

```bash
npm install
cp .env.example .env   # set SESSION_SECRET (>=32 chars)
npx prisma db push
npm run dev            # http://localhost:3000
```

Prod:
```bash
npm run build && npm start
npm test               # 5 tests: URL validation, SSRF, rules, scoring
```

## What works today (MVP Phases 1–6)

1. **Onboarding** — `/projects`: URL validation + normalize, SSRF check, business context, keywords, competitors. `POST /api/projects`
2. **Crawler** — BFS, same-registrable-domain only (`psl`), robots.txt respected, dedup, redirect chains (5), depth/page caps (30/3), timeout 12s, 400ms rate limit, 2 retries, HTML-only parse, 2MB cap. Extracts title/meta/canonical/H1/H2s/body/links/images+alt/word count/status/OG/schema/robots/indexability. `POST /api/projects/:id/crawl` → poll `GET /api/crawls/:id` (2s UI polling, live progress).
3. **Audit (19 deterministic rules)** — `src/lib/audit/rules.ts`: broken, missing/dup/long titles, missing/dup meta, missing/multi H1, thin (<200w), alt, noindex, canonical mismatch, oversized (>500KB), slow (>2.5s), OG, schema, orphans, poor internal linking, HTTPS. Each: what/why/fix/impact/difficulty/affected URLs. No LLM, no invented data.
4. **Score (transparent)** — `src/lib/audit/scoring.ts`: 6 categories (Technical 25%, On-page 25%, Content 15%, Linking 15%, Indexability 12%, Performance 8%). Starts 100, deducts per failed check. Returns explanation + top issues + next actions per category.
5. **AI strategist + fix generator** — `src/lib/ai/`: modular agents (strategist, fix_generator, content). OpenAI-compatible (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`) with structured JSON; **deterministic fallback when no key** so product works at zero cost. Never invents URLs/rankings/backlinks. Token/cost logged to `AgentRun`.
6. **Approval flow** — `Detected→Recommended→Drafted→Awaiting approval→Approved→Applied/Failed/Rejected` via `AIAction`. `POST /api/issues/:id/generate-fix`, `POST /api/actions/:id/approve|reject`. Full `AuditLog`. CMS auto-apply is an isolated interface (approve records intent; adapters plug in).
7. **UI** — Dashboard (health/next actions/categories), Projects, Issues (filter), Content, Keywords, Competitors, Backlinks, AI Agent queue (NOW/NEXT/WATCH), Reports (markdown), Settings. Plain language, progressive disclosure, loading/empty/error states.

## Architecture

```
Next.js 14 App Router (TS) — frontend + Route Handler API (single deployable)
Prisma 6 + SQLite dev (file:./dev.db), Postgres-ready (switch provider + DATABASE_URL)
In-process job runner (src/lib/jobs/queue.ts) — enqueueCrawl() swappable with BullMQ/Redis
Auth: bcryptjs + jose JWT (httpOnly) + DB sessions, org tenant isolation
Crawler: fetch + cheerio + robots-parser + psl
AI: provider abstraction + zod schemas + fallback templates
```

DB: User, Organization, Membership, Project, Competitor, Crawl, Page, SEOIssue, Recommendation, AIAction, Keyword, Backlink, BacklinkOpportunity, ContentOpportunity, Report, AgentRun, AuditLog, Session.

API: see `src/app/api/` — `/projects`, `/:id`, `/:id/crawl`, `/:id/pages|issues|recommendations|actions|report|opportunities|competitors`, `/crawls/:id`, `/issues/:id/generate-fix`, `/actions/:id/approve|reject`, `/auth/*`.

## Security / cost / observability

- SSRF: scheme allowlist, credential/port/host blocklist, DNS A/AAAA → private-IP reject (`src/lib/security/ssrf.ts`, tested).
- Authz per-project via org membership; rate limits on auth + project create; input zod-validated; audit logs.
- Cost: rules first, LLM only for interpretation; fallback = $0; tokens/cost per AgentRun; content-hash ready for change-skipping.
- Logs: crawl errors/duration, AI usage, job failures, approvals in `AgentRun` + `AuditLog` + server stderr.

## Roadmap (spec Phases 7–10)

- Content gaps already seeded from real pages; add GSC/keyword-volume integrations (no fake volumes).
- Competitor re-crawl + diff (real HTML only).
- Backlink discovery via Common Crawl/Ahrefs/Moz adapters into existing tables + quality score + outreach drafts (approval-gated).
- Monitor cron: rescan schedule, ranking/backlink watchers, quiet notifications.

## Env

See `.env.example`. Required: `DATABASE_URL`, `SESSION_SECRET`. Optional: `OPENAI_*`, `CRAWL_*`.
