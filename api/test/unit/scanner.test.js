import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encryptFile, getMasterKey, sha256 } from '../../src/utils/crypto.js'
import { lookupHash, uploadFile, getAnalysis } from '../../src/services/virustotal.js'
import { getFileForScan, saveScanResult } from '../../src/services/scan.repository.js'
import { readStoredFile } from '../../src/services/scan.storage.js'
import { scanFile } from '../../src/services/scanner.js'

vi.mock('../../src/services/virustotal.js', async (importOriginal) => {
  const original = await importOriginal()

  return {
    ...original,
    lookupHash: vi.fn(),
    uploadFile: vi.fn(),
    getAnalysis: vi.fn()
  }
})

vi.mock('../../src/services/scan.repository.js', () => {
  return {
    getFileForScan: vi.fn(),
    saveScanResult: vi.fn()
  }
})

vi.mock('../../src/services/scan.storage.js', () => {
  return {
    readStoredFile: vi.fn()
  }
})

const PDF = Buffer.from('%PDF-1.4\n%test\n1 0 obj')

const CLEAN_STATS = {
  malicious: 0,
  suspicious: 0
}

const BAD_STATS = {
  malicious: 12,
  suspicious: 1
}

function storeFile (content, name) {
  const encrypted = encryptFile(content, getMasterKey())

  getFileForScan.mockResolvedValue({
    id: 'file-1',
    original_name: name,
    storage_key: 'demo-user/file-1',
    enc_key: encrypted.wrappedKey,
    enc_iv: encrypted.iv,
    enc_tag: encrypted.tag,
    content_sha256: sha256(content)
  })

  readStoredFile.mockResolvedValue(encrypted.body)
}

function windowsProgram () {
  const buffer = Buffer.alloc(512)
  buffer.write('MZ')

  return buffer
}

describe('Scanner', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.MASTER_KEY = 'a'.repeat(64)
    delete process.env.VIRUSTOTAL_UPLOAD
  })

  it('does nothing when the file does not exist', async () => {
    getFileForScan.mockResolvedValue(undefined)

    expect(await scanFile('nope')).toBe(null)
    expect(saveScanResult).not.toHaveBeenCalled()
  })

  it('blocks a disguised program without calling VirusTotal', async () => {
    storeFile(windowsProgram(), 'rapport.pdf')

    const result = await scanFile('file-1')

    expect(result.status).toBe('malicious')
    expect(result.source).toBe('file-type')
    expect(lookupHash).not.toHaveBeenCalled()
    expect(saveScanResult).toHaveBeenCalledWith('file-1', result)
  })

  it('uses the hash when VirusTotal already knows the file', async () => {
    storeFile(PDF, 'rapport.pdf')
    lookupHash.mockResolvedValue(BAD_STATS)

    const result = await scanFile('file-1')

    expect(lookupHash).toHaveBeenCalledWith(sha256(PDF))
    expect(result.status).toBe('malicious')
    expect(result.source).toBe('virustotal-hash')
    expect(result.malicious).toBe(12)
    expect(result.reason).toContain('13')
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('marks a known safe file as clean', async () => {
    storeFile(PDF, 'rapport.pdf')
    lookupHash.mockResolvedValue(CLEAN_STATS)

    const result = await scanFile('file-1')

    expect(result.status).toBe('clean')
    expect(result.reason).toBe(null)
  })

  it('uploads the decrypted file when VirusTotal does not know it', async () => {
    storeFile(PDF, 'rapport.pdf')
    lookupHash.mockResolvedValue(null)
    uploadFile.mockResolvedValue('analysis-1')
    getAnalysis
      .mockResolvedValueOnce({
        done: false
      })
      .mockResolvedValueOnce({
        done: true,
        stats: CLEAN_STATS
      })

    const result = await scanFile('file-1')

    expect(uploadFile.mock.calls[0][0].equals(PDF)).toBe(true)
    expect(getAnalysis).toHaveBeenCalledTimes(2)
    expect(result.status).toBe('clean')
    expect(result.source).toBe('virustotal-upload')
  })

  it('never uploads when the upload is disabled', async () => {
    process.env.VIRUSTOTAL_UPLOAD = 'false'
    storeFile(PDF, 'rapport.pdf')
    lookupHash.mockResolvedValue(null)

    const result = await scanFile('file-1')

    expect(uploadFile).not.toHaveBeenCalled()
    expect(result.status).toBe('clean')
    expect(result.reason).toContain('upload disabled')
  })

  it('saves an error when the analysis never finishes', async () => {
    storeFile(PDF, 'rapport.pdf')
    lookupHash.mockResolvedValue(null)
    uploadFile.mockResolvedValue('analysis-1')
    getAnalysis.mockResolvedValue({
      done: false
    })

    const result = await scanFile('file-1')

    expect(result.status).toBe('error')
    expect(result.reason).toContain('too long')
    expect(saveScanResult).toHaveBeenCalledWith('file-1', result)
  })

  it('saves an error when VirusTotal fails', async () => {
    storeFile(PDF, 'rapport.pdf')
    lookupHash.mockRejectedValue(new Error('VirusTotal lookup failed: 429'))

    const result = await scanFile('file-1')

    expect(result.status).toBe('error')
    expect(result.reason).toContain('429')
  })
})
