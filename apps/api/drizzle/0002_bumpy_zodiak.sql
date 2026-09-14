CREATE TYPE "public"."attachment_status" AS ENUM('checking', 'available', 'rejected');--> statement-breakpoint
CREATE TABLE "case_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"message_id" uuid,
	"uploader_type" "actor_type" NOT NULL,
	"uploader_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" "attachment_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_message_id_case_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."case_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_attachments_case_idx" ON "case_attachments" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "case_attachments_message_idx" ON "case_attachments" USING btree ("message_id");