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

## `/readyz` Mismatch Computation
`/readyz` tracks both `measuredCount` and `reconstructedCount` separately.
- Reconstructed baseline: 14 calls.
- Expected measured calls from provider: `max(0, providerUsed - reconstructedCount)`.
- Local measured calls: `SELECT count(*) FROM llm_requests WHERE origin = 'measured'`.
- `mismatch = expectedMeasured !== null ? expectedMeasured !== measuredCount : false`.
This ensures historical reconstructed calls do not pollute live call budget accounting or trigger false mismatch alerts, while guaranteeing that any unlogged live request to the real provider triggers an immediate mismatch.
