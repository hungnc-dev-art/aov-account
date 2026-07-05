import { normalizeAccountInput } from '../../../../src/lib/accounts'
import { prisma } from '../../../../src/lib/prisma'

export const runtime = 'nodejs'

const IMPORT_TRANSACTION_TIMEOUT_MS = 120_000
const IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000

type NormalizedAccount = ReturnType<typeof normalizeAccountInput>

class ImportRowError extends Error {
  constructor(rowIndex: number, username: string, reason: string) {
    super(`Dòng ${rowIndex} (${username || 'thiếu username'}): ${reason}`)
    this.name = 'ImportRowError'
  }
}

function usernameForLog(input: unknown): string {
  if (
    typeof input === 'object' &&
    input !== null &&
    'username' in input &&
    typeof input.username === 'string'
  ) {
    return input.username.trim()
  }
  return ''
}

function safeNormalizedData(account: NormalizedAccount) {
  return {
    username: account.username,
    heroes: account.heroes,
    heroNamesNormalized: account.heroNamesNormalized,
    hasPassword: Boolean(account.password),
  }
}

function safeError(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) }
  return {
    name: error.name,
    message: error.message,
    ...('code' in error && typeof error.code === 'string'
      ? { code: error.code }
      : {}),
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      accounts?: unknown
      replace?: unknown
    }
    if (!Array.isArray(body.accounts) || !body.accounts.length) {
      return Response.json(
        { error: 'Danh sách account import không hợp lệ.' },
        { status: 400 },
      )
    }
    if (body.replace !== undefined && typeof body.replace !== 'boolean') {
      return Response.json(
        { error: 'Tuỳ chọn xoá dữ liệu cũ không hợp lệ.' },
        { status: 400 },
      )
    }

    const accounts = body.accounts.map((account, index) => {
      const rowIndex = index + 1
      const username = usernameForLog(account)
      try {
        return normalizeAccountInput(account)
      } catch (error) {
        console.error('[accounts/import] Dữ liệu dòng không hợp lệ', {
          rowIndex,
          username,
          error: safeError(error),
        })
        throw new ImportRowError(
          rowIndex,
          username,
          error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.',
        )
      }
    })

    const warnings = accounts.flatMap((account, index) =>
      account.password
        ? []
        : [`Dòng ${index + 1} (${account.username}) chưa có mật khẩu.`],
    )

    await prisma.$transaction(async (transaction) => {
      if (body.replace) await transaction.account.deleteMany()
      for (const [index, account] of accounts.entries()) {
        try {
          await transaction.account.upsert({
            where: { username: account.username },
            create: account,
            update: account,
          })
        } catch (error) {
          const rowIndex = index + 1
          console.error('[accounts/import] Không thể upsert account', {
            rowIndex,
            username: account.username,
            normalizedData: safeNormalizedData(account),
            error: safeError(error),
          })
          throw new ImportRowError(
            rowIndex,
            account.username,
            'Không thể lưu account vào database.',
          )
        }
      }
    }, {
      maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
      timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
    })

    return Response.json({ imported: accounts.length, warnings })
  } catch (error) {
    console.error('[accounts/import] Import thất bại', {
      error: safeError(error),
    })
    const message = error instanceof ImportRowError
      ? error.message
      : 'Không thể import account.'
    return Response.json({ error: message }, { status: 400 })
  }
}
