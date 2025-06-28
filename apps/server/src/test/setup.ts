import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import path from 'node:path';

// Test database configuration
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/file_search_test';

let testPool: Pool;
let testDb: ReturnType<typeof drizzle>;

export const getTestDb = () => testDb;

export const setupTestDatabase = async () => {
  // Create a new pool for testing
  testPool = new Pool({
    connectionString: TEST_DATABASE_URL,
  });

  // Create drizzle instance
  testDb = drizzle(testPool, { schema });

  await migrate(testDb, {
    migrationsFolder: path.resolve(__dirname, '../../migrations'),
  });
};

export const cleanupTestDatabase = async () => {
  if (testPool) {
    await testPool.end();
  }
};

export const clearTestDatabase = async () => {
  if (testDb) {
    // Clear all tables in reverse order of dependencies
    await testDb.delete(schema.scanPathIgnores);
    await testDb.delete(schema.tags);
    await testDb.delete(schema.scanPaths);
    await testDb.delete(schema.files);
  }
};

// Global test setup
beforeAll(async () => {
  await setupTestDatabase();
});

// Global test cleanup
afterAll(async () => {
  await cleanupTestDatabase();
});

// Clear database before each test
beforeEach(async () => {
  await clearTestDatabase();
});
