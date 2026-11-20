import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWorkbook, usernameDedupeKey, validateExcelFile } from './excel'

const workbookFrom = (sheets: Record<string, unknown[][]>) => {
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  return workbook
}

describe('Excel matrix parser', () => {
  it('parses accounts stored in columns and heroes stored in rows', () => {
    const result = parseWorkbook(workbookFrom({
      Sheet3: [
        [null, null, 'Tên đăng nhập', 'account01', 'account02'],
        [null, null, 'Tên nick', 'Rừng', 'Mid'],
        [null, null, 'MK', 'secret', ''],
        ['STT', 'Tên Tướng', 'Vai Trò', null, null],
        [1, 'Nakroth', 'Sát thủ', 'x', null],
        [2, 'Krixi', 'Pháp sư', null, 'x'],
      ],
    }))

    expect(result.sourceSheet).toBe('Sheet3')
    expect(result.accounts).toHaveLength(2)
    expect(result.accounts[0].heroes).toEqual(['Nakroth'])
    expect(result.accounts[1].nickname).toBe('Mid')
    expect(result.errors).toContain('Tài khoản account02 chưa có mật khẩu.')
  })

  it('skips rows without heroes and reports a clear warning', () => {
    const result = parseWorkbook(workbookFrom({
      Accounts: [
        ['username', 'password', 'heroes'],
        ['valid-account', 'secret', 'Nakroth'],
        ['missing-heroes', 'secret', ''],
      ],
    }))
    expect(result.accounts.map((account) => account.username)).toEqual(['valid-account'])
    expect(result.errors).toContain('Bỏ qua tài khoản missing-heroes: chưa có tướng.')
  })

  it('dedupes usernames by trim + lowercase only, keeping punctuation variants (B10)', () => {
    const result = parseWorkbook(workbookFrom({
      Accounts: [
        ['username', 'password', 'heroes'],
        ['fixture.a', 'p', 'Nakroth'],
        ['fixture-a', 'p', 'Nakroth'],
        ['Fixture_A', 'p', 'Nakroth'],
        [' FIXTURE.A ', 'p', 'Nakroth'],
        ['tài.khoản', 'p', 'Nakroth'],
        ['tai-khoan', 'p', 'Nakroth'],
      ],
    }))
    expect(result.accounts.map((account) => account.username)).toEqual(['fixture.a', 'fixture-a', 'Fixture_A', 'tài.khoản', 'tai-khoan'])
    expect(result.errors).toContain('Bỏ qua username trùng trong file: FIXTURE.A')
    expect(usernameDedupeKey('  User.One ')).toBe('user.one')
  })

  it('picks the most complete sheet in a multi-sheet workbook and accepts all ownership markers', () => {
    const result = parseWorkbook(workbookFrom({
      Notes: [['ghi chú'], ['không có bảng']],
      Data: [
        ['STT', 'Username', 'Mật khẩu', 'Nakroth', 'Krixi', 'Điêu Thuyền'],
        [1, 'row-a', 'p', 'x', 'có', 'TRUE'],
        [2, 'row-b', '', '1', 'yes', ''],
      ],
    }))
    expect(result.sourceSheet).toBe('Data')
    expect(result.accounts[0].heroes).toEqual(['Nakroth', 'Krixi', 'Điêu Thuyền'])
    expect(result.accounts[1].heroes).toEqual(['Nakroth', 'Krixi'])
  })

  it('does not include timestamps or normalized fields in import rows', () => {
    const result = parseWorkbook(workbookFrom({ A: [['username', 'heroes'], ['u1', 'Nakroth, Lữ Bố']] }))
    expect(Object.keys(result.accounts[0]).sort()).toEqual(['gold', 'heroes', 'level', 'nickname', 'note', 'password', 'rank', 'status', 'username'])
  })
})

describe('validateExcelFile', () => {
  const zipHeader = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]
  const file = (name: string, bytes: number[] | string, size?: number) => {
    const content = typeof bytes === 'string' ? bytes : new Uint8Array(bytes)
    const blob = new File([content], name)
    return size ? Object.defineProperty(blob, 'size', { value: size }) : blob
  }

  it('accepts real spreadsheet signatures', async () => {
    await expect(validateExcelFile(file('kho.xlsx', zipHeader))).resolves.toBeNull()
    await expect(validateExcelFile(file('kho.xls', [0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).resolves.toBeNull()
    await expect(validateExcelFile(file('kho.csv', 'username,heroes\nu,Nakroth'))).resolves.toBeNull()
  })

  it('rejects wrong extensions, disguised files and oversized files', async () => {
    await expect(validateExcelFile(file('kho.exe', zipHeader))).resolves.toMatch('Chỉ hỗ trợ')
    await expect(validateExcelFile(file('kho.xlsx', '<html>not excel</html>'))).resolves.toMatch('không đúng định dạng')
    await expect(validateExcelFile(file('kho.csv', [0x41, 0x00, 0x42]))).resolves.toMatch('nhị phân')
    await expect(validateExcelFile(file('kho.xlsx', zipHeader, 6 * 1024 * 1024))).resolves.toMatch('lớn hơn')
    await expect(validateExcelFile(file('kho.xlsx', []))).resolves.toBe('File rỗng.')
  })
})
