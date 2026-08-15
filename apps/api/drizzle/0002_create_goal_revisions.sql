CREATE TYPE "public"."goal_period" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TABLE "goal_revisions" (
	"goal_revision_id" uuid PRIMARY KEY NOT NULL,
	"dog_id" uuid NOT NULL,
	"period" "goal_period" NOT NULL,
	"minutes" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_revisions" ADD CONSTRAINT "goal_revisions_dog_id_dogs_dog_id_fk" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("dog_id") ON DELETE no action ON UPDATE no action;
