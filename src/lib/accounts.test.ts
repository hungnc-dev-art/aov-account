import { describe, expect, it } from 'vitest'
import { normalizeAccountInput, parseAccountId, usernameKey } from './accounts'

describe('normalizeAccountInput', () => {
  it('normalizes a valid account without exposing generated fields', () => {
    expect(
      normalizeAccountInput({
        username: '  fixture-user  ',
        password: '',
        nickname: '  Fixture  ',
        heroes: [' Điêu Thuyền ', 'Nakroth'],
      }),
    ).toEqual({
      username: 'fixture-user',
      password: '',
      nickname: 'Fixture',
      gold: '',
      level: '',
      rank: '',
      status: '',
      heroes: ['Điêu Thuyền', 'Nakroth'],
      heroNamesNormalized: ['dieu thuyen', 'nakroth'],
      note: '',
    })
  })

  it('rejects a row without username with a clear error', () => {
    expect(() => normalizeAccountInput({ heroes: ['Nakroth'] })).toThrow(
      'Tên đăng nhập là bắt buộc.',
    )
  })

  it('rejects invalid hero data before calling Prisma', () => {
    expect(() =>
      normalizeAccountInput({ username: 'fixture-user', heroes: [null] }),
    ).toThrow('Tên tướng ở vị trí 1 phải là chuỗi.')
  })

  it('deduplicates heroes by normalized name and drops names that normalize to empty (B8)', () => {
    const result = normalizeAccountInput({
      username: 'fixture-user',
      heroes: ['Lữ Bố', 'lu bo', 'LỮ BỐ', '!!!', 'Điêu   Thuyền', 'dieu thuyen', 'Tướng Lạ'],
    })
    expect(result.heroes).toEqual(['Lữ Bố', 'Điêu Thuyền', 'Tướng Lạ'])
    expect(result.heroNamesNormalized).toEqual(['lu bo', 'dieu thuyen', 'tuong la'])
    expect(new Set(result.heroNamesNormalized).size).toBe(result.heroNamesNormalized.length)
  })

  it('rejects accounts whose heroes are all empty after normalization', () => {
    expect(() => normalizeAccountInput({ username: 'u', heroes: ['!!!', '   '] })).toThrow('Chọn ít nhất một tướng.')
  })

  it('enforces length limits and keeps password undefined only when optional', () => {
    expect(() => normalizeAccountInput({ username: 'x'.repeat(129), heroes: ['Nakroth'] })).toThrow('Tên đăng nhập dài quá')
    expect(() => normalizeAccountInput({ username: 'u', password: 'p'.repeat(257), heroes: ['Nakroth'] })).toThrow('Mật khẩu dài quá')
    expect(normalizeAccountInput({ username: 'u', heroes: ['Nakroth'] }, { passwordOptional: true }).password).toBeUndefined()
    expect(normalizeAccountInput({ username: 'u', heroes: ['Nakroth'] }).password).toBe('')
  })
})

describe('usernameKey / parseAccountId', () => {
  it('compares usernames by trim + lowercase only', () => {
    expect(usernameKey('  Demo.KHO01 ')).toBe('demo.kho01')
    expect(usernameKey('fixture-a')).not.toBe(usernameKey('fixture_a'))
  })

  it('accepts only positive integer ids', () => {
    expect(parseAccountId('42')).toBe(42)
    for (const bad of ['0', '-1', '1.5', '1e3', 'abc', '', '99999999999']) expect(parseAccountId(bad)).toBeUndefined()
  })
})
