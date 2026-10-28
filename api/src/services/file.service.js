/**
 * File logic for axis 2 (SCRUM-12, FR-STO-01).
 * - the content goes to SeaweedFS
 * - the information (name, owner, size...) goes to PostgreSQL
 */
import { randomUUID } from 'node:crypto'
import { query } from '../config/db.js'
import { putObject } from '../config/storage.js'

export const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32 MB (VirusTotal free limit)
export const MAX_FILES = 10 // files per upload

export async function saveFile (ownerId, file) {
  const id = randomUUID()
  const storageKey = `${ownerId}/${id}`

  // SCRUM-14 will encrypt file.buffer here, before it is stored.
  await putObject(storageKey, file.buffer, file.mimetype)

  const { rows } = await query(
    `INSERT INTO files (id, owner_id, original_name, mime_type, size_bytes, storage_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, original_name, mime_type, size_bytes, scan_status, created_at`,
    [id, ownerId, file.originalname, file.mimetype, file.size, storageKey]
  )
  return rows[0]
}

export async function listFiles (ownerId) {
  const { rows } = await query(
    `SELECT id, original_name, mime_type, size_bytes, scan_status, created_at
     FROM files
     WHERE owner_id = $1
     ORDER BY created_at DESC`,
    [ownerId]
  )
  return rows
}
