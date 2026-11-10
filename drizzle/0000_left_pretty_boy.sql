CREATE TYPE "public"."role" AS ENUM('tank', 'healer', 'dps');--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"blizzard_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"class_name" text NOT NULL,
	"spec" text,
	"role" "role" NOT NULL,
	"item_level" integer,
	"guild_rank" integer,
	"in_guild" boolean DEFAULT true NOT NULL,
	"last_login" timestamp with time zone,
	"last_synced" timestamp with time zone,
	"user_id" integer,
	CONSTRAINT "characters_blizzard_id_unique" UNIQUE("blizzard_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"active_character_id" integer,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;