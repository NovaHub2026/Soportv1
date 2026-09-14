CREATE TYPE "public"."incident_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" text
);
--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "incident_id" uuid;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;