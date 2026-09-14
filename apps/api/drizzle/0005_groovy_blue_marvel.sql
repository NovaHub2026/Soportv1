ALTER TABLE "support_cases" ADD COLUMN "closed_reason" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "parent_case_id" uuid;