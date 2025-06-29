import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/file_search_test';

const testPool = new Pool({
  connectionString: TEST_DATABASE_URL,
});

export const testDb = drizzle(testPool, { schema });
