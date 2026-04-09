import { Pool, type PoolClient, types as pgTypes } from 'pg';

// node-postgres returns NUMERIC as a string by default to preserve precision.
// For Blackmoor's use cases (marketplace prices, budget spend in USD, item
// stats), JS float precision is sufficient and treating them as numbers is
// far more ergonomic than parseFloat at every call site. Register the parser
// once at module load so every NUMERIC column returns a number.
pgTypes.setTypeParser(1700, parseFloat); // 1700 = OID for NUMERIC

// Reuse the pool across hot reloads in dev
const globalForPg = globalThis as unknown as { pool: Pool };

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // rejectUnauthorized: false is required for managed Postgres hosts (Heroku, Render, etc.)
    // that use self-signed certs. To fully verify the cert, set DATABASE_CA_CERT env var instead.
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pool = pool;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

// Run a function inside a single DB transaction. The callback receives a
// dedicated client; commits on success, rolls back on any thrown error,
// always releases the client.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
