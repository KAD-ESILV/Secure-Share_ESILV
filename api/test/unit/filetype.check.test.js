import { describe, it, expect } from 'vitest'
import { checkRealType, getExtension } from '../../src/services/filetype.check.js'

const PDF = Buffer.from('%PDF-1.4\n%test\n1 0 obj')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(100)])
const TEXT = Buffer.from('hello world')

function windowsProgram () {
  const buffer = Buffer.alloc(512)
  buffer.write('MZ')

  return buffer
}

describe('Real file type check', () => {
  it('reads the extension in lower case and merges jpeg into jpg', () => {
    expect(getExtension('Photo.JPEG')).toBe('jpg')
    expect(getExtension('facture.pdf.exe')).toBe('exe')
    expect(getExtension('Makefile')).toBe('')
    expect(getExtension('.env')).toBe('')
  })

  it('accepts a real PDF named .pdf', async () => {
    const result = await checkRealType(PDF, 'rapport.pdf')

    expect(result.status).toBe('clean')
  })

  it('blocks a program hidden behind a .pdf name', async () => {
    const result = await checkRealType(windowsProgram(), 'rapport.pdf')

    expect(result.status).toBe('malicious')
    expect(result.reason).toContain('exe')
  })

  it('blocks scripts by their extension', async () => {
    const result = await checkRealType(TEXT, 'install.ps1')

    expect(result.status).toBe('malicious')
  })

  it('flags a PNG named .pdf', async () => {
    const result = await checkRealType(PNG, 'contrat.pdf')

    expect(result.status).toBe('suspicious')
    expect(result.reason).toContain('png')
  })

  it('accepts office files seen as zip', async () => {
    const result = await checkRealType(ZIP, 'notes.docx')

    expect(result.status).toBe('clean')
  })

  it('accepts text files that have no signature', async () => {
    const result = await checkRealType(TEXT, 'notes.txt')

    expect(result.status).toBe('clean')
  })
})
