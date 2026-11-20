import { requireOwner } from '../../../../src/lib/auth/guard'
import { authenticate } from '../../../../src/lib/auth/login'
import { errorResponse } from '../../../../src/lib/http'

export const runtime = 'nodejs'

/** Nhập lại mật khẩu trước thao tác nguy hiểm (thay thế kho, xuất kèm mật khẩu). */
export async function POST(request: Request) {
  const guard = await requireOwner(request, { write: true })
  if (!guard.ok) return guard.response
  try {
    return await authenticate(request, 'reauth', guard.session)
  } catch (error) {
    return errorResponse(error, 'auth:reauth')
  }
}
