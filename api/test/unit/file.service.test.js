/**
 * Unit tests for src/services/file.service.js (SCRUM-12).
 * PostgreSQL and SeaweedFS are replaced by fakes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveFile, listFiles } from '../../src/services/file.service.js'
import { query } from '../../src/config/db.js'
import { putObject } from '../../src/config/storage.js'

vi.mock('../../src/config/db.js', () => ({ query: vi.fn() }))
vi.mock('../../src/config/storage.js', () => ({ putObject: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  putObject.mockResolvedValue({})
  query.mockResolvedValue({ rows: [{ id: 'abc', original_name: 'hello.txt', scan_status: 'pending' }] })
})

describe('saveFile', () => {
  const file = { originalname: 'hello.txt', mimetype: 'text/plain', size: 5, buffer: Buffer.from('hello') }

  it('stores the content in SeaweedFS under the owner folder', async () => {
    await saveFile('demo-user', file)
    const [key, body, type] = putObject.mock.calls[0]
    expect(key.startsWith('demo-user/')).toBe(true)
    expect(body).toBe(file.buffer)
    expect(type).toBe('text/plain')
  })

  it('saves the file information in PostgreSQL', async () => {
    const saved = await saveFile('demo-user', file)
    const params = query.mock.calls[0][1]
    expect(params).toContain('demo-user')
    expect(params).toContain('hello.txt')
    expect(params).toContain(5)
    expect(saved.scan_status).toBe('pending')
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
