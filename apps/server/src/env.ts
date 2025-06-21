import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z
      .string({
        required_error:
          'DATABASE_URL environment variable is required for database connection',
      })
      .url(),
    PORT: z.coerce.number(),
  },

  runtimeEnv: process.env,
});
