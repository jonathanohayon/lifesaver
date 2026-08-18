import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const isDatabaseConfigured = Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0);

export const pool = isDatabaseConfigured
  ? new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Add it to .env before using database functions.');
  }

  return pool.query<T>(text, params);
}

export async function closeDatabasePool() {
  if (pool) {
    await pool.end();
  }
}
