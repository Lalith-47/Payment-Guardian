# Revenue Guardian — Feature Specification

> Autonomous Payment Guardrails for PayPal Merchants  
> **Stack:** Next.js 16 (Turbopack) • React 19 • TypeScript • PostgreSQL (Drizzle) • Redis (BullMQ) • PayPal Sandbox APIs

---

## 1. Autonomous Recovery Pipeline

**Location:** `src/pipeline/processor.ts` • `src/worker.ts` • `src/queue/index.ts`

| Capability | Description |
|------------|-------------|
| **Capture Decline Recovery** | Intercepts `payment.capture_declined` events → AI triage → deterministic policy evaluation → auto-execute or escalate to owner warrant |
| **Webhook Ingestion** | Cryptographic verification: RSA-SHA256 signature + CRC32 body hash + certificate URL host validation (`paypal.com` / `*.paypal.com` only) |
| **Event State Machine** | `RECEIVED → RULE_FILTERED → PROPOSED → POLICY_EVALUATED → WAITING_FOR_APPROVAL \| WAITING_FOR_AI \| EXECUTED \| COMPLETED \| REJECTED \| FAILED` |
| **Polling Reconciler** | Background sweep every 60s: confirms `COMPLETED` orders when webhooks timeout; syncs invoice status from PayPal |
| **Multi-Source Events** | `paypal_capture_route`, `paypal_webhook`, `polling_reconciler`, `sandbox_negative_testing` |

---

## 2. Deterministic Policy Engine (Zero I/O, Fail-Closed)

**Location:** `src/policy/engine.ts`

### Recovery Guardrails
| Guardrail | Default | Behavior |
|-----------|---------|----------|
| Auto-Refund Ceiling | $25.00 | Refunds above → `NEEDS_APPROVAL` |
| Max Retry Attempts | 2 | Blocks at limit → `BLOCKED` (escalated to approval) |
| Min Retry Interval | 4 hours | Enforced between automated retries |
| AI Confidence Threshold | 0.80 | Below → `NEEDS_APPROVAL` |
| Currency Allowlist | USD, CAD, EUR, GBP | Mismatch → `NEEDS_APPROVAL` |
| Max Discount on Offers | 10% | Exceeds → `NEEDS_APPROVAL` |
| Explicit Approval Actions | `["escalate"]` | Configurable per action type |

### Invoice Guardrails (M3-Lite)
| Guardrail | Default |
|-----------|---------|
| Max Auto-Send Amount | $500.00 |
| Allowed Currencies | USD, CAD, EUR, GBP |
| Default Due Days | 15 |
| Confidence Threshold | 0.80 |
| Required Fields | customerEmail, amount, currency |

### Decisions
- **AUTO** — execute immediately via ActionExecutor
- **NEEDS_APPROVAL** — generate single-use owner warrant
- **BLOCKED** — hard stop (e.g., max retries exceeded)

---

## 3. LLM Agent with Grounding & Budget Controls

**Location:** `src/agent/client.ts` • `src/agent/schema.ts` • `src/lib/llm-budget.ts`

| Feature | Implementation |
|---------|----------------|
| **Multi-Model Fallback** | Primary + ordered fallbacks via `MODEL_PRIMARY`, `MODEL_FALLBACKS` |
| **Grounding Validation** | Regex blocks hallucinated policy thresholds & customer history claims; downgrades confidence to 0.40, prefixes reasoning with `[UNGROUNDED CLAIM]` |
| **Daily Budget Enforcement** | Separate counters for real/test providers; exhausts → `WAITING_FOR_AI` |
| **Rate Limiting** | 15 RPM client-side with exponential backoff + jitter |
| **Safety Gate** | `LLM_ALLOW_LIVE=false` blocks real provider calls at code level (pre-network) |
| **Redis Caching** | 24h TTL keyed by `eventId` prevents duplicate model calls on retry |
| **JSON Repair** | Single repair attempt with error context on parse failure |
| **Request Logging** | Every outbound call recorded: model, latency, status, error, origin |

---

## 4. ActionExecutor — Sole Mutating Entrypoint

**Location:** `src/executor/index.ts`

| Action | PayPal Endpoint | Idempotency Key |
|--------|-----------------|-----------------|
| `retry` | `POST /v2/checkout/orders/{id}/capture` | `PayPal-Request-Id` |
| `refund` | `POST /v2/payments/captures/{id}/refund` | `PayPal-Request-Id` |
| `offer` | `POST /v2/invoicing/invoices` (draft) | `PayPal-Request-Id` |
| `invoice` | Draft → Send → GET fresh | Dual keys (draft + send) |
| `escalate` / `none` | No-op | N/A |

### Execution Gate
- **AUTO** policy decision → immediate dispatch
- **NEEDS_APPROVAL** → requires valid single-use approval token (HMAC-SHA256, 120min TTL, consumed on use)
- Idempotency check against `actions` table before any network call

---

## 5. Approval Workflow (Human-in-the-Loop)

**Location:** `src/app/approvals/page.tsx` • `src/db/queries/approvals.ts`

- **Single-use expiring tokens** — HMAC-SHA256 hashed in DB, never stored plaintext
- **Owner Inbox UI** — pending warrants with AI reasoning, confidence %, trigger rule, context snapshot
- **Approve** → dispatches to ActionExecutor with verified token
- **Reject** → records owner reason in audit log, voids token
- **Filter Tabs** — Pending / All with live counts
- **Status Badges** — PENDING / APPROVED / REJECTED / EXPIRED

