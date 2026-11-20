import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../src/lib/http'
import { parseImportRequest, prepareRows, runImport, type ImportDb, type ImportTx } from '../../src/lib/import-service'

function fakeDb(existing: Array<{ id: number; username: string }>) {
  const account = {
    findMany: vi.fn(async () => existing),
    count: vi.fn(async () => existing.length),
    deleteMany: vi.fn(async () => ({ count: existing.length })),
    createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    update: vi.fn(async () => ({})),
  }
  const tx = { account, $executeRaw: vi.fn(async () => 0) } as unknown as ImportTx
  const db: ImportDb = { $transaction: async (fn) => fn(tx) }
  return { db, account }
}

const acc = (username: string, extra: Record<string, unknown> = {}) => ({ username, password: 'p', heroes: ['Nakroth'], ...extra })

describe('prepareRows', () => {
  it('counts invalid rows and in-file duplicates (trim + lowercase) separately from valid ones', () => {
    const result = prepareRows([acc('User.A'), acc(' user.a '), acc('fixture-a'), acc('fixture_a'), { username: '', heroes: ['x'] }, acc('no-heroes', { heroes: [] })])
    expect(result.valid.map((row) => row.username)).toEqual(['User.A', 'fixture-a', 'fixture_a'])
    expect(result.invalid).toBe(3)
    expect(result.warnings).toHaveLength(3)
  })
})

describe('runImport', () => {
  it('merge updates matches (case-insensitive) without renaming and never deletes', async () => {
    const { db, account } = fakeDb([{ id: 1, username: 'Demo.Kho' }, { id: 2, username: 'other' }])
    const summary = await runImport(db, { mode: 'merge', accounts: [acc('demo.kho'), acc('brand-new')] })
    expect(summary).toMatchObject({ created: 1, updated: 1, skipped: 0, deleted: 0 })
    expect(account.deleteMany).not.toHaveBeenCalled()
    const updateArgs = account.update.mock.calls[0] as unknown as [{ where: { id: number }; data: Record<string, unknown> }]
    expect(updateArgs[0].where).toEqual({ id: 1 })
    expect(updateArgs[0].data).not.toHaveProperty('username')
    expect(summary.warnings.some((warning) => warning.includes('Demo.Kho'))).toBe(true)
  })

  it('create-only never overwrites existing accounts', async () => {
    const { db, account } = fakeDb([{ id: 1, username: 'demo.old' }])
    const summary = await runImport(db, { mode: 'create-only', accounts: [acc('DEMO.OLD'), acc('demo.fresh')] })
    expect(summary).toMatchObject({ created: 1, updated: 0, skipped: 1 })
    expect(account.update).not.toHaveBeenCalled()
  })

  it('skips ambiguous matches when the database already has case variants', async () => {
    const { db, account } = fakeDb([{ id: 1, username: 'abc' }, { id: 2, username: 'ABC' }])
    const summary = await runImport(db, { mode: 'merge', accounts: [acc('Abc')] })
    expect(summary.skipped).toBe(1)
    expect(account.update).not.toHaveBeenCalled()
    expect(account.createMany).not.toHaveBeenCalled()
  })

  it('replace refuses partially invalid files', async () => {
    const { db, account } = fakeDb([{ id: 1, username: 'x' }])
    await expect(runImport(db, { mode: 'replace', accounts: [acc('ok'), acc('bad', { heroes: [] })], confirm: { phrase: 'THAY THẾ', expectedCount: 1 } }))
      .rejects.toThrow('mọi dòng đều hợp lệ')
    expect(account.deleteMany).not.toHaveBeenCalled()
  })
})

describe('parseImportRequest', () => {
  it('validates mode, shape and size', () => {
    expect(() => parseImportRequest({ mode: 'wipe', accounts: [acc('a')] })).toThrow('Chế độ nhập không hợp lệ.')
    expect(() => parseImportRequest({ mode: 'merge', accounts: [] })).toThrow()
    expect(() => parseImportRequest({ mode: 'merge', accounts: Array.from({ length: 2001 }, () => acc('a')) })).toThrow(HttpError)
    expect(parseImportRequest({ replace: true, accounts: [acc('a')] }).mode).toBe('replace')
  })
})
