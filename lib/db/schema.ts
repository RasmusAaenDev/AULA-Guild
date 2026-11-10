import { boolean, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const roles = ['tank', 'healer', 'dps'] as const;
export type Role = (typeof roles)[number];
export const roleEnum = pgEnum('role', roles);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  discordId: text('discord_id').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  activeCharacterId: integer('active_character_id'),
});

export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  blizzardId: integer('blizzard_id').notNull().unique(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  spec: text('spec'),
  role: roleEnum('role').notNull(),
  itemLevel: integer('item_level'),
  guildRank: integer('guild_rank'),
  inGuild: boolean('in_guild').notNull().default(true),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  lastSynced: timestamp('last_synced', { withTimezone: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
});
