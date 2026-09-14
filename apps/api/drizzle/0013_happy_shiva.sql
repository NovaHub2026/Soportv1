CREATE TABLE "customer_preferences" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"case_id" uuid NOT NULL,
	"notification_id" uuid,
	"kind" text NOT NULL,
	"to_masked" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"link" text NOT NULL,
	"delivery" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_notifications" ADD COLUMN "emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_settings" ADD COLUMN "email_delay_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_notification_id_case_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."case_notifications"("id") ON DELETE set null ON UPDATE no action;