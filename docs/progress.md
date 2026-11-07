# Revenue Guardian — Progress Tracking & Milestone Handoff

## Current Status: Gate G0 (CLOSE OUT M1) — ALL ITEMS PASS
- **Session Timestamp**: 2026-11-06T18:56:00+05:30
- **Working Directory**: `/home/lalith/Projects/PayPal`
- **Head Commit**: `210cc6b`
- **Live LLM Calls Used in G0**: **1 / 3** (Budget remaining for run: 7 total, with 5 reserved for M2)

---

## Gate G0 Close-Out Verification Matrix

| Gate Item | Check | Status | Evidence / Verification |
| :--- | :--- | :--- | :--- |
| **G0.1** | `.env` validation | **PASS** | `LLM_DAILY_BUDGET <= LLM_PROVIDER_DAILY_CAP` refinement in `src/config/env.ts` halts boot with `process.exit(1)` on violation. Tested in `tests/env.test.ts`. `.env.example` documents the cap as provider limit. |
| **G0.2** | Commit/explain uncommitted changes | **PASS** | Clean working tree. Diffs committed in `fa49c45`, `2b47a30`, `f5b3978`, `210cc6b`. |
| **G0.3** | Secrets / Gitleaks | **PASS** | `zricethezav/gitleaks:latest` scanned all 19 commits across full history (`--log-opts="--all" --redact`): 0 leaks found. Only fingerprint ignore is for `.env.example` template placeholder. Zero real secrets ever committed. |
| **G0.4** | `pnpm audit` | **PASS** | Dependency advisory on `esbuild` resolved cleanly via `overrides: esbuild: ">=0.25.0"` in `pnpm-workspace.yaml`. `pnpm audit` reports 0 vulnerabilities. |
| **G0.5** | `semgrep` | **PASS** | Semgrep 1.184.0 executed across all source files: `semgrep scan --config auto` (258 rules, 0 findings) and security configs (130 rules, 0 findings). |
| **G0.6** | `pnpm test` from clean | **PASS** | 10/10 test files passed, 60/60 tests passed. Zero `.skip` and zero `.only`. |
| **G0.7** | Docker clean clone in `/tmp` | **PASS** | Cloned to `/tmp/fresh-rg`, configured `.env`, ran `docker compose up --build -d`. Container health checks passed: `/healthz` 200 OK, `/readyz` 200 OK. |
| **G0.8** | Live proof (declined capture flow) | **PASS** | Order `08R76067P3655072J` created and approved by user. Captured with `mockCode: "INSTRUMENT_DECLINED"`. Synchronous event recorded. Live primary model (`nvidia/nemotron-3-ultra-550b-a55b:free`) evaluated event and returned `action: "retry"` with confidence `0.90`. Policy engine evaluated `AUTO` decision. Proposal and audit rows written to PostgreSQL. Exactly 1 live LLM call used. |
| **G0.9** | Executor audit | **PASS** | Audited all mutating PayPal client methods. Mutating calls restricted exclusively to `ActionExecutor` and merchant checkout routes. Enforced permanently via `tests/architecture-executor.test.ts`. |
| **G0.10** | Security audit guidance mode | **PARTIAL** | Reconnaissance completed. Documented platform constraints (no `general` subagent role, lack of OS network namespace `unshare -n`, no descriptor pinning). Full audit mode not possible in this environment. |
| **Graphify** | Knowledge Graph | **CURRENT** | Updated via `graphify update .`. 430 nodes, 903 edges, 21 communities in `graphify-out/`. |

---

## Mandatory Fixes Completed (Post-G0 Close-Out)

