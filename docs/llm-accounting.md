# LLM Accounting and Request Origin Audit

## Overview
This document records the lineage, origin classification, and accounting rules for the `llm_requests` table.

## Database Schema (`llm_requests`)
```sql
Table "public.llm_requests"
    Column     |           Type           | Nullable |                 Default                  
---------------+--------------------------+----------+------------------------------------------
 id            | integer                  | not null | nextval('llm_requests_id_seq'::regclass) 
 timestamp     | timestamp with time zone | not null | now()                                    
 caller        | text                     | not null |                                          
 model         | text                     | not null |                                          
 event_id      | text                     |          |                                          
 http_status   | integer                  |          |                                          
 attempt       | integer                  | not null | 1                                        
 latency_ms    | integer                  |          |                                          
 error_message | text                     |          |                                          
 origin        | text                     | not null | 'measured'::text                         
Indexes:
    "llm_requests_pkey" PRIMARY KEY, btree (id)
```

## Classification: Measured vs Reconstructed
- **measured**: Written in real-time by the instrumented OpenRouter client (`src/agent/client.ts`) during live outbound HTTP execution. The `latency_ms` is the actual measured elapsed execution time in milliseconds (`Date.now() - startTime`), and `http_status` is the HTTP response status. Only measured rows count toward live budget decisions.
- **reconstructed**: Historical requests backfilled to align local logging with the provider's cumulative daily request counter after instrumentation was introduced in commit `3eb8e67`. Because these calls occurred prior to client-level latency tracking, their `latency_ms` values have been set to `NULL` (discarding artificial estimates ending in 0).

## Historical Rows (1–14) Audit
All 14 rows were seeded post-facto via an administrative reconciliation SQL script during commit `3eb8e67` / step 550 to reconcile OpenRouter's reported daily counter (14) with events in the database. None of rows 1–14 were written at call time by the instrumented client. Consequently, all 14 rows are marked `origin = 'reconstructed'` and their `latency_ms` is set to `NULL`.

| ID | Timestamp (UTC) | Caller | Model | Event ID | HTTP Status | Attempt | Latency (ms) | Origin | Backfill Reason / Source |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-07 11:37:38 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_2240ee07-4426-4e8e-be15-a345ef851a17 | 200 | 1 | NULL | reconstructed | Initial C1 dispute evaluation triage |
| 2 | 2026-11-07 11:41:29 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_snap_p9inx | 200 | 1 | NULL | reconstructed | Snapshot evaluation test |
| 3 | 2026-11-07 11:41:39 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_sm_auto_2926d5c6 | 200 | 1 | NULL | reconstructed | State machine auto-capture transition |
| 4 | 2026-11-07 11:41:39 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_sm_appr_2926d5c6 | 200 | 1 | NULL | reconstructed | State machine approval evaluation |
| 5 | 2026-11-07 11:41:39 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_sm_offer_2926d5c6 | 200 | 1 | NULL | reconstructed | State machine offer evaluation |
| 6 | 2026-11-07 11:41:43 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_bound_1_c924c63d | 200 | 1 | NULL | reconstructed | Policy boundary condition test 1 |
| 7 | 2026-11-07 11:41:48 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_bound_2_c924c63d | 200 | 1 | NULL | reconstructed | Policy boundary condition test 2 |
| 8 | 2026-11-07 11:41:52 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_bound_3_c924c63d | 200 | 1 | NULL | reconstructed | Policy boundary condition test 3 |
| 9 | 2026-11-07 11:41:54 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_test_283beb14 | 200 | 1 | NULL | reconstructed | Live worker integration test |
| 10 | 2026-11-07 13:43:54 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_a4dd40e0-9d2f-4a95-bcc8-9f6297576f13 | 200 | 1 | NULL | reconstructed | E2E Playwright run against demo stack |
| 11 | 2026-11-07 13:43:57 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_48d0b7da-4670-4d25-820c-c48faeac32ca | 200 | 1 | NULL | reconstructed | E2E Playwright run against demo stack |
| 12 | 2026-11-07 14:18:02 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_8e32a1b1-c364-4d51-a41a-70f4ee43b455 | 200 | 1 | NULL | reconstructed | E2E Playwright run against demo stack |
| 13 | 2026-11-07 14:18:06 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_a20f6b38-1f0e-4051-bafd-3620b49876fe | 200 | 1 | NULL | reconstructed | E2E Playwright run against demo stack |
| 14 | 2026-11-07 14:18:17 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_2b53eda4-e90f-4882-b357-cef03b176f44 | 200 | 1 | NULL | reconstructed | E2E Playwright run against demo stack |

