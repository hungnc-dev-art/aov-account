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

/** Tài khoản trả về từ GET /api/accounts. KHÔNG chứa mật khẩu (lấy riêng khi xem/sao chép). */
export interface Account {
  id: number
  username: string
  nickname: string
  gold: string
  level: string
  rank: string
  status: string
  heroes: string[]
  heroNamesNormalized: string[]
  note: string
  hasPassword: boolean
  createdAt: string
  updatedAt: string
}

/** Dữ liệu form thêm/sửa. `password` bỏ trống (undefined) khi sửa = giữ nguyên. */
export interface AccountDraft {
  username: string
  password?: string
  nickname: string
  heroes: string[]
}

/** Một dòng đọc từ Excel / IndexedDB cũ, gửi lên POST /api/accounts/import. */
export interface AccountImportRow {
  username: string
  password: string
  nickname: string
  gold: string
  level: string
  rank: string
  status: string
  heroes: string[]
  note: string
}

export interface ImportResult {
  accounts: AccountImportRow[]
  errors: string[]
  sourceSheet: string
}

export type ImportMode = 'merge' | 'replace' | 'create-only'

export interface ImportSummary {
  mode: ImportMode
  received: number
  created: number
  updated: number
  skipped: number
  invalid: number
  deleted: number
  warnings: string[]
}

export interface AccountExportRow {
  username: string
  password?: string
  nickname: string
  gold: string
  level: string
  rank: string
  status: string
  heroes: string[]
  note: string
}
