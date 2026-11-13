import { describe, it, expect, vi } from 'vitest'
import { s3 } from '../../src/config/storage.js'
import { readStoredFile } from '../../src/services/scan.storage.js'

vi.mock('../../src/config/storage.js', () => {
  return {
    bucket: 'test-bucket',
    s3: {
      send: vi.fn()
    }
  }
})

describe('Scan storage', () => {
  it('reads a stored file from SeaweedFS', async () => {
    s3.send.mockResolvedValue({
      Body: {
        transformToByteArray: async () => new Uint8Array([1, 2, 3])
      }
    })

    const result = await readStoredFile('demo-user/file-1')
    const command = s3.send.mock.calls[0][0]

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBe(3)
    expect(command.input.Bucket).toBe('test-bucket')
    expect(command.input.Key).toBe('demo-user/file-1')
  })
})
