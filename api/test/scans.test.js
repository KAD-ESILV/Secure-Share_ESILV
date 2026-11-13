import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import router from '../src/routes/auto/scans.route.js'
import { listScans, listQuarantine, getFileForScan } from '../src/services/scan.repository.js'
import { enqueueScan, getQueueSize } from '../src/services/scan.queue.js'

vi.mock('../src/services/scan.repository.js', () => {
  return {
    listScans: vi.fn(),
    listQuarantine: vi.fn(),
    getFileForScan: vi.fn()
  }
})

vi.mock('../src/services/scan.queue.js', () => {
  return {
    enqueueScan: vi.fn(),
    getQueueSize: vi.fn()
  }
})

const FILE_ID = '3f2b8c1e-9d4a-4e7b-8f6c-2a1b3c4d5e6f'

function buildApp (user) {
  const app = express()
  app.use(express.json())

  if (user) {
    app.use((req, res, next) => {
      req.user = user
      next()
    })
  }

  app.use(router)
  app.use((err, req, res, next) => {
    res.status(500).json({
      error: true,
      message: err.message
    })
  })

  return app
}

describe('Scans API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lists every scan and the size of the queue', async () => {
    const scan = {
      id: 1,
      status: 'clean'
    }
    listScans.mockResolvedValue([scan])
    getQueueSize.mockReturnValue(3)

    const res = await request(buildApp()).get('/api/scans')

    expect(res.status).toBe(200)
    expect(res.body.scans).toEqual([scan])
    expect(res.body.waiting).toBe(3)
  })

  it('lists the files in quarantine', async () => {
    const file = {
      id: FILE_ID,
      scan_status: 'malicious'
    }
    listQuarantine.mockResolvedValue([file])

    const res = await request(buildApp()).get('/api/quarantine')

    expect(res.status).toBe(200)
    expect(res.body.files).toEqual([file])
  })

  it('refuses a file id that is not a UUID', async () => {
    const res = await request(buildApp()).post('/api/scans/123')

    expect(res.status).toBe(400)
    expect(getFileForScan).not.toHaveBeenCalled()
  })

  it('returns 404 when the file does not exist', async () => {
    getFileForScan.mockResolvedValue(undefined)

    const res = await request(buildApp()).post('/api/scans/' + FILE_ID)

    expect(res.status).toBe(404)
    expect(enqueueScan).not.toHaveBeenCalled()
  })

  it('queues a new scan for an existing file', async () => {
    const file = {
      id: FILE_ID
    }
    getFileForScan.mockResolvedValue(file)

    const res = await request(buildApp()).post('/api/scans/' + FILE_ID)

    expect(res.status).toBe(202)
    expect(res.body.fileId).toBe(FILE_ID)
    expect(enqueueScan).toHaveBeenCalledWith(FILE_ID)
  })

  it('blocks users who are not admin', async () => {
    const user = {
      id: 'u1',
      role: 'user'
    }
    const app = buildApp(user)

    const scans = await request(app).get('/api/scans')
    const quarantine = await request(app).get('/api/quarantine')
    const rescan = await request(app).post('/api/scans/' + FILE_ID)

    expect(scans.status).toBe(403)
    expect(quarantine.status).toBe(403)
    expect(rescan.status).toBe(403)
  })

  it('lets an admin in', async () => {
    const admin = {
      id: 'a1',
      role: 'admin'
    }
    listQuarantine.mockResolvedValue([])

    const res = await request(buildApp(admin)).get('/api/quarantine')

    expect(res.status).toBe(200)
  })

  it('passes database errors to the error handler', async () => {
    listScans.mockRejectedValue(new Error('database down'))
    listQuarantine.mockRejectedValue(new Error('database down'))
    getFileForScan.mockRejectedValue(new Error('database down'))
    const app = buildApp()

    const scans = await request(app).get('/api/scans')
    const quarantine = await request(app).get('/api/quarantine')
    const rescan = await request(app).post('/api/scans/' + FILE_ID)

    expect(scans.status).toBe(500)
    expect(quarantine.status).toBe(500)
    expect(rescan.status).toBe(500)
  })
})
