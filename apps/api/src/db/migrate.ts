import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDatabaseConfigured, pool, closeDatabasePool } from './pool.js';
import { runMigrations, type MigrationLogger } from './migrate.runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const migrationsDir = path.join(repoRoot, 'database', 'migrations');

if (!isDatabaseConfigured || !pool) {
  console.error('DATABASE_URL is not configured. Create .env first, then run npm.cmd run db:migrate again.');
  process.exit(1);
}

const logger: MigrationLogger = {
  log: (message) => console.log(message),
  error: (message, error) => (error === undefined ? console.error(message) : console.error(message, error)),
};

// One client for the whole run, checked out here and pinned through every statement.
// See migrate.runner.ts for why the pool-level query() helper cannot be used: it hands
// out an arbitrary connection per call, which silently dissolves the transactions.
const client = await pool.connect();

try {
  const appliedCount = await runMigrations(client, migrationsDir, logger);

  if (appliedCount === 0) {
    console.log('No new migrations to apply. Database is up to date.');
  } else {
    console.log(`Database migrations complete. Applied ${appliedCount} migration(s).`);
  }
} finally {
  client.release();
  await closeDatabasePool();
}
