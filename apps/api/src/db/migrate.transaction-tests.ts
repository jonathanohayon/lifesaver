import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyMigration, runMigrations, type MigrationClient } from './migrate.runner.js';

/**
 * Regression tests for the migration runner transaction bug.
 *
 * The bug: the runner sent `BEGIN`, the migration body and `COMMIT` through the
 * pool-level `query()` helper, which checks out an arbitrary connection per call. The
 * three statements could land on three different sessions, so the migration ran outside
 * any transaction and auto-committed statement by statement. A migration that failed
 * halfway left the schema partly changed with nothing recorded in schema_migrations.
 *
 * These tests do not assert that a mock was called. They run the real runner against a
 * fake session that MODELS Postgres transaction semantics — including the auto-commit
 * behaviour outside a transaction that made the old code dangerous — and assert on what
 * ends up durably applied. A runner that lost its transaction would fail them.
 */

/**
 * A single database session with just enough behaviour to be meaningful.
 *
 * Two rules carry the whole test suite:
 *   1. a write inside a transaction becomes durable only at COMMIT, and is discarded at
 *      ROLLBACK;
 *   2. a write issued with NO transaction open commits immediately.
 *
 * Rule 2 is what makes the old bug visible. A migration body is a multi-statement string,
 * and Postgres executes those statements one after another: if the session is not in a
 * transaction, each one commits on its own. A file that fails at its third statement then
 * leaves the first two permanently applied, with no ledger row saying so. The session
 * below therefore splits a body into statements rather than treating it as atomic —
 * modelling the body as a single all-or-nothing call would hide precisely the damage
 * this suite exists to detect.
 */
class FakeSession implements MigrationClient {
  inTransaction = false;
  /** Migrations durably recorded, i.e. what a later run would see as already applied. */
  committed: string[] = [];
  /** DDL statements durably applied to the schema. */
  schema: string[] = [];
  /** Writes issued inside the current transaction, discarded on ROLLBACK. */
  private pendingLedger: string[] = [];
  private pendingSchema: string[] = [];
  /** Every statement issued to this session, in order. */
  statements: string[] = [];
  /** Statements containing this substring throw, simulating a bad migration. */
  failOnBody: string | null = null;
  failOnRollback = false;

  async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    const sql = text.trim();
    this.statements.push(collapse(sql));

    if (sql === 'BEGIN') {
      assert.equal(this.inTransaction, false, 'BEGIN issued while a transaction was already open.');
      this.inTransaction = true;
      this.pendingLedger = [];
      this.pendingSchema = [];
      return { rows: [] };
    }

    if (sql === 'COMMIT') {
      assert.equal(this.inTransaction, true, 'COMMIT issued with no transaction open.');
      this.committed.push(...this.pendingLedger);
      this.schema.push(...this.pendingSchema);
      this.pendingLedger = [];
      this.pendingSchema = [];
      this.inTransaction = false;
      return { rows: [] };
    }

    if (sql === 'ROLLBACK') {
      if (this.failOnRollback) {
        this.inTransaction = false;
        throw new Error('connection lost during rollback');
      }
      this.pendingLedger = [];
      this.pendingSchema = [];
      this.inTransaction = false;
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO schema_migrations')) {
      this.write(this.pendingLedger, this.committed, String(values?.[0]));
      return { rows: [] };
    }

    if (sql.startsWith('SELECT filename FROM schema_migrations')) {
      return { rows: this.committed.map((filename) => ({ filename })) };
    }

    if (sql.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return { rows: [] };
    }

    // A migration body: one or more statements, executed in sequence.
    for (const statement of splitStatements(sql)) {
      if (this.failOnBody !== null && statement.includes(this.failOnBody)) {
        throw new Error(`syntax error near "${this.failOnBody}"`);
      }
      this.write(this.pendingSchema, this.schema, statement);
    }

    return { rows: [] };
  }

  /** Buffered until COMMIT inside a transaction; immediately durable outside one. */
  private write(pending: string[], durable: string[], value: string) {
    (this.inTransaction ? pending : durable).push(value);
  }
}

const splitStatements = (sql: string) =>
  sql
    .split(';')
    .map((statement) => collapse(statement))
    .filter(Boolean);

const collapse = (sql: string) => sql.replace(/\s+/g, ' ').trim();

