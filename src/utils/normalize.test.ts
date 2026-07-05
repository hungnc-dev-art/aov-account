import { describe, expect, it } from 'vitest'
import { fuzzyMatch, normalizeText, splitHeroes } from './normalize'

describe('normalize helpers', () => {
  it('removes Vietnamese accents and normalizes spacing', () => {
    expect(normalizeText('  Điêu   Thuyền ')).toBe('dieu thuyen')
  })

  it('splits and deduplicates hero names', () => {
    expect(splitHeroes('Valhein, Krixi\nvalhein; Ngộ Không')).toEqual([
      'Valhein',
      'Krixi',
      'Ngộ Không',
    ])
  })

  it('supports a small typing mistake', () => {
    expect(fuzzyMatch('nakroth', 'nakroht')).toBe(true)
  })
})
