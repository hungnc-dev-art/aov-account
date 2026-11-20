import { cookies } from 'next/headers'
import { getAuthConfig, nowSeconds } from './config'
import { sessionCookieName } from './cookie'
import { verifySessionToken, type SessionPayload } from './session'

/** Đọc phiên trong Server Component (trang `/`, `/login`). */
export async function getPageSession(): Promise<SessionPayload | null> {
  const config = getAuthConfig()
  if (!config) return null
  const token = (await cookies()).get(sessionCookieName())?.value
  return verifySessionToken(token, config.secret, nowSeconds())
}
