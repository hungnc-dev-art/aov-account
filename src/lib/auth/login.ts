// Logic đăng nhập / xác thực lại dùng chung cho các Route Handler auth.
import { getAuthConfig, nowSeconds, SESSION_TTL_SECONDS } from './config'
import { serializeSessionCookie } from './cookie'
import { MAX_PASSWORD_LENGTH, verifyPassword } from './password'
import { clientIp, hitRateLimit, LOGIN_LIMIT, resetRateLimit } from './rate-limit'
import { createSessionToken, type SessionPayload } from './session'
import { isRecord, json, jsonError, readJson } from '../http'

const FAILURE_DELAY_MS = 400
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : ms))

export async function authenticate(request: Request, scope: 'login' | 'reauth', existing?: SessionPayload): Promise<Response> {
  const config = getAuthConfig()
  if (!config) return jsonError(503, 'AUTH_NOT_CONFIGURED', 'Máy chủ chưa được cấu hình đăng nhập.')

  const ip = clientIp(request)
  const ipKey = `${scope}:ip:${ip}`
  const perIp = hitRateLimit(ipKey, LOGIN_LIMIT.perIp, LOGIN_LIMIT.windowMs)
  const global = hitRateLimit(`${scope}:global`, LOGIN_LIMIT.global, LOGIN_LIMIT.windowMs)
  if (!perIp.allowed || !global.allowed) {
    const retryAfter = Math.max(perIp.allowed ? 0 : perIp.retryAfterSeconds, global.allowed ? 0 : global.retryAfterSeconds)
    return jsonError(429, 'RATE_LIMITED', 'Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.', { 'retry-after': String(retryAfter) })
  }

  const body = await readJson(request, 2 * 1024)
  const password = isRecord(body) && typeof body.password === 'string' ? body.password : ''
  const valid = password.length > 0 && password.length <= MAX_PASSWORD_LENGTH && (await verifyPassword(password, config.ownerPasswordHash))
  if (!valid) {
    await delay(FAILURE_DELAY_MS)
    return jsonError(401, 'INVALID_CREDENTIALS', 'Mật khẩu không đúng.')
  }

  resetRateLimit(ipKey)
  const now = nowSeconds()
  const { token, payload } = await createSessionToken(config.secret, now, now)
  const response = json({
    ok: true,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    reauthUntil: new Date((payload.auth + 300) * 1000).toISOString(),
    renewed: Boolean(existing),
  })
  response.headers.append('set-cookie', serializeSessionCookie(token, SESSION_TTL_SECONDS))
  return response
}
