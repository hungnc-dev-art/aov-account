import { parseAccountId } from '../../../../../src/lib/accounts'
import { requireOwner } from '../../../../../src/lib/auth/guard'
import { errorResponse, json, jsonError } from '../../../../../src/lib/http'
import { prisma } from '../../../../../src/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Lấy mật khẩu của MỘT tài khoản khi chủ sở hữu bấm xem/sao chép. Không cache. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner(request)
  if (!guard.ok) return guard.response
  const id = parseAccountId((await context.params).id)
  if (!id) return jsonError(400, 'INVALID_ID', 'ID tài khoản không hợp lệ.')
  try {
    const account = await prisma.account.findUnique({ where: { id }, select: { password: true } })
    if (!account) return jsonError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.')
    return json({ password: account.password })
  } catch (error) {
    return errorResponse(error, 'accounts:password')
  }
}
