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

// Health check function with abort condition
async function waitForServer(
  maxRetries = 20,
  retryDelay = 1500,
  shouldAbort = () => false,
) {
  const { HOST, PORT } = getEnv();
  const url = `http://${HOST}:${PORT}/api`;

  for (let i = 0; i < maxRetries; i++) {
    // Check if we should stop trying
    if (shouldAbort()) {
      throw new Error('Server failed to start properly');
    }

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

  // Setup server environment with test configuration
  const testEnv = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'test',
    USE_MOCK_DB: 'true', // Enable mock database mode
  };

  let serverFailed = false;

  serverProcess = spawn(
    'npx',
    ['nx', 'run', 'server:serve', '--port=' + PORT],
    {
      stdio: 'pipe',
      env: testEnv,
    },
  );

  serverProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    console.log(`Server stdout: ${output}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    const error = data.toString();
    console.error(`Server stderr: ${error}`);

    // Detect server failures
    if (
      error.includes('Invalid environment variables') ||
      error.includes('Error:') ||
      error.includes('exited with code 1')
    ) {
      serverFailed = true;
    }
  });

  // Wait for server to be healthy or detect failure
  await waitForServer(20, 1500, () => serverFailed);
}, 60000);

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
