import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import dockerCompose from 'docker-compose';
import path from 'node:path';
import isPortReachable from 'is-port-reachable';
import { TEST_DATABASE_URL } from './test-db';

export const setup = async () => {
  console.time('global-setup');

  const isDBReachable = await isPortReachable(5433, { host: '127.0.0.1' });

  if (!isDBReachable) {
    await dockerCompose.upAll({
      cwd: path.resolve(__dirname),
      log: true,
    });
  }

  await dockerCompose.exec(
    'postgres-test',
    ['sh', '-c', 'until pg_isready ; do sleep 1; done'],
    {
      cwd: path.join(__dirname),
    },
  );

  const testPool = new Pool({
    connectionString: TEST_DATABASE_URL,
  });

  const testDb = drizzle(testPool, { schema });

  await migrate(testDb, {
    migrationsFolder: path.resolve(__dirname, '../../migrations'),
  });

  await testPool.end();

  console.timeEnd('global-setup');

  return async () => {
    console.time('global-cleanup');

    if (process.env.CI) {
      await dockerCompose.down({
        cwd: path.resolve(__dirname),
      });
    } else {
      if (Math.ceil(Math.random() * 10) === 10) {
        await testDb.delete(schema.scanPathIgnores);
        await testDb.delete(schema.tags);
        await testDb.delete(schema.scanPaths);
        await testDb.delete(schema.files);
      }
    }

    console.timeEnd('global-cleanup');
  };
};
