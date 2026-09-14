ALTER TYPE "public"."case_category" ADD VALUE 'formal_complaint';--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "complaint_deadline_at" timestamp with time zone;