# Private SaaS pilot runbook

## Offer and boundaries

Invite 5–10 small business owners. One website per organization, at most 30 pages per audit. The free invitation provides one audit and five drafts for 30 days. Paid access costs $29 USD for one calendar month, with eight audits and 50 drafts. Weekly monitoring shares the audit allowance. Access and renewal are manual; this release does not collect payment details or charge subscriptions.

Customers apply approved fixes themselves. “Reported updated” is the customer's statement. “Verified” requires a subsequent successful audit of the same target page that no longer detects the original issue. JavaScript rendering uses ScrapingBee; HTML mode uses the protected direct HTTP transport. This is an audit of a sample, not a claim about rankings or complete site coverage.

Publishing integrations, public approval links, agency branding and team invitations are outside the pilot. Legacy public links are revoked by the migration and blocked by the routes. Existing organizations need an operator-issued access period before new audits or drafts are allowed. Legacy scores are hidden until rescanned.

## Local setup

Use the Node version in `.node-version`, then:

```sh
npm ci
cp .env.example .env
# Configure DATABASE_URL=file:./dev.db and a random SESSION_SECRET >=32 characters.
npm run db:push
npm run pilot -- invite owner@example.com
npm run dev
```

`db:push` is for SQLite development and preserves existing records when adding the new schema. Back up an existing database first. Use `db:migrate:deploy` for PostgreSQL. Do not run production migrations or overwrite an existing database to run tests.

The invite command prints a private single-use URL; it does not send email. Deliver it through your normal customer channel. Only hashes are stored in the database. Reissuing an invitation expires previous unused invitations for that email.

## Payments and operator actions

Confirm payment using your chosen invoice/payment service, then run commands in the target environment:

```sh
npm run pilot -- activate owner@example.com --reference=INVOICE-001
npm run pilot -- status owner@example.com
npm run pilot -- suspend owner@example.com
npm run pilot -- resume owner@example.com
npm run pilot -- export owner@example.com --output=/secure/location/export.json
npm run pilot -- recover
```

Activation grants one calendar month. Renewal begins when the existing paid period ends, or now if expired. Reusing an invoice reference cannot grant another period. Refunds or payment reversals must be handled in the payment service and reflected by suspending access as appropriate. No automatic payment flow exists.

For a customer-requested deletion, inspect their organization ID with `status`, then:

```sh
npm run pilot -- delete owner@example.com --confirm-org=ORGANIZATION_ID
```

Deletion refuses to run while an audit is active. Exports exclude password hashes, sessions, reset tokens, OAuth tokens and integration secrets. The daily maintenance path also deletes organizations 90 days after all access periods have expired; the scheduler checks every 15 minutes. This removes application data, while backup expiry follows the hosting backup retention policy. Confirm identity through the verified account email before fulfilling support requests.

## Production configuration

Use separate Render staging and production stacks, each with its own PostgreSQL, Redis, session/cron secrets, app URL and provider credentials. Use internal database/cache connections in one Render region. Validate `render.yaml` against Render before provisioning. Set automatic deployment only after CI passes. Paid resources incur hosting charges; review the dashboard quote before provisioning.

Required launch inputs:

- `DATABASE_URL`, `REDIS_URL`, random `SESSION_SECRET` and `CRON_SECRET`.
- `APP_URL` matching the deployed HTTPS URL, a monitored `SUPPORT_EMAIL`, and a sender domain you own.
- `RESEND_API_KEY` and a verified `RESEND_FROM` for recovery, report and alert delivery.
- `SCRAPINGBEE_API_KEY` for JavaScript rendering. Without it, explicitly select HTML mode; never market JavaScript support before a live rendering test passes.
- Optional `OPENAI_API_KEY`; no key means deterministic drafting. Custom models require explicit input/output rates matching the provider account. USD figures are estimates, not a billing guarantee.
- Optional Google OAuth configuration with the exact public callback URL.

