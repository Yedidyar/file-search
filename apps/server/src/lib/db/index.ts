import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string({
    required_error:
      'DATABASE_URL environment variable is required for database connection',
  }),
});

const env = envSchema.parse(process.env);

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle({ client: pool, schema: schema });
