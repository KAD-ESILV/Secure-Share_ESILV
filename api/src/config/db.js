/**
 * PostgreSQL connection pool, shared by the whole API.
 * DATABASE_URL is provided by docker-compose.yml.
 */
import pg from 'pg'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export function query (text, params) {
  return pool.query(text, params)
}
