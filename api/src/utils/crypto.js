/**
 * SCRUM-14 - File encryption (FR-STO-02, NFR-SEC-02)
 *
 * Envelope encryption with AES-256-GCM:
 *  - each file gets its own random 256-bit key (the "file key")
 *  - the file is encrypted with its file key
 *  - the file key is itself encrypted with the MASTER_KEY from .env
 * So the storage (SeaweedFS) only holds unreadable data, and the database
 * only holds encrypted keys. Without the MASTER_KEY, nothing can be read.
 *
 * GCM also adds an authentication tag: if one byte of the stored file is
 * changed, decryption fails instead of returning corrupted data.
 */
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // bytes = 256 bits
const IV_LENGTH = 12 // bytes, recommended size for GCM
const TAG_LENGTH = 16 // bytes

/** Reads the MASTER_KEY (64 hexadecimal characters) and checks it. */
export function getMasterKey (hex = process.env.MASTER_KEY) {
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('MASTER_KEY must be 64 hexadecimal characters (generate one with: openssl rand -hex 32)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt (plain, key) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const data = Buffer.concat([cipher.update(plain), cipher.final()])
  return { iv, tag: cipher.getAuthTag(), data }
}

export function decrypt ({ iv, tag, data }, key) {
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

/** SHA-256 of the original file, used later to check a download is identical. */
export function sha256 (buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Encrypts a whole file.
 * Returns the encrypted content (to store in SeaweedFS) and what must be
 * saved in the database to decrypt it later.
 */
export function encryptFile (buffer, masterKey) {
  const fileKey = randomBytes(KEY_LENGTH)
  const content = encrypt(buffer, fileKey)
  const wrapped = encrypt(fileKey, masterKey)

  return {
    body: content.data,
    iv: content.iv,
    tag: content.tag,
    // wrapped key = iv (12) + tag (16) + encrypted file key (32)
    wrappedKey: Buffer.concat([wrapped.iv, wrapped.tag, wrapped.data])
  }
}

/** Reverse of encryptFile. Throws if the data or the key is wrong. */
export function decryptFile ({ body, iv, tag, wrappedKey }, masterKey) {
  const fileKey = decrypt({
    iv: wrappedKey.subarray(0, IV_LENGTH),
    tag: wrappedKey.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH),
    data: wrappedKey.subarray(IV_LENGTH + TAG_LENGTH)
  }, masterKey)

  return decrypt({ iv, tag, data: body }, fileKey)
}
