import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),

  filename: text('filename').notNull(),
  fileType: text('file_type').notNull(),
  path: text('path').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deletedAt', { withTimezone: true }),

  lastIndexedAt: timestamp('lastIndexedAt', { withTimezone: true }).notNull(),
});
