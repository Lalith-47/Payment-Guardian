# Revenue Guardian — Milestone 2 Checklist

- [x] **Checkpoint commits**: Hygiene committed in `23b6153`. WIP M2 committed in `649fe54`.
- [x] **scripts/ credential check**: Verified zero hardcoded credentials in `scripts/`.
- [x] **gitleaks clean**: Gitleaks pre-commit scanned with 0 leaks found; working tree scanned.
- [x] **test edits reviewed**: Verified 6 test files for strict assertions; zero .skip/.only/fixme, no loosened matchers.
- [x] **Docker build with new .dockerignore**: Verified `docker compose build` passes cleanly.
- [x] **Hallmark per-screen sloplint + screenshots**: Sloplint clean on every screen (commit `8c93808`), Antigravity browser screenshots saved to `docs/screenshots`.
- [ ] **C1 real recovered trail**: Real sandbox order approved -> captured with INSTRUMENT_DECLINED -> AUTO retry without mock header -> PAYMENT.CAPTURE.COMPLETED webhook links back -> RECOVERED state. (1 live model call).
- [ ] **C2 no mock on retry**: Assert executor-initiated retries never send mockCode or PayPal-Mock-Response header.
- [ ] **C3 retry bound**: Repeated declines capped at policy max -> escalate to approval; unique idempotency key; no duplicate captures.
- [ ] **C4 policy-claim grounding**: Model prompt receives no policy details; validator downgrades reasoning claiming external policies/facts; UI marks "AI note (unverified)".
- [ ] **C5 consistent drafts**: Retry draft is a courtesy notice ("we are retrying your payment"), not customer instruction; documented in `docs/progress.md`.
- [x] **forged-cookie test on every route**: Forged `better-auth.session_token=forged` returns 401 across all protected routes under `src/app/api`; session validated against DB/store (commit `c0db4dc`).
- [ ] **clean Docker rebuild + green Playwright**: `docker compose build --no-cache web worker && docker compose up -d`, unmodified stack with fake LLM worker overrides, Playwright e2e green.
- [ ] **owner seed from env**: Verified credentials read from env with no hardcoded password in repo, tests, or git history.
- [ ] **LLM budget reconciled**: Provider key endpoint usage vs local counter reconciled; provider cap = 50, budget below it.
