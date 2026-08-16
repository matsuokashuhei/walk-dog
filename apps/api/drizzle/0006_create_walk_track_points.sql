CREATE TABLE "walk_track_points" (
	"track_point_id" uuid PRIMARY KEY NOT NULL,
	"walk_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "walk_track_points_walk_id_recorded_at_unique" UNIQUE("walk_id","recorded_at")
);
--> statement-breakpoint
ALTER TABLE "walk_track_points" ADD CONSTRAINT "walk_track_points_walk_id_walks_walk_id_fk" FOREIGN KEY ("walk_id") REFERENCES "public"."walks"("walk_id") ON DELETE no action ON UPDATE no action;