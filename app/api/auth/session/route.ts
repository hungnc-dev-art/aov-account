import { REAUTH_WINDOW_SECONDS } from '../../../../src/lib/auth/config'
import { isAllowedFetchSite, readSession } from '../../../../src/lib/auth/guard'
import { json, jsonError } from '../../../../src/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAllowedFetchSite(request)) return jsonError(403, 'CSRF_REJECTED', 'Yêu cầu bị từ chối.')
  const session = await readSession(request)
  if (!session) return json({ authenticated: false })
  return json({
    authenticated: true,
    expiresAt: new Date(session.exp * 1000).toISOString(),
    reauthUntil: new Date((session.auth + REAUTH_WINDOW_SECONDS) * 1000).toISOString(),
  })
}
