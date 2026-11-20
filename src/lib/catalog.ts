import { heroes } from '../data/heroes'
import type { Account, Hero, HeroRole } from '../types'
import { normalizeText } from '../utils/normalize'

export const ROLES: HeroRole[] = ['Đấu sĩ', 'Đỡ đòn', 'Pháp sư', 'Sát thủ', 'Trợ thủ', 'Xạ thủ']
export const allHeroes: Hero[] = heroes
export const heroByNormalized = new Map(allHeroes.map((hero) => [hero.normalizedName, hero]))
export const heroById = new Map(allHeroes.map((hero) => [hero.id, hero]))

export function findHero(name: string): Hero | undefined {
  return heroByNormalized.get(normalizeText(name))
}

/** Index tướng → tài khoản (derived state, không lưu DB). Mỗi tài khoản xuất hiện tối đa 1 lần / tướng. */
export function buildOwnerIndex(accounts: Account[]): Map<string, Account[]> {
  const index = new Map<string, Account[]>()
  for (const account of accounts) {
    for (const name of new Set(account.heroNamesNormalized)) {
      const owners = index.get(name)
      if (owners) owners.push(account)
      else index.set(name, [account])
    }
  }
  return index
}

export function accountLabel(account: Pick<Account, 'nickname' | 'username'>): string {
  return account.nickname || account.username
}
