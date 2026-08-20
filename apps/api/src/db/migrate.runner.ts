import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * The single database session a migration run owns.
 *
 * Taking the client as a parameter is the fix, not a detail of it. The previous runner
 * called the pool-level `query()` helper, which checks out an arbitrary client per call,
 * so `BEGIN`, the migration body and `COMMIT` could land on three different connections:
 * the migration ran outside the transaction it appeared to be in, auto-committing
 * statement by statement. A failure halfway through left the schema partly changed, with
 * nothing recorded in schema_migrations and a `ROLLBACK` sent to a connection that had no
 * transaction open. Threading one pinned client through every statement makes the
 * transaction real, and makes the guarantee testable without a live database.
 *
 * The shape is intentionally minimal rather than pg's `PoolClient`: everything here needs
 * is `query`, and a narrow structural type lets the tests supply a recording double.
 */
export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface MigrationLogger {
  log: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

const silentLogger: MigrationLogger = { log: () => {}, error: () => {} };

/** Migration files are `NNN_description.sql`; anything else in the directory is ignored. */
const MIGRATION_FILE_PATTERN = /^\d+_.*\.sql$/;

export async function ensureMigrationTable(client: MigrationClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getAppliedMigrations(client: MigrationClient): Promise<Set<string>> {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC;');
  return new Set((result.rows as { filename: string }[]).map((row) => row.filename));
}

/**
 * Applies one migration atomically: the schema change and its schema_migrations row
 * commit together, or neither does.
 */
export async function applyMigration(
  client: MigrationClient,
  file: string,
  sql: string,
  logger: MigrationLogger = silentLogger
): Promise<void> {
  await client.query('BEGIN');

  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1);', [file]);
    await client.query('COMMIT');
  } catch (error) {
    // A failed COMMIT has already ended the transaction, and a dead connection makes
    // ROLLBACK fail too. The original error is the one worth reporting either way, so a
    // failing rollback must never replace it.
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error(`Rollback after the failure of ${file} did not complete.`, rollbackError);
    }
    throw error;
  }
}

export async function listMigrationFiles(migrationsDir: string): Promise<string[]> {
  const entries = await fs.readdir(migrationsDir);
  return entries.filter((file) => MIGRATION_FILE_PATTERN.test(file)).sort();
}

/**
 * Applies every not-yet-applied migration, in filename order, each in its own
 * transaction on the given client. Returns how many were applied.
 *
 * One migration per transaction rather than one transaction for the whole run: a run that
 * fails on file 12 keeps the eleven that already succeeded, which is what the
 * schema_migrations ledger claims happened.
 */
export async function runMigrations(
  client: MigrationClient,
  migrationsDir: string,
  logger: MigrationLogger = silentLogger
): Promise<number> {
  await ensureMigrationTable(client);
  const applied = await getAppliedMigrations(client);
  const files = await listMigrationFiles(migrationsDir);

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      logger.log(`Skipping already applied migration: ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');

    logger.log(`Applying migration: ${file}`);

    try {
      await applyMigration(client, file, sql, logger);
    } catch (error) {
      logger.error(`Migration failed: ${file}`);
      throw error;
    }

    appliedCount += 1;
    logger.log(`Applied migration: ${file}`);
  }

  return appliedCount;
}