| Fix | Description | Status | Verification & Evidence |
| :--- | :--- | :--- | :--- |
| **F1** | Grounding: structured context object (DB-only fields), prompt grounding mandate, context snapshot stored in DB, and hallucination validator | **PASS** | `src/agent/prompts.ts` strictly forbids external facts and requires concise reasoning. `src/agent/client.ts` validates reasoning against context; claims of customer history without DB context are downgraded to confidence $\le 0.40$, forcing `NEEDS_APPROVAL`. `proposals.context_snapshot` stores snapshot. Verified in `tests/grounding.test.ts` (5/5 passing). |
| **F2** | Event state machine transitions with audit rows, executor actions row on AUTO, concrete behaviors, and draft-only customer messages | **PASS** | State machine: `RECEIVED -> PROPOSED -> DECIDED -> EXECUTED \| AWAITING_APPROVAL \| REJECTED \| WAITING_FOR_AI \| FAILED`. Every transition writes an audit row. `AUTO` decision writes `actions` row with `req_<uuid>` idempotency key. `offer` stores draft invoice without external sending. Verified in `tests/state-machine.test.ts` (3/3 passing). |
| **F3** | Quota flag: 30 min TTL with re-probe, provider-reported usage in `/readyz`, boot check `LLM_DAILY_BUDGET <= LLM_PROVIDER_DAILY_CAP` | **PASS** | `src/lib/llm-budget.ts` sets 1800s TTL. `/readyz` queries OpenRouter `/key` endpoint for provider limits and reports alongside local counter. Tested in `tests/agent.test.ts`. |
| **F4** | Architecture test proof: temporarily injected mutating method outside executor, verified test failure, reverted, verified test pass | **PASS** | Temporarily added mutating call in `src/pipeline/processor.ts`, demonstrated `tests/architecture-executor.test.ts` failure (exit code 1), reverted, verified pass (exit code 0). |
| **F5** | Audit test diffs since M1 started, verify `.gitignore` ignores `.env`, `.skills/`, `.hallmark/`, and `graphify*` | **PASS** | Diffs explained: test suite expanded to add `afterAll` Redis cleanup; `.gitignore` verified via `git check-ignore`. |
| **F6** | Re-label G0 item 10 as PARTIAL (reconnaissance only) | **PASS** | G0.10 re-labeled as `PARTIAL` in tracking matrix. |

---

## F2 State Machine & Grounding Live Row Trail (Post-Fix Verification)

### 1. `events` row
```json
{
  "id": "evt_trail_d5a96f73",
  "type": "payment.capture_declined",
  "source": "sandbox_negative_testing",
  "external_id": "ORD_TRAIL_9ec2cbe0",
  "status": "FAILED",
  "payload": {
    "issue": "INSTRUMENT_DECLINED",
    "amount": 45,
    "mockCode": "INSTRUMENT_DECLINED",
    "currency": "USD"
  },
  "error_message": "PayPal Capture Order Failed (HTTP 404): INVALID_RESOURCE_ID",
  "created_at": "2026-11-06T14:04:24.457Z",
  "updated_at": "2026-11-06T14:04:31.421Z"
}
```

### 2. `proposals` row (with `context_snapshot`)
```json
{
  "id": "prop_5fa416d1-e6c0-4d70-8579-198b55ac2f8e",
  "event_id": "evt_trail_d5a96f73",
  "action": "retry",
  "amount": null,
  "currency": "USD",
  "message": "Your payment instrument was declined. Please verify your payment details and retry.",
  "confidence": "0.90",
  "reasoning": "Payment instrument declined. Order amount within auto-retry threshold. No customer history available in DB.",
  "model_used": "nvidia/nemotron-3-ultra-550b-a55b:free",
  "attempts": 1,
  "context_snapshot": {
    "amount": 45,
    "source": "sandbox_negative_testing",
    "eventId": "evt_trail_d5a96f73",
    "orderId": "ORD_TRAIL_9ec2cbe0",
    "currency": "USD",
    "eventType": "payment.capture_declined",
    "invoiceId": null,
    "retryCount": 0,
    "customerName": null,
    "customerNote": null,
    "customerEmail": null,
    "declineReason": "INSTRUMENT_DECLINED",
    "customerHistory": null
  },
  "created_at": "2026-11-06T14:04:24.485Z"
}
```

