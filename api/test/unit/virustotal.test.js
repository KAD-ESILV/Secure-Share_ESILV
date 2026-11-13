import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lookupHash, uploadFile, getAnalysis, getVerdict } from '../../src/services/virustotal.js'

function fakeResponse (status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body
  }
}

describe('VirusTotal client', () => {
  beforeEach(() => {
    process.env.VIRUSTOTAL_API_KEY = 'test-key'
    process.env.VIRUSTOTAL_DELAY_MS = '0'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses to call the API without a key', async () => {
    process.env.VIRUSTOTAL_API_KEY = 'change-me'

    await expect(lookupHash('abc')).rejects.toThrow('VIRUSTOTAL_API_KEY')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends the API key in the headers', async () => {
    fetch.mockResolvedValue(fakeResponse(404, {}))

    await lookupHash('abc')

    const options = fetch.mock.calls[0][1]
    expect(fetch.mock.calls[0][0]).toContain('/files/abc')
    expect(options.headers['x-apikey']).toBe('test-key')
  })

  it('returns null when VirusTotal does not know the file', async () => {
    fetch.mockResolvedValue(fakeResponse(404, {}))

    expect(await lookupHash('abc')).toBe(null)
  })

  it('returns the stats when VirusTotal knows the file', async () => {
    const stats = {
      malicious: 3,
      suspicious: 0
    }
    fetch.mockResolvedValue(fakeResponse(200, {
      data: {
        attributes: {
          last_analysis_stats: stats
        }
      }
    }))

    expect(await lookupHash('abc')).toEqual(stats)
  })

  it('throws when the lookup fails', async () => {
    fetch.mockResolvedValue(fakeResponse(429, {}))

    await expect(lookupHash('abc')).rejects.toThrow('429')
  })

  it('uploads a file and returns the analysis id', async () => {
    fetch.mockResolvedValue(fakeResponse(200, {
      data: {
        id: 'analysis-42'
      }
    }))

    const id = await uploadFile(Buffer.from('hello'), 'hello.txt')

    expect(id).toBe('analysis-42')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })

  it('throws when the upload fails', async () => {
    fetch.mockResolvedValue(fakeResponse(500, {}))

    await expect(uploadFile(Buffer.from('x'), 'x.txt')).rejects.toThrow('500')
  })

  it('tells if an analysis is finished', async () => {
    fetch.mockResolvedValue(fakeResponse(200, {
      data: {
        attributes: {
          status: 'completed',
          stats: {
            malicious: 0,
            suspicious: 0
          }
        }
      }
    }))

    const result = await getAnalysis('analysis-42')

    expect(result.done).toBe(true)
    expect(result.stats.malicious).toBe(0)
  })

  it('throws when the analysis cannot be read', async () => {
    fetch.mockResolvedValue(fakeResponse(404, {}))

    await expect(getAnalysis('nope')).rejects.toThrow('404')
  })

  it('turns the stats into a verdict', () => {
    const infected = {
      malicious: 2,
      suspicious: 0
    }
    const doubtful = {
      malicious: 0,
      suspicious: 1
    }
    const safe = {
      malicious: 0,
      suspicious: 0
    }

    expect(getVerdict(infected)).toBe('malicious')
    expect(getVerdict(doubtful)).toBe('suspicious')
    expect(getVerdict(safe)).toBe('clean')
  })
})
