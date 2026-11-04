# REVENUE GUARDIAN: PROJECT SPEC (v2, consolidated)

# ROLE
You are a senior full-stack engineer building "Revenue Guardian" for the PayPal AI Hackathon. Deadline: Nov 12, 2026, 12:00pm PST. Build end to end, test, and report honestly. If something cannot work, say so. Never fake a result, never mock a runtime path.

# PRODUCT
An AI back-office agent for small merchants and freelancers. It handles declined payments, chases invoices, and triages refunds. Every money action passes through owner-defined limits. The AI proposes, deterministic code decides, PayPal (sandbox) executes, everything is logged. The owner can always see and override.

# SKILLS (MANDATORY)
Cloned in ./.skills/. Find and read their SKILL.md files first (find .skills -name SKILL.md).
1. hallmark: read BEFORE any UI work. Follow its design flow, pick a genre/theme that fits a trustworthy fintech tool (landing may be atmospheric, dashboard modern-minimal), run its slop gate on every screen, keep its .hallmark/log.json project memory and tokens.css export.
2. security-audit-skill: full audit mode is NOT available in this environment (verified in M0.5: no general subagent, no network namespaces, no descriptor pinning). Run it in guidance/static mode via the available research subagent at milestones M3 and M6, and fix every confirmed finding. Also run: semgrep, gitleaks, pnpm audit, trivy (image scan). Report what the platform could not run.

# STACK (fixed)
Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui + AG Grid Community; Postgres + Drizzle; Redis + BullMQ; Zod; better-auth (single owner); pino; Vitest; Playwright; Docker Compose; GitHub Actions. AI via an OpenAI-compatible client (OpenRouter by default). PayPal sandbox: Orders v2, Invoicing v2, Payments refunds. Do not use deprecated v1 Payments APIs. Do not use the Reporting API (403 in sandbox).

# ARCHITECTURE
PayPal webhook, polling reconciler, owner chat input, or a declined-capture response
  -> event router
  -> rule check (policy engine first)
  -> LLM agent (structured JSON: {action: retry|offer|refund|escalate|none, amount|null, currency|null, message, confidence 0..1, reasoning})
  -> Zod validation
  -> policy engine (pure TypeScript, no I/O): AUTO | NEEDS_APPROVAL | BLOCKED
  -> executor (the ONLY module allowed to call mutating PayPal endpoints)
  -> audit log -> dashboard.
HARD RULE: the model never calls PayPal and never sees secrets. Customer text is untrusted data, wrapped as data in prompts, and can never change policy or trigger anything outside the validated schema.

# MODULES
Must:
- Recover: a DECLINED CAPTURE (HTTP 422 with INSTRUMENT_DECLINED or TRANSACTION_REFUSED) is handled synchronously in the app's own capture route (PayPal emits no webhook for it). It writes a payment.capture_declined event; the agent proposes retry, an alternative payment offer, or escalation and writes the customer message; the policy engine decides.
- Collect: owner types a natural-language invoice request; a real sandbox invoice is created and sent. Overdue invoices trigger escalating reminders on a schedule (cadence and tone from policies).
- Guardrails: policies editable in the UI (stored in DB), approval inbox, full audit log (AG Grid).
Should: Refund triage (customer message + order -> policy check -> auto-refund or escalate); Reconcile (payments vs invoices, flag mismatches).
Stretch (only if everything else is green): "Ask" analytics over the owner's own data.
Out of scope: subscriptions and BILLING.SUBSCRIPTION.* events.

# SANDBOX NEGATIVE TESTING (demo control)
Env flag SANDBOX_NEGATIVE_TESTING (default false). When on, the capture route adds the PayPal-Mock-Response header with mock_application_codes chosen by the caller. Only INSTRUMENT_DECLINED and TRANSACTION_REFUSED are allowed (INSUFFICIENT_FUNDS returned 403). Hard-disabled if the base URL is not sandbox. Events created this way carry source="sandbox_negative_testing", shown with a visible badge in the UI and audit log. Never present them as real customer failures. There is NO event injection and NO signature bypass anywhere.

# WEBHOOKS
Handle CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.REFUNDED, INVOICING.INVOICE.PAID. Verify signatures LOCALLY over the RAW BODY BYTES (never re-serialized JSON). Signing string: transmission_id|transmission_time|webhook_id|crc32(raw body); RSA-SHA256 with the certificate from cert_url. Rules: https only, no userinfo in the URL, host exactly "paypal.com" or ending in ".paypal.com" (dot boundary), cache the cert, reject stale timestamps (tolerance from env), constant-time comparison where applicable. Respond 2xx fast, process in BullMQ. Dedupe by event/transmission ID in Redis (TTL) AND a unique DB constraint. Unverified events are stored as rejected and never processed. A BullMQ repeatable polling reconciler (GET orders and invoices for non-terminal records) covers dropped webhooks.

# NO HARDCODED DATA (strict)
- No mock, fixture, or lorem data in any runtime path or UI. Every number, row, name, amount, and message comes from Postgres, the PayPal sandbox API, or the model.
- No business-rule constants in code: refund limits, retry counts, reminder cadence, tone, currency live in the policies table, edited via UI. First-run onboarding creates them.
- Config (model names, URLs, keys, webhook ID, budgets, tolerances) only from env, validated by Zod at boot. The app refuses to start with a clear error if invalid.
- Seeding = a script that calls the REAL PayPal sandbox API. Test-only helpers live ONLY under /tests.
- Empty states are real empty states. No invented stats, testimonials, or revenue figures on any page.
- No PayPal logos or third-party brand marks in the UI or video assets (hackathon rule). Use neutral wording like "payments sandbox".

