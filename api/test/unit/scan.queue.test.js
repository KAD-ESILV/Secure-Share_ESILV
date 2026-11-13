import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanFile } from '../../src/services/scanner.js'
import { getPendingFileIds } from '../../src/services/scan.repository.js'
import { enqueueScan, resumePendingScans, getQueueSize, whenIdle } from '../../src/services/scan.queue.js'

vi.mock('../../src/services/scanner.js', () => {
  return {
    scanFile: vi.fn()
  }
})

vi.mock('../../src/services/scan.repository.js', () => {
  return {
    getPendingFileIds: vi.fn()
  }
})

function slowScan (order) {
  let active = 0
  let maxActive = 0

  scanFile.mockImplementation(async (fileId) => {
    active++
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => {
      setTimeout(resolve, 5)
    })
    order.push(fileId)
    active--
  })

  return () => maxActive
}

describe('Scan queue', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('scans the files one by one, in order', async () => {
    const order = []
    const getMaxActive = slowScan(order)

    enqueueScan('a')
    enqueueScan('b')
    enqueueScan('c')
    await whenIdle()

    expect(order).toEqual(['a', 'b', 'c'])
    expect(getMaxActive()).toBe(1)
    expect(getQueueSize()).toBe(0)
  })

  it('does not add the same file twice while it waits', async () => {
    const order = []
    slowScan(order)

    enqueueScan('a')
    enqueueScan('b')
    enqueueScan('b')
    await whenIdle()

    expect(order).toEqual(['a', 'b'])
  })

  it('keeps going when one scan crashes', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    scanFile
      .mockRejectedValueOnce(new Error('database down'))
      .mockResolvedValueOnce(null)

    enqueueScan('a')
    enqueueScan('b')
    await whenIdle()

    expect(scanFile).toHaveBeenCalledTimes(2)
    expect(errors.mock.calls[0][0]).toContain('database down')
    errors.mockRestore()
  })

  it('puts back the pending files at startup', async () => {
    getPendingFileIds.mockResolvedValue(['x', 'y'])

    const count = await resumePendingScans()
    await whenIdle()

    expect(count).toBe(2)
    expect(scanFile).toHaveBeenCalledWith('x')
    expect(scanFile).toHaveBeenCalledWith('y')
  })
})
