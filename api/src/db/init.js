/**
 * Creates the database tables if they do not exist yet.
 * Called once when the API starts (see src/index.js).
 */
import { query } from '../config/db.js'

export async function initDb () {
  await query(`
    CREATE TABLE IF NOT EXISTS files (
      id            UUID PRIMARY KEY,
      owner_id      TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type     TEXT,
      size_bytes    BIGINT NOT NULL,
      storage_key   TEXT NOT NULL UNIQUE,
      scan_status   TEXT NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}
