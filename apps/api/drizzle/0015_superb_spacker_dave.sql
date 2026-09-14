ALTER TABLE "support_cases" ADD COLUMN "waiting_customer_since" timestamp with time zone;--> statement-breakpoint
-- Backfill (FND-0033): cases already waiting for the customer keep their previous measure of the wait.
UPDATE "support_cases" SET "waiting_customer_since" = coalesce("last_staff_message_at", "updated_at") WHERE "status" = 'waiting_customer' AND "waiting_customer_since" IS NULL;
