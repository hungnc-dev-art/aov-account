import { checkWriteRequest } from '../../../../src/lib/auth/guard'
import { authenticate } from '../../../../src/lib/auth/login'
import { errorResponse } from '../../../../src/lib/http'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const rejected = checkWriteRequest(request)
  if (rejected) return rejected
  try {
    return await authenticate(request, 'login')
  } catch (error) {
    return errorResponse(error, 'auth:login')
  }
}
