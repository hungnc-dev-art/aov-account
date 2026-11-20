// Session token ký HMAC-SHA256 bằng Web Crypto (chạy được trong Proxy và Route Handler).
// Định dạng: v1.<payload base64url>.<chữ ký base64url>
import { REAUTH_WINDOW_SECONDS, SESSION_TTL_SECONDS } from './config'

export interface SessionPayload {
  v: 1
  /** Thời điểm phát hành (giây) */
  iat: number
  /** Hết hạn tuyệt đối (giây) */
  exp: number
  /** Lần cuối nhập mật khẩu (giây) — dùng cho thao tác nguy hiểm */
  auth: number
  jti: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const keyCache = new Map<string, Promise<CryptoKey>>()
const CLOCK_SKEW = 60

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret)
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    keyCache.set(secret, key)
  }
  return key
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('invalid base64url')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function createSessionToken(secret: string, now: number, authAt = now): Promise<{ token: string; payload: SessionPayload }> {
  const jti = toBase64Url(crypto.getRandomValues(new Uint8Array(16)))
  const payload: SessionPayload = { v: 1, iat: now, exp: now + SESSION_TTL_SECONDS, auth: authAt, jti }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`v1.${body}`))
  return { token: `v1.${body}.${toBase64Url(new Uint8Array(signature))}`, payload }
}

function isPayload(value: unknown): value is SessionPayload {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.v === 1 &&
    Number.isInteger(record.iat) &&
    Number.isInteger(record.exp) &&
    Number.isInteger(record.auth) &&
    typeof record.jti === 'string'
  )
}

/** Trả payload khi chữ ký đúng và còn hạn; mọi trường hợp khác trả `null`. */
export async function verifySessionToken(token: string | undefined | null, secret: string, now: number): Promise<SessionPayload | null> {
  if (!token || token.length > 1024) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64Url(parts[2]), encoder.encode(`v1.${parts[1]}`))
    if (!valid) return null
    const payload: unknown = JSON.parse(decoder.decode(fromBase64Url(parts[1])))
    if (!isPayload(payload)) return null
    if (payload.exp <= now) return null
    if (payload.iat > now + CLOCK_SKEW || payload.auth > now + CLOCK_SKEW) return null
    if (payload.exp - payload.iat > SESSION_TTL_SECONDS) return null
    return payload
  } catch {
    return null
  }
}

export function isRecentlyAuthenticated(session: SessionPayload, now: number): boolean {
  return now - session.auth <= REAUTH_WINDOW_SECONDS
}
