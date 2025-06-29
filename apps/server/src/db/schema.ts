import {
  pgTable,
  text,
  timestamp,
  uuid,
  smallint,
  integer,
  interval,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),

  filename: text('filename').notNull(),
  fileType: text('file_type').notNull(),
  path: text('path').notNull().unique(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deletedAt', { withTimezone: true }),

  lastIndexedAt: timestamp('lastIndexedAt', { withTimezone: true }).notNull(),
});

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id')
    .notNull()
    .references(() => files.id),
  name: text('name').notNull(),
});

export const scanStatusEnum = pgEnum('scan_status', [
  'success',
  'error',
  'skipped',
]);

export const scanPaths = pgTable('scan_paths', {
  id: uuid('id').defaultRandom().primaryKey(),
  pathGlob: text('path_glob').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
  nextScanAt: timestamp('next_scan_at', { withTimezone: true }),
  lastStatus: scanStatusEnum('last_status'),
  lastErrorMessage: text('last_error_message'),
  failureCount: integer('failure_count').default(0).notNull(),
  scanInterval: interval('scan_interval').notNull(),
  priority: smallint('priority').default(0).notNull(),
});

export const scanPathIgnores = pgTable('scan_path_ignores', {
  scanPathId: uuid('scan_path_id')
    .notNull()
    .references(() => scanPaths.id),
  pattern: text('pattern').notNull(),
});
