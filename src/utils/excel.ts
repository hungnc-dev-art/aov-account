import * as XLSX from 'xlsx'
import type { Account, ImportResult } from '../types'
import { normalizeText, splitHeroes } from './normalize'

type Cell = string | number | boolean | Date | null | undefined
type Row = Cell[]

const USERNAME_KEYS = ['ten dang nhap', 'username', 'tai khoan', 'account']
const PASSWORD_KEYS = ['mat khau', 'password', 'mk']
const HERO_KEYS = ['tuong', 'danh sach tuong', 'heroes', 'hero']

function cellText(value: Cell): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizedCell(value: Cell): string {
  return normalizeText(cellText(value))
}

function findCell(rows: Row[], keys: string[], maxRows = rows.length) {
  for (let row = 0; row < Math.min(maxRows, rows.length); row += 1) {
    for (let column = 0; column < rows[row].length; column += 1) {
      if (keys.includes(normalizedCell(rows[row][column]))) return { row, column }
    }
  }
  return undefined
}

function isOwnershipMarker(value: Cell): boolean {
  return ['x', '1', 'co', 'yes', 'true'].includes(normalizedCell(value))
}

function createAccount(
  input: Partial<Account> & Pick<Account, 'username' | 'password' | 'heroes'>,
): Account {
  const timestamp = new Date().toISOString()
  const heroes = splitHeroes(input.heroes.join(','))

  return {
    username: input.username.trim(),
    password: input.password,
    nickname: input.nickname ?? '',
    gold: input.gold ?? '',
    level: input.level ?? '',
    rank: input.rank ?? '',
    status: input.status ?? '',
    heroes,
    heroNamesNormalized: heroes.map(normalizeText),
    note: input.note ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function parseColumnMatrix(rows: Row[]): Account[] {
  const usernameCell = findCell(rows, USERNAME_KEYS, 12)
  const heroCell = findCell(rows, ['ten tuong'], 15)
  if (!usernameCell || !heroCell || usernameCell.row >= heroCell.row) return []

  const accountStartColumn = usernameCell.column + 1
  const metadataRows = new Map<string, number>()

  for (let row = 0; row < heroCell.row; row += 1) {
    const label = normalizedCell(rows[row][usernameCell.column])
    if (label) metadataRows.set(label, row)
  }

  const rowFor = (...keys: string[]) => {
    for (const key of keys) {
      const row = metadataRows.get(key)
      if (row !== undefined) return row
    }
    return undefined
  }

  const passwordRow = rowFor(...PASSWORD_KEYS)
  const nicknameRow = rowFor('ten nick', 'nickname')
  const goldRow = rowFor('vang', 'gold')
  const levelRow = rowFor('level', 'cap')
  const rankRow = rowFor('rank', 'hang')
  const statusRow = rowFor('tinh trang', 'status')
  const heroRows = rows
    .slice(heroCell.row + 1)
    .filter((row) => cellText(row[heroCell.column]))

  const accounts: Account[] = []
  for (
    let column = accountStartColumn;
    column < rows[usernameCell.row].length;
    column += 1
  ) {
    const username = cellText(rows[usernameCell.row][column])
    if (!username) continue

    const readMetadata = (row: number | undefined) =>
      row === undefined ? '' : cellText(rows[row][column])

    accounts.push(
      createAccount({
        username,
        password: readMetadata(passwordRow),
        nickname: readMetadata(nicknameRow),
        gold: readMetadata(goldRow),
        level: readMetadata(levelRow),
        rank: readMetadata(rankRow),
        status: readMetadata(statusRow),
        heroes: heroRows
          .filter((row) => isOwnershipMarker(row[column]))
          .map((row) => cellText(row[heroCell.column])),
      }),
    )
  }

  return accounts
}

function parseRowMatrix(rows: Row[]): Account[] {
  const usernameCell = findCell(rows, USERNAME_KEYS, 12)
  if (!usernameCell) return []

  const header = rows[usernameCell.row]
  const passwordColumn = header.findIndex((cell) =>
    PASSWORD_KEYS.includes(normalizedCell(cell)),
  )
  const knownMetadata = new Set([
    'stt',
    ...USERNAME_KEYS,
    ...PASSWORD_KEYS,
    'ten nick',
    'vang',
    'gold',
    'level',
    'hang',
    'rank',
    'tinh trang',
    'status',
    'ghi chu',
    'note',
  ])
  const heroColumns = header
    .map((cell, column) => ({ name: cellText(cell), column }))
    .filter(({ name, column }) => column > usernameCell.column && name)
    .filter(({ name }) => !knownMetadata.has(normalizeText(name)))

  return rows
    .slice(usernameCell.row + 1)
    .filter((row) => cellText(row[usernameCell.column]))
    .map((row) =>
      createAccount({
        username: cellText(row[usernameCell.column]),
        password: passwordColumn >= 0 ? cellText(row[passwordColumn]) : '',
        heroes: heroColumns
          .filter(({ column }) => isOwnershipMarker(row[column]))
          .map(({ name }) => name),
      }),
    )
}

function parseFlatTable(rows: Row[]): Account[] {
  const usernameCell = findCell(rows, USERNAME_KEYS, 12)
  if (!usernameCell) return []
  const header = rows[usernameCell.row].map(normalizedCell)
  const findColumn = (keys: string[]) => header.findIndex((cell) => keys.includes(cell))
  const usernameColumn = findColumn(USERNAME_KEYS)
  const passwordColumn = findColumn(PASSWORD_KEYS)
  const heroesColumn = findColumn(HERO_KEYS)
  if (usernameColumn < 0 || heroesColumn < 0) return []

  return rows
    .slice(usernameCell.row + 1)
    .filter((row) => cellText(row[usernameColumn]))
    .map((row) =>
      createAccount({
        username: cellText(row[usernameColumn]),
        password: passwordColumn >= 0 ? cellText(row[passwordColumn]) : '',
        heroes: splitHeroes(cellText(row[heroesColumn])),
      }),
    )
}

function accountScore(accounts: Account[]): number {
  return (
    accounts.length * 5 +
    accounts.filter((account) => account.password).length * 3 +
    accounts.reduce((total, account) => total + account.heroes.length, 0)
  )
}

export function parseWorkbook(workbook: XLSX.WorkBook): ImportResult {
  const candidates = workbook.SheetNames.map((sourceSheet) => {
    const sheet = workbook.Sheets[sourceSheet]
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
      header: 1,
      defval: null,
      raw: false,
      blankrows: false,
    })
    const hasColumnMatrix =
      Boolean(findCell(rows, ['ten tuong'], 15)) &&
      Boolean(findCell(rows, USERNAME_KEYS, 12))
    const parsers = hasColumnMatrix
      ? [parseColumnMatrix]
      : [parseFlatTable, parseRowMatrix]
    const parsed = parsers
      .map((parser) => parser(rows))
      .sort((first, second) => accountScore(second) - accountScore(first))[0]
    return { sourceSheet, accounts: parsed }
  }).sort((first, second) => accountScore(second.accounts) - accountScore(first.accounts))

  const best = candidates[0]
  if (!best?.accounts.length) {
    return {
      accounts: [],
      errors: [
        'Không tìm thấy bảng account hợp lệ. Cần có username và danh sách tướng.',
      ],
      sourceSheet: '',
    }
  }

  const seen = new Set<string>()
  const errors: string[] = []
  const accounts = best.accounts.filter((account, index) => {
    const key = normalizeText(account.username)
    if (!key) {
      errors.push(`Bỏ qua dòng ${index + 1}: thiếu tên đăng nhập.`)
      return false
    }
    if (seen.has(key)) {
      errors.push(`Bỏ qua username trùng: ${account.username}`)
      return false
    }
    seen.add(key)
    if (!account.heroes.length) {
      errors.push(`Bỏ qua account ${account.username}: chưa có tướng.`)
      return false
    }
    if (!account.password) {
      errors.push(`Account ${account.username} chưa có mật khẩu.`)
    }
    return true
  })

  return { accounts, errors, sourceSheet: best.sourceSheet }
}

export async function parseExcelFile(file: File): Promise<ImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer())
  return parseWorkbook(workbook)
}

export function exportAccountsToExcel(accounts: Account[]): void {
  const rows = accounts.map((account, index) => ({
    STT: index + 1,
    username: account.username,
    password: account.password,
    nickname: account.nickname,
    gold: account.gold,
    level: account.level,
    rank: account.rank,
    status: account.status,
    heroes: account.heroes.join(', '),
    note: account.note,
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts')
  XLSX.writeFile(workbook, `lien-quan-backup-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
