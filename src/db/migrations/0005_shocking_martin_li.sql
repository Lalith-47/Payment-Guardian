ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "customer_name" text;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "due_days" integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "items" jsonb;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "note" text;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "draft_message" text;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN IF NOT EXISTS "confirmation_source" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "max_auto_invoice_amount" numeric(10, 2) DEFAULT '500.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "allowed_currencies" jsonb DEFAULT '["USD","CAD","EUR","GBP"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "default_due_days" integer DEFAULT 15 NOT NULL;