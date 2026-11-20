// Chuyển dữ liệu IndexedDB cũ (trước khi dùng Neon) lên server — một lần, an toàn:
// - chạy NỀN sau khi danh sách đã tải, không bao giờ chặn việc tải tài khoản (B1);
// - chế độ create-only: KHÔNG ghi đè tài khoản đã có trên server (B2);
// - dòng không hợp lệ bị bỏ qua và được thống kê; tối đa 3 lần thử khi lỗi mạng/máy chủ.
import type { AccountImportRow, ImportSummary } from '../types'

export const MIGRATION_DONE_KEY = 'aov-neon-migration-v1'
export const MIGRATION_ATTEMPTS_KEY = 'aov-neon-migration-attempts'
export const MAX_MIGRATION_ATTEMPTS = 3
const BATCH_SIZE = 500

export type MigrationOutcome =
  | { status: 'skipped' }
  | { status: 'empty' }
  | { status: 'done'; summary: ImportSummary }
  | { status: 'failed'; attempts: number }
  | { status: 'gave-up' }

export interface MigrationDeps {
  readLegacy: () => Promise<unknown[]>
  importRows: (rows: AccountImportRow[]) => Promise<ImportSummary>
  storage: Pick<Storage, 'getItem' | 'setItem'>
  /** Lỗi do chưa đăng nhập/bị từ chối: không tính là một lần thử. */
  isAuthError?: (error: unknown) => boolean
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

export function toImportRow(value: unknown): AccountImportRow | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  return {
    username: text(record.username),
    password: text(record.password),
    nickname: text(record.nickname),
    gold: text(record.gold),
    level: text(record.level),
    rank: text(record.rank),
    status: text(record.status),
    heroes: Array.isArray(record.heroes) ? record.heroes.filter((hero): hero is string => typeof hero === 'string') : [],
    note: text(record.note),
  }
}

function mergeSummaries(parts: ImportSummary[]): ImportSummary {
  return parts.reduce<ImportSummary>(
    (total, part) => ({
      ...total,
      received: total.received + part.received,
      created: total.created + part.created,
      updated: total.updated + part.updated,
      skipped: total.skipped + part.skipped,
      invalid: total.invalid + part.invalid,
      warnings: [...total.warnings, ...part.warnings].slice(0, 200),
    }),
    { mode: 'create-only', received: 0, created: 0, updated: 0, skipped: 0, invalid: 0, deleted: 0, warnings: [] },
  )
}

export async function runLegacyMigration(deps: MigrationDeps): Promise<MigrationOutcome> {
  if (deps.storage.getItem(MIGRATION_DONE_KEY)) return { status: 'skipped' }
  const attempts = Number(deps.storage.getItem(MIGRATION_ATTEMPTS_KEY) ?? '0') || 0
  if (attempts >= MAX_MIGRATION_ATTEMPTS) {
    deps.storage.setItem(MIGRATION_DONE_KEY, `gave-up:${new Date().toISOString()}`)
    return { status: 'gave-up' }
  }

  const legacy: unknown[] = await deps.readLegacy().catch(() => [])
  const rows = legacy.map(toImportRow).filter((row): row is AccountImportRow => row !== null)
  const unreadable = legacy.length - rows.length
  if (!rows.length) {
    deps.storage.setItem(MIGRATION_DONE_KEY, `empty:${new Date().toISOString()}`)
    return { status: 'empty' }
  }

  try {
    const parts: ImportSummary[] = []
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      parts.push(await deps.importRows(rows.slice(start, start + BATCH_SIZE)))
    }
    const summary = mergeSummaries(parts)
    summary.invalid += unreadable
    deps.storage.setItem(MIGRATION_DONE_KEY, JSON.stringify({ at: new Date().toISOString(), created: summary.created, skipped: summary.skipped, invalid: summary.invalid }))
    return { status: 'done', summary }
  } catch (error) {
    if (deps.isAuthError?.(error)) return { status: 'failed', attempts }
    deps.storage.setItem(MIGRATION_ATTEMPTS_KEY, String(attempts + 1))
    return { status: 'failed', attempts: attempts + 1 }
  }
}

/** Đọc store `accounts` của DB IndexedDB cũ; không tạo DB mới nếu chưa tồn tại. */
export function readLegacyAccounts(): Promise<unknown[]> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve([])
      return
    }
    const request = indexedDB.open('AovAccountManager')
    request.onerror = () => resolve([])
    request.onupgradeneeded = () => {
      request.transaction?.abort()
      resolve([])
    }
    request.onsuccess = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('accounts')) {
        database.close()
        resolve([])
        return
      }
      const getAll = database.transaction('accounts', 'readonly').objectStore('accounts').getAll()
      getAll.onerror = () => {
        database.close()
        resolve([])
      }
      getAll.onsuccess = () => {
        database.close()
        resolve(Array.isArray(getAll.result) ? getAll.result : [])
      }
    }
  })
}
