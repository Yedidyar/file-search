import z from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number(),
  HOST: z.string(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (!env) {
    env = envSchema.parse(process.env);
  }
  return env;
}

export default function setup() {
  getEnv(); // This will parse and cache the environment variables
}
