CREATE TYPE "public"."walk_state" AS ENUM('recording', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "walks" (
	"walk_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"state" "walk_state" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "walks" ADD CONSTRAINT "walks_owner_id_owners_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "walks_owner_id_recording_unique" ON "walks" USING btree ("owner_id") WHERE "walks"."state" = 'recording';
