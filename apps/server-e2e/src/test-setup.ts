import z from 'zod';
import axios from 'axios';
import { spawn } from 'child_process';
import { afterAll, beforeAll } from 'vitest';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;
let serverProcess: ReturnType<typeof spawn> | null = null;

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
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }
  throw new Error(`Server failed to start after ${maxRetries} attempts`);
}

// Start the server before all tests
beforeAll(async () => {
  const { PORT } = getEnv();
  console.log(`Starting server on port ${PORT}...`);

  serverProcess = spawn(
    'npx',
    ['nx', 'run', 'server:serve', '--port=' + PORT],
    {
      stdio: 'pipe',
      env: { ...process.env },
    },
  );

  serverProcess.stdout?.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });

  // Wait for server to be healthy
  await waitForServer();
}, 30000);

// Stop the server after all tests
afterAll(() => {
  if (serverProcess) {
    console.log('Stopping server...');
    serverProcess.kill();
    serverProcess = null;
  }
});

export default function setup() {
  getEnv(); // This will parse and cache the environment variables
}
