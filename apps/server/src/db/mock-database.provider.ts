import * as schema from './schema';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// Create SQLite database in memory
const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

// Initialize database tables
const initDb = () => {
  // Create tables based on schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER,
      modified INTEGER,
      created INTEGER,
      content_type TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_paths (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_path_ignores (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL
    );
  `);
};

initDb();

// SQLite-backed implementation with same API as the mock
const sqliteDb = {
  // Query implementations
  select: () => ({
    from: (table: any) => {
      if (table === schema.files) {
        return {
          leftJoin: () => ({
            orderBy: () => {
              // Get files from SQLite
              return sqlite.prepare('SELECT * FROM files').all();
            },
          }),
        };
      }
      return [];
    },
  }),
  insert: (table: any) => ({
    values: (values: any) => ({
      onConflictDoUpdate: () => ({
        returning: () => {
          if (table === schema.files) {
            const records = Array.isArray(values) ? values : [values];
            const insertStmt = sqlite.prepare(
              'INSERT INTO files (id, path, name, size, modified, created, content_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            );

            const results = records.map((record) => {
              const id = randomUUID();
              insertStmt.run(
                id,
                record.path,
                record.name,
                record.size,
                record.modified,
                record.created,
                record.content_type,
              );
              return { ...record, id };
            });

            return results;
          }
          return [];
        },
      }),
      returning: () => {
        if (table === schema.tags) {
          const records = Array.isArray(values) ? values : [values];
          const insertStmt = sqlite.prepare(
            'INSERT INTO tags (id, name) VALUES (?, ?)',
          );

          records.forEach((record) => {
            const id = randomUUID();
            insertStmt.run(id, record.name);
          });
        }
        return [];
      },
    }),
  }),
  delete: (table: any) => ({
    where: () => {
      if (table === schema.tags) {
        sqlite.prepare('DELETE FROM tags').run();
      }
      return [];
    },
  }),
  transaction: async (callback: any) => {
    return sqlite.transaction(() => {
      return callback(sqliteDb);
    });
  },
};

export const mockDrizzle = sqliteDb as any;

export const mockDatabaseProviders = [
  {
    provide: 'DATABASE',
    useValue: sqliteDb,
  },
];
