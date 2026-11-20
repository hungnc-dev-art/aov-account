// Tiện ích dựng Request cho test Route Handler (không cần server, không cần DB).
import { createSessionToken } from '../../src/lib/auth/session'

export const ORIGIN = 'http://localhost:3000'
export const TEST_SECRET = 'test-secret-'.padEnd(48, 'x')

interface RequestOptions {
  method?: string
  body?: unknown
  rawBody?: string
  cookie?: string
  origin?: string | null
  contentType?: string | null
  fetchSite?: string
  ip?: string
  headers?: Record<string, string>
}

export function makeRequest(path: string, options: RequestOptions = {}): Request {
  const method = options.method ?? 'GET'
  const headers = new Headers({ 'x-forwarded-host': 'localhost:3000', host: 'localhost:3000', ...options.headers })
  if (options.cookie) headers.set('cookie', options.cookie)
  if (options.ip) headers.set('x-real-ip', options.ip)
  if (options.fetchSite) headers.set('sec-fetch-site', options.fetchSite)
  if (method !== 'GET' && options.origin !== null) headers.set('origin', options.origin ?? ORIGIN)
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body))
  if (body !== undefined && options.contentType !== null) headers.set('content-type', options.contentType ?? 'application/json')
  return new Request(`${ORIGIN}${path}`, { method, headers, body })
}

export async function sessionCookie(options: { now?: number; authAgoSeconds?: number; secret?: string } = {}): Promise<string> {
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const authAt = now - (options.authAgoSeconds ?? 0)
  const { token } = await createSessionToken(options.secret ?? TEST_SECRET, now, authAt)
  return `aov_session=${token}`
}

export const routeContext = (id: string) => ({ params: Promise.resolve({ id }) })
