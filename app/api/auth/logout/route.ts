import { clearSessionCookie } from '../../../../src/lib/auth/cookie'
import { checkWriteRequest } from '../../../../src/lib/auth/guard'
import { json } from '../../../../src/lib/http'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const rejected = checkWriteRequest(request)
  if (rejected) return rejected
  const response = json({ ok: true })
  response.headers.append('set-cookie', clearSessionCookie())
  return response
}
