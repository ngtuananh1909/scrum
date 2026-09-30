import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export type SqlClient = Pick<PoolClient, 'query'>;
export type SqlPool = Pick<Pool, 'connect'>;

let pool: Pool | undefined;

/**
 * The server talks to Postgres through the transaction pooler. Browser code
 * never imports this module and therefore never receives the database URL.
 */
export function databasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error('DATABASE_URL is required for the server database');

    let host: string;
    try {
      host = new URL(connectionString).hostname.replace(/^\[|\]$/g, '');
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
    }

    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    const isLocalDatabase = localHosts.has(host);
    pool = new Pool({
      connectionString,
      max: 1,
      allowExitOnIdle: true,
      // Supabase's transaction pooler does not support named prepared
      // statements. All queries in this service are unnamed.
      ssl: isLocalDatabase ? false : { rejectUnauthorized: true },
    });
  }
  return pool;
}

export async function queryOne<T extends QueryResultRow>(
  client: SqlClient,
  text: string,
  values: readonly unknown[] = [],
): Promise<T | null> {
  const result = await client.query<T>(text, [...values]);
  return result.rows[0] ?? null;
}
