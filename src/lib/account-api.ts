// Lớp gọi API từ Client Component. Mọi lỗi trở thành ApiError có status + code,
// kể cả khi server trả body không phải JSON (B3).
import type { Account, AccountDraft, AccountExportRow, AccountImportRow, ImportMode, ImportSummary } from '../types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export const isApiError = (error: unknown, code?: string): error is ApiError =>
  error instanceof ApiError && (!code || error.code === code)

let unauthorizedHandler: (() => void) | null = null
/** Đăng ký hành động khi phiên hết hạn (chuyển về trang đăng nhập). */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
  }
  const payload = (await response.json().catch(() => null)) as (T & { error?: string; code?: string }) | null
  if (!response.ok) {
    const code = payload?.code ?? (response.status === 401 ? 'UNAUTHENTICATED' : 'HTTP_ERROR')
    if (code === 'UNAUTHENTICATED') unauthorizedHandler?.()
    const fallback = response.status >= 500
      ? 'Máy chủ gặp lỗi. Dữ liệu chưa bị thay đổi, vui lòng thử lại sau.'
      : 'Không thể xử lý yêu cầu.'
    throw new ApiError(response.status, code, payload?.error ?? fallback)
  }
  if (payload === null) throw new ApiError(response.status, 'INVALID_RESPONSE', 'Máy chủ trả dữ liệu không hợp lệ.')
  return payload
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export async function listAccounts(): Promise<Account[]> {
  return (await request<{ accounts: Account[] }>('/api/accounts')).accounts
}

export async function createAccount(draft: AccountDraft & Partial<AccountImportRow>): Promise<Account> {
  return (await post<{ account: Account }>('/api/accounts', draft)).account
}

export async function updateAccount(id: number, draft: AccountDraft & Partial<AccountImportRow>): Promise<Account> {
  return (await request<{ account: Account }>(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(draft) })).account
}

export async function deleteAccount(id: number): Promise<void> {
  await request<{ success: boolean }>(`/api/accounts/${id}`, { method: 'DELETE' })
}

export async function fetchPassword(id: number): Promise<string> {
  return (await request<{ password: string }>(`/api/accounts/${id}/password`)).password
}

export async function exportAccounts(includePasswords: boolean): Promise<AccountExportRow[]> {
  return (await post<{ accounts: AccountExportRow[] }>('/api/accounts/export', { includePasswords })).accounts
}

export async function importAccounts(input: {
  mode: ImportMode
  accounts: AccountImportRow[]
  confirm?: { phrase: string; expectedCount: number }
}): Promise<ImportSummary> {
  return post<ImportSummary>('/api/accounts/import', input)
}

export async function reauthenticate(password: string): Promise<void> {
  await post<{ ok: boolean }>('/api/auth/reauth', { password })
}

export async function logout(): Promise<void> {
  await post<{ ok: boolean }>('/api/auth/logout', {})
}
