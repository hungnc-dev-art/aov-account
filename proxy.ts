import { NextResponse, type NextRequest } from 'next/server'
import { getAuthConfig, nowSeconds } from './src/lib/auth/config'
import { sessionCookieName } from './src/lib/auth/cookie'
import { verifySessionToken } from './src/lib/auth/session'

// Lớp kiểm tra sớm: chặn trang/API khi chưa đăng nhập và gắn CSP có nonce.
// Mỗi Route Handler vẫn tự kiểm tra phiên (không chỉ dựa vào Proxy).

function contentSecurityPolicy(nonce: string, https: boolean): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ]
  if (https) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const config = getAuthConfig()
  const token = request.cookies.get(sessionCookieName())?.value
  const session = config ? await verifySessionToken(token, config.secret, nowSeconds()) : null

  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth/') || session) return NextResponse.next()
    return NextResponse.json(
      { error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', code: 'UNAUTHENTICATED' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    )
  }

  if (pathname !== '/login' && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const nonce = btoa(crypto.randomUUID())
  const csp = contentSecurityPolicy(nonce, request.nextUrl.protocol === 'https:')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', csp)
  response.headers.set('cache-control', 'private, no-store')
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|heroes/|assets/|favicon|icons.svg|robots.txt).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }],
    },
  ],
}
