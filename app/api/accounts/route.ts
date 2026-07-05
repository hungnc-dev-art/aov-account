import { Prisma } from '../../../src/generated/prisma/client'
import { normalizeAccountInput, serializeAccount } from '../../../src/lib/accounts'
import { prisma } from '../../../src/lib/prisma'
import { normalizeText } from '../../../src/utils/normalize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const hero = new URL(request.url).searchParams.get('hero')
  const accounts = await prisma.account.findMany({
    where: hero
      ? { heroNamesNormalized: { has: normalizeText(hero) } }
      : undefined,
    orderBy: { updatedAt: 'desc' },
  })

  return Response.json({ accounts: accounts.map(serializeAccount) })
}

export async function POST(request: Request) {
  try {
    const input = normalizeAccountInput(await request.json())
    const account = await prisma.account.create({ data: input })
    return Response.json({ account: serializeAccount(account) }, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return Response.json(
        { error: 'Tên đăng nhập đã tồn tại.' },
        { status: 409 },
      )
    }
    const message =
      error instanceof Error ? error.message : 'Không thể tạo tài khoản.'
    return Response.json({ error: message }, { status: 400 })
  }
}
