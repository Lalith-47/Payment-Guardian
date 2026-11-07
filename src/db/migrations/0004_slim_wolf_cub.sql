CREATE TABLE IF NOT EXISTS "llm_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"caller" text NOT NULL,
	"model" text NOT NULL,
	"event_id" text,
	"http_status" integer,
	"attempt" integer DEFAULT 1 NOT NULL,
	"latency_ms" integer,
	"error_message" text
);
