CREATE TABLE "owners" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"cognito_subject" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_cognito_subject_unique" UNIQUE("cognito_subject")
);
