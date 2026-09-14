ALTER TABLE "support_cases" ADD COLUMN "customer_last_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "staff_last_read_at" timestamp with time zone;