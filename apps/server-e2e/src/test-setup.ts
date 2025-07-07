import z from 'zod';
import axios from 'axios';
import { beforeAll } from 'vitest';
import { setTimeout } from 'timers/promises';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (!env) {
    env = envSchema.parse({
      PORT: process.env.PORT || 3000,
      HOST: process.env.HOST || 'localhost',
    });
  }
  return env;
}

// Health check function
async function waitForServer(maxRetries = 20, retryDelay = 1500) {
  const { HOST, PORT } = getEnv();
  const url = `http://${HOST}:${PORT}/api`;

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Health check attempt ${i + 1}/${maxRetries}...`);
      await axios.get(url);
      console.log('Server is ready!');
      return true;
    } catch (e) {
      console.log(`Server not ready yet, retrying...`);
      await setTimeout(retryDelay);
    }
  }
  throw new Error(`Server failed to start after ${maxRetries} attempts`);
}

// Wait for the server to be ready before running tests
beforeAll(async () => {
  console.log(`Checking if server is ready on port ${getEnv().PORT}...`);
  await waitForServer();
}, 30 * 1000);

export default async function setup() {
  getEnv(); // This will parse and cache the environment variables
}
