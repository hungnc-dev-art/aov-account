import { normalizeText } from '../utils/normalize'
import { isRecord, ValidationError } from './http'

export const ACCOUNT_LIMITS = {
  username: 128,
  password: 256,
  nickname: 128,
  shortField: 64,
  note: 1000,
  heroName: 64,
  heroes: 300,
} as const

type OptionalField = 'nickname' | 'gold' | 'level' | 'rank' | 'status' | 'note'

const FIELD_LABELS: Record<OptionalField | 'password', string> = {
  password: 'Mật khẩu',
  nickname: 'Tên tài khoản',
  gold: 'Vàng',
  level: 'Level',
  rank: 'Rank',
  status: 'Tình trạng',
  note: 'Ghi chú',
}

const FIELD_MAX: Record<OptionalField, number> = {
  nickname: ACCOUNT_LIMITS.nickname,
  gold: ACCOUNT_LIMITS.shortField,
  level: ACCOUNT_LIMITS.shortField,
  rank: ACCOUNT_LIMITS.shortField,
  status: ACCOUNT_LIMITS.shortField,
  note: ACCOUNT_LIMITS.note,
}

export interface NormalizedAccountInput {
  username: string
  /** `undefined` chỉ xảy ra khi `passwordOptional` (giữ nguyên mật khẩu đang lưu). */
  password?: string
  nickname: string
  gold: string
  level: string
  rank: string
  status: string
  heroes: string[]
  heroNamesNormalized: string[]
  note: string
}

/** Khoá so sánh logic cho username: trim + lowercase (unique trong DB vẫn phân biệt hoa/thường). */
export function usernameKey(username: string): string {
  return username.trim().toLowerCase()
}

/**
 * Chuẩn hoá danh sách tướng: trim, gộp khoảng trắng, bỏ tên rỗng sau normalize,
 * loại trùng theo `normalizeText` (giữ tên hiển thị đầu tiên). Hai mảng luôn cùng thứ tự.
 */
export function dedupeHeroNames(names: readonly string[]): { heroes: string[]; heroNamesNormalized: string[] } {
  const heroes: string[] = []
  const heroNamesNormalized: string[] = []
  const seen = new Set<string>()
  for (const raw of names) {
    const display = raw.trim().replace(/\s+/g, ' ')
    const normalized = normalizeText(display)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    heroes.push(display)
    heroNamesNormalized.push(normalized)
  }
  return { heroes, heroNamesNormalized }
}

function optionalString(input: Record<string, unknown>, field: OptionalField | 'password', max: number): string {
  const value = input[field]
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ValidationError(`${FIELD_LABELS[field]} phải là chuỗi.`)
  if (value.length > max) throw new ValidationError(`${FIELD_LABELS[field]} dài quá ${max} ký tự.`)
  return value
}

export function normalizeAccountInput(input: unknown, options: { passwordOptional?: boolean } = {}): NormalizedAccountInput {
  if (!isRecord(input)) throw new ValidationError('Dữ liệu tài khoản không hợp lệ.')

  const username = typeof input.username === 'string' ? input.username.trim() : ''
  if (!username) throw new ValidationError('Tên đăng nhập là bắt buộc.')
  if (username.length > ACCOUNT_LIMITS.username) throw new ValidationError(`Tên đăng nhập dài quá ${ACCOUNT_LIMITS.username} ký tự.`)

  if (!Array.isArray(input.heroes)) throw new ValidationError('Danh sách tướng không hợp lệ.')
  if (input.heroes.length > ACCOUNT_LIMITS.heroes) throw new ValidationError(`Một tài khoản tối đa ${ACCOUNT_LIMITS.heroes} tướng.`)
  const names = input.heroes.map((hero, index) => {
    if (typeof hero !== 'string') throw new ValidationError(`Tên tướng ở vị trí ${index + 1} phải là chuỗi.`)
    if (hero.length > ACCOUNT_LIMITS.heroName) throw new ValidationError(`Tên tướng ở vị trí ${index + 1} quá dài.`)
    return hero
  })
  const { heroes, heroNamesNormalized } = dedupeHeroNames(names)
  if (!heroes.length) throw new ValidationError('Chọn ít nhất một tướng.')

  const password = options.passwordOptional && input.password === undefined
    ? undefined
    : optionalString(input, 'password', ACCOUNT_LIMITS.password)

  return {
    username,
    password,
    nickname: optionalString(input, 'nickname', FIELD_MAX.nickname).trim(),
    gold: optionalString(input, 'gold', FIELD_MAX.gold),
    level: optionalString(input, 'level', FIELD_MAX.level),
    rank: optionalString(input, 'rank', FIELD_MAX.rank),
    status: optionalString(input, 'status', FIELD_MAX.status),
    heroes,
    heroNamesNormalized,
    note: optionalString(input, 'note', FIELD_MAX.note),
  }
}

export interface AccountRow {
  id: number
  username: string
  password: string
  nickname: string
  gold: string
  level: string
  rank: string
  status: string
  heroes: string[]
  heroNamesNormalized: string[]
  note: string
  createdAt: Date
  updatedAt: Date
}

/** Dạng trả về client cho danh sách: KHÔNG kèm mật khẩu, chỉ có cờ `hasPassword`. */
export interface PublicAccount {
  id: number
  username: string
  nickname: string
  gold: string
  level: string
  rank: string
  status: string
  heroes: string[]
  heroNamesNormalized: string[]
  note: string
  hasPassword: boolean
  createdAt: string
  updatedAt: string
}

export function toPublicAccount(account: AccountRow): PublicAccount {
  return {
    id: account.id,
    username: account.username,
    nickname: account.nickname,
    gold: account.gold,
    level: account.level,
    rank: account.rank,
    status: account.status,
    heroes: account.heroes,
    heroNamesNormalized: account.heroNamesNormalized,
    note: account.note,
    hasPassword: account.password.length > 0,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

export function parseAccountId(value: string): number | undefined {
  if (!/^\d{1,10}$/.test(value)) return undefined
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}
