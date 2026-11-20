// Nhập nhiều tài khoản. Toàn bộ thao tác ghi chạy trong MỘT transaction: lỗi giữa chừng → rollback.
import { normalizeAccountInput, usernameKey, type NormalizedAccountInput } from './accounts'
import { ConflictError, HttpError, isRecord, ValidationError } from './http'

export type ImportMode = 'merge' | 'replace' | 'create-only'
export const IMPORT_MODES: readonly ImportMode[] = ['merge', 'replace', 'create-only']
export const MAX_IMPORT_ROWS = 2000
export const REPLACE_CONFIRM_PHRASE = 'THAY THẾ'
const MAX_WARNINGS = 200

export interface ImportSummary {
  mode: ImportMode
  received: number
  created: number
  updated: number
  /** Bỏ qua vì đã tồn tại (create-only) hoặc trùng không xác định được (nhiều bản ghi cùng khoá). */
  skipped: number
  /** Dòng không hợp lệ hoặc trùng username trong cùng lần nhập. */
  invalid: number
  /** Số tài khoản đã bị xoá (chỉ replace). */
  deleted: number
  warnings: string[]
}

type AccountData = NormalizedAccountInput & { password: string }

/** Tối thiểu những gì service cần từ Prisma (giúp test bằng mock). */
export interface ImportTx {
  account: {
    findMany(args: { select: { id: true; username: true } }): Promise<Array<{ id: number; username: string }>>
    count(): Promise<number>
    deleteMany(): Promise<unknown>
    createMany(args: { data: AccountData[] }): Promise<{ count: number }>
    update(args: { where: { id: number }; data: Omit<AccountData, 'username'> }): Promise<unknown>
  }
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>
}

