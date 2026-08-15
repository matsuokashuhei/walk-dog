CREATE TYPE "public"."dog_gender" AS ENUM('male', 'female', 'unknown');--> statement-breakpoint
CREATE TABLE "dogs" (
	"dog_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gender" "dog_gender" NOT NULL,
	"birthday" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dogs_owner_id_name_unique" UNIQUE("owner_id","name")
);
--> statement-breakpoint
ALTER TABLE "dogs" ADD CONSTRAINT "dogs_owner_id_owners_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("owner_id") ON DELETE no action ON UPDATE no action;
