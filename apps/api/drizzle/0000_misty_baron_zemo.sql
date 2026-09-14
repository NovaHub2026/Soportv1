CREATE TYPE "public"."actor_type" AS ENUM('customer', 'staff', 'system');--> statement-breakpoint
CREATE TYPE "public"."case_category" AS ENUM('deposits_withdrawals', 'operations', 'account_verification', 'bonuses_promotions', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_event_type" AS ENUM('case_created', 'case_assigned', 'status_changed', 'case_reopened');--> statement-breakpoint
CREATE TYPE "public"."case_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('new', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."message_visibility" AS ENUM('public', 'internal');--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" "case_event_type" NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"author_type" "actor_type" NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text,
	"visibility" "message_visibility" DEFAULT 'public' NOT NULL,
	"body" text NOT NULL,
	"client_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "support_cases_reference_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" text NOT NULL,
	"subject" text NOT NULL,
	"category" "case_category" NOT NULL,
	"status" "case_status" DEFAULT 'new' NOT NULL,
	"priority" "case_priority" DEFAULT 'normal' NOT NULL,
	"assigned_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_customer_message_at" timestamp with time zone,
	"last_staff_message_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_events_case_idx" ON "case_events" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "case_messages_case_idx" ON "case_messages" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_messages_author_client_message_uq" ON "case_messages" USING btree ("author_id","client_message_id") WHERE "case_messages"."client_message_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "support_cases_reference_number_uq" ON "support_cases" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "support_cases_customer_idx" ON "support_cases" USING btree ("customer_id","last_message_at");--> statement-breakpoint
CREATE INDEX "support_cases_queue_idx" ON "support_cases" USING btree ("status","assigned_agent_id","created_at");