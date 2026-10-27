/**
 * Integration test for GET /boom.
 * Ensures global error handler shapes the response.
 */
import request from 'supertest'
import app from '../src/app.js'
import { describe, it, expect } from 'vitest'

describe('GET /boom', () => {
  it('returns 500 with error payload', async () => {
    const res = await request(app).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe(true)
    expect(typeof res.body.message).toBe('string')
  })
})
