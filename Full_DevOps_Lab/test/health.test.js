/**
 * Integration test for GET /health.
 */
import request from 'supertest'
import app from '../src/app.js'
import { describe, it, expect } from 'vitest'

describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })
})
