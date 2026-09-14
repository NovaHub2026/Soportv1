ALTER TABLE "support_cases" ADD COLUMN "record_kind" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "record_reference" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "record_captured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "record_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "record_lookup_reason" text;--> statement-breakpoint
CREATE INDEX "support_cases_record_idx" ON "support_cases" USING btree ("customer_id","record_kind","record_reference");