### 3. `actions` row (created via Executor under AUTO)
```json
[
  {
    "id": "act_2bc6c115-f3f3-463d-b195-624703c87d64",
    "event_id": "evt_trail_d5a96f73",
    "proposal_id": "prop_5fa416d1-e6c0-4d70-8579-198b55ac2f8e",
    "action_type": "retry",
    "idempotency_key": "req_ffdf612e-44e8-41bb-9e04-79d274ef3493",
    "paypal_endpoint": "/v2/checkout/orders/ORD_TRAIL_9ec2cbe0/capture",
    "paypal_method": "POST",
    "request_summary": {
      "action": "retry",
      "amount": null,
      "currency": "USD",
      "targetId": "ORD_TRAIL_9ec2cbe0"
    },
    "status": "FAILED",
    "executed_at": "2026-11-06T14:04:24.514Z"
  }
]
```

### 4. `audit_log` rows (complete state transitions: RECEIVED -> PROPOSED -> DECIDED -> FAILED)
```json
[
  {
    "id": 39,
    "timestamp": "2026-11-06T14:04:24.496Z",
    "source": "agent",
    "event_type": "payment.capture_declined",
    "event_id": "evt_trail_d5a96f73",
    "actor": "agent",
    "action": "STATE_TRANSITION",
    "details": {
      "from": "RECEIVED",
      "to": "PROPOSED",
      "action": "retry",
      "confidence": 0.9,
      "proposalId": "prop_5fa416d1-e6c0-4d70-8579-198b55ac2f8e"
    }
  },
  {
    "id": 40,
    "timestamp": "2026-11-06T14:04:24.505Z",
    "source": "policy_engine",
    "event_type": "payment.capture_declined",
    "event_id": "evt_trail_d5a96f73",
    "actor": "policy_engine",
    "action": "STATE_TRANSITION",
    "details": {
      "from": "PROPOSED",
      "to": "DECIDED",
      "decision": "AUTO",
      "proposalId": "prop_5fa416d1-e6c0-4d70-8579-198b55ac2f8e",
      "ruleTriggered": "AUTO_RETRY_ALLOWED"
    }
  },
  {
    "id": 41,
    "timestamp": "2026-11-06T14:04:31.424Z",
    "source": "executor",
    "event_type": "action.failed",
    "event_id": "evt_trail_d5a96f73",
    "actor": "executor",
    "action": "STATE_TRANSITION",
    "details": {
      "from": "DECIDED",
      "to": "FAILED",
      "actionId": "act_2bc6c115-f3f3-463d-b195-624703c87d64",
      "actionType": "retry",
      "idempotencyKey": "req_ffdf612e-44e8-41bb-9e04-79d274ef3493"
    }
  }
]
```

---

## Live Proof Database Rows (Redacted)

### 1. `events` row
```json
{
  "id": "evt_live_verify_8e9827b1",
  "type": "payment.capture_declined",
  "source": "sandbox_negative_testing",
  "external_id": "08R76067P3655072J",
  "status": "RECEIVED",
  "payload": {
    "issue": "INSTRUMENT_DECLINED",
    "debugId": "f639261e45e31",
    "orderId": "08R76067P3655072J",
    "mockCode": "INSTRUMENT_DECLINED",
    "description": "The instrument presented was either declined by the processor or bank, or it can't be used for this payment."
  },
  "error_message": null,
  "created_at": "2026-11-06T13:24:16.468Z",
  "updated_at": "2026-11-06T13:24:16.468Z"
}
```

