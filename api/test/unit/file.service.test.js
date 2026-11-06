/**
 * Unit tests for src/services/file.service.js (full CRUD).
 * PostgreSQL and SeaweedFS are replaced by fakes. Encryption is real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  saveFile,
  listFiles,
  getFile,
  downloadFile,
  renameFile,
  deleteFile,
  validateFileName,
  IntegrityError
} from '../../src/services/file.service.js'
import { query } from '../../src/config/db.js'
import { putObject, getObject, deleteObject } from '../../src/config/storage.js'
import { encryptFile, decryptFile, getMasterKey, sha256 } from '../../src/utils/crypto.js'

vi.mock('../../src/config/db.js', () => ({ query: vi.fn() }))
vi.mock('../../src/config/storage.js', () => ({
  putObject: vi.fn(),
  getObject: vi.fn(),
  deleteObject: vi.fn()
}))

const MASTER_HEX = 'c'.repeat(64)
const ID = '3f2c1a9e-8b7d-4c6e-9f10-1234567890ab'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MASTER_KEY = MASTER_HEX
  putObject.mockResolvedValue({})
  deleteObject.mockResolvedValue({})
  query.mockResolvedValue({ rows: [{ id: 'abc', original_name: 'hello.txt', scan_status: 'pending' }] })
})

describe('saveFile', () => {
  const file = { originalname: 'hello.txt', mimetype: 'text/plain', size: 11, buffer: Buffer.from('hello world') }

  it('stores the content in SeaweedFS under the owner folder', async () => {
    await saveFile('demo-user', file)
    const [key] = putObject.mock.calls[0]
    expect(key.startsWith('demo-user/')).toBe(true)
  })

  it('never sends the readable file to SeaweedFS', async () => {
    await saveFile('demo-user', file)
    const [, body, type] = putObject.mock.calls[0]
    expect(body.equals(file.buffer)).toBe(false)
    expect(body.includes(Buffer.from('hello'))).toBe(false)
    expect(type).toBe('application/octet-stream')
  })

  it('saves what is needed to decrypt the file, and it decrypts correctly', async () => {
    await saveFile('demo-user', file)
    const [, body] = putObject.mock.calls[0]
    const params = query.mock.calls[0][1]
    const [,,,,,, wrappedKey, iv, tag, hash] = params

    const decrypted = decryptFile({ body, iv, tag, wrappedKey }, getMasterKey(MASTER_HEX))
    expect(decrypted.equals(file.buffer)).toBe(true)
    expect(hash).toBe(sha256(file.buffer))
  })

  it('saves the file information in PostgreSQL', async () => {
    const saved = await saveFile('demo-user', file)
    const params = query.mock.calls[0][1]
    expect(params).toContain('demo-user')
    expect(params).toContain('hello.txt')
    expect(params).toContain(11)
    expect(saved.scan_status).toBe('pending')
  })

  it('refuses to store anything without a valid MASTER_KEY', async () => {
    process.env.MASTER_KEY = 'change-me'
    await expect(saveFile('demo-user', file)).rejects.toThrow('MASTER_KEY')
    expect(putObject).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('does not write to the database if the storage fails', async () => {
    putObject.mockRejectedValueOnce(new Error('storage down'))
    await expect(saveFile('demo-user', file)).rejects.toThrow('storage down')
    expect(query).not.toHaveBeenCalled()
  })
})

describe('listFiles', () => {
  it('only returns the files of the given owner', async () => {
    const files = await listFiles('demo-user')
    expect(query.mock.calls[0][1]).toEqual(['demo-user'])
    expect(files).toHaveLength(1)
  })
})

describe('getFile', () => {
  it('returns the file when it belongs to the owner', async () => {
    const file = await getFile('demo-user', ID)
    expect(query.mock.calls[0][1]).toEqual([ID, 'demo-user'])
    expect(file.original_name).toBe('hello.txt')
  })

  it('returns null when the file does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    expect(await getFile('demo-user', ID)).toBeNull()
  })
})

describe('downloadFile', () => {
  const original = Buffer.from('Bonjour SecureShare')

  function storedRow (overrides = {}, tamper = false) {
    const enc = encryptFile(original, getMasterKey(MASTER_HEX))
    const body = Buffer.from(enc.body)
    if (tamper) body[0] = body[0] ^ 0xff
    getObject.mockResolvedValueOnce(body)
    return {
      original_name: 'bonjour.txt',
      mime_type: 'text/plain',
      storage_key: 'demo-user/' + ID,
      enc_key: enc.wrappedKey,
      enc_iv: enc.iv,
      enc_tag: enc.tag,
      content_sha256: sha256(original),
      ...overrides
    }
  }

  it('returns exactly the original file, decrypted', async () => {
    query.mockResolvedValueOnce({ rows: [storedRow()] })
    const file = await downloadFile('demo-user', ID)
    expect(file.content.equals(original)).toBe(true)
    expect(file.name).toBe('bonjour.txt')
    expect(getObject).toHaveBeenCalledWith('demo-user/' + ID)
  })

  it('returns null when the file does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    expect(await downloadFile('demo-user', ID)).toBeNull()
    expect(getObject).not.toHaveBeenCalled()
  })

  it('throws an IntegrityError when the stored file was modified', async () => {
    query.mockResolvedValueOnce({ rows: [storedRow({}, true)] })
    await expect(downloadFile('demo-user', ID)).rejects.toBeInstanceOf(IntegrityError)
  })

  it('throws an IntegrityError when the fingerprint does not match', async () => {
    query.mockResolvedValueOnce({ rows: [storedRow({ content_sha256: 'f'.repeat(64) })] })
    await expect(downloadFile('demo-user', ID)).rejects.toBeInstanceOf(IntegrityError)
  })
})

describe('renameFile', () => {
  it('updates the name of my file', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: ID, original_name: 'new.txt' }] })
    const file = await renameFile('demo-user', ID, '  new.txt  ')
    expect(query.mock.calls[0][1]).toEqual([ID, 'demo-user', 'new.txt'])
    expect(file.original_name).toBe('new.txt')
  })

  it('returns null when the file does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    expect(await renameFile('demo-user', ID, 'x.txt')).toBeNull()
  })
})

describe('deleteFile', () => {
  it('deletes the content in SeaweedFS, then the row in PostgreSQL', async () => {
    query.mockResolvedValueOnce({ rows: [{ storage_key: 'demo-user/' + ID }] })
    query.mockResolvedValueOnce({ rows: [] })
    expect(await deleteFile('demo-user', ID)).toBe(true)
    expect(deleteObject).toHaveBeenCalledWith('demo-user/' + ID)
    expect(query.mock.calls[1][0]).toContain('DELETE FROM files')
  })

  it('returns false and deletes nothing when the file does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    expect(await deleteFile('demo-user', ID)).toBe(false)
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('keeps the row if the storage fails', async () => {
    query.mockResolvedValueOnce({ rows: [{ storage_key: 'demo-user/' + ID }] })
    deleteObject.mockRejectedValueOnce(new Error('storage down'))
    await expect(deleteFile('demo-user', ID)).rejects.toThrow('storage down')
    expect(query).toHaveBeenCalledTimes(1)
  })
})

describe('validateFileName', () => {
  it('accepts a normal name', () => {
    expect(validateFileName('report.pdf')).toBeNull()
  })

  it('refuses an empty name', () => {
    expect(validateFileName('   ')).toBe('name is required')
    expect(validateFileName(undefined)).toBe('name is required')
  })

  it('refuses a name that is too long', () => {
    expect(validateFileName('a'.repeat(256))).toContain('at most')
  })

  it('refuses slashes', () => {
    expect(validateFileName('a/b.txt')).toContain('must not contain')
    expect(validateFileName('a\\b.txt')).toContain('must not contain')
  })
})
