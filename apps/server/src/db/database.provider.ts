import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { env } from '../env';
import { mockDrizzle } from './mock-database.provider';

const DATABASE_PROVIDER = 'DATABASE';

const useMockDb = !!process.env.USE_MOCK_DB;

const createDb = () => {
  if (useMockDb) {
    console.log('Using mock database for testing');
    return mockDrizzle;
  }

  console.log('Connecting to real PostgreSQL database');
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });
  return drizzle(pool, { schema });
};

export const db = createDb();

export { DATABASE_PROVIDER };

export const databaseProviders = [
  {
    provide: DATABASE_PROVIDER,
    useValue: db,
  },
];
