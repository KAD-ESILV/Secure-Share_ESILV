/**
 * Integration tests for SCRUM-12 (POST /api/files, GET /api/files).
 * The database and SeaweedFS are replaced by fakes (vi.mock),
 * so these tests run without Docker, including in the CI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import router, { getOwnerId } from '../src/routes/auto/files.route.js'
import { saveFile, listFiles } from '../src/services/file.service.js'
import { errorHandler } from '../src/utils/errorHandler.js'

vi.mock('../src/services/file.service.js', () => ({
  MAX_FILE_SIZE: 32 * 1024 * 1024,
  MAX_FILES: 10,
  saveFile: vi.fn(),
  listFiles: vi.fn()
}))

const app = express()
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
    expect(res.body.files).toHaveLength(1)
    expect(listFiles).toHaveBeenCalledWith('demo-user')
  })

  it('returns 500 when the database fails', async () => {
    listFiles.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).get('/api/files')
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
