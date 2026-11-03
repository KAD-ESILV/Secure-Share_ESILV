/**
 * Integration test for GET /info.
 * Validates the merged info object from helpers.
 */
import request from 'supertest'
import app from '../src/app.js'
import { describe, it, expect } from 'vitest'

describe('GET /info', () => {
  it('returns app info', async () => {
    const res = await request(app).get('/info')
    expect(res.status).toBe(200)
    expect(typeof res.body.name).toBe('string')
    expect(typeof res.body.version).toBe('string')
    expect(typeof res.body.node).toBe('string')
    expect(typeof res.body.uptime).toBe('number')
  })

  it('has plausible node version & non-negative uptime', async () => {
    const res = await request(app).get('/info')
    expect(res.body.node).toMatch(/^v\d+\.\d+\.\d+/)
    expect(res.body.uptime).toBeGreaterThanOrEqual(0)
  })
})
