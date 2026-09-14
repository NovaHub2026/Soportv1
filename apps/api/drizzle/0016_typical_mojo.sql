CREATE TYPE "public"."access_recovery_status" AS ENUM('received', 'forwarded', 'closed');--> statement-breakpoint
CREATE TABLE "access_recovery_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "access_recovery_requests_reference_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"contact" text NOT NULL,
	"contact_hash" text NOT NULL,
	"description" text NOT NULL,
	"status" "access_recovery_status" DEFAULT 'received' NOT NULL,
	"client_request_id" text,
	"handled_by_id" text,
	"handled_by_name" text,
	"handled_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "access_recovery_reference_uq" ON "access_recovery_requests" USING btree ("reference_number");--> statement-breakpoint
CREATE UNIQUE INDEX "access_recovery_client_request_uq" ON "access_recovery_requests" USING btree ("contact_hash","client_request_id") WHERE "access_recovery_requests"."client_request_id" is not null;--> statement-breakpoint
CREATE INDEX "access_recovery_status_idx" ON "access_recovery_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "access_recovery_contact_idx" ON "access_recovery_requests" USING btree ("contact_hash","created_at");