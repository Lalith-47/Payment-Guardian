ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'unknown';

-- 1. Unify signature_status values (strictly VALID or INVALID)
UPDATE "webhook_deliveries"
SET "signature_status" = 'INVALID'
WHERE "signature_status" != 'VALID';

-- 2. Classify real deliveries: resource ID matches an object we created in paypal_orders, paypal_invoices, or actions
UPDATE "webhook_deliveries"
SET "origin" = 'real'
WHERE (
  (raw_body::json)->'resource'->'invoice'->>'id' IN (SELECT id FROM paypal_invoices WHERE id IS NOT NULL)
  OR (raw_body::json)->'resource'->>'id' IN (SELECT id FROM paypal_invoices WHERE id IS NOT NULL)
  OR (raw_body::json)->'resource'->>'id' IN (SELECT id FROM paypal_orders WHERE id IS NOT NULL)
  OR (raw_body::json)->'resource'->'supplementary_data'->'related_ids'->>'order_id' IN (SELECT id FROM paypal_orders WHERE id IS NOT NULL)
  OR (raw_body::json)->'resource'->>'id' IN (SELECT response_summary->>'captureId' FROM actions WHERE response_summary->>'captureId' IS NOT NULL)
  OR (raw_body::json)->'resource'->>'id' IN (SELECT response_summary->>'orderId' FROM actions WHERE response_summary->>'orderId' IS NOT NULL)
);

-- 3. Classify simulated deliveries:
-- - ancient create_time (canned simulator sample from 2015)
-- - test harness transmissions / synthetic event IDs
-- - or resource IDs that match nothing created in our tables
UPDATE "webhook_deliveries"
SET "origin" = 'simulated'
WHERE "origin" = 'unknown';
