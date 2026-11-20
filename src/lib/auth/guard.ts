// Kiểm tra quyền tại từng Route Handler (không chỉ dựa vào Proxy).
import { getAuthConfig, nowSeconds } from './config'
import { readCookie, sessionCookieName } from './cookie'
import { isRecentlyAuthenticated, verifySessionToken, type SessionPayload } from './session'
import { jsonError } from '../http'

export type GuardResult = { ok: true; session: SessionPayload } | { ok: false; response: Response }

interface GuardOptions {
  /** Request ghi dữ liệu: bắt buộc cùng origin + Content-Type JSON (nếu có body). */
  write?: boolean
  /** Thao tác nguy hiểm: cần đã nhập mật khẩu trong cửa sổ xác thực lại. */
  recentAuth?: boolean
}

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH'])

/** Chặn request đọc từ site khác (trình duyệt gửi Sec-Fetch-Site). */
export function isAllowedFetchSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  return !site || site === 'same-origin' || site === 'none'
}

/** Origin phải trùng host đang phục vụ; không có Origin thì cần Sec-Fetch-Site same-origin. */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      return Boolean(host) && new URL(origin).host === host
    } catch {
      return false
    }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin'
}

export function isJsonRequest(request: Request): boolean {
  const type = request.headers.get('content-type') ?? ''
  return type.split(';')[0].trim().toLowerCase() === 'application/json'
}

/** Kiểm tra CSRF cho request ghi (dùng cả cho login/logout chưa có phiên). */
export function checkWriteRequest(request: Request): Response | null {
  if (!isSameOrigin(request)) return jsonError(403, 'CSRF_REJECTED', 'Yêu cầu bị từ chối vì không xuất phát từ ứng dụng.')
  if (BODY_METHODS.has(request.method) && !isJsonRequest(request)) {
    return jsonError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Yêu cầu phải gửi dữ liệu dạng application/json.')
  }
  return null
}

export async function readSession(request: Request): Promise<SessionPayload | null> {
  const config = getAuthConfig()
  if (!config) return null
  const token = readCookie(request.headers.get('cookie'), sessionCookieName())
  return verifySessionToken(token, config.secret, nowSeconds())
}

export async function requireOwner(request: Request, options: GuardOptions = {}): Promise<GuardResult> {
  if (!getAuthConfig()) {
    return { ok: false, response: jsonError(503, 'AUTH_NOT_CONFIGURED', 'Máy chủ chưa được cấu hình đăng nhập.') }
  }
  if (options.write) {
    const rejected = checkWriteRequest(request)
    if (rejected) return { ok: false, response: rejected }
  } else if (!isAllowedFetchSite(request)) {
    return { ok: false, response: jsonError(403, 'CSRF_REJECTED', 'Yêu cầu bị từ chối vì không xuất phát từ ứng dụng.') }
  }
  const session = await readSession(request)
  if (!session) {
    return { ok: false, response: jsonError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.') }
  }
  if (options.recentAuth && !isRecentlyAuthenticated(session, nowSeconds())) {
    return { ok: false, response: jsonError(403, 'REAUTH_REQUIRED', 'Vui lòng nhập lại mật khẩu để tiếp tục thao tác này.') }
  }
  return { ok: true, session }
}
