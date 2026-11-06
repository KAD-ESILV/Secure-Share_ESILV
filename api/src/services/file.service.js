/**
 * File logic for axis 2 - CRUD on the "file" entity (Labs 5 and 6).
 * - SCRUM-12 (FR-STO-01): upload, content in SeaweedFS, information in PostgreSQL
 * - SCRUM-14 (FR-STO-02): content encrypted (AES-256-GCM) before storage
 * - Download (FR-STO-09): decrypted on the fly, integrity checked with SHA-256
 * - Rename (PUT) and delete (FR-STO-04)
 *
 * Every function takes the owner id: a user can only see or change his own files.
 */
import { randomUUID } from 'node:crypto'
import { query } from '../config/db.js'
import { putObject, getObject, deleteObject } from '../config/storage.js'
import { encryptFile, decryptFile, getMasterKey, sha256 } from '../utils/crypto.js'

export const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32 MB (VirusTotal free limit)
export const MAX_FILES = 10 // files per upload
export const MAX_NAME_LENGTH = 255

const PUBLIC_COLUMNS = 'id, original_name, mime_type, size_bytes, scan_status, created_at'

/** Thrown when a stored file does not match its original fingerprint. */
export class IntegrityError extends Error {
  constructor () {
    super('File integrity check failed')
    this.name = 'IntegrityError'
    this.status = 500
  }
}

/** Checks a new file name. Returns an error message, or null if it is valid. */
export function validateFileName (name) {
  if (typeof name !== 'string' || name.trim() === '') {
    return 'name is required'
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return `name must be at most ${MAX_NAME_LENGTH} characters`
  }
  if (/[/\\]/.test(name)) {
    return 'name must not contain / or \\'
  }
  return null
}

// CREATE ---------------------------------------------------------------

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
     RETURNING ${PUBLIC_COLUMNS}`,
    [
      id, ownerId, file.originalname, file.mimetype, file.size, storageKey,
      encrypted.wrappedKey, encrypted.iv, encrypted.tag, sha256(file.buffer)
    ]
  )
  return rows[0]
}

// READ -----------------------------------------------------------------

export async function listFiles (ownerId) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}
     FROM files
     WHERE owner_id = $1
     ORDER BY created_at DESC`,
    [ownerId]
  )
  return rows
}

/** Returns the information of one file, or null if it does not exist or is not mine. */
export async function getFile (ownerId, id) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM files WHERE id = $1 AND owner_id = $2`,
    [id, ownerId]
  )
  return rows[0] || null
}

/**
 * Returns the decrypted content of one file, or null if not found.
 * Nothing readable is ever written on disk: decryption happens in memory.
 */
export async function downloadFile (ownerId, id) {
  const { rows } = await query(
    `SELECT original_name, mime_type, storage_key, enc_key, enc_iv, enc_tag, content_sha256
     FROM files WHERE id = $1 AND owner_id = $2`,
    [id, ownerId]
  )
  const row = rows[0]
  if (!row) return null

  const body = await getObject(row.storage_key)

  let content
  try {
    content = decryptFile(
      { body, iv: row.enc_iv, tag: row.enc_tag, wrappedKey: row.enc_key },
      getMasterKey()
    )
  } catch {
    throw new IntegrityError()
  }

  if (sha256(content) !== row.content_sha256) {
    throw new IntegrityError()
  }

  return { name: row.original_name, mimeType: row.mime_type, content }
}

// UPDATE ---------------------------------------------------------------

/** Renames one file. Returns the updated file, or null if not found. */
export async function renameFile (ownerId, id, newName) {
  const { rows } = await query(
    `UPDATE files SET original_name = $3
     WHERE id = $1 AND owner_id = $2
     RETURNING ${PUBLIC_COLUMNS}`,
    [id, ownerId, newName.trim()]
  )
  return rows[0] || null
}

// DELETE ---------------------------------------------------------------

/** Deletes the content in SeaweedFS and the information in PostgreSQL. */
export async function deleteFile (ownerId, id) {
  const { rows } = await query(
    'SELECT storage_key FROM files WHERE id = $1 AND owner_id = $2',
    [id, ownerId]
  )
  if (!rows[0]) return false

  await deleteObject(rows[0].storage_key)
  await query('DELETE FROM files WHERE id = $1 AND owner_id = $2', [id, ownerId])
  return true
}
