import { describe, expect, it } from 'vitest'
import { normalizeAccountInput } from './accounts'

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
})
