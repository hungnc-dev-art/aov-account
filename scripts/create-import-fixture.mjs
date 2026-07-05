import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const fixtureDirectory = new URL('../test/fixtures/', import.meta.url)
const fixturePath = new URL('import-accounts.xlsx', fixtureDirectory)

await mkdir(fixtureDirectory, { recursive: true })

const rows = [
  ['username', 'password', 'nickname', 'heroes'],
  ['codex-import-fixture-01', '', 'Fixture 01', 'Nakroth, Krixi'],
  ['codex-import-fixture-02', 'fixture-only', 'Fixture 02', 'Điêu Thuyền'],
]
const worksheet = XLSX.utils.aoa_to_sheet(rows)
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts')
XLSX.writeFile(workbook, fileURLToPath(fixturePath))

console.log('Đã tạo test/fixtures/import-accounts.xlsx')
