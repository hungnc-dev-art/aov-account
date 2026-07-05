import { useMemo, useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import type { Account, AccountDraft } from '../types'
import { heroes } from '../data/heroes'
import { normalizeText } from '../utils/normalize'
import { HeroAvatar } from './HeroAvatar'

interface AccountFormProps {
  account: Account | null
  open: boolean
  onClose: () => void
  onSave: (draft: AccountDraft) => Promise<void>
}

const emptyDraft: AccountDraft = {
  username: '',
  password: '',
  nickname: '',
  heroes: [],
}

export function AccountForm({ account, open, onClose, onSave }: AccountFormProps) {
  const [draft, setDraft] = useState<AccountDraft>(() =>
    account
      ? {
          username: account.username,
          password: account.password,
          nickname: account.nickname,
          heroes: account.heroes,
        }
      : emptyDraft,
  )
  const [heroQuery, setHeroQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredHeroes = useMemo(() => {
    const normalizedQuery = normalizeText(heroQuery)
    if (!normalizedQuery) return heroes
    return heroes.filter((hero) =>
      hero.normalizedName.includes(normalizedQuery),
    )
  }, [heroQuery])

  if (!open) return null

  const update = (
    field: 'username' | 'password' | 'nickname',
    value: string,
  ) =>
    setDraft((current) => ({ ...current, [field]: value }))

  const toggleHero = (heroName: string) => {
    setDraft((current) => ({
      ...current,
      heroes: current.heroes.includes(heroName)
        ? current.heroes.filter((name) => name !== heroName)
        : [...current.heroes, heroName],
    }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.heroes.length) return
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal account-form"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Quản lý account</p>
            <h2>{account ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className="form-grid">
          <label>
            <span className="field-label">
              Tên đăng nhập
              <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <input
              required
              value={draft.username}
              onChange={(event) => update('username', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Mật khẩu
            <input
              value={draft.password}
              onChange={(event) => update('password', event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="span-2">
            Tên tài khoản
            <input
              value={draft.nickname}
              onChange={(event) => update('nickname', event.target.value)}
            />
          </label>
        </div>

        <fieldset className="hero-picker">
          <div className="hero-picker__heading">
            <div>
              <legend>
                <span className="field-label">
                  Danh sách tướng
                  <span className="required-mark" aria-hidden="true">*</span>
                </span>
              </legend>
              <span>{draft.heroes.length} tướng đã chọn</span>
            </div>
            {draft.heroes.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({ ...current, heroes: [] }))
                }
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>

          <div className="hero-picker__search">
            <Search size={17} />
            <input
              value={heroQuery}
              onChange={(event) => setHeroQuery(event.target.value)}
              placeholder="Lọc theo tên tướng…"
            />
          </div>

          <div className="hero-checkbox-grid">
            {filteredHeroes.map((hero) => {
              const checked = draft.heroes.includes(hero.name)
              return (
                <label
                  className={`hero-checkbox ${checked ? 'hero-checkbox--checked' : ''}`}
                  key={hero.id}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleHero(hero.name)}
                  />
                  <HeroAvatar hero={hero} name={hero.name} />
                  <span>{hero.name}</span>
                </label>
              )
            })}
          </div>
          {!draft.heroes.length && (
            <p className="field-error">Chọn ít nhất một tướng.</p>
          )}
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Huỷ
          </button>
          <button
            className="button button--primary"
            disabled={saving || !draft.heroes.length}
          >
            {saving ? 'Đang lưu…' : 'Lưu tài khoản'}
          </button>
        </div>
      </form>
    </div>
  )
}
