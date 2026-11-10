CREATE TABLE "sim_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"character_id" integer,
	"input" text NOT NULL,
	"status" text NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sim_jobs" ADD CONSTRAINT "sim_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sim_jobs" ADD CONSTRAINT "sim_jobs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sim_jobs_status_id_idx" ON "sim_jobs" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "sim_jobs_user_id_id_idx" ON "sim_jobs" USING btree ("user_id","id" DESC NULLS LAST);