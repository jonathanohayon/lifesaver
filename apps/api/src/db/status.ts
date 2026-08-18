import { env } from '../config/env.js';
import { isDatabaseConfigured, query } from './pool.js';

export interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
  provider: 'postgresql';
  sslEnabled: boolean;
  databaseTime: string | null;
  databaseName: string | null;
  message: string;
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (!isDatabaseConfigured) {
    return {
      configured: false,
      connected: false,
      provider: 'postgresql',
      sslEnabled: env.DATABASE_SSL,
      databaseTime: null,
      databaseName: null,
      message: 'Database is not configured yet. Add DATABASE_URL to .env when ready.',
    };
  }

  try {
    const result = await query<{ now: Date; database_name: string }>(
      'SELECT NOW() AS now, current_database() AS database_name;'
    );

    const row = result.rows[0];

    return {
      configured: true,
      connected: true,
      provider: 'postgresql',
      sslEnabled: env.DATABASE_SSL,
      databaseTime: row?.now ? row.now.toISOString() : null,
      databaseName: row?.database_name ?? null,
      message: 'Database connection is healthy.',
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      provider: 'postgresql',
      sslEnabled: env.DATABASE_SSL,
      databaseTime: null,
      databaseName: null,
      message: error instanceof Error ? error.message : 'Database connection failed.',
    };
  }
}
