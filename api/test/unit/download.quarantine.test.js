import { describe, it, expect, vi, beforeEach } from 'vitest'
import { query } from '../../src/config/db.js'
import { getObject } from '../../src/config/storage.js'
import { encryptFile, getMasterKey, sha256 } from '../../src/utils/crypto.js'
import { downloadFile, QuarantineError } from '../../src/services/file.service.js'

vi.mock('../../src/config/db.js', () => {
  return {
    query: vi.fn()
  }
})

vi.mock('../../src/config/storage.js', () => {
  return {
    getObject: vi.fn(),
    putObject: vi.fn(),
    deleteObject: vi.fn()
  }
})

const CONTENT = Buffer.from('Bonjour SecureShare')

function storedFile (scanStatus) {
  const encrypted = encryptFile(CONTENT, getMasterKey())

  query.mockResolvedValue({
    rows: [
      {
        original_name: 'bonjour.txt',
        mime_type: 'text/plain',
        storage_key: 'demo-user/file-1',
        enc_key: encrypted.wrappedKey,
        enc_iv: encrypted.iv,
        enc_tag: encrypted.tag,
        content_sha256: sha256(CONTENT),
        scan_status: scanStatus
      }
    ]
  })

  getObject.mockResolvedValue(encrypted.body)
}

describe('Download and quarantine', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.MASTER_KEY = 'b'.repeat(64)
  })

  it('downloads a clean file', async () => {
    storedFile('clean')

    const result = await downloadFile('demo-user', 'file-1')

    expect(result.content.equals(CONTENT)).toBe(true)
  })

  it('refuses the files that are not clean', async () => {
    const statuses = ['malicious', 'suspicious', 'pending', 'error']

    for (const status of statuses) {
      storedFile(status)

      await expect(downloadFile('demo-user', 'file-1')).rejects.toThrow(QuarantineError)
    }

    expect(getObject).not.toHaveBeenCalled()
  })

  it('answers 403 with the scan status in the message', async () => {
    storedFile('malicious')

    const error = await downloadFile('demo-user', 'file-1').catch((err) => err)

    expect(error.status).toBe(403)
    expect(error.message).toContain('malicious')
  })
})
