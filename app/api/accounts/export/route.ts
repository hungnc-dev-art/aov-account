import { requireOwner } from '../../../../src/lib/auth/guard'
import { errorResponse, isRecord, json, readJson, ValidationError } from '../../../../src/lib/http'
import { prisma } from '../../../../src/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dữ liệu cho file Excel (file được tạo trong trình duyệt, không upload đi đâu).
 * Mặc định KHÔNG kèm mật khẩu; kèm mật khẩu cần đã xác thực lại trong 5 phút.
 */
export async function POST(request: Request) {
  const basic = await requireOwner(request, { write: true })
  if (!basic.ok) return basic.response
  try {
    const body = await readJson(request, 1024)
    if (!isRecord(body)) throw new ValidationError('Yêu cầu xuất không hợp lệ.')
    const includePasswords = body.includePasswords === true
    if (includePasswords) {
      const strict = await requireOwner(request, { write: true, recentAuth: true })
      if (!strict.ok) return strict.response
    }
    const accounts = await prisma.account.findMany({ orderBy: { updatedAt: 'desc' } })
    return json({
      includePasswords,
      accounts: accounts.map((account) => ({
        username: account.username,
        ...(includePasswords ? { password: account.password } : {}),
        nickname: account.nickname,
        gold: account.gold,
        level: account.level,
        rank: account.rank,
        status: account.status,
        heroes: account.heroes,
        note: account.note,
      })),
    })
  } catch (error) {
    return errorResponse(error, 'accounts:export')
  }
}
