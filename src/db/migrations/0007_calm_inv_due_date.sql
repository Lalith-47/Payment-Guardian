ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "payment_term" text;
ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "due_date" text;

