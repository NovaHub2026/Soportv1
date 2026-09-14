CREATE TYPE "public"."consultation_status" AS ENUM('open', 'answered');--> statement-breakpoint
CREATE TYPE "public"."consultation_team" AS ENUM('finance', 'operations', 'security', 'verification', 'product');--> statement-breakpoint
CREATE TABLE "case_consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"team" "consultation_team" NOT NULL,
	"question" text NOT NULL,
	"status" "consultation_status" DEFAULT 'open' NOT NULL,
	"requested_by_id" text NOT NULL,
	"requested_by_name" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_by_id" text,
	"answered_by_name" text,
	"answered_at" timestamp with time zone,
	"answer" text
);
--> statement-breakpoint
ALTER TABLE "case_consultations" ADD CONSTRAINT "case_consultations_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_consultations_case_idx" ON "case_consultations" USING btree ("case_id","status");