/**
 * Unit tests for src/utils/errorHandler.js.
 * We stub a minimal `res` object to capture status and body.
 */
import { describe, it, expect } from 'vitest'
import { errorHandler } from '../../src/utils/errorHandler.js'

function makeRes () {
  return {
    statusCode: 0,
    body: null,
    status (code) { this.statusCode = code; return this },
    json (obj) { this.body = obj; return this }
  }
}

describe('errorHandler', () => {
  it('defaults to 500 with generic message', () => {
    const res = makeRes()
    errorHandler({}, {}, res, () => {})
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: true, message: 'Internal Server Error' })
  })

  it('uses provided status and message', () => {
    const res = makeRes()
    errorHandler({ status: 418, message: 'teapot' }, {}, res, () => {})
    expect(res.statusCode).toBe(418)
    expect(res.body).toEqual({ error: true, message: 'teapot' })
  })
})