---

## 6. Event Stream & Audit Ledger

**Location:** `src/app/events/page.tsx` • `src/db/queries/audit.ts`

### Event Table (AG Grid)
- Pagination, sorting, single-row selection
- Columns: Event ID, Classification, Source, Status (badged), Amount, Timestamp

### Drill-Down Detail Panel
| Section | Content |
|---------|---------|
| **Event Metadata** | Type, source, external ID, status, error message |
| **AI Proposals** | Action, confidence, reasoning, model used, full context snapshot |
| **ActionExecutor Dispatches** | Endpoint, method, idempotency key, status, response summary |
| **Append-Only Audit Trail** | Actor, action, from→to transition, details JSON, timestamp |

### Retry Eligibility
- `WAITING_FOR_AI` (budget exhausted / all models failed)
- `FAILED` (executor error)
- `DEAD_LETTER` (idempotent replay)
- Re-enqueues with fresh budget check

---

## 7. PayPal Invoicing (M3-Lite)

**Location:** `src/app/invoices/page.tsx` • `src/agent/invoice-extractor.ts` • `src/policy/engine.ts` (evaluateInvoicePolicy)

| Feature | Description |
|---------|-------------|
| **AI Field Extraction** | Natural language prompt → structured schema (customer, amount, currency, due days, line items, note) |
| **Policy Evaluation** | Max auto-send amount, allowed currencies, confidence threshold, required fields |
| **Auto-Send vs Warrant** | Under ceiling → direct send via ActionExecutor; over → approval warrant in inbox |
| **Draft Message Storage** | Customer note stored as `draftMessage` only (never auto-sent) |
| **Due Date Calculation** | NET_10/15/30/45/60/90 or DUE_ON_DATE_SPECIFIED |
| **Payer View URL** | Direct link to PayPal sandbox invoice |
| **Audit Timeline** | State transitions with actor, from→to, confirmation source (webhook/polling/executor) |

---

## 8. Policy Management UI

**Location:** `src/app/policies/page.tsx` • `src/db/queries/policies.ts`

- **Live Form** — all guardrail parameters editable (refund ceiling, retries, confidence, discount, tone, currencies, due days)
- **Version History** — immutable snapshots in `policy_versions` table with change reason & author
- **Per-Action Approval Toggles** — escalate, refund, offer, retry (checkbox chips)
- **Audit Change Reason** — required free-text field archived with each version

---

## 9. PayPal Checkout Demo (Cinematic Scrollytelling)

**Location:** `src/app/checkout-landing/page.tsx`

- **6 Scroll Phases** (600vh track): Hero → Security → Network → Intelligence → Developer → Finale
- **Canvas Animations** — checkout card, security halo rings, global network mesh, smart button orbit, code terminal, success pulse
- **Smooth Lerp Interpolation** — 60fps render loop with `requestAnimationFrame`
- **Responsive** — Desktop split layout (copy left/right, graphic anchored); Mobile/Tablet stacked

---

## 10. Infrastructure & Observability

| Component | Location | Purpose |
|-----------|----------|---------|
| **Circuit Breaker** | `src/paypal/circuit-breaker.ts` | 5 failures → 30s open → half-open probe |
| **OAuth Token Cache** | `src/paypal/client.ts` | In-memory with 60s pre-expiry refresh |
| **Structured Logging** | `src/lib/logger.ts` | Pino with child loggers per module |
| **LLM Request Log** | `src/db/schema.ts` (`llmRequests`) | Every outbound call: model, latency, status, error, origin |
| **Webhook Deliveries** | `src/db/schema.ts` (`webhookDeliveries`) | Immutable log with signature status, origin (real/simulated) |
| **Health Checks** | Dashboard | Postgres, Redis, PayPal API, LLM Budget status |

---

## 11. Authentication & Internationalization

| Feature | Implementation |
|---------|----------------|
| **Auth** | better-auth (email/password, single owner) |
| **Dark Mode** | next-themes with `attribute="class"`, `localStorage` persistence, `color-scheme` meta |
| **Languages** | EN / HI / KN — `LanguageSwitcher` updates `html[lang]` + `localStorage` |

---

## 12. Test Coverage (50+ Test Files)

| Category | Coverage |
|----------|----------|
| **Policy Engine** | Guardrail decisions, edge cases, invoice policy |
| **Pipeline** | State transitions, webhook handling, idempotency |
| **Agent** | Grounding, budget, backoff, fallback cascade |
| **Executor** | Idempotency, approval gate, mutation types |
| **Webhooks** | Signature verification, replay protection, cert validation |
| **E2E** | M2/M3 flows, approval hash, capture abuse, invoice idempotency |

---

## Summary: What This Software Does

> **Revenue Guardian** is an **autonomous back-office** for PayPal merchants that:
>
> 1. **Intercepts checkout declines** in real-time via webhook/polling
> 2. **Evaluates recovery options** with a grounded LLM agent (retry, refund, offer, invoice, escalate)
> 3. **Enforces deterministic PostgreSQL guardrails** (ceilings, retries, confidence, currency) — **zero hallucination**
> 4. **Auto-executes** via idempotent ActionExecutor **OR** escalates to **single-use owner approval warrants**
> 5. **Provides full observability**: event stream, audit trail, policy versioning, reconciliation
> 6. **Generates/sends invoices** with AI extraction, policy-bounded auto-send, and audit timeline
> 7. **Runs entirely in sandbox** with circuit breakers, budget guards, and safety gates