import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'

function sendScan (body) {
  return request(app).post('/api/scans').send(body)
}

describe('Scans API', () => {
  it('accepts a clean PDF', async () => {
    const res = await sendScan({
      fileName: 'rapport.pdf',
      mimeType: 'application/pdf',
      size: 2048
    })

    expect(res.status).toBe(201)
    expect(typeof res.body.scan.id).toBe('number')
    expect(res.body.scan.ownerId).toBe('demo-user')
    expect(res.body.scan.status).toBe('clean')
    expect(res.body.scan.quarantined).toBe(false)
  })

  it('blocks a file hidden behind a double extension', async () => {
    const res = await sendScan({
      fileName: 'facture.pdf.exe',
      mimeType: 'application/pdf',
      size: 2048
    })

    expect(res.status).toBe(201)
    expect(res.body.scan.status).toBe('malicious')
    expect(res.body.scan.quarantined).toBe(true)
    expect(res.body.scan.reason).toContain('.exe')
  })

  it('detects dangerous extensions written in capitals', async () => {
    const res = await sendScan({
      fileName: 'VIRUS.EXE',
      mimeType: 'application/octet-stream',
      size: 100
    })

    expect(res.body.scan.status).toBe('malicious')
  })

  it('flags a file whose type does not match its extension', async () => {
    const res = await sendScan({
      fileName: 'photo.png',
      mimeType: 'application/pdf',
      size: 500
    })

    expect(res.body.scan.status).toBe('suspicious')
    expect(res.body.scan.quarantined).toBe(true)
  })

  it('accepts files without extension', async () => {
    const noDot = await sendScan({
      fileName: 'Makefile',
      mimeType: 'text/plain',
      size: 10
    })
    const hidden = await sendScan({
      fileName: '.env',
      mimeType: 'text/plain',
      size: 10
    })

    expect(noDot.body.scan.status).toBe('clean')
    expect(hidden.body.scan.status).toBe('clean')
  })

  it('returns 400 when a field is missing', async () => {
    const res = await sendScan({
      fileName: 'rapport.pdf'
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe(true)
  })

  it('returns 400 when fileName is not text', async () => {
    const res = await sendScan({
      fileName: 123,
      mimeType: 'application/pdf',
      size: 10
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when size is not a positive number', async () => {
    const negative = await sendScan({
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      size: -5
    })
    const text = await sendScan({
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      size: 'big'
    })

    expect(negative.status).toBe(400)
    expect(text.status).toBe(400)
  })

  it('returns 413 when the file is bigger than 32 MB', async () => {
    const res = await sendScan({
      fileName: 'video.zip',
      mimeType: 'application/zip',
      size: 33 * 1024 * 1024
    })

    expect(res.status).toBe(413)
  })

  it('lists every scan', async () => {
    const before = await request(app).get('/api/scans')

    await sendScan({
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      size: 10
    })
    await sendScan({
      fileName: 'b.exe',
      mimeType: 'application/octet-stream',
      size: 10
    })

    const after = await request(app).get('/api/scans')

    expect(after.status).toBe(200)
    expect(after.body.scans).toHaveLength(before.body.scans.length + 2)
  })

  it('returns one scan by id, or 404 if it does not exist', async () => {
    const created = await sendScan({
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      size: 10
    })
    const id = created.body.scan.id

    const found = await request(app).get('/api/scans/' + id)
    const missing = await request(app).get('/api/scans/999999')

    expect(found.status).toBe(200)
    expect(found.body.scan.fileName).toBe('a.pdf')
    expect(missing.status).toBe(404)
  })

  it('only shows dangerous files in quarantine', async () => {
    const clean = await sendScan({
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      size: 10
    })
    const dangerous = await sendScan({
      fileName: 'b.exe',
      mimeType: 'application/octet-stream',
      size: 10
    })

    const res = await request(app).get('/api/quarantine')
    const ids = res.body.files.map((file) => file.id)

    expect(res.status).toBe(200)
    expect(ids).toContain(dangerous.body.scan.id)
    expect(ids).not.toContain(clean.body.scan.id)
  })
})