export interface ImportDb {
  $transaction<T>(fn: (tx: ImportTx) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T>
}

export interface ImportRequest {
  mode: ImportMode
  accounts: unknown[]
  confirm?: { phrase?: unknown; expectedCount?: unknown }
}

export function parseImportRequest(body: unknown): ImportRequest {
  if (!isRecord(body)) throw new ValidationError('Dữ liệu nhập không hợp lệ.')
  const mode = body.mode ?? (body.replace === true ? 'replace' : 'merge')
  if (typeof mode !== 'string' || !IMPORT_MODES.includes(mode as ImportMode)) throw new ValidationError('Chế độ nhập không hợp lệ.')
  if (!Array.isArray(body.accounts) || !body.accounts.length) throw new ValidationError('Danh sách tài khoản nhập không hợp lệ.')
  if (body.accounts.length > MAX_IMPORT_ROWS) {
    throw new HttpError(413, 'TOO_MANY_ROWS', `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} tài khoản.`)
  }
  const confirm = isRecord(body.confirm) ? body.confirm : undefined
  return { mode: mode as ImportMode, accounts: body.accounts, confirm }
}

function pushWarning(warnings: string[], message: string) {
  if (warnings.length < MAX_WARNINGS) warnings.push(message)
  else if (warnings.length === MAX_WARNINGS) warnings.push('… và các cảnh báo khác.')
}

export function prepareRows(rows: unknown[]): { valid: AccountData[]; invalid: number; warnings: string[] } {
  const valid: AccountData[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  let invalid = 0
  rows.forEach((row, index) => {
    const line = index + 1
    try {
      const account = normalizeAccountInput(row)
      const key = usernameKey(account.username)
      if (seen.has(key)) {
        invalid += 1
        pushWarning(warnings, `Dòng ${line}: username trùng với dòng trước trong file (so sánh không phân biệt hoa/thường) — bỏ qua.`)
        return
      }
      seen.add(key)
      valid.push({ ...account, password: account.password ?? '' })
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error
      invalid += 1
      pushWarning(warnings, `Dòng ${line}: ${error.message}`)
    }
  })
  return { valid, invalid, warnings }
}

function normalizePhrase(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFC').trim().toLocaleUpperCase('vi') : ''
}

export async function runImport(db: ImportDb, request: ImportRequest): Promise<ImportSummary> {
  const prepared = prepareRows(request.accounts)
  const summary: ImportSummary = {
    mode: request.mode,
    received: request.accounts.length,
    created: 0,
    updated: 0,
    skipped: 0,
    invalid: prepared.invalid,
    deleted: 0,
    warnings: prepared.warnings,
  }

  if (request.mode === 'replace') {
    if (normalizePhrase(request.confirm?.phrase) !== REPLACE_CONFIRM_PHRASE) {
      throw new ValidationError(`Cần gõ chính xác “${REPLACE_CONFIRM_PHRASE}” để thay thế toàn bộ kho.`, 'CONFIRMATION_REQUIRED')
    }
    const expectedCount = request.confirm?.expectedCount
    if (typeof expectedCount !== 'number' || !Number.isInteger(expectedCount) || expectedCount < 0) {
      throw new ValidationError('Thiếu số tài khoản hiện có để xác nhận thay thế.', 'CONFIRMATION_REQUIRED')
    }
    if (prepared.invalid > 0) {
      throw new ValidationError('Chế độ thay thế yêu cầu mọi dòng đều hợp lệ. Hãy sửa file hoặc dùng chế độ gộp.')
    }
    if (!prepared.valid.length) throw new ValidationError('Không có tài khoản hợp lệ để nhập.')

    return db.$transaction(async (tx) => {
      // Khoá bảng để số bản ghi không đổi giữa lúc đếm và lúc xoá.
      await tx.$executeRaw`LOCK TABLE "Account" IN SHARE ROW EXCLUSIVE MODE`
      const current = await tx.account.count()
      if (current !== expectedCount) {
        throw new ConflictError(
          `Số tài khoản trong kho đã thay đổi (${current} thay vì ${expectedCount}). Hãy tải lại trang rồi thử lại.`,
          'COUNT_MISMATCH',
        )
      }
      await tx.account.deleteMany()
      const created = await tx.account.createMany({ data: prepared.valid })
      return { ...summary, deleted: current, created: created.count }
    }, { maxWait: 10_000, timeout: 60_000 })
  }

  if (!prepared.valid.length) return summary

  return db.$transaction(async (tx) => {
    const existing = await tx.account.findMany({ select: { id: true, username: true } })
    const byKey = new Map<string, Array<{ id: number; username: string }>>()
    for (const record of existing) {
      const key = usernameKey(record.username)
      byKey.set(key, [...(byKey.get(key) ?? []), record])
    }

    const creates: AccountData[] = []
    let updated = 0
    let skipped = 0
    for (const row of prepared.valid) {
      const matches = byKey.get(usernameKey(row.username)) ?? []
      if (matches.length > 1) {
        skipped += 1
        pushWarning(summary.warnings, `“${row.username}” khớp ${matches.length} tài khoản chỉ khác hoa/thường — bỏ qua để tránh ghi nhầm.`)
        continue
      }
      if (matches.length === 1) {
        if (request.mode === 'create-only') {
          skipped += 1
          continue
        }
        const [match] = matches
        const { username, ...data } = row
        await tx.account.update({ where: { id: match.id }, data })
        updated += 1
        if (match.username !== username) {
          pushWarning(summary.warnings, `“${username}” được ghép với tài khoản “${match.username}” (khác hoa/thường); giữ nguyên username đang lưu.`)
        }
        continue
      }
      creates.push(row)
    }
    const created = creates.length ? (await tx.account.createMany({ data: creates })).count : 0
    return { ...summary, created, updated, skipped }
  }, { maxWait: 10_000, timeout: 60_000 })
}

/** Vercel Functions giới hạn body 4,5 MB; giữ dưới mức đó và trả 413 rõ ràng. */
export const IMPORT_LIMITS = { maxRows: MAX_IMPORT_ROWS, maxBodyBytes: 4 * 1024 * 1024 }
