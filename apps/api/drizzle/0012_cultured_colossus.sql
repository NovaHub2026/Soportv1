CREATE TABLE "case_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "case_notifications" ADD CONSTRAINT "case_notifications_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_notifications_customer_idx" ON "case_notifications" USING btree ("customer_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "case_notifications_case_idx" ON "case_notifications" USING btree ("case_id");