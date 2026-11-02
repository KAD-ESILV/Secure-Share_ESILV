/**
 * Unit tests for src/services/file.service.js (SCRUM-12 + SCRUM-14).
 * PostgreSQL and SeaweedFS are replaced by fakes. Encryption is real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveFile, listFiles } from '../../src/services/file.service.js'
import { query } from '../../src/config/db.js'
import { putObject } from '../../src/config/storage.js'
import { decryptFile, getMasterKey, sha256 } from '../../src/utils/crypto.js'

vi.mock('../../src/config/db.js', () => ({ query: vi.fn() }))
vi.mock('../../src/config/storage.js', () => ({ putObject: vi.fn() }))

const MASTER_HEX = 'c'.repeat(64)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MASTER_KEY = MASTER_HEX
  putObject.mockResolvedValue({})
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
