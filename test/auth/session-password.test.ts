import { describe, expect, it } from 'vitest'
import { SESSION_TTL_SECONDS } from '../../src/lib/auth/config'
import { hashPassword, verifyPassword } from '../../src/lib/auth/password'
import { createSessionToken, isRecentlyAuthenticated, verifySessionToken } from '../../src/lib/auth/session'
// @ts-expect-error -- script .mjs không có khai báo kiểu
import { generateSessionSecret, hashOwnerPassword } from '../../scripts/auth-setup.mjs'

const SECRET = 'unit-test-secret-'.padEnd(48, 'z')
const FAST = { N: 2 ** 14, r: 8, p: 1 }

describe('owner password hashing', () => {
  it('verifies the correct password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery', FAST)
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true)
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true)
    await expect(verifyPassword('correct horse batterY', hash)).resolves.toBe(false)
    await expect(verifyPassword('', hash)).resolves.toBe(false)
  })

  it('rejects malformed or weakened hashes without throwing', async () => {
    await expect(verifyPassword('x', 'plain-text')).resolves.toBe(false)
    await expect(verifyPassword('x', 'scrypt$1024$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA')).resolves.toBe(false)
    await expect(verifyPassword('x', 'scrypt$16384$8$1$c2hvcnQ$AAAAAAAAAAAAAAAAAAAAAA')).resolves.toBe(false)
  })

  it('accepts hashes produced by scripts/auth-setup.mjs', async () => {
    const hash: string = await hashOwnerPassword('một mật khẩu đủ dài 2026')
    await expect(verifyPassword('một mật khẩu đủ dài 2026', hash)).resolves.toBe(true)
    expect(generateSessionSecret()).toMatch(/^[A-Za-z0-9_-]{64}$/)
  })
})

describe('session token', () => {
  const now = 1_800_000_000

  it('round-trips a valid token', async () => {
    const { token, payload } = await createSessionToken(SECRET, now)
    await expect(verifySessionToken(token, SECRET, now + 10)).resolves.toEqual(payload)
    expect(payload.exp - payload.iat).toBe(SESSION_TTL_SECONDS)
  })

  it('rejects tampered payloads and signatures', async () => {
    const { token } = await createSessionToken(SECRET, now)
    const [version, body, signature] = token.split('.')
    const forgedBody = Buffer.from(JSON.stringify({ v: 1, iat: now, exp: now + 999_999, auth: now, jti: 'x' })).toString('base64url')
    await expect(verifySessionToken(`${version}.${forgedBody}.${signature}`, SECRET, now)).resolves.toBeNull()
    await expect(verifySessionToken(`${version}.${body}.${signature.slice(0, -2)}AA`, SECRET, now)).resolves.toBeNull()
    await expect(verifySessionToken(token, 'another-secret-'.padEnd(48, 'q'), now)).resolves.toBeNull()
    await expect(verifySessionToken('v1.not-base64!.x', SECRET, now)).resolves.toBeNull()
    await expect(verifySessionToken('x'.repeat(2000), SECRET, now)).resolves.toBeNull()
    await expect(verifySessionToken(undefined, SECRET, now)).resolves.toBeNull()
  })

  it('rejects expired tokens and tokens issued in the future', async () => {
    const { token } = await createSessionToken(SECRET, now)
    await expect(verifySessionToken(token, SECRET, now + SESSION_TTL_SECONDS)).resolves.toBeNull()
    await expect(verifySessionToken(token, SECRET, now - 3600)).resolves.toBeNull()
  })

  it('tracks the re-authentication window', async () => {
    const { payload } = await createSessionToken(SECRET, now, now - 100)
    expect(isRecentlyAuthenticated(payload, now)).toBe(true)
    expect(isRecentlyAuthenticated(payload, now + 400)).toBe(false)
  })
})
