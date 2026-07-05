import type { Account } from '../types'
import { normalizeText } from '../utils/normalize'

type AccountField =
  | 'password'
  | 'nickname'
  | 'gold'
  | 'level'
  | 'rank'
  | 'status'
  | 'note'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalString(
  input: Record<string, unknown>,
  field: AccountField,
): string {
  const value = input[field]
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') {
    throw new Error(`Trường ${field} phải là chuỗi.`)
  }
  return value
}

export function normalizeAccountInput(input: unknown) {
  if (!isRecord(input)) throw new Error('Dữ liệu account không hợp lệ.')

  const username =
    typeof input.username === 'string' ? input.username.trim() : ''
  if (!username) throw new Error('Tên đăng nhập là bắt buộc.')

  if (!Array.isArray(input.heroes)) {
    throw new Error('Danh sách tướng không hợp lệ.')
  }

  const heroes = [
    ...new Set(
      input.heroes.map((hero, index) => {
        if (typeof hero !== 'string') {
          throw new Error(`Tên tướng ở vị trí ${index + 1} phải là chuỗi.`)
        }
        return hero.trim()
      }),
    ),
  ].filter(Boolean)

  if (!heroes.length) throw new Error('Chọn ít nhất một tướng.')

  return {
    username,
    password: optionalString(input, 'password'),
    nickname: optionalString(input, 'nickname').trim(),
    gold: optionalString(input, 'gold'),
    level: optionalString(input, 'level'),
    rank: optionalString(input, 'rank'),
    status: optionalString(input, 'status'),
    heroes,
    heroNamesNormalized: heroes.map(normalizeText),
    note: optionalString(input, 'note'),
  }
}

export function serializeAccount(account: {
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
}): Account {
  return {
    ...account,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}
