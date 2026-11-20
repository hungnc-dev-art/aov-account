// Regression test cho logic phía client: theme (B7), route hash (link cũ), migrate IndexedDB (B1, B2).
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../src/lib/account-api'
import {
  MAX_MIGRATION_ATTEMPTS,
  MIGRATION_ATTEMPTS_KEY,
  MIGRATION_DONE_KEY,
  runLegacyMigration,
  toImportRow,
} from '../../src/lib/legacy-indexed-db'
import { canonicalHash, formatHash, parseHash } from '../../src/lib/navigation'
import { parsePreference, resolveTheme, THEME_BOOT_SCRIPT, THEME_KEY } from '../../src/lib/theme'
import type { ImportSummary } from '../../src/types'

function runBootScript(stored: string | null, prefersDark: boolean) {
  const writes: string[] = []
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
  runInNewContext(THEME_BOOT_SCRIPT, {
    localStorage: { getItem: (key: string) => (key === THEME_KEY ? stored : null), setItem: (key: string) => writes.push(key) },
    matchMedia: () => ({ matches: prefersDark }),
    document: { documentElement: root },
  })
  return { theme: root.dataset.theme, colorScheme: root.style.colorScheme, writes }
}

describe('theme (B7)', () => {
  it('boot script applies the stored choice before render and never writes storage', () => {
    expect(runBootScript('light', true)).toEqual({ theme: 'light', colorScheme: 'light', writes: [] })
    expect(runBootScript('dark', false)).toEqual({ theme: 'dark', colorScheme: 'dark', writes: [] })
    expect(runBootScript('system', false).theme).toBe('light')
    expect(runBootScript(null, false).theme).toBe('dark')
    expect(runBootScript('garbage', false).theme).toBe('dark')
  })

  it('resolves preferences consistently with the boot script', () => {
    expect(parsePreference('light')).toBe('light')
    expect(parsePreference(null)).toBe('dark')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})

describe('hash navigation', () => {
  it('keeps old links working', () => {
    expect(parseHash('#accounts')).toEqual({ page: 'accounts' })
    expect(parseHash('')).toEqual({ page: 'heroes', id: undefined })
    expect(parseHash('#top')).toEqual({ page: 'heroes', id: undefined })
    expect(canonicalHash('#accounts')).toBe('#/accounts')
    expect(canonicalHash('#top')).toBe('#/heroes')
    expect(canonicalHash('#/accounts')).toBeNull()
  })

  it('round-trips deep links and tolerates malformed encoding', () => {
    expect(parseHash(formatHash({ page: 'heroes', id: 'ngo-khong' }))).toEqual({ page: 'heroes', id: 'ngo-khong' })
    expect(parseHash('#/accounts/42')).toEqual({ page: 'accounts', id: '42' })
    expect(parseHash('#/heroes/%E0%A4%A')).toEqual({ page: 'heroes', id: undefined })
  })
})

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data }
}

const summary = (overrides: Partial<ImportSummary> = {}): ImportSummary => ({
  mode: 'create-only', received: 0, created: 0, updated: 0, skipped: 0, invalid: 0, deleted: 0, warnings: [], ...overrides,
})

describe('legacy IndexedDB migration (B1, B2)', () => {
  it('imports in create-only mode and reports created / skipped / invalid', async () => {
    const storage = memoryStorage()
    const importRows = vi.fn(async (rows) => summary({ received: rows.length, created: 1, skipped: 1, invalid: 1 }))
    const outcome = await runLegacyMigration({
      storage,
      readLegacy: async () => [{ username: 'old', heroes: ['Nakroth'] }, { username: 'exists', heroes: ['Krixi'] }, { username: 'no-heroes', heroes: [] }, 'garbage'],
      importRows,
    })
    expect(outcome).toMatchObject({ status: 'done', summary: { created: 1, skipped: 1, invalid: 2 } })
    expect(importRows.mock.calls[0][0]).toHaveLength(3)
    expect(storage.data.get(MIGRATION_DONE_KEY)).toContain('"created":1')
  })

  it('never runs again once done, and finishes immediately when there is nothing to migrate', async () => {
    const importRows = vi.fn()
    expect(await runLegacyMigration({ storage: memoryStorage({ [MIGRATION_DONE_KEY]: 'x' }), readLegacy: async () => [{}], importRows })).toEqual({ status: 'skipped' })
    const empty = memoryStorage()
    expect(await runLegacyMigration({ storage: empty, readLegacy: async () => [], importRows })).toEqual({ status: 'empty' })
    expect(empty.data.has(MIGRATION_DONE_KEY)).toBe(true)
    expect(importRows).not.toHaveBeenCalled()
  })

  it('counts network/server failures and gives up after the limit (no infinite retries)', async () => {
    const storage = memoryStorage()
    const failing = { storage, readLegacy: async () => [{ username: 'u', heroes: ['Nakroth'] }], importRows: async () => { throw new ApiError(500, 'INTERNAL_ERROR', 'x') } }
    for (let attempt = 1; attempt <= MAX_MIGRATION_ATTEMPTS; attempt += 1) {
      expect(await runLegacyMigration(failing)).toEqual({ status: 'failed', attempts: attempt })
    }
    expect(await runLegacyMigration(failing)).toEqual({ status: 'gave-up' })
    expect(await runLegacyMigration(failing)).toEqual({ status: 'skipped' })
  })

  it('does not burn an attempt when the user is simply not authenticated', async () => {
    const storage = memoryStorage()
    await runLegacyMigration({
      storage,
      readLegacy: async () => [{ username: 'u', heroes: ['Nakroth'] }],
      importRows: async () => { throw new ApiError(401, 'UNAUTHENTICATED', 'x') },
      isAuthError: (error) => error instanceof ApiError && error.status === 401,
    })
    expect(storage.data.get(MIGRATION_ATTEMPTS_KEY)).toBeUndefined()
  })

  it('maps legacy records defensively', () => {
    expect(toImportRow(null)).toBeNull()
    expect(toImportRow({ username: 'a', password: 5, heroes: ['x', 3] })).toMatchObject({ username: 'a', password: '', heroes: ['x'] })
  })
})
