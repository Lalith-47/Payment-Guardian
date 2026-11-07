CREATE TABLE IF NOT EXISTS "policy_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" text NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "trigger_rule" text;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "reminder_cadence_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "tone" text DEFAULT 'empathetic' NOT NULL;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'policy_versions_policy_id_policies_id_fk'
	) THEN
		ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;