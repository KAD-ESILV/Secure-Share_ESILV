import { describe, it, expect, vi, beforeEach } from 'vitest'
import { query } from '../../src/config/db.js'
import {
  initScansTable,
  getFileForScan,
  saveScanResult,
  getPendingFileIds,
  listScans,
  listQuarantine
} from '../../src/services/scan.repository.js'

vi.mock('../../src/config/db.js', () => {
  return {
    query: vi.fn()
  }
})

function rows (list) {
  return {
    rows: list
  }
}

describe('Scan repository', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue(rows([]))
  })

  it('creates the scans table', async () => {
    await initScansTable()

    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS scans')
  })

  it('reads the file to scan by its id', async () => {
    const file = {
      id: 'file-1',
      original_name: 'rapport.pdf'
    }
    query.mockResolvedValue(rows([file]))

    const result = await getFileForScan('file-1')

    expect(result).toEqual(file)
    expect(query.mock.calls[0][1]).toEqual(['file-1'])
  })

  it('returns undefined when the file does not exist', async () => {
    expect(await getFileForScan('nope')).toBe(undefined)
  })

  it('saves the scan and updates the file status', async () => {
    const scan = {
      status: 'malicious',
      reason: 'Dangerous extension: .exe',
      source: 'file-type',
      malicious: 0,
      suspicious: 0
    }

    await saveScanResult('file-1', scan)

    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[0][0]).toContain('INSERT INTO scans')
    expect(query.mock.calls[0][1][0]).toBe('file-1')
    expect(query.mock.calls[1][0]).toContain('UPDATE files SET scan_status')
    expect(query.mock.calls[1][1]).toEqual(['malicious', 'file-1'])
  })

  it('lists the ids of the files waiting for a scan', async () => {
    const first = {
      id: 'a'
    }
    const second = {
      id: 'b'
    }
    query.mockResolvedValue(rows([first, second]))

    expect(await getPendingFileIds()).toEqual(['a', 'b'])
  })

  it('lists every scan with its file name', async () => {
    const scan = {
      id: 1
    }
    query.mockResolvedValue(rows([scan]))

    const result = await listScans()

    expect(result).toHaveLength(1)
    expect(query.mock.calls[0][0]).toContain('JOIN files')
  })

  it('lists only the dangerous files in quarantine', async () => {
    await listQuarantine()

    expect(query.mock.calls[0][0]).toContain("IN ('malicious', 'suspicious')")
  })
})
