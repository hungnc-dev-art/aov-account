import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { POST as login } from '../../app/api/auth/login/route'
import { POST as logout } from '../../app/api/auth/logout/route'
import { POST as reauth } from '../../app/api/auth/reauth/route'
import { GET as session } from '../../app/api/auth/session/route'
import { hashPassword } from '../../src/lib/auth/password'
import { clearAllRateLimits } from '../../src/lib/auth/rate-limit'
import { verifySessionToken } from '../../src/lib/auth/session'
import { makeRequest, sessionCookie, TEST_SECRET } from '../helpers/api'

const PASSWORD = 'owner-test-password-2026'

beforeAll(async () => {
  process.env.AUTH_SESSION_SECRET = TEST_SECRET
  process.env.AUTH_OWNER_PASSWORD_HASH = await hashPassword(PASSWORD, { N: 2 ** 14, r: 8, p: 1 })
})
afterAll(() => {
  delete process.env.AUTH_SESSION_SECRET
  delete process.env.AUTH_OWNER_PASSWORD_HASH
})
beforeEach(() => clearAllRateLimits())

const loginRequest = (password: string, extra: Parameters<typeof makeRequest>[1] = {}) =>
  makeRequest('/api/auth/login', { method: 'POST', body: { password }, ip: '203.0.113.7', ...extra })

describe('POST /api/auth/login', () => {
  it('sets a hardened session cookie for the right password', async () => {
    const response = await login(loginRequest(PASSWORD))
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^aov_session=v1\./)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Max-Age=43200')
    const token = cookie.split(';')[0].split('=')[1]
    expect(await verifySessionToken(token, TEST_SECRET, Math.floor(Date.now() / 1000))).not.toBeNull()
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('rejects a wrong password without setting a cookie or leaking details', async () => {
    const response = await login(loginRequest('wrong-password'))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.json()).toEqual({ error: 'Mật khẩu không đúng.', code: 'INVALID_CREDENTIALS' })
  })

  it('blocks CSRF: text/plain, foreign origin and missing origin', async () => {
    expect((await login(loginRequest(PASSWORD, { contentType: 'text/plain' }))).status).toBe(415)
    expect((await login(loginRequest(PASSWORD, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await login(loginRequest(PASSWORD, { origin: null }))).status).toBe(403)
  })

  it('rate-limits repeated attempts from one IP', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(loginRequest('nope'))).status).toBe(401)
    }
    const limited = await login(loginRequest(PASSWORD))
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    // IP khác vẫn đăng nhập được (giới hạn toàn cục chưa chạm).
    expect((await login(loginRequest(PASSWORD, { ip: '198.51.100.9' }))).status).toBe(200)
  })

  it('tolerates trailing newlines in env values pasted into Vercel', async () => {
    const savedHash = process.env.AUTH_OWNER_PASSWORD_HASH
    const savedSecret = process.env.AUTH_SESSION_SECRET
    process.env.AUTH_OWNER_PASSWORD_HASH = `${savedHash}\r\n`
    process.env.AUTH_SESSION_SECRET = `${savedSecret}\n`
    const response = await login(loginRequest(PASSWORD, { ip: '192.0.2.99' }))
    process.env.AUTH_OWNER_PASSWORD_HASH = savedHash
    process.env.AUTH_SESSION_SECRET = savedSecret
    expect(response.status).toBe(200)
  })

  it('fails closed when auth is not configured', async () => {
    const saved = process.env.AUTH_OWNER_PASSWORD_HASH
    delete process.env.AUTH_OWNER_PASSWORD_HASH
    const response = await login(loginRequest(PASSWORD))
    process.env.AUTH_OWNER_PASSWORD_HASH = saved
    expect(response.status).toBe(503)
  })

  it('rejects malformed JSON with a generic message', async () => {
    const response = await login(makeRequest('/api/auth/login', { method: 'POST', rawBody: '{"password":', ip: '192.0.2.1' }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('Dữ liệu gửi lên không phải JSON hợp lệ.')
  })
})

describe('session, logout, reauth', () => {
  it('reports authentication state', async () => {
    expect(await (await session(makeRequest('/api/auth/session'))).json()).toEqual({ authenticated: false })
    const body = await (await session(makeRequest('/api/auth/session', { cookie: await sessionCookie() }))).json()
    expect(body.authenticated).toBe(true)
    expect(typeof body.expiresAt).toBe('string')
  })

  it('logout clears the cookie', async () => {
    const response = await logout(makeRequest('/api/auth/logout', { method: 'POST', body: {} }))
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('reauth requires a session and refreshes the auth time', async () => {
    expect((await reauth(makeRequest('/api/auth/reauth', { method: 'POST', body: { password: PASSWORD } }))).status).toBe(401)
    const cookie = await sessionCookie({ authAgoSeconds: 3600 })
    const response = await reauth(makeRequest('/api/auth/reauth', { method: 'POST', body: { password: PASSWORD }, cookie, ip: '192.0.2.50' }))
    expect(response.status).toBe(200)
    const token = (response.headers.get('set-cookie') ?? '').split(';')[0].split('=')[1]
    const payload = await verifySessionToken(token, TEST_SECRET, Math.floor(Date.now() / 1000))
    expect(payload && Math.floor(Date.now() / 1000) - payload.auth).toBeLessThan(5)
  })
})
