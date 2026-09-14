ALTER TYPE "public"."case_event_type" ADD VALUE 'reminder_sent';--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "outside_hours_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_settings" ADD COLUMN "reminder_after_hours" integer DEFAULT 48 NOT NULL;