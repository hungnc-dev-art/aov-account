import { Prisma } from '../../../../src/generated/prisma/client'
import {
  normalizeAccountInput,
  serializeAccount,
} from '../../../../src/lib/accounts'
import { prisma } from '../../../../src/lib/prisma'

export const runtime = 'nodejs'

function parseId(value: string): number | undefined {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = parseId((await context.params).id)
  if (!id) return Response.json({ error: 'ID không hợp lệ.' }, { status: 400 })

  try {
    const input = normalizeAccountInput(await request.json())
    const account = await prisma.account.update({ where: { id }, data: input })
    return Response.json({ account: serializeAccount(account) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return Response.json(
          { error: 'Không tìm thấy tài khoản.' },
          { status: 404 },
        )
      }
      if (error.code === 'P2002') {
        return Response.json(
          { error: 'Tên đăng nhập đã tồn tại.' },
          { status: 409 },
        )
      }
    }
    const message =
      error instanceof Error ? error.message : 'Không thể cập nhật tài khoản.'
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = parseId((await context.params).id)
  if (!id) return Response.json({ error: 'ID không hợp lệ.' }, { status: 400 })

  try {
    await prisma.account.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return Response.json(
        { error: 'Không tìm thấy tài khoản.' },
        { status: 404 },
      )
    }
    return Response.json(
      { error: 'Không thể xoá tài khoản.' },
      { status: 400 },
    )
  }
}
