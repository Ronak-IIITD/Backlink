# SEO Agent

SEO Agent helps a team understand and improve a website’s search health. It crawls a site, identifies concrete issues, explains their impact, and prepares fixes for review. Approved changes are tracked so the team can follow their progress.

This repository contains the application and its operational notes. The product is under active development; the capabilities below describe the current implementation.

## Product workflow

1. Add a website and provide business context, target keywords, and competitors.
2. Run a crawl and review the site audit, health score, and prioritized actions.
3. Generate a suggested fix, edit it if needed, and approve or reject it.
4. Review reports and activity as the site is monitored.

The audit uses deterministic checks and reports the pages behind each finding. AI features help interpret findings and draft content or fixes. When no AI provider is configured, deterministic fallback responses keep the core workflow usable. The application does not claim unverified rankings, traffic, or backlinks.

## Current capabilities

- Project setup with URL validation and crawl safeguards.
- Site crawling with robots.txt handling, page and depth limits, and crawl progress.
- Technical and on-page audits, including titles, descriptions, headings, images, indexability, links, structured data, and performance indicators.
- A transparent health score with category breakdowns and prioritized next steps.
- AI-assisted recommendations and fix drafts with an approval history.
- Project dashboard, issue queue, content and keyword workspaces, competitor and backlink areas, reports, and settings.
- Organization-scoped access, session-based authentication, and audit logging.

Some integrations and monitoring features are still planned. Search Console connectivity is available as an optional read-only integration when configured.

## Local development

### Requirements

- Node.js and npm
- SQLite for local development (Prisma uses the local schema)

### Start the app

```bash
npm install
cp .env.example .env
```

Set `SESSION_SECRET` to a random value of at least 32 characters. Then initialize the local database and start the application:

```bash
npx prisma db push
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

Optional integrations are configured through `.env`. AI settings use `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL`. Search Console setup is described below.

## Application areas

| Area | Purpose |
| --- | --- |
| `/projects` | Create and configure a website project |
| `/dashboard` | Review site health and the next recommended actions |
| `/projects/:id` | View a project audit and review individual findings |
| `/issues` and `/agent` | Work through issues, generated drafts, and approvals |
| `/content` and `/keywords` | Review content opportunities and keyword work |
| `/competitors` and `/backlinks` | Review competitor and backlink workspaces |
| `/reports` | View project reports |
| `/settings` and `/help` | Manage account settings and find help |

API route handlers live under `src/app/api/`.

## Runtime overview

- **Web application:** Next.js App Router serves the product UI and API from one service.
- **Data:** Prisma with SQLite for local development and PostgreSQL in production.
- **Crawl jobs:** An in-process runner locally; BullMQ and Redis with a separate worker in production.
- **Authentication:** Password hashing, signed HTTP-only sessions, and organization membership checks.
- **SEO analysis:** Rule-based checks and scoring in `src/lib/audit/`.
- **AI features:** Provider abstraction and structured outputs in `src/lib/ai/`, with deterministic fallbacks.

## Production deployment

`render.yaml` describes the Render services: the web app, a dedicated crawl worker, managed PostgreSQL and Redis, and a scheduler for report delivery and rescans. Production requires `DATABASE_URL`, `REDIS_URL`, and `SESSION_SECRET`; the web service and worker must both be deployed.

Production uses `prisma/schema.production.prisma`. Create production schema migrations against a development PostgreSQL database, then deploy them through the configured pre-deploy step:

```bash
npm run db:migrate:dev:production
npm run db:migrate:deploy
```

Keep `APP_URL` aligned with the public app URL. If Search Console is enabled, register the exact callback URL, `https://<your-service>/api/integrations/search-console/callback`, in the Google OAuth client and configure the matching environment variables.

## Optional: Google Search Console

To display clicks, impressions, CTR, position, and applied-fix dates, enable the Search Console API and configure a Google OAuth web client with:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SEARCH_CONSOLE_REDIRECT_URI`

For local development, the callback is `http://localhost:3000/api/integrations/search-console/callback`. The integration requests read-only Search Console access. Refresh tokens are encrypted using a key derived from `SESSION_SECRET`.

## Configuration

See `.env.example` for the full list. `DATABASE_URL` and `SESSION_SECRET` are required. AI, email, and Google OAuth settings are optional. Password recovery requires a Resend API key and a verified sender address.
