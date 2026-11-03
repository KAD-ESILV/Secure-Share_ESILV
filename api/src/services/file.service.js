/**
 * File logic for axis 2.
 * - SCRUM-12 (FR-STO-01): the content goes to SeaweedFS, the information
 *   (name, owner, size...) goes to PostgreSQL
 * - SCRUM-14 (FR-STO-02): the content is encrypted (AES-256-GCM) before
 *   it is stored, so SeaweedFS never holds a readable file
 */
import { randomUUID } from 'node:crypto'
import { query } from '../config/db.js'
import { putObject } from '../config/storage.js'
import { encryptFile, getMasterKey, sha256 } from '../utils/crypto.js'

export const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32 MB (VirusTotal free limit)
export const MAX_FILES = 10 // files per upload

export async function saveFile (ownerId, file) {
  const id = randomUUID()
  const storageKey = `${ownerId}/${id}`

  const encrypted = encryptFile(file.buffer, getMasterKey())

  // Only encrypted bytes leave the API
  await putObject(storageKey, encrypted.body, 'application/octet-stream')

  const { rows } = await query(
    `INSERT INTO files (id, owner_id, original_name, mime_type, size_bytes, storage_key,
                        enc_key, enc_iv, enc_tag, content_sha256)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, original_name, mime_type, size_bytes, scan_status, created_at`,
    [
      id, ownerId, file.originalname, file.mimetype, file.size, storageKey,
      encrypted.wrappedKey, encrypted.iv, encrypted.tag, sha256(file.buffer)
    ]
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