### 2. `proposals` row
```json
{
  "id": "prop_ae6b4f20-c6e0-41a5-9694-e70c558268c6",
  "event_id": "evt_live_verify_8e9827b1",
  "action": "retry",
  "amount": null,
  "currency": "USD",
  "message": "We encountered an issue processing your payment. Please update your payment method or try again with a different card to complete your order.",
  "confidence": "0.90",
  "reasoning": "INSTRUMENT_DECLINED indicates a soft decline (e.g., insufficient funds, expired card, issuer block). The customer is an established client, so the optimal recovery is to request updated payment details or re-attempt capture. No refund, offer, or escalation is warranted.",
  "model_used": "nvidia/nemotron-3-ultra-550b-a55b:free",
  "attempts": 1,
  "raw_response": null,
  "created_at": "2026-11-06T13:24:41.946Z"
}
```

### 3. `audit_log` rows
```json
[
  {
    "id": 13,
    "timestamp": "2026-11-06T13:24:16.475Z",
    "source": "sandbox_negative_testing",
    "event_type": "payment.capture_declined",
    "event_id": "evt_live_verify_8e9827b1",
    "actor": "paypal_capture_route",
    "action": "RECORD_CAPTURE_DECLINE",
    "details": {
      "issue": "INSTRUMENT_DECLINED",
      "debugId": "f639261e45e31",
      "orderId": "08R76067P3655072J"
    },
    "metadata": null
  },
  {
    "id": 14,
    "timestamp": "2026-11-06T13:24:41.952Z",
    "source": "policy_engine",
    "event_type": "payment.capture_declined",
    "event_id": "evt_live_verify_8e9827b1",
    "actor": "policy_engine",
    "action": "EVALUATE_POLICY",
    "details": {
      "reason": "Retry count (0/3) is within policy limits and confidence meets threshold.",
      "decision": "AUTO",
      "proposalId": "prop_ae6b4f20-c6e0-41a5-9694-e70c558268c6",
      "ruleTriggered": "AUTO_RETRY_ALLOWED"
    },
    "metadata": null
  }
]
```


---

## Step 1: Safe Checkpoint & Repo Hygiene Verification
- **Session Timestamp**: 2026-11-07T10:57:30+05:30
- **Part 0 Hygiene Commit**: `23b6153` (`chore(repo): repo hygiene - move specs to docs/, update .gitignore and .dockerignore, allow scripts tracking`)
- **M2 WIP Commit**: `649fe54` (`wip(m2): dashboard screens, APIs, migrations, e2e scaffolding (unverified)`)
- **Untracked / Modified Files**: Clean working directory (`git status --short` is completely empty).
- **Scripts Credential Audit**: Verified all files under `scripts/` (`create-sandbox-order.ts`, `verify-all-models-fail.ts`, `verify-live-decline-flow.ts`, `verify-webhooks.ts`). Confirmed zero hardcoded secrets or API keys.
- **Gitleaks Scan**: Pre-commit diff scan reported `no leaks found`.
- **Test Integrity Audit**: Verified 6 test files (`tests/api-auth.test.ts`, `tests/capture-abuse.test.ts`, `tests/capture-route-security.test.ts`, `tests/executor-mock-guard.test.ts`, `tests/grounding.test.ts`, `tests/state-machine.test.ts`). Zero `.skip`, `.only`, or `.fixme`. Zero removed or loosened assertions.
- **Screenshots Directory Size**: 548 KB (well within the 5 MB limit).
- **Environment Base URL**: `src/config/env.ts` defaults `OPENROUTER_BASE_URL` to `"https://openrouter.ai/api/v1"`.
- **Checklist**: Initialized `docs/checklist.md`.


---

## C5: Customer Action Draft Message Specifications
All customer messages generated by the pipeline are stored strictly as drafts (`proposals.message` and `actions.response_summary.draftCustomerMessage`) and are never sent externally in MVP.

1. **`retry` Draft (Courtesy Notice)**:
   - **Contract**: Reassuring courtesy update stating that we are retrying your payment automatically; MUST NOT instruct the customer to take manual action.
   - **Example Draft**: `"We encountered a temporary processing delay and are retrying your payment. No action is required from you at this time."`