## Live Measured Rows (15–24) Audit
All calls from row 15 onward were measured in real-time by the instrumented OpenRouter client with millisecond-precision latency tracking (`latency_ms`).

| ID | Timestamp (UTC) | Caller | Model | Event ID | HTTP Status | Attempt | Latency (ms) | Origin | Context / Purpose |
|---|---|---|---|---|---|---|---|---|---|
| 15 | 2026-11-07 17:32:06 | invoice-extractor | nvidia/nemotron-3-ultra-550b-a55b:free | | 200 | 1 | 803 | measured | Invoice extraction preflight validation |
| 16 | 2026-11-07 17:38:27 | agent | nvidia/nemotron-3-ultra-550b-a55b:free | | 200 | 1 | 799 | measured | Agent decision engine reachability test |
| 17 | 2026-11-07 17:38:58 | invoice-extractor | nvidia/nemotron-3-ultra-550b-a55b:free | | 200 | 1 | 849 | measured | Invoice extraction prompt structure check |
| 18 | 2026-11-07 17:39:16 | invoice-extractor | nvidia/nemotron-3-ultra-550b-a55b:free | | 200 | 1 | 641 | measured | Live Call 1: Invoice 0050 extraction ($20 Acme Corp) |
| 19 | 2026-11-07 17:54:27 | invoice-extractor | nvidia/nemotron-3-ultra-550b-a55b:free | | 200 | 1 | 764 | measured | Live Call 2: Invoice 0051 extraction ($750 Beta LLC) |
| 20 | 2026-11-07 18:30:08 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_d204559e-8cde-4f9b-a51a-6b9027ef887d | 200 | 1 | 629 | measured | Checkout test capture declined attempt 1 (Order 6LC362308L9034703) |
| 21 | 2026-11-07 18:30:18 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_22f8f066-5cf5-461b-af2e-426ea5b630b6 | 200 | 1 | 531 | measured | Checkout test capture declined attempt 2 (Order 6LC362308L9034703) |
| 22 | 2026-11-07 18:30:35 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_23aeb8ea-bcdb-4582-b947-5616a7583c98 | 200 | 1 | 535 | measured | Checkout test capture declined attempt 3 (Order 6LC362308L9034703) |
| 23 | 2026-11-07 18:30:42 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_d0ff95ce-b168-48fd-a940-0de355cdb40c | 200 | 1 | 515 | measured | Checkout test capture declined attempt 4 (Order 6LC362308L9034703) |
| 24 | 2026-11-07 19:02:47 | worker | nvidia/nemotron-3-ultra-550b-a55b:free | evt_dec_0d4e8ab5-564d-4bce-9876-525c128f0713 | 200 | 1 | 530 | measured | Worker background event evaluation |

## Safety Gate (`LLM_ALLOW_LIVE`)
To protect budget and strictly prevent accidental live OpenRouter consumption:
- The runtime enforces `LLM_ALLOW_LIVE` (boolean, default `false`).
- When `false`, all attempts to make outbound network calls to the real OpenRouter provider (`defaultOpenRouterCaller`, `AgentService.evaluateEvent`, `extractInvoiceFromText`) are refused BEFORE any network request is issued.
- Events evaluated while `LLM_ALLOW_LIVE=false` transition immediately to `status: WAITING_FOR_AI` with zero outbound network calls and zero `measured` rows written to `llm_requests`.
- The fake LLM server (`http://localhost:4040` / `isRealProvider() === false`) used by the isolated e2e stack is exempt from this gate.
- `/readyz` exposes `llmAllowLive: boolean` for end-to-end verification.

