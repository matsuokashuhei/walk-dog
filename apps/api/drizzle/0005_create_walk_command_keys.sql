CREATE TYPE "public"."walk_command_namespace" AS ENUM('start', 'finish');--> statement-breakpoint
CREATE TABLE "walk_command_keys" (
	"walk_command_key_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"namespace" "walk_command_namespace" NOT NULL,
	"key" text NOT NULL,
	"body_hash" text NOT NULL,
	"walk_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "walk_command_keys_owner_id_namespace_key_unique" UNIQUE("owner_id","namespace","key")
);
--> statement-breakpoint
ALTER TABLE "walk_command_keys" ADD CONSTRAINT "walk_command_keys_owner_id_owners_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_command_keys" ADD CONSTRAINT "walk_command_keys_walk_id_walks_walk_id_fk" FOREIGN KEY ("walk_id") REFERENCES "public"."walks"("walk_id") ON DELETE no action ON UPDATE no action;
