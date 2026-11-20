import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeRequest, routeContext, sessionCookie, TEST_SECRET } from '../helpers/api'

const db = vi.hoisted(() => {
  const account = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  }
  const executeRaw = vi.fn()
  const tx = { account, $executeRaw: executeRaw }
  return {
    account,
    executeRaw,
    prisma: {
      account,
      $executeRaw: executeRaw,
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  }
})
vi.mock('../../src/lib/prisma', () => ({ prisma: db.prisma }))

const { GET: listAccounts, POST: createAccount } = await import('../../app/api/accounts/route')
const { PUT: updateAccount, DELETE: deleteAccount } = await import('../../app/api/accounts/[id]/route')
const { GET: getPassword } = await import('../../app/api/accounts/[id]/password/route')
const { POST: exportAccounts } = await import('../../app/api/accounts/export/route')
const { POST: importAccounts } = await import('../../app/api/accounts/import/route')

const row = (id: number, username: string, password = 'secret-pass') => ({
  id,
  username,
  password,
  nickname: `Nick ${id}`,
  gold: '',
  level: '',
  rank: '',
  status: '',
  heroes: ['Nakroth'],
  heroNamesNormalized: ['nakroth'],
  note: '',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-02T00:00:00Z'),
})

let cookie = ''
beforeAll(async () => {
  process.env.AUTH_SESSION_SECRET = TEST_SECRET
  process.env.AUTH_OWNER_PASSWORD_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA'
  cookie = await sessionCookie({ authAgoSeconds: 3600 })
})
afterAll(() => {
  delete process.env.AUTH_SESSION_SECRET
  delete process.env.AUTH_OWNER_PASSWORD_HASH
})
beforeEach(() => {
  vi.clearAllMocks()
  db.prisma.$transaction.mockImplementation(async (fn) => fn({ account: db.account, $executeRaw: db.executeRaw }))
})

describe('authentication on every account route', () => {
  it('returns 401 without a session and never touches the database', async () => {
    const responses = await Promise.all([
      listAccounts(makeRequest('/api/accounts')),
      createAccount(makeRequest('/api/accounts', { method: 'POST', body: { username: 'a', heroes: ['Nakroth'] } })),
      updateAccount(makeRequest('/api/accounts/1', { method: 'PUT', body: {} }), routeContext('1')),
      deleteAccount(makeRequest('/api/accounts/1', { method: 'DELETE' }), routeContext('1')),
      getPassword(makeRequest('/api/accounts/1/password'), routeContext('1')),
      exportAccounts(makeRequest('/api/accounts/export', { method: 'POST', body: {} })),
      importAccounts(makeRequest('/api/accounts/import', { method: 'POST', body: { mode: 'merge', accounts: [] } })),
    ])
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401])
    expect(db.account.findMany).not.toHaveBeenCalled()
    expect(db.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects forged and expired cookies', async () => {
    const forged = cookie.slice(0, -4) + 'AAAA'
    expect((await listAccounts(makeRequest('/api/accounts', { cookie: forged }))).status).toBe(401)
    const expired = await sessionCookie({ now: Math.floor(Date.now() / 1000) - 13 * 3600 })
    expect((await listAccounts(makeRequest('/api/accounts', { cookie: expired }))).status).toBe(401)
    const otherSecret = await sessionCookie({ secret: 'z'.repeat(48) })
    expect((await listAccounts(makeRequest('/api/accounts', { cookie: otherSecret }))).status).toBe(401)
  })

  it('blocks cross-site reads and CSRF writes', async () => {
    expect((await listAccounts(makeRequest('/api/accounts', { cookie, fetchSite: 'cross-site' }))).status).toBe(403)
    const body = { username: 'csrf', heroes: ['Nakroth'] }
    expect((await createAccount(makeRequest('/api/accounts', { method: 'POST', body, cookie, contentType: 'text/plain' }))).status).toBe(415)
    expect((await createAccount(makeRequest('/api/accounts', { method: 'POST', body, cookie, origin: 'https://evil.example' }))).status).toBe(403)
    expect((await deleteAccount(makeRequest('/api/accounts/1', { method: 'DELETE', cookie, origin: null }), routeContext('1'))).status).toBe(403)
    expect(db.account.create).not.toHaveBeenCalled()
    expect(db.account.delete).not.toHaveBeenCalled()
  })
})

