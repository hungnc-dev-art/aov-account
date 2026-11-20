import { normalizeAccountInput, parseAccountId, toPublicAccount } from '../../../../src/lib/accounts'
import { requireOwner } from '../../../../src/lib/auth/guard'
import { errorResponse, json, jsonError, readJson } from '../../../../src/lib/http'
import { prisma } from '../../../../src/lib/prisma'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: Context) {
  const guard = await requireOwner(request, { write: true })
  if (!guard.ok) return guard.response
  const id = parseAccountId((await context.params).id)
  if (!id) return jsonError(400, 'INVALID_ID', 'ID tài khoản không hợp lệ.')
  try {
    // Không gửi `password` = giữ nguyên mật khẩu đang lưu.
    const { password, ...input } = normalizeAccountInput(await readJson(request), { passwordOptional: true })
    const duplicate = await prisma.account.findFirst({
      where: { username: { equals: input.username, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    })
    if (duplicate) return jsonError(409, 'USERNAME_TAKEN', 'Tên đăng nhập đã tồn tại (không phân biệt hoa/thường).')
    const account = await prisma.account.update({
      where: { id },
      data: password === undefined ? input : { ...input, password },
    })
    return json({ account: toPublicAccount(account) })
  } catch (error) {
    return errorResponse(error, 'accounts:update')
  }
}

export async function DELETE(request: Request, context: Context) {
  const guard = await requireOwner(request, { write: true })
  if (!guard.ok) return guard.response
  const id = parseAccountId((await context.params).id)
  if (!id) return jsonError(400, 'INVALID_ID', 'ID tài khoản không hợp lệ.')
  try {
    await prisma.account.delete({ where: { id } })
    return json({ success: true })
  } catch (error) {
    return errorResponse(error, 'accounts:delete')
  }
}
