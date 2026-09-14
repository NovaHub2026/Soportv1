CREATE TABLE "support_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"timezone" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"attention_threshold_hours" integer NOT NULL,
	"follow_up_window_days" integer NOT NULL,
	"updated_by_id" text NOT NULL,
	"updated_by_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
