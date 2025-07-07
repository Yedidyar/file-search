import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const useMockDb = !!process.env.USE_MOCK_DB;

export const env = createEnv({
  server: {
    DATABASE_URL: useMockDb
      ? z.string().optional().default('mock://localhost/test-db')
      : z
          .string({
            required_error:
              'DATABASE_URL environment variable is required for database connection',
          })
          .url(),
    PORT: z.coerce.number(),
  },

  runtimeEnv: process.env,
});
