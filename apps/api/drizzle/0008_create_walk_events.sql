CREATE TYPE "public"."walk_event_type" AS ENUM('pee', 'poop', 'sniff', 'greet');
--> statement-breakpoint
CREATE TABLE "walk_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"walk_id" uuid NOT NULL,
	"participant_dog_id" uuid NOT NULL,
	"type" "walk_event_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"latitude" numeric(8, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "walk_events" ADD CONSTRAINT "walk_events_walk_id_walks_walk_id_fk" FOREIGN KEY ("walk_id") REFERENCES "public"."walks"("walk_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "walk_events" ADD CONSTRAINT "walk_events_participant_dog_id_dogs_dog_id_fk" FOREIGN KEY ("participant_dog_id") REFERENCES "public"."dogs"("dog_id") ON DELETE no action ON UPDATE no action;
