import { normalizeAccountInput, toPublicAccount } from '../../../src/lib/accounts'
import { requireOwner } from '../../../src/lib/auth/guard'
import { errorResponse, json, jsonError, readJson } from '../../../src/lib/http'
import { prisma } from '../../../src/lib/prisma'
import { normalizeText } from '../../../src/utils/normalize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const guard = await requireOwner(request)
  if (!guard.ok) return guard.response
  try {
    const hero = new URL(request.url).searchParams.get('hero')
    const accounts = await prisma.account.findMany({
      where: hero ? { heroNamesNormalized: { has: normalizeText(hero) } } : undefined,
      orderBy: { updatedAt: 'desc' },
    })
    return json({ accounts: accounts.map(toPublicAccount) })
  } catch (error) {
    return errorResponse(error, 'accounts:list')
  }
}

export async function POST(request: Request) {
  const guard = await requireOwner(request, { write: true })
  if (!guard.ok) return guard.response
  try {
    const input = normalizeAccountInput(await readJson(request))
    const duplicate = await prisma.account.findFirst({
      where: { username: { equals: input.username, mode: 'insensitive' } },
      select: { id: true },
    })
    if (duplicate) return jsonError(409, 'USERNAME_TAKEN', 'Tên đăng nhập đã tồn tại (không phân biệt hoa/thường).')
    const account = await prisma.account.create({ data: { ...input, password: input.password ?? '' } })
    return json({ account: toPublicAccount(account) }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'accounts:create')
  }
}
