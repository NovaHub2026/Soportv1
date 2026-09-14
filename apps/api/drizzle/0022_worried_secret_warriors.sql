CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"requested_by_id" text NOT NULL,
	"requested_by_name" text,
	"reason" text NOT NULL,
	"case_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