## `/readyz` Mismatch Computation
`/readyz` tracks both `measuredCount` and `reconstructedCount` separately within the current UTC day (`timestamp >= current UTC midnight`).

## Known Pre-Fix Invoice Records (Invoices 0050 & 0051)
Prior to commit addressing Item 1 (invoice due terms bug):
- **Invoice 0050 (`INV2-WM7Y-KVGX-2XA4-8G3W`)**: Created via Live Call 1 ($20.00 to Acme Corp, net 15 prompt). Due to a hardcoded `{ term_type: "DUE_ON_RECEIPT" }` payload in `paypalClient.createDraftInvoice`, PayPal reported `term_type = "DUE_ON_RECEIPT"` and `due_date = "2026-11-07"`. Subsequently paid in sandbox and reconciled to `PAID_CONFIRMED_BY_POLLING`.
- **Invoice 0051 (`INV2-KBEJ-EYQW-7ATK-W7JQ`)**: Created via Live Call 2 ($750.00 to Beta LLC, net 30 prompt, over-limit human approval). Although the proposal stated `dueDays: 30`, `createDraftInvoice` omitted the term payload, resulting in PayPal recording `term_type = "DUE_ON_RECEIPT"` and `due_date = "2026-11-07"`, while `paypal_invoices.due_days` defaulted to `15`.
- Both records (0050 and 0051) are preserved unmodified as historical pre-fix records.
- Invoices created post-fix (0060 `INV2-F4LY-K7PW-F7E2-SSZS` with Net 30 -> `NET_30` / `2026-12-07`, and 0061 `INV2-S5Z6-JVQ7-R9ZK-7QAC` with custom 20 days -> `DUE_ON_DATE_SPECIFIED` / `2026-11-27`) correctly reflect parsed due terms and store the exact terms reported back by PayPal on GET.

## Complete Invoice Registry (Every Invoice Created in Runs)
The following is the exhaustive list of all invoice records across the demo database and PayPal sandbox:

| Invoice ID | Invoice Number | DB Table | Amount | Status | Payment Term | Due Date | Origin / Note |
|---|---|---|---|---|---|---|---|
| `INV2-WM7Y-KVGX-2XA4-8G3W` | `0050` | `paypal_invoices` | $20.00 USD | `PAID_CONFIRMED_BY_POLLING` | DUE_ON_RECEIPT | 2026-11-07 | Live Call 1 ($20 Acme Corp) |
| `INV2-KBEJ-EYQW-7ATK-W7JQ` | `0051` | `paypal_invoices` | $750.00 USD | `SENT` | DUE_ON_RECEIPT | 2026-11-07 | Live Call 2 ($750 Beta LLC) |
| `INV2-F4LY-K7PW-F7E2-SSZS` | `0060` | `paypal_invoices` | $30.00 USD | `SENT` | `NET_30` | 2026-12-07 | Real verification invoice (Net 30) |
| `INV2-S5Z6-JVQ7-R9ZK-7QAC` | `0061` | `paypal_invoices` | $45.00 USD | `SENT` | `DUE_ON_DATE_SPECIFIED` | 2026-11-27 | Real verification invoice (custom 20 days) |
| `INV2-LH2U-HJ83-EN9F-9U7F` | `E2E-0062` | PayPal Sandbox | $150.00 USD | `SENT` | NET_15 | 2026-11-22 | E2E stack test execution |
| `INV2-3Z9H-U569-AWC5-RH2L` | `E2E-E2E-0063` | PayPal Sandbox | $150.00 USD | `SENT` | NET_15 | 2026-11-22 | E2E stack test execution |
| `INV2-XDGK-PTGE-94YG-YJS9` | `E2E-E2E-0064` | PayPal Sandbox | $150.00 USD | `DRAFT` | NET_15 | 2026-11-22 | E2E stack test execution |
| `INV2-4G66-ZV93-2K3Q-ZN2S` | `E2E-E2E-0065` | PayPal Sandbox | $150.00 USD | `DRAFT` | NET_15 | 2026-11-22 | E2E stack test execution |
| `INV_SYNC_c40fc2c1` ... `INV_SYNC_95b899b9` | NULL | `paypal_invoices` | $500.00 USD | `SENT` | NULL | NULL | 14 synthetic seed records from sync/polling tests |

