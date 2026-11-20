// Cookie phiên: HttpOnly, SameSite=Strict, Secure + tiền tố __Host- khi production.

const isProduction = () => process.env.NODE_ENV === 'production'

export function sessionCookieName(): string {
  return isProduction() ? '__Host-aov_session' : 'aov_session'
}

export function serializeSessionCookie(token: string, maxAgeSeconds: number): string {
  const parts = [`${sessionCookieName()}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`]
  if (isProduction()) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(): string {
  return serializeSessionCookie('', 0)
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return undefined
}
