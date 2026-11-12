-- Skift fra Discord- til Battle.net-login: alle brugere starter forfra.
-- Indhold (opslag, kommentarer, chatbeskeder, filer, events, serier, karakterer) bevares uden ejer;
-- forfatter-/uploadernavnet gemmes som tekst, før brugerne slettes.
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "event_series" DROP CONSTRAINT "event_series_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_series" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "uploaded_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "uploader_name" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "author_name" text;--> statement-breakpoint
-- Navnet som det blev vist: den aktive karakters fulde navn (som lib/names.ts fullName), ellers brugernavnet.
CREATE TEMP TABLE "_bnet_author_names" ON COMMIT DROP AS
  SELECT u."id" AS "user_id",
    COALESCE(
      CASE
        WHEN c."id" IS NULL THEN NULL
        WHEN NULLIF(btrim(c."surname"), '') IS NOT NULL THEN c."name" || ' ' || btrim(c."surname")
        WHEN c."slug" LIKE lower(c."name") || '-_%'
          THEN c."name" || ' ' || upper(substr(c."slug", length(c."name") + 2, 1)) || substr(c."slug", length(c."name") + 3)
        ELSE c."name"
      END,
      u."name"
    ) AS "name"
  FROM "users" u
  LEFT JOIN "characters" c ON c."id" = u."active_character_id" AND c."user_id" = u."id";
--> statement-breakpoint
UPDATE "posts" p SET "author_name" = n."name" FROM "_bnet_author_names" n WHERE n."user_id" = p."author_id";--> statement-breakpoint
UPDATE "comments" c SET "author_name" = n."name" FROM "_bnet_author_names" n WHERE n."user_id" = c."author_id";--> statement-breakpoint
UPDATE "files" f SET "uploader_name" = n."name" FROM "_bnet_author_names" n WHERE n."user_id" = f."uploaded_by";--> statement-breakpoint
DROP TABLE "_bnet_author_names";--> statement-breakpoint
-- Brugerafhængige rækker slettes; ejer-kolonner på bevaret indhold nulstilles.
DELETE FROM "rsvps";--> statement-breakpoint
DELETE FROM "post_reads";--> statement-breakpoint
DELETE FROM "post_bookmarks";--> statement-breakpoint
DELETE FROM "sim_jobs";--> statement-breakpoint
UPDATE "posts" SET "author_id" = NULL;--> statement-breakpoint
UPDATE "comments" SET "author_id" = NULL;--> statement-breakpoint
UPDATE "files" SET "uploaded_by" = NULL;--> statement-breakpoint
UPDATE "events" SET "created_by" = NULL;--> statement-breakpoint
UPDATE "event_series" SET "created_by" = NULL;--> statement-breakpoint
UPDATE "chat_channels" SET "created_by" = NULL;--> statement-breakpoint
UPDATE "chat_messages" SET "user_id" = NULL;--> statement-breakpoint
UPDATE "characters" SET "user_id" = NULL;--> statement-breakpoint
DELETE FROM "users";--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_discord_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "discord_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "battlenet_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "battletag" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_battlenet_id_unique" UNIQUE("battlenet_id");
