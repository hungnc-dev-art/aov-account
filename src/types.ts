export type HeroRole =
  | 'Đấu sĩ'
  | 'Đỡ đòn'
  | 'Pháp sư'
  | 'Sát thủ'
  | 'Trợ thủ'
  | 'Xạ thủ'

export interface HeroSkill {
  name: string
  description: string
  iconUrl?: string
}

export interface Hero {
  id: string
  name: string
  normalizedName: string
  roles: HeroRole[]
  imageUrl?: string
  sourceUrl: string
  skills: HeroSkill[]
}

export interface Account {
  id?: number
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
  createdAt: string
  updatedAt: string
}

export interface AccountDraft {
  username: string
  password: string
  nickname: string
  heroes: string[]
}

export interface ImportResult {
  accounts: Account[]
  errors: string[]
  sourceSheet: string
}
