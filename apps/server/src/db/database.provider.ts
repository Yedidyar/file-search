import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { env } from '../env';

const DATABASE_PROVIDER = 'DATABASE';

const createDb = () => {
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
