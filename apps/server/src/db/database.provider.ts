import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { env } from '../env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle({ client: pool, schema: schema });

export const DATABASE_PROVIDER = 'DATABASE';

export const databaseProviders = [
  {
    provide: DATABASE_PROVIDER,
    useValue: db,
  },
];
