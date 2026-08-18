import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDatabaseConfigured, query, closeDatabasePool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const migrationsDir = path.join(repoRoot, 'database', 'migrations');

if (!isDatabaseConfigured) {
  console.error('DATABASE_URL is not configured. Create .env first, then run npm.cmd run db:migrate again.');
  process.exit(1);
}

async function ensureMigrationTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<{ filename: string }>('SELECT filename FROM schema_migrations ORDER BY filename ASC;');
  return new Set(result.rows.map((row) => row.filename));
}

async function run() {
  await ensureMigrationTable();
  const applied = await getAppliedMigrations();

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort();

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping already applied migration: ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');

    console.log(`Applying migration: ${file}`);
    await query('BEGIN');

    try {
      await query(sql);
      await query('INSERT INTO schema_migrations (filename) VALUES ($1);', [file]);
      await query('COMMIT');
      appliedCount += 1;
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await query('ROLLBACK');
      console.error(`Migration failed: ${file}`);
      throw error;
    }
  }

  if (appliedCount === 0) {
    console.log('No new migrations to apply. Database is up to date.');
  } else {
    console.log(`Database migrations complete. Applied ${appliedCount} migration(s).`);
  }
}

try {
  await run();
} finally {
  await closeDatabasePool();
}