async function withMigrationsDir(
  files: Record<string, string>,
  run: (dir: string) => Promise<void>
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lifesaver-migrations-'));

  try {
    for (const [name, contents] of Object.entries(files)) {
      await fs.writeFile(path.join(dir, name), contents, 'utf8');
    }
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

// ---------------------------------------------------------------------------------------
// The transaction is real
// ---------------------------------------------------------------------------------------

test('a migration wraps its body and its ledger row in one transaction, in order', async () => {
  const session = new FakeSession();

  await applyMigration(session, '001_create_things.sql', 'CREATE TABLE things (id INT);');

  assert.deepEqual(session.statements, [
    'BEGIN',
    'CREATE TABLE things (id INT);',
    'INSERT INTO schema_migrations (filename) VALUES ($1);',
    'COMMIT',
  ]);
  assert.deepEqual(session.committed, ['001_create_things.sql']);
  assert.equal(session.inTransaction, false, 'the transaction must be closed when the migration returns.');
});

test('a migration that fails records nothing and leaves no transaction open', async () => {
  const session = new FakeSession();
  session.failOnBody = 'BROKEN';

  await assert.rejects(
    () => applyMigration(session, '002_broken.sql', 'CREATE TABLE BROKEN ('),
    /syntax error/,
    'the original database error must reach the caller.'
  );

  assert.deepEqual(
    session.committed,
    [],
    'a failed migration must not be recorded in schema_migrations — this is the regression.'
  );
  assert.ok(session.statements.includes('ROLLBACK'), 'a failed migration must be rolled back.');
  assert.ok(!session.statements.includes('COMMIT'), 'a failed migration must never commit.');
  assert.equal(session.inTransaction, false, 'the transaction must not be left open on the pinned session.');
});

test('a multi-statement migration failing partway applies NONE of its statements', async () => {
  const session = new FakeSession();
  session.failOnBody = 'BROKEN';

  await assert.rejects(
    () =>
      applyMigration(
        session,
        '004_multi.sql',
        [
          'CREATE TABLE alpha (id INT);',
          'CREATE TABLE BROKEN (;',
          'CREATE TABLE gamma (id INT);',
        ].join('\n')
      ),
    /syntax error/
  );

  // This is the sharpest form of the regression. Without a real transaction the first
  // statement commits on its own, and the schema is left holding a table that no ledger
  // row accounts for — the next run would replay the file and fail on "alpha already
  // exists", which is exactly how a database gets stuck.
  assert.deepEqual(
    session.schema,
    [],
    'statements executed before the failure must not survive: the transaction must undo them.'
  );
  assert.deepEqual(session.committed, [], 'and nothing may be recorded as applied.');
});

test('a rollback that itself fails does not mask the original error', async () => {
  const session = new FakeSession();
  session.failOnBody = 'BROKEN';
  session.failOnRollback = true;

  await assert.rejects(
    () => applyMigration(session, '003_broken.sql', 'CREATE TABLE BROKEN ('),
    /syntax error/,
    'the migration error must survive a failing rollback, not be replaced by it.'
  );
});

// ---------------------------------------------------------------------------------------
// The run as a whole
// ---------------------------------------------------------------------------------------

test('migrations apply in filename order, not directory order', async () => {
  await withMigrationsDir(
    {
      '010_tenth.sql': 'SELECT 10;',
      '002_second.sql': 'SELECT 2;',
      '001_first.sql': 'SELECT 1;',
      'README.md': 'not a migration',
      'notes.sql': 'SELECT 0;',
    },
    async (dir) => {
      const session = new FakeSession();
      const applied = await runMigrations(session, dir);

      assert.equal(applied, 3, 'only the NNN_*.sql files are migrations.');
      assert.deepEqual(session.committed, ['001_first.sql', '002_second.sql', '010_tenth.sql']);
    }
  );
});

test('already applied migrations are skipped and not re-run', async () => {
  await withMigrationsDir(
    { '001_first.sql': 'SELECT 1;', '002_second.sql': 'SELECT 2;' },
    async (dir) => {
      const session = new FakeSession();
      session.committed = ['001_first.sql'];

      const applied = await runMigrations(session, dir);

      assert.equal(applied, 1);
      assert.deepEqual(session.committed, ['001_first.sql', '002_second.sql']);
      assert.ok(!session.statements.includes('SELECT 1;'), 'an applied migration must not run twice.');
    }
  );
});

test('a failing migration stops the run and leaves the earlier ones applied', async () => {
  await withMigrationsDir(
    {
      '001_first.sql': 'SELECT 1;',
      '002_broken.sql': 'CREATE TABLE BROKEN (',
      '003_third.sql': 'SELECT 3;',
    },
    async (dir) => {
      const session = new FakeSession();
      session.failOnBody = 'BROKEN';

      await assert.rejects(() => runMigrations(session, dir), /syntax error/);

      assert.deepEqual(
        session.committed,
        ['001_first.sql'],
        'the ledger must reflect exactly what succeeded: the first, not the broken one.'
      );
      assert.ok(
        !session.statements.includes('SELECT 3;'),
        'the run must stop at the failure rather than skipping past it.'
      );
    }
  );
});

test('a clean run against no pending migrations touches nothing', async () => {
  await withMigrationsDir({ '001_first.sql': 'SELECT 1;' }, async (dir) => {
    const session = new FakeSession();
    session.committed = ['001_first.sql'];

    const applied = await runMigrations(session, dir);

    assert.equal(applied, 0);
    assert.ok(!session.statements.includes('BEGIN'), 'nothing to do means no transaction is opened.');
  });
});

// ---------------------------------------------------------------------------------------

let failures = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} migration transaction tests passed.`);

if (failures > 0) {
  process.exit(1);
}
