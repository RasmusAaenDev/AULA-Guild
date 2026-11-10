CREATE TABLE "highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "highlights_baseline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "highlights_character_dedupe_idx" ON "highlights" USING btree ("character_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "highlights_occurred_at_idx" ON "highlights" USING btree ("occurred_at" DESC NULLS LAST);