describe('GET /api/accounts', () => {
  it('never returns passwords in the list', async () => {
    db.account.findMany.mockResolvedValue([row(1, 'demo.a'), row(2, 'demo.b', '')])
    const response = await listAccounts(makeRequest('/api/accounts', { cookie }))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).not.toContain('secret-pass')
    const { accounts } = JSON.parse(text)
    expect(accounts[0]).not.toHaveProperty('password')
    expect(accounts.map((account: { hasPassword: boolean }) => account.hasPassword)).toEqual([true, false])
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('reports database failures as an error, not as an empty list', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    db.account.findMany.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED db.internal:5432 user=demo.a'), { code: 'P1001' }))
    const response = await listAccounts(makeRequest('/api/accounts', { cookie }))
    expect(response.status).toBe(500)
    const text = await response.text()
    expect(text).not.toContain('ECONNREFUSED')
    expect(text).not.toContain('accounts')
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('demo.a')
    consoleError.mockRestore()
  })
})

describe('create / update / delete', () => {
  it('creates an account and rejects case-insensitive duplicates', async () => {
    db.account.findFirst.mockResolvedValueOnce(null)
    db.account.create.mockImplementation(async ({ data }) => ({ ...row(9, data.username), ...data }))
    const created = await createAccount(makeRequest('/api/accounts', { method: 'POST', cookie, body: { username: ' New.User ', password: '', heroes: ['Lữ Bố', 'lu bo', ' Nakroth '] } }))
    expect(created.status).toBe(201)
    expect(db.account.create.mock.calls[0][0].data).toMatchObject({ username: 'New.User', heroes: ['Lữ Bố', 'Nakroth'], heroNamesNormalized: ['lu bo', 'nakroth'] })

    db.account.findFirst.mockResolvedValueOnce({ id: 3 })
    const duplicate = await createAccount(makeRequest('/api/accounts', { method: 'POST', cookie, body: { username: 'NEW.USER', heroes: ['Nakroth'] } }))
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json()).code).toBe('USERNAME_TAKEN')
  })

  it('returns a generic 400 for invalid JSON instead of the parser message', async () => {
    const response = await createAccount(makeRequest('/api/accounts', { method: 'POST', cookie, rawBody: '{bad json' }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('Dữ liệu gửi lên không phải JSON hợp lệ.')
  })

  it('keeps the stored password when an update omits it', async () => {
    db.account.findFirst.mockResolvedValue(null)
    db.account.update.mockResolvedValue(row(4, 'demo.c'))
    await updateAccount(makeRequest('/api/accounts/4', { method: 'PUT', cookie, body: { username: 'demo.c', heroes: ['Nakroth'] } }), routeContext('4'))
    expect(db.account.update.mock.calls[0][0].data).not.toHaveProperty('password')
    await updateAccount(makeRequest('/api/accounts/4', { method: 'PUT', cookie, body: { username: 'demo.c', password: 'moi', heroes: ['Nakroth'] } }), routeContext('4'))
    expect(db.account.update.mock.calls[1][0].data.password).toBe('moi')
  })

  it('keeps optional fields that the update body omits instead of blanking them', async () => {
    db.account.findFirst.mockResolvedValue(null)
    db.account.update.mockResolvedValue(row(4, 'demo.c'))
    await updateAccount(makeRequest('/api/accounts/4', { method: 'PUT', cookie, body: { username: 'demo.c', nickname: 'Mới', heroes: ['Nakroth'] } }), routeContext('4'))
    const data = db.account.update.mock.calls[0][0].data
    expect(data).toMatchObject({ username: 'demo.c', nickname: 'Mới', heroes: ['Nakroth'], heroNamesNormalized: ['nakroth'] })
    for (const kept of ['gold', 'level', 'rank', 'status', 'note', 'password']) expect(data).not.toHaveProperty(kept)
  })

  it('maps missing records and bad ids', async () => {
    db.account.delete.mockRejectedValue(Object.assign(new Error('Record not found'), { code: 'P2025' }))
    expect((await deleteAccount(makeRequest('/api/accounts/99', { method: 'DELETE', cookie }), routeContext('99'))).status).toBe(404)
    expect((await deleteAccount(makeRequest('/api/accounts/abc', { method: 'DELETE', cookie }), routeContext('abc'))).status).toBe(400)
    expect((await deleteAccount(makeRequest('/api/accounts/1e3', { method: 'DELETE', cookie }), routeContext('1e3'))).status).toBe(400)
  })
})