*Note on scratch IDs*: `INV2-7T2W-TY8U-45W9-2DVL` and `INV2-9UET-E5C7-P5B3-6K6N` cited in an interim report were ephemeral test objects created in the isolated test database `revenue_guardian_test` during unit test harness development, not demo DB verification records. The authoritative verification invoices are `INV2-F4LY-K7PW-F7E2-SSZS` (0060) and `INV2-S5Z6-JVQ7-R9ZK-7QAC` (0061).

## Webhook Deliveries Classification (Real vs Simulated)
- **Delivery 63 (`WH-7Y7254563A4550640-11V2185806837105M`)**: PayPal's canned Webhook Simulator sample. Payload contains `create_time: 2015-02-17T18:51:33Z`, capture `42311647XV020574X`, and order `8U481631H66031715`. It is **simulated** (not a real delivery).
- **Nov 4 M1 Webhook**: Used the exact same simulator event ID `WH-7Y7254563A4550640-11V2185806837105M` from 2015, and was likewise **simulated**.
- **Provably Real Webhook Deliveries**:
  - Deliveries 47 & 48: `WH-3L12717952942970T-25G99833JD6155048` and `WH-5NW19326K3043071Y-8GN930717H152400K` (`CHECKOUT.ORDER.APPROVED` for sandbox order `9H315076FR413194X`, created Nov 7 11:22 & 11:27 UTC).
  - Delivery 49: `WH-0A160470LX2405000-2U246758JX0520422` (`PAYMENT.CAPTURE.COMPLETED` for capture `96Y881058L747472P`, order `9H315076FR413194X`, created Nov 7 11:37 UTC — the accepted real C1 trail).
  - Delivery 22: `WH-3RU56185SY270690U-5A375863H98296418` (`PAYMENT.CAPTURE.COMPLETED` for capture `4D699688EK0420814`, order `2CM682479Y333790V`).
  - Deliveries 10, 14, 18, 23, 27, 31, 41, 50: `INVOICING.INVOICE.CREATED` deliveries for real sandbox invoices 0022 through 0029.
  - Deliveries 64, 65, 66, 67, 68, 69: Real sandbox webhooks emitted by PayPal for sandbox invoices created during E2E runs (`E2E-0062`, `E2E-E2E-0063`, `E2E-E2E-0064`, `E2E-E2E-0065`).
- **Simulated / Synthetic Deliveries**:
  - Delivery 63: Canned 2015 simulator sample (`WH-7Y7254563A4550640-11V2185806837105M`).
  - All deliveries with transmission IDs starting with `trans_` (`trans_unknown_*`, `trans_wh_sim_*`, `trans_wh_rec_*`, `wh_evt_*`): synthetically created by local test suites and simulator harnesses.

- Local counts today: queries rows where `timestamp >= current UTC midnight` for `origin = 'measured'` and `origin = 'reconstructed'`.
- `localCountToday = measuredCount + reconstructedCount`.
- Provider counter resets daily at UTC midnight, returning `providerUsed` for the current UTC day.
- `mismatch = providerUsed !== null ? providerUsed !== localCountToday : false`.
When the provider counter resets at the next UTC midnight, previous-day rows are excluded from `localCountToday`, preventing any false mismatch tomorrow while ensuring any unlogged live request to the real provider triggers an immediate mismatch.
