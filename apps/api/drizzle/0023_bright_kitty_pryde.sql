ALTER TABLE "case_notifications" ADD COLUMN "email_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "case_notifications" ADD COLUMN "email_failed_at" timestamp with time zone;