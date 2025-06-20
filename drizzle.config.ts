import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string({
    required_error:
      'DATABASE_URL environment variable is required for database connection',
  }),
});

const env = envSchema.parse(process.env);

export default defineConfig({
  out: './apps/server/migrations',
  schema: './apps/server/src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
