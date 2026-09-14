ALTER TABLE "case_messages" ADD COLUMN "system_kind" text;--> statement-breakpoint
ALTER TABLE "case_messages" ADD COLUMN "system_data" jsonb;