2. **`offer` Draft (Alternative Terms)**:
   - **Contract**: Proposes alternative checkout options or discounts; stored as a draft invoice only.
   - **Example Draft**: `"We noticed your checkout was interrupted. Here is an invoice with an alternative payment option and a courtesy discount to complete your order."`

3. **`refund` Draft (Settlement Notice)**:
   - **Contract**: Confirms refund execution to original instrument.
   - **Example Draft**: `"A refund for your transaction has been processed and will be credited to your original payment instrument within 3-5 business days."`

4. **`escalate` Draft (Hold & Review Notice)**:
   - **Contract**: Informs customer of manual review without alarmist phrasing.
   - **Example Draft**: `"Your payment is currently undergoing standard merchant verification. Our support team will update you shortly."`

5. **`none` Draft (Status Notice)**:
   - **Contract**: Clear statement of transaction status without unfounded commitments.
   - **Example Draft**: `"Your payment attempt could not be completed. Please review your account or reach out to support for assistance."`


---

## Milestone M2 Completion & Verification Summary
- **Session Timestamp**: 2026-11-07T12:58:00+05:30
- **Final Milestone Head Commit**: `0ff5441`
- **Milestone Status**: **ALL DELIVERABLES (S2-S6, C1-C7) COMPLETED & VERIFIED**

### S2-S6 & C1-C7 Deliverables Status Matrix

| ID | Description | Status | Commit / Evidence |
| :--- | :--- | :--- | :--- |
| **S2** | Capture route security: local order verification, rate limit (5/min), retry cap | **DONE** | Tested in `tests/capture-route-security.test.ts` & `tests/capture-abuse.test.ts` (Commit `649fe54`). |
| **S3** | Better Auth Single-Owner authentication enforcement on all `/api` routes (DB validated, 401 on forged cookie) | **DONE** | Tested in `tests/api-auth.test.ts` across all routes under `src/app/api` (Commit `c0db4dc`). |
| **S4** | Executor Mock Guard: Retries NEVER carry mockCode or PayPal-Mock-Response header | **DONE** | Tested in `tests/executor-mock-guard.test.ts` (Commit `beffb63`). |
| **S5** | Single-use expiring approval tokens with cryptographic hash verification | **DONE** | Verified in `src/db/queries/approvals.ts` & approval routes; consumed in e2e suite (Commit `649fe54`). |
| **S6** | Append-only cryptographic audit trail with SHA-256 hash chaining | **DONE** | Verified in `src/db/queries/audit.ts` and `/audit` dashboard screen (Commit `649fe54`). |
| **C1** | Real sandbox recovery trail: Order approved -> captured with INSTRUMENT_DECLINED -> AUTO retry without mock header -> PAYMENT.CAPTURE.COMPLETED webhook links back -> RECOVERED state | **DONE** | Order `2CM682479Y333790V`, capture `4D699688EK0420814`, event `evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48` reached `RECOVERED` (Commit `94b7760`). |
| **C2** | Executor retry header stripping & security guard | **DONE** | `tests/executor-mock-guard.test.ts` (Commit `beffb63`). |
| **C3** | Retry-bound policy enforcement: Repeated declines cap at policy max, escalate to manual approval; unique idempotency key | **DONE** | Tested in `tests/state-machine.test.ts` test #4 (Commit `aca1a6d`). |
| **C4** | Policy-claim grounding: Prompt passes zero policy details; validator flags ungrounded rules/facts; UI marks "AI note (unverified)" | **DONE** | Tested in `tests/grounding.test.ts` test #7, UI in `approvals` & `events` (Commit `e7bd782`, `6eaaf6d`). |
| **C5** | Customer drafts: Courtesy notices, not customer instructions | **DONE** | Prompt specification and documentation in `docs/progress.md` (Commit `007830e`). |
| **C6** | Hallmark UI design: 6 screens sloplint clean (0 FAIL, 0 REFLEX, 0 WARN), Antigravity screenshots saved | **DONE** | Hallmark sloplint clean across all views, screenshots in `docs/screenshots/` (Commit `8c93808`, `22ae4b2`). |
| **C7** | Playwright E2E suite on unmodified Docker stack with fake LLM worker overrides | **DONE** | `pnpm exec playwright test` 1 passed (22.3s), screenshots 01-06 updated (Commit `22ae4b2`). |

---

### C1 Live Recovery Database Rows (Real Sandbox Trail)

#### 1. `events` row
```json
{
  "id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
  "type": "payment.capture_declined",
  "source": "sandbox_negative_testing",
  "external_id": "2CM682479Y333790V",
  "status": "RECOVERED",
  "payload": {
    "issue": "INSTRUMENT_DECLINED",
    "debugId": "f38677925aebf",
    "orderId": "2CM682479Y333790V",
    "mockCode": "INSTRUMENT_DECLINED",
    "description": "The instrument presented  was either declined by the processor or bank, or it can't be used for this payment."
  },
  "error_message": null,
  "created_at": "2026-11-07T07:26:09.932Z",
  "updated_at": "2026-11-07T07:27:37.950Z"
}
```

#### 2. `proposals` row
```json
{
  "id": "prop_f52e94a1-7add-4505-ac82-257cadb3f850",
  "event_id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
  "action": "retry",
  "amount": "25.00",
  "currency": "USD",
  "message": "We encountered a temporary processing delay and are retrying your payment. No action is required from you at this time.",
  "confidence": "0.90",
  "reasoning": "First capture decline (retry_count=0) with INSTRUMENT_DECLINED reason indicates a soft decline suitable for automatic retry per policy.",
  "model_used": "nvidia/nemotron-3-ultra-550b-a55b:free",
  "attempts": 1,
  "raw_response": null,
  "created_at": "2026-11-07T07:26:14.375Z",
  "context_snapshot": {
    "amount": 25,
    "source": "sandbox_negative_testing",
    "eventId": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
    "orderId": "2CM682479Y333790V",
    "currency": "USD",
    "eventType": "payment.capture_declined",
    "invoiceId": null,
    "retryCount": 0,
    "customerName": null,
    "customerNote": null,
    "customerEmail": null,
    "declineReason": "INSTRUMENT_DECLINED",
    "customerHistory": null
  }
}
```

#### 3. `actions` row (Executor executed capture retry WITHOUT mock header against PayPal Sandbox)
```json
{
  "id": "act_c28184d3-2946-41f8-b40e-b74ae34cbc61",
  "event_id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
  "proposal_id": "prop_f52e94a1-7add-4505-ac82-257cadb3f850",
  "approval_id": null,
  "action_type": "retry",
  "idempotency_key": "req_1b0c287c-2895-4cd2-8c79-42f4feb923d2",
  "paypal_endpoint": "/v2/checkout/orders/2CM682479Y333790V/capture",
  "paypal_method": "POST",
  "request_summary": {
    "action": "retry",
    "amount": 25,
    "currency": "USD",
    "targetId": "2CM682479Y333790V"
  },
  "response_summary": {
    "amount": {
      "value": "25.00",
      "currency_code": "USD"
    },
    "status": "COMPLETED",
    "captureId": "4D699688EK0420814"
  },
  "status": "SUCCESS",
  "status_code": 200,
  "error_message": null,
  "executed_at": "2026-11-07T07:26:14.456Z"
}
```

