CREATE TABLE "walk_participants" (
	"walk_participant_id" uuid PRIMARY KEY NOT NULL,
	"walk_id" uuid NOT NULL,
	"dog_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "walk_participants_walk_id_dog_id_unique" UNIQUE("walk_id","dog_id")
);
--> statement-breakpoint
ALTER TABLE "walk_participants" ADD CONSTRAINT "walk_participants_walk_id_walks_walk_id_fk" FOREIGN KEY ("walk_id") REFERENCES "public"."walks"("walk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_participants" ADD CONSTRAINT "walk_participants_dog_id_dogs_dog_id_fk" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("dog_id") ON DELETE no action ON UPDATE no action;
