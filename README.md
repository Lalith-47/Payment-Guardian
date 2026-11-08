# Revenue Guardian

Revenue Guardian is an autonomous payment recovery & back-office financial triage system built with Next.js, Node.js, PostgreSQL (Drizzle ORM), Redis (BullMQ), Better-Auth, and OpenAI-compatible multi-model AI routing with fail-closed guardrails.

---

## Architecture Overview

```
[PayPal Webhooks / API Capture]
          │
          ▼
   Next.js API Gateway  ─────────► [PostgreSQL: events, audit_log]
          │
          ▼
    BullMQ Queue (Redis)
          │
          ▼
  Background Worker Daemon
          │
          ├──► AI Agent Router (Deterministic Schema + Grounding Validator)
          │
          ├──► Policy Guardrail Engine (FAIL-CLOSED: AUTO, NEEDS_APPROVAL, BLOCKED)
          │
          └──► Action Executor (Idempotent Mutations: retry, refund, offer, escalate)
```

---

## Operational Scripts

All utility scripts are tracked in `scripts/`:

- **`scripts/sync-webhook.ts`**:
  Finds or registers a PayPal Sandbox Webhook for the current `APP_URL`, subscribed exclusively to the event types Revenue Guardian handles (`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `INVOICING.INVOICE.PAID`). Prints the exact `PAYPAL_WEBHOOK_ID=...` string for the owner to configure in `.env` (never edits `.env` automatically).
  ```bash
  npx tsx scripts/sync-webhook.ts
  ```

- **`scripts/update-webhook.ts`**:
  Verifies that `PAYPAL_WEBHOOK_ID` is registered in PayPal Sandbox and sends a `PATCH` update to point the webhook destination to `${APP_URL}/api/webhooks/paypal`.
  ```bash
  npx tsx scripts/update-webhook.ts
  ```

- **`scripts/create-sandbox-order.ts`**:
  Creates a real PayPal Sandbox order with `amount: "25.00"` USD and return/cancel URLs dynamically constructed from `APP_URL`.
  ```bash
  npx tsx scripts/create-sandbox-order.ts
  ```

- **`scripts/verify-c1-trail.ts`**:
  Executes the real sandbox recovery trail (C1): order capture decline $\rightarrow$ AI proposal $\rightarrow$ policy evaluation $\rightarrow$ executor capture retry $\rightarrow$ webhook linkage $\rightarrow$ `RECOVERED` state.
  ```bash
  npx tsx scripts/verify-c1-trail.ts <ORDER_ID>
  ```

- **`scripts/verify-all-models-fail.ts`**:
  Simulates full model degradation/outage and asserts fail-safe transition to `WAITING_FOR_AI`.

---

## Health & Readiness Endpoints

- **`GET /healthz`**: Liveness probe (HTTP 200).
- **`GET /readyz`**: Readiness probe checking PostgreSQL, Redis, PayPal Sandbox Auth, Model Provider Reachability, and verifies that `PAYPAL_WEBHOOK_ID` is among registered sandbox webhooks.

---

## Screenshots

Screenshots of the 6 core dashboard views (verified with Hallmark sloplint):

- **01 Dashboard**: `docs/screenshots/01-dashboard.png`
- **02 Policies**: `docs/screenshots/02-policies.png`
- **03 Checkout**: `docs/screenshots/03-checkout.png`
- **04 Events**: `docs/screenshots/04-events.png`
- **05 Approvals**: `docs/screenshots/05-approvals.png`
- **06 Audit**: `docs/screenshots/06-audit.png`