#### 4. `audit_log` rows (Full Lifecycle)
```json
[
  {
    "id": 289,
    "timestamp": "2026-11-07T07:26:09.938Z",
    "source": "sandbox_negative_testing",
    "event_type": "payment.capture_declined",
    "event_id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
    "actor": "paypal_capture_route",
    "action": "RECORD_CAPTURE_DECLINE",
    "details": {
      "issue": "INSTRUMENT_DECLINED",
      "source": "sandbox_negative_testing",
      "orderId": "2CM682479Y333790V",
      "description": "The instrument presented was either declined by the processor or bank, or it can't be used for this payment."
    }
  },
  {
    "id": 290,
    "timestamp": "2026-11-07T07:26:14.437Z",
    "source": "agent",
    "event_type": "payment.capture_declined",
    "event_id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
    "actor": "agent",
    "action": "STATE_TRANSITION",
    "details": {
      "to": "PROPOSED",
      "from": "RECEIVED",
      "action": "retry",
      "confidence": 0.9,
      "proposalId": "prop_f52e94a1-7add-4505-ac82-257cadb3f850"
    }
  },
  {
    "id": 291,
    "timestamp": "2026-11-07T07:26:14.447Z",
    "source": "policy_engine",
    "event_type": "payment.capture_declined",
    "event_id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
    "actor": "policy_engine",
    "action": "STATE_TRANSITION",
    "details": {
      "to": "DECIDED",
      "from": "PROPOSED",
      "reason": "Retry count (0/3) is within policy limits and confidence meets threshold.",
      "decision": "AUTO",
      "proposalId": "prop_f52e94a1-7add-4505-ac82-257cadb3f850",
      "ruleTriggered": "AUTO_RETRY_ALLOWED"
    }
  },
  {
    "id": 292,
    "timestamp": "2026-11-07T07:26:16.704Z",
    "source": "executor",
    "event_type": "action.executed",
    "event_id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
    "actor": "executor",
    "action": "STATE_TRANSITION",
    "details": {
      "to": "EXECUTED",
      "from": "DECIDED",
      "result": {
        "amount": { "value": "25.00", "currency_code": "USD" },
        "status": "COMPLETED",
        "captureId": "4D699688EK0420814"
      },
      "actionId": "act_c28184d3-2946-41f8-b40e-b74ae34cbc61",
      "actionType": "retry",
      "idempotencyKey": "req_1b0c287c-2895-4cd2-8c79-42f4feb923d2"
    }
  },
  {
    "id": 294,
    "timestamp": "2026-11-07T07:27:37.955Z",
    "source": "webhook",
    "event_type": "PAYMENT.CAPTURE.COMPLETED",
    "event_id": "evt_dec_934cb7ef-00cc-4deb-97ba-fe2a6e0a2f48",
    "actor": "paypal_webhook",
    "action": "STATE_TRANSITION",
    "details": {
      "to": "RECOVERED",
      "from": "EXECUTED",
      "orderId": "2CM682479Y333790V",
      "captureId": "4D699688EK0420814"
    }
  }
]
```

---

### LLM Budget Reconciliation
- **Provider Limit (`LLM_PROVIDER_DAILY_CAP`)**: 50 calls/day (OpenRouter free-tier credit cap).
- **Application Budget (`LLM_DAILY_BUDGET`)**: 40 calls/day (strictly below provider cap).
- **OpenRouter `/api/v1/key` Provider Query**: `usage: 0`, `limit: 50`.
- **Local Application Counter**: 18 calls recorded (16 from test fail-safes/error tests + 2 live verification calls in G0 and C1).
- **Total Live Calls in M2**: Exactly **1 live call used in M2** (`nvidia/nemotron-3-ultra-550b-a55b:free` for order `2CM682479Y333790V`).
- **Live Calls Remaining**: 6 remaining of the 8-call total project budget.

---

### Schema Nullability Clarification
- **Schema**: `policyUpdateSchema` in `src/app/api/policies/route.ts:13`.
- **Field**: `description: z.string().nullable().optional()`.
- **Rationale**: The database column `policies.description` is nullable (`text("description")` in Drizzle ORM). When the frontend saves policy modifications from `/policies`, existing policies with `null` descriptions submit `{ description: null }`. Without `.nullable().optional()`, Zod validation rejected requests with `Expected string, received null`.
