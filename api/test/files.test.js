/**
 * Integration tests for the Files API (full CRUD).
 * The service (database + SeaweedFS) is replaced by fakes (vi.mock),
 * so these tests run without Docker, including in the CI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import router, { getOwnerId } from '../src/routes/auto/files.route.js'
import {
  saveFile,
  listFiles,
  getFile,
  downloadFile,
  renameFile,
  deleteFile
} from '../src/services/file.service.js'
import { errorHandler } from '../src/utils/errorHandler.js'

vi.mock('../src/services/scan.queue.js', () => {
  return {
    enqueueScan: vi.fn()
  }
})

vi.mock('../src/services/file.service.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    MAX_FILE_SIZE: 32 * 1024 * 1024,
    MAX_FILES: 10,
    validateFileName: original.validateFileName,
    saveFile: vi.fn(),
    listFiles: vi.fn(),
    getFile: vi.fn(),
    downloadFile: vi.fn(),
    renameFile: vi.fn(),
    deleteFile: vi.fn()
  }
})

const ID = '3f2c1a9e-8b7d-4c6e-9f10-1234567890ab'
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

const app = express()
app.use(express.json())
app.use(router)
app.use(errorHandler)

beforeEach(() => {
  vi.clearAllMocks()
  saveFile.mockImplementation(async (_ownerId, file) => ({
    id: 'id-' + file.originalname,
    original_name: file.originalname,
    size_bytes: file.size,
    scan_status: 'pending'
  }))
  listFiles.mockResolvedValue([])
  getFile.mockImplementation(async (_owner, id) => (id === ID ? { id: ID, original_name: 'report.pdf' } : null))
  downloadFile.mockImplementation(async (_owner, id) => (
    id === ID ? { name: 'report.txt', mimeType: 'text/plain', content: Buffer.from('hello') } : null
  ))
  renameFile.mockImplementation(async (_owner, id, name) => (id === ID ? { id: ID, original_name: name } : null))
  deleteFile.mockImplementation(async (_owner, id) => id === ID)
})

describe('POST /api/files', () => {
  it('uploads one file and returns 201', async () => {
    const res = await request(app)
      .post('/api/files')
      .attach('files', Buffer.from('hello'), 'hello.txt')

    expect(res.status).toBe(201)
    expect(res.body.files).toHaveLength(1)
    expect(res.body.files[0].original_name).toBe('hello.txt')
    expect(res.body.files[0].scan_status).toBe('pending')
    expect(saveFile).toHaveBeenCalledWith('demo-user', expect.objectContaining({ originalname: 'hello.txt' }))
  })

  it('uploads several files at once', async () => {
    const res = await request(app)
      .post('/api/files')
      .attach('files', Buffer.from('a'), 'a.txt')
      .attach('files', Buffer.from('b'), 'b.txt')

    expect(res.status).toBe(201)
    expect(res.body.files).toHaveLength(2)
    expect(saveFile).toHaveBeenCalledTimes(2)
  })

  it('returns 400 when no file is sent', async () => {
    const res = await request(app).post('/api/files')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(true)
  })

  it('returns 413 when a file is larger than 32 MB', async () => {
    const big = Buffer.alloc(32 * 1024 * 1024 + 1)
    const res = await request(app)
      .post('/api/files')
      .attach('files', big, 'big.bin')

    expect(res.status).toBe(413)
    expect(saveFile).not.toHaveBeenCalled()
  })

  it('returns 400 when the field name is wrong', async () => {
    const res = await request(app)
      .post('/api/files')
      .attach('document', Buffer.from('x'), 'x.txt')

    expect(res.status).toBe(400)
  })

  it('returns 500 when the storage fails', async () => {
    saveFile.mockRejectedValueOnce(new Error('storage down'))
    const res = await request(app)
      .post('/api/files')
      .attach('files', Buffer.from('x'), 'x.txt')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe(true)
  })
})

describe('GET /api/files', () => {
  it('returns the list of my files', async () => {
    listFiles.mockResolvedValueOnce([{ id: '1', original_name: 'a.txt' }])
    const res = await request(app).get('/api/files')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.files)).toBe(true)
    expect(res.body.files).toHaveLength(1)
    expect(listFiles).toHaveBeenCalledWith('demo-user')
  })

  it('returns 500 when the database fails', async () => {
    listFiles.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).get('/api/files')
    expect(res.status).toBe(500)
  })
})

describe('GET /api/files/:id', () => {
  it('returns one file', async () => {
    const res = await request(app).get(`/api/files/${ID}`)
    expect(res.status).toBe(200)
    expect(res.body.file.id).toBe(ID)
    expect(getFile).toHaveBeenCalledWith('demo-user', ID)
  })

  it('returns 404 for an unknown file', async () => {
    const res = await request(app).get(`/api/files/${UNKNOWN_ID}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe(true)
  })

  it('returns 404 for an id that is not a UUID, without asking the database', async () => {
    const res = await request(app).get('/api/files/123')
    expect(res.status).toBe(404)
    expect(getFile).not.toHaveBeenCalled()
  })

  it('returns 500 when the database fails', async () => {
    getFile.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).get(`/api/files/${ID}`)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/files/:id/download', () => {
  it('sends the decrypted file as an attachment', async () => {
    const res = await request(app).get(`/api/files/${ID}/download`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.headers['content-disposition']).toContain('report.txt')
    expect(res.text).toBe('hello')
  })

  it('returns 404 for an unknown file', async () => {
    const res = await request(app).get(`/api/files/${UNKNOWN_ID}/download`)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the integrity check fails', async () => {
    downloadFile.mockRejectedValueOnce(Object.assign(new Error('File integrity check failed'), { status: 500 }))
    const res = await request(app).get(`/api/files/${ID}/download`)
    expect(res.status).toBe(500)
    expect(res.body.message).toBe('File integrity check failed')
  })
})

describe('PUT /api/files/:id', () => {
  it('renames a file', async () => {
    const res = await request(app).put(`/api/files/${ID}`).send({ name: 'new-name.pdf' })
    expect(res.status).toBe(200)
    expect(res.body.file.original_name).toBe('new-name.pdf')
    expect(renameFile).toHaveBeenCalledWith('demo-user', ID, 'new-name.pdf')
  })

  it('returns 400 when the name is missing', async () => {
    const res = await request(app).put(`/api/files/${ID}`).send({})
    expect(res.status).toBe(400)
    expect(renameFile).not.toHaveBeenCalled()
  })

  it('returns 400 when the name contains a slash', async () => {
    const res = await request(app).put(`/api/files/${ID}`).send({ name: '../secret.txt' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown file', async () => {
    const res = await request(app).put(`/api/files/${UNKNOWN_ID}`).send({ name: 'x.txt' })
    expect(res.status).toBe(404)
  })

  it('returns 500 when the database fails', async () => {
    renameFile.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).put(`/api/files/${ID}`).send({ name: 'x.txt' })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/files/:id', () => {
  it('deletes a file and returns 204', async () => {
    const res = await request(app).delete(`/api/files/${ID}`)
    expect(res.status).toBe(204)
    expect(deleteFile).toHaveBeenCalledWith('demo-user', ID)
  })

  it('returns 404 for an unknown file', async () => {
    const res = await request(app).delete(`/api/files/${UNKNOWN_ID}`)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the storage fails', async () => {
    deleteFile.mockRejectedValueOnce(new Error('storage down'))
    const res = await request(app).delete(`/api/files/${ID}`)
    expect(res.status).toBe(500)
  })
})

describe('getOwnerId', () => {
  it('uses the logged-in user when there is one', () => {
    expect(getOwnerId({ user: { id: 'u-42' } })).toBe('u-42')
  })

  it('falls back to demo-user before login exists', () => {
    expect(getOwnerId({})).toBe('demo-user')
  })
})
