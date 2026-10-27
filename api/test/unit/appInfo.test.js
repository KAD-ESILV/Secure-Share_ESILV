/**
 * Unit tests for src/utils/appInfo.js.
 * No HTTP or Express involved; just pure functions.
 */
import { describe, it, expect, vi } from 'vitest'
import { getPackageInfo, getRuntimeInfo } from '../../src/utils/appInfo.js'

describe('getPackageInfo', () => {
  it('returns name and version', () => {
    const info = getPackageInfo()
    expect(info).toHaveProperty('name')
    expect(info).toHaveProperty('version')
  })
})

describe('getRuntimeInfo', () => {
  it('returns node and uptime', () => {
    const runtime = getRuntimeInfo()
    expect(typeof runtime.node).toBe('string')
    expect(typeof runtime.uptime).toBe('number')
  })

  it('calls process.uptime()', () => {
    const spy = vi.spyOn(process, 'uptime')
    getRuntimeInfo()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
