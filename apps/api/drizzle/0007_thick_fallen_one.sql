DROP INDEX "case_messages_author_client_message_uq";--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "client_message_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "case_messages_case_author_client_message_uq" ON "case_messages" USING btree ("case_id","author_type","author_id","client_message_id") WHERE "case_messages"."client_message_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "support_cases_customer_client_message_uq" ON "support_cases" USING btree ("customer_id","client_message_id") WHERE "support_cases"."client_message_id" is not null;--> statement-breakpoint
-- Cycle Audit 1 (FND-0010): the creation key moves to the case. Backfill it from each case's first customer
-- message so retries of creations made before this migration still find their case.
UPDATE "support_cases" c SET "client_message_id" = m."client_message_id"
FROM "case_messages" m
WHERE m."case_id" = c."id" AND m."author_type" = 'customer' AND m."client_message_id" IS NOT NULL
  AND m."created_at" = (SELECT MIN(x."created_at") FROM "case_messages" x WHERE x."case_id" = c."id" AND x."author_type" = 'customer');
