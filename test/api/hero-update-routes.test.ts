import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeRequest, sessionCookie, TEST_SECRET } from '../helpers/api'
import { clearAllRateLimits } from '../../src/lib/auth/rate-limit'

const { GET, POST } = await import('../../app/api/heroes/update/route')

const TOKEN = 'github_pat_test_token'
const fetchMock = vi.fn<typeof fetch>()

const runsResponse = (run?: Record<string, unknown>) =>
  Response.json({ workflow_runs: run ? [run] : [] })

let cookie = ''
beforeAll(async () => {
  process.env.AUTH_SESSION_SECRET = TEST_SECRET
  process.env.AUTH_OWNER_PASSWORD_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA'
  cookie = await sessionCookie()
})
afterAll(() => {
  delete process.env.AUTH_SESSION_SECRET
  delete process.env.AUTH_OWNER_PASSWORD_HASH
})
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  clearAllRateLimits()
  process.env.GITHUB_HEROES_TOKEN = TOKEN
  process.env.GITHUB_HEROES_REPO = 'owner/repo'
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GITHUB_HEROES_TOKEN
  delete process.env.GITHUB_HEROES_REPO
  delete process.env.GITHUB_HEROES_REF
})

const post = (options: Parameters<typeof makeRequest>[1] = {}) =>
  POST(makeRequest('/api/heroes/update', { method: 'POST', body: {}, cookie, ...options }))

describe('/api/heroes/update', () => {
  it('requires an owner session and never calls GitHub without one', async () => {
    const responses = await Promise.all([GET(makeRequest('/api/heroes/update')), post({ cookie: undefined })])
    expect(responses.map((response) => response.status)).toEqual([401, 401])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects cross-origin dispatch', async () => {
    const response = await post({ origin: 'https://evil.example' })
    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports not configured when the token is missing', async () => {
    delete process.env.GITHUB_HEROES_TOKEN
    const status = await GET(makeRequest('/api/heroes/update', { cookie }))
    expect(await status.json()).toEqual({ configured: false, run: null })
    const dispatch = await post()
    expect(dispatch.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the latest run without leaking URLs or the token', async () => {
    fetchMock.mockResolvedValueOnce(runsResponse({
      status: 'completed', conclusion: 'success', event: 'schedule',
      created_at: '2026-11-25T20:17:00Z', updated_at: '2026-11-25T20:21:00Z',
      html_url: 'https://github.com/owner/repo/actions/runs/1', actor: { login: 'someone' },
    }))
    const response = await GET(makeRequest('/api/heroes/update', { cookie }))
    const body = await response.json()
    expect(body).toEqual({
      configured: true,
      run: { running: false, conclusion: 'success', trigger: 'schedule', startedAt: '2026-11-25T20:17:00Z', finishedAt: '2026-11-25T20:21:00Z' },
    })
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.github.com/repos/owner/repo/actions/workflows/update-heroes.yml/runs?per_page=1')
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
  })

  it('dispatches the workflow on the configured ref', async () => {
    process.env.GITHUB_HEROES_REF = 'main'
    fetchMock.mockResolvedValueOnce(runsResponse()).mockResolvedValueOnce(new Response(null, { status: 204 }))
    const response = await post()
    expect(response.status).toBe(202)
    const [url, init] = fetchMock.mock.calls[1]
    expect(String(url)).toBe('https://api.github.com/repos/owner/repo/actions/workflows/update-heroes.yml/dispatches')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ ref: 'main' })
  })

  it('refuses to start a second run while one is in progress', async () => {
    fetchMock.mockResolvedValueOnce(runsResponse({ status: 'in_progress', conclusion: null, event: 'workflow_dispatch', created_at: '2026-11-25T10:00:00Z' }))
    const response = await post()
    expect(response.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps GitHub auth failures to a safe Vietnamese error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"Bad credentials"}', { status: 401 }))
    const response = await GET(makeRequest('/api/heroes/update', { cookie }))
    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.code).toBe('GITHUB_FORBIDDEN')
    expect(JSON.stringify(body)).not.toContain('Bad credentials')
  })

  it('rate limits repeated dispatches', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/dispatches') ? new Response(null, { status: 204 }) : runsResponse())
    const statuses = []
    for (let i = 0; i < 4; i += 1) statuses.push((await post()).status)
    expect(statuses).toEqual([202, 202, 202, 429])
  })
})
