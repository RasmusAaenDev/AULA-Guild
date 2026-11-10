CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "rsvps_user_id_idx" ON "rsvps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rsvps_character_id_idx" ON "rsvps" USING btree ("character_id");