describe('password and export', () => {
  it('returns one password on demand with no-store', async () => {
    db.account.findUnique.mockResolvedValue({ password: 'only-this' })
    const response = await getPassword(makeRequest('/api/accounts/5/password', { cookie }), routeContext('5'))
    expect(await response.json()).toEqual({ password: 'only-this' })
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('exports without passwords by default and requires re-auth to include them', async () => {
    db.account.findMany.mockResolvedValue([row(1, 'demo.a')])
    const plain = await exportAccounts(makeRequest('/api/accounts/export', { method: 'POST', cookie, body: {} }))
    expect(JSON.stringify(await plain.json())).not.toContain('secret-pass')

    const stale = await exportAccounts(makeRequest('/api/accounts/export', { method: 'POST', cookie, body: { includePasswords: true } }))
    expect(stale.status).toBe(403)
    expect((await stale.json()).code).toBe('REAUTH_REQUIRED')

    const fresh = await sessionCookie({ authAgoSeconds: 10 })
    const full = await exportAccounts(makeRequest('/api/accounts/export', { method: 'POST', cookie: fresh, body: { includePasswords: true } }))
    expect((await full.json()).accounts[0].password).toBe('secret-pass')
  })
})

describe('POST /api/accounts/import', () => {
  const accounts = [{ username: 'demo.new', password: 'x', heroes: ['Nakroth'] }]

  it('replace needs recent re-auth, the confirmation phrase and a matching count', async () => {
    const stale = await importAccounts(makeRequest('/api/accounts/import', { method: 'POST', cookie, body: { mode: 'replace', accounts } }))
    expect(stale.status).toBe(403)

    const fresh = await sessionCookie({ authAgoSeconds: 5 })
    const noPhrase = await importAccounts(makeRequest('/api/accounts/import', { method: 'POST', cookie: fresh, body: { mode: 'replace', accounts } }))
    expect(noPhrase.status).toBe(400)
    expect((await noPhrase.json()).code).toBe('CONFIRMATION_REQUIRED')

    db.account.count.mockResolvedValue(7)
    const mismatch = await importAccounts(makeRequest('/api/accounts/import', {
      method: 'POST', cookie: fresh, body: { mode: 'replace', accounts, confirm: { phrase: 'thay thế', expectedCount: 5 } },
    }))
    expect(mismatch.status).toBe(409)
    expect(db.account.deleteMany).not.toHaveBeenCalled()

    db.account.createMany.mockResolvedValue({ count: 1 })
    const ok = await importAccounts(makeRequest('/api/accounts/import', {
      method: 'POST', cookie: fresh, body: { mode: 'replace', accounts, confirm: { phrase: 'THAY THẾ', expectedCount: 7 } },
    }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ mode: 'replace', deleted: 7, created: 1 })
    expect(db.executeRaw).toHaveBeenCalled()
  })

  it('the legacy `replace: true` flag cannot bypass the confirmation', async () => {
    const fresh = await sessionCookie({ authAgoSeconds: 5 })
    const response = await importAccounts(makeRequest('/api/accounts/import', { method: 'POST', cookie: fresh, body: { replace: true, accounts } }))
    expect(response.status).toBe(400)
    expect(db.account.deleteMany).not.toHaveBeenCalled()
  })

  it('surfaces a failure inside the transaction as an error (rollback) without leaking details', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fresh = await sessionCookie({ authAgoSeconds: 5 })
    db.account.count.mockResolvedValue(1)
    db.account.createMany.mockRejectedValue(new Error('insert failed for demo.new'))
    const response = await importAccounts(makeRequest('/api/accounts/import', {
      method: 'POST', cookie: fresh, body: { mode: 'replace', accounts, confirm: { phrase: 'THAY THẾ', expectedCount: 1 } },
    }))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('demo.new')
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('demo.new')
    consoleError.mockRestore()
  })

  it('rejects oversized payloads', async () => {
    const big = Array.from({ length: 2001 }, (_, index) => ({ username: `u${index}`, heroes: ['Nakroth'] }))
    const response = await importAccounts(makeRequest('/api/accounts/import', { method: 'POST', cookie, body: { mode: 'merge', accounts: big } }))
    expect(response.status).toBe(413)
  })
})