Rendering waits for network idle within a bounded upstream timeout before taking the DOM snapshot. Pages with persistent network activity can time out and are labelled unaudited. Rendering reserves five credits per attempt, uses no premium/stealth upgrade, and shares a 50,000-credit monthly cap across the pilot. AI reserves its per-call cap before dispatch, reconciles known usage, and retains reservations after uncertain upstream outcomes. All calls, including validation failures and retries, are accounted for. Daily token reservations and paid-period AI budgets are shared across web and worker processes.

The worker uses the runtime `tsx` dependency, which survives development-dependency pruning. Run migrations once from the web pre-deploy command. Build artifacts must be prepared in the build step; Render pre-deploy filesystem changes are not carried into the running instance. PostgreSQL model additions are additive; do not reset customer data.

The scheduler runs maintenance, due rescans and due reports every 15 minutes. Rescans require paid access and an available audit allowance. Reports wait while an audit is active, only use completed current-version audits and do not resend an already delivered report. Delivery uses a stable provider idempotency key; uncertain outcomes after the provider's idempotency retention window require operator reconciliation before retrying.

## Verification before invitations

The CI workflow checks Node 24, PostgreSQL 18 migrations, schema drift, type checking, lint, regression/integration tests, the production build, worker startup, health, and the real authenticated HTTP workflow. Locally, tests use a temporary SQLite database by default. For production-parity tests, provide a dedicated PostgreSQL URL ending in `_test` as `TEST_DATABASE_URL` and generate the production client first. `TEST_REDIS_URL` enables shared rate-limit tests. Never point test variables at customer databases.

Before enabling paid access:

1. Deploy staging, run the full suite and check desktop/mobile onboarding, audit coverage, copying fixes, approvals, reported updates and later verification.
2. Test one real public JavaScript-heavy site with the configured renderer. Verify rendered headings, title, links and JSON-LD against the actual page. Check the credit ledger.
3. Send recovery and report emails to the operator's test account; verify delivery and duplicate suppression. Test reset expiry and session revocation.
4. Confirm missing Redis or a stale worker heartbeat makes `/api/health` return 503. Configure Render service notifications/uptime alerts to reach the operator.
5. Enable automated PostgreSQL backups. Restore one backup into staging, run migrations and health checks, and inspect an audit/report. Document the backup retention, recovery steps and measured restore time.
6. Set up the external invoice method and publish owner-approved service/privacy terms, cancellation/refund terms, support contact and processor disclosures. No legal boilerplate is generated by this implementation.
7. Inspect repository history for real credentials in previously tracked `.env` or database files. Rotate exposed credentials at their providers; removing a file from tracking does not erase history. Do not rewrite shared history without coordination.
8. Deploy production at one reviewed commit. For an existing deployment, pause scheduling and drain the worker before migrations; restart web and worker together afterwards. Keep migrations backward-compatible and take a backup first.

## Operating the pilot

Start with two customers. Observe for seven days, then expand to ten only after resolving security, isolation and data-loss issues. Track audit success rate on supported reachable sites, time to first useful action, verified fixes, provider costs by account, support effort and paid renewals. Target >=95% successful supported audits, five customers completing a fix and three paid renewals during a 30-day pilot.

`/api/health` checks database connectivity, Redis, worker freshness and a queued-audit age threshold of 30 minutes. Check Render logs and operator `status` output daily. Worker heartbeat expires after 60 seconds. Expired crawl leases and draft-generation reservations are recovered by maintenance; allowances are returned and the customer can start a new request. In-progress provider reservations remain charged conservatively after process failure.

If incidents occur, suspend the affected account or pause the worker/scheduler, preserve the database, and diagnose before retrying. A failed Redis enqueue returns the audit allowance. Terminal worker failure returns the allowance once. Do not manually mark a failed audit complete or turn an unknown provider cost into zero.

Rollback web and worker to the same known-good commit; keep additive schema migrations in place. A database restore is a separate recovery action and must be coordinated to avoid discarding newer customer changes. Recovery from managed snapshots is a launch gate, not something the repository can prove without a configured hosting account.

Public signup, automated subscriptions, broader publishing integrations and team features remain a later milestone after pilot validation.
