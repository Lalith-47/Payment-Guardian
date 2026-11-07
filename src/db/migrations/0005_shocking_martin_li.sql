ALTER TABLE "paypal_invoices" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN "due_days" integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN "items" jsonb;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN "draft_message" text;--> statement-breakpoint
ALTER TABLE "paypal_invoices" ADD COLUMN "confirmation_source" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "max_auto_invoice_amount" numeric(10, 2) DEFAULT '500.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "allowed_currencies" jsonb DEFAULT '["USD","CAD","EUR","GBP"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "default_due_days" integer DEFAULT 15 NOT NULL;