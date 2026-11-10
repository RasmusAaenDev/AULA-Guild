import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
  surname: text('surname'),
  className: text('class_name').notNull(),
  spec: text('spec'),
  role: roleEnum('role').notNull(),
  level: integer('level'),
  itemLevel: integer('item_level'),
  guildRank: integer('guild_rank'),
  inGuild: boolean('in_guild').notNull().default(true),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  lastSynced: timestamp('last_synced', { withTimezone: true }),
  // Tidspunkt for første highlight-baseline; null = ikke sat (så ingen historik backfilles).
  highlightsBaselineAt: timestamp('highlights_baseline_at', { withTimezone: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
});

export const eventTypes = ['raid', 'aften'] as const;
export type EventType = (typeof eventTypes)[number];
export const eventTypeEnum = pgEnum('event_type', eventTypes);

import { rsvpStatuses, type RsvpStatus } from '@/lib/rsvp-ui';

export { rsvpStatuses };
export type { RsvpStatus };
export const rsvpStatusEnum = pgEnum('rsvp_status', rsvpStatuses);

export const eventSeries = pgTable('event_series', {
  id: serial('id').primaryKey(),
  type: eventTypeEnum('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  weekday: integer('weekday').notNull(),
  startTime: text('start_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  active: boolean('active').notNull().default(true),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    type: eventTypeEnum('type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    seriesId: integer('series_id').references(() => eventSeries.id, { onDelete: 'set null' }),
    detached: boolean('detached').notNull().default(false),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('events_series_starts_at_uniq').on(t.seriesId, t.startsAt).where(sql`${t.seriesId} is not null`),
    index('events_starts_at_idx').on(t.startsAt),
  ],
);

export const rsvps = pgTable(
  'rsvps',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: integer('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    status: rsvpStatusEnum('status').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rsvps_event_user_uniq').on(t.eventId, t.userId),
    index('rsvps_user_id_idx').on(t.userId),
    index('rsvps_character_id_idx').on(t.characterId),
  ],
);

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    pinned: boolean('pinned').notNull().default(false),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('posts_created_at_idx').on(t.createdAt), index('posts_pinned_idx').on(t.pinned, t.pinnedAt)],
);

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('comments_post_id_idx').on(t.postId, t.createdAt)],
);

export const postReads = pgTable(
  'post_reads',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index('post_reads_post_id_idx').on(t.postId)],
);

export const postBookmarks = pgTable(
  'post_bookmarks',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index('post_bookmarks_post_id_idx').on(t.postId)],
);

export const fileSections = ['filer', 'galleri'] as const;
export type FileSectionValue = (typeof fileSections)[number];
export const fileSectionEnum = pgEnum('file_section', fileSections);

export const files = pgTable(
  'files',
  {
    id: serial('id').primaryKey(),
    section: fileSectionEnum('section').notNull(),
    title: text('title').notNull(),
    originalName: text('original_name').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // Serverens eget tilfældige id (crypto.randomUUID()); aldrig afledt af brugerinput.
    storageKey: text('storage_key').notNull().unique(),
    uploadedBy: integer('uploaded_by')
      .notNull()
      .references(() => users.id),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('files_section_created_at_idx').on(t.section, t.createdAt)],
);

// Egne chat-kanaler: findes kun i vores database, aldrig i Discord.
export const chatChannels = pgTable(
  'chat_channels',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('chat_channels_name_active_idx').on(sql`lower(${t.name})`).where(sql`${t.deletedAt} is null`)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id')
      .notNull()
      .references(() => chatChannels.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    characterId: integer('character_id').references(() => characters.id, { onDelete: 'set null' }),
    // Snapshot af den aktive karakters fulde navn på sendetidspunktet.
    authorName: text('author_name').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('chat_messages_channel_id_id_idx').on(t.channelId, t.id)],
);

// Automatisk genererede begivenheder fra armory (level-up, achievements). Ryddes efter 30 dage.
export const highlightTypes = ['level_up', 'achievement'] as const;
export type HighlightType = (typeof highlightTypes)[number];

export const highlights = pgTable(
  'highlights',
  {
    id: serial('id').primaryKey(),
    characterId: integer('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    type: text('type').$type<HighlightType>().notNull(),
    title: text('title').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('highlights_character_dedupe_idx').on(t.characterId, t.dedupeKey),
    index('highlights_occurred_at_idx').on(t.occurredAt.desc()),
  ],
);

// SimulationCraft-jobs: en kø i databasen, som appens runner afvikler én ad gangen mod simc-worker.
export const simStatuses = ['queued', 'running', 'done', 'failed'] as const;
export type SimStatus = (typeof simStatuses)[number];

export const simJobs = pgTable(
  'sim_jobs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Til senere brug (armory-indgang); bruges ikke endnu.
    characterId: integer('character_id').references(() => characters.id, { onDelete: 'set null' }),
    input: text('input').notNull(),
    status: text('status').$type<SimStatus>().notNull(),
    result: jsonb('result'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('sim_jobs_status_id_idx').on(t.status, t.id), index('sim_jobs_user_id_id_idx').on(t.userId, t.id.desc())],
);
