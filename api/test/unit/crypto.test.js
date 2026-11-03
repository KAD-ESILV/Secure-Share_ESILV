/**
 * Unit tests for src/utils/crypto.js (SCRUM-14).
 */
import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { getMasterKey, encryptFile, decryptFile, sha256 } from '../../src/utils/crypto.js'

const MASTER_HEX = 'a'.repeat(64)
const masterKey = getMasterKey(MASTER_HEX)
const original = Buffer.from('Top secret SecureShare document')

describe('getMasterKey', () => {
  it('returns a 32-byte key from 64 hex characters', () => {
    expect(masterKey).toHaveLength(32)
  })

  it('refuses a missing key', () => {
    expect(() => getMasterKey('')).toThrow('MASTER_KEY')
  })

  it('refuses the placeholder of .env.example', () => {
    expect(() => getMasterKey('change-me-64-hex-characters')).toThrow('MASTER_KEY')
  })

  it('refuses a key that is too short', () => {
    expect(() => getMasterKey('ab'.repeat(16))).toThrow('MASTER_KEY')
  })
})

describe('encryptFile / decryptFile', () => {
  it('encrypted content is not the original content', () => {
    const enc = encryptFile(original, masterKey)
    expect(enc.body.equals(original)).toBe(false)
    expect(enc.body.includes(Buffer.from('secret'))).toBe(false)
  })

  it('decrypting gives back exactly the original file', () => {
    const enc = encryptFile(original, masterKey)
    const dec = decryptFile(enc, masterKey)
    expect(dec.equals(original)).toBe(true)
  })

  it('works with a large binary file', () => {
    const big = randomBytes(5 * 1024 * 1024)
    const dec = decryptFile(encryptFile(big, masterKey), masterKey)
    expect(sha256(dec)).toBe(sha256(big))
  })

  it('the same file encrypted twice gives different results (random key and IV)', () => {
    const a = encryptFile(original, masterKey)
    const b = encryptFile(original, masterKey)
    expect(a.body.equals(b.body)).toBe(false)
    expect(a.wrappedKey.equals(b.wrappedKey)).toBe(false)
  })

  it('fails with the wrong master key', () => {
    const enc = encryptFile(original, masterKey)
    const otherKey = getMasterKey('b'.repeat(64))
    expect(() => decryptFile(enc, otherKey)).toThrow()
  })

  it('fails if the stored file was modified (integrity check)', () => {
    const enc = encryptFile(original, masterKey)
    enc.body[0] = enc.body[0] ^ 0xff
    expect(() => decryptFile(enc, masterKey)).toThrow()
  })
})

describe('sha256', () => {
  it('returns a 64-character hex fingerprint', () => {
    expect(sha256(original)).toMatch(/^[0-9a-f]{64}$/)
  })
})
