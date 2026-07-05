import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWorkbook } from './excel'

describe('Excel matrix parser', () => {
  it('parses accounts stored in columns and heroes stored in rows', () => {
    const rows = [
      [null, null, 'Tên đăng nhập', 'account01', 'account02'],
      [null, null, 'Tên nick', 'Rừng', 'Mid'],
      [null, null, 'MK', 'secret', ''],
      ['STT', 'Tên Tướng', 'Vai Trò', null, null],
      [1, 'Nakroth', 'Sát thủ', 'x', null],
      [2, 'Krixi', 'Pháp sư', null, 'x'],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet3')

    const result = parseWorkbook(workbook)

    expect(result.sourceSheet).toBe('Sheet3')
    expect(result.accounts).toHaveLength(2)
    expect(result.accounts[0].heroes).toEqual(['Nakroth'])
    expect(result.accounts[1].nickname).toBe('Mid')
    expect(result.errors).toContain('Account account02 chưa có mật khẩu.')
  })

  it('skips rows without heroes and reports a clear warning', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['username', 'password', 'heroes'],
      ['valid-account', 'secret', 'Nakroth'],
      ['missing-heroes', 'secret', ''],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts')

    const result = parseWorkbook(workbook)

    expect(result.accounts.map((account) => account.username)).toEqual([
      'valid-account',
    ])
    expect(result.errors).toContain(
      'Bỏ qua account missing-heroes: chưa có tướng.',
    )
  })
})