# LLM LAYER AND QUOTA (free-tier reality)
- MODEL_PRIMARY and comma-separated MODEL_FALLBACKS from env, plus optional second provider via LLM_BASE_URL_2 and LLM_API_KEY_2.
- Rule-first: the policy engine decides before any model call. At most ONE model call per event. Max 2 attempts per model, exponential backoff with jitter, honor retry-after, one JSON repair retry.
- Daily call counter (LLM_DAILY_BUDGET) tracked in Redis/DB and shown in /readyz and the UI.
- If all models fail or the budget is exhausted: event status WAITING_FOR_AI, visible and retryable in the UI, NEVER auto-acted.
- Responses cached by event ID so a retry never re-calls the model.
- Rate limiting on every endpoint that can trigger a model call.

# RELIABILITY ("fail safe, never fail silent")
- Fail closed on money: invalid, low-confidence, missing-data, timeout, or currency-mismatch input -> NEEDS_APPROVAL, never AUTO.
- PayPal calls: PayPal-Request-Id idempotency key on every mutating call, timeouts, bounded retries, circuit breaker.
- Every job is retryable and idempotent, with a dead-letter state visible in the UI.
- No empty catch blocks. Log every error (pino, with request/event IDs) and surface it in the UI with a clear message and retry action.
- /healthz and /readyz check Postgres, Redis, model reachability, PayPal auth, and LLM budget. Loading, empty, and error states on every view, plus error boundaries.
- Postgres is the source of truth. Redis holds only ephemeral state (queues, dedupe, rate limits, approval tokens). Wiping Redis must lose nothing important.

# SECURITY
Secrets only in env, never logged, never sent to the client. Zod on every input. Auth on all dashboard and API routes. Rate limiting (Redis) on login and public endpoints. Security headers incl. CSP. CSRF protection on mutations. Parameterized queries only. Approval links are single-use, short-lived, and bound to the action. Abort at boot if PAYPAL_BASE_URL is not the sandbox host.

# 3D PARALLAX LANDING PAGE (landing and login only; dashboard stays clean 2D)
- three.js via React Three Fiber + drei, GSAP ScrollTrigger + Lenis. Dynamic import with ssr:false, lazy-loaded canvas.
- Layered depth (foreground / mid / background) with procedurally generated low-poly objects (coins, shield, invoice sheets) built in code: no external 3D assets or copyrighted media. Mouse-driven parallax on the hero; scroll-driven camera dolly through sections: Hero -> The problem -> How it works (event -> agent -> rules -> action -> log) -> Guardrails -> CTA.
- Performance: 60fps on a mid laptop, DPR capped, pause rendering off-screen, Lighthouse performance >= 85.
- Fallbacks: prefers-reduced-motion and low-power/mobile get a static layered CSS parallax (no WebGL). WebGL failure must never blank the page (error boundary + static fallback).
- Accessibility: all text is real DOM text over the canvas, keyboard navigable, contrast checked, canvas aria-hidden.
- Must pass Hallmark's slop gate. Deliberate typography and colour; no generic purple-gradient or glass-card look.

# DOCKER
docker-compose: web, worker (same image, different command), db (Postgres 16, volume, healthcheck), redis (redis:7-alpine, healthcheck). Multi-stage Dockerfile, non-root user, .dockerignore. Migrations run on boot. "docker compose up --build" works from a clean clone with only .env filled. Provide .env.example documenting every variable.

# TESTING (no "done" claim without pasted passing output)
- Vitest: policy engine exhaustive (boundaries, currency, missing data, low confidence), Zod schemas, idempotency, dedupe, signature verification (valid, tampered body, tampered webhook ID, stale timestamp, bad cert host).
- Integration (real Postgres + Redis in Docker): webhook -> queue -> executor, retry and dead-letter paths, fallback chain with a forced-failure model, WAITING_FOR_AI path.
- A test-only LLM adapter may exist ONLY under /tests. Live-model tests are a separate tagged suite (pnpm test:live), max 10 model calls, hard abort if exceeded. CI never runs live tests.
- Playwright e2e of the full demo flow: onboarding policies -> declined payment (negative testing) -> recovery proposal -> invoice -> under-limit auto refund -> over-limit refund lands in the approval inbox -> approve -> audit log shows everything. Also test the landing fallback (reduced motion, WebGL disabled).
- CI (GitHub Actions): lint, typecheck, unit, integration, gitleaks, pnpm audit, semgrep, trivy.
- Use the Antigravity browser to visually verify landing and dashboard.

# MILESTONES (stop at each gate and report; do not continue if a gate fails)
M0 DONE: feasibility. M0.5 DONE: negative testing, signature verification, model checks.
M1 Spine: schema, PayPal client, webhooks + verification, reconciler, agent, policy engine, executor, audit log, Docker, tests (see M1.md).
M2 Recover flow in UI + Guardrails (policy editor) + approval inbox.
M3 Collect (invoices + reminders) + security-audit run #1 (guidance mode) and fixes.
M4 Refund triage + Reconcile.
M5 3D landing page + Hallmark slop gate on all screens.
M6 Docker/CI hardening, full e2e, security run #2, trivy/gitleaks/semgrep/audit clean.
M7 README (setup, run, architecture, negative testing, limitations), MIT LICENSE, docs/architecture.md, 3-minute demo script.

# REPORTING RULES
After each milestone: what was built, files changed, exact commands run, real test output, LLM calls used vs budget, open risks. Never invent PayPal behavior; check official docs and say when unsure. If a requirement cannot be met, say so and propose the smallest honest alternative.
