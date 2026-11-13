import { query } from '../config/db.js'

export async function initScansTable () {
  await query(`
    CREATE TABLE IF NOT EXISTS scans (
      id          SERIAL PRIMARY KEY,
      file_id     UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      status      TEXT NOT NULL,
      reason      TEXT,
      source      TEXT NOT NULL,
      malicious   INTEGER NOT NULL DEFAULT 0,
      suspicious  INTEGER NOT NULL DEFAULT 0,
      scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

export async function getFileForScan (fileId) {
  const result = await query(
    `SELECT id, original_name, storage_key, enc_key, enc_iv, enc_tag, content_sha256
     FROM files
     WHERE id = $1`,
    [fileId]
  )

  return result.rows[0]
}

export async function saveScanResult (fileId, scan) {
  await query(
    `INSERT INTO scans (file_id, status, reason, source, malicious, suspicious)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [fileId, scan.status, scan.reason, scan.source, scan.malicious, scan.suspicious]
  )

  await query(
    'UPDATE files SET scan_status = $1 WHERE id = $2',
    [scan.status, fileId]
  )
}

export async function getPendingFileIds () {
  const result = await query(
    `SELECT id
     FROM files
     WHERE scan_status = 'pending'
     ORDER BY created_at`
  )

  return result.rows.map((row) => row.id)
}

export async function listScans () {
  const result = await query(
    `SELECT s.id, s.file_id, f.original_name, f.owner_id, s.status, s.reason,
            s.source, s.malicious, s.suspicious, s.scanned_at
     FROM scans s
     JOIN files f ON f.id = s.file_id
     ORDER BY s.scanned_at DESC`
  )

  return result.rows
}

export async function listQuarantine () {
  const result = await query(
    `SELECT id, owner_id, original_name, mime_type, size_bytes, scan_status, created_at
     FROM files
     WHERE scan_status IN ('malicious', 'suspicious')
     ORDER BY created_at DESC`
  )

  return result.rows
}
