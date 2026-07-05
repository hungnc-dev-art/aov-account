import type { Account, AccountDraft, ImportResult } from '../types'

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? 'Không thể xử lý yêu cầu.')
  }
  return payload
}

export async function listAccounts(): Promise<Account[]> {
  const response = await fetch('/api/accounts', { cache: 'no-store' })
  const payload = await readJson<{ accounts: Account[] }>(response)
  return payload.accounts
}

export async function createAccount(
  draft: AccountDraft | Account,
): Promise<Account> {
  const response = await fetch('/api/accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  })
  const payload = await readJson<{ account: Account }>(response)
  return payload.account
}

export async function updateAccount(
  id: number,
  draft: AccountDraft | Account,
): Promise<Account> {
  const response = await fetch(`/api/accounts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  })
  const payload = await readJson<{ account: Account }>(response)
  return payload.account
}

export async function deleteAccount(id: number): Promise<void> {
  await readJson<{ success: boolean }>(
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' }),
  )
}

export async function importAccounts(
  result: ImportResult,
  replace: boolean,
): Promise<number> {
  const response = await fetch('/api/accounts/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accounts: result.accounts, replace }),
  })
  const payload = await readJson<{ imported: number }>(response)
  return payload.imported
}
