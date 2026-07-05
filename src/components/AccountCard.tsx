import { Check, Copy, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Account, Hero } from '../types'
import { heroByNormalizedName } from '../data/heroes'
import { normalizeText } from '../utils/normalize'
import { HeroAvatar } from './HeroAvatar'

interface AccountCardProps {
  account: Account
  matchedHeroes: string[]
  onEdit: () => void
  onDelete: () => void
  onHeroClick: (hero: Hero) => void
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button className="icon-button" onClick={() => void copy()} aria-label={`Copy ${label}`}>
      {copied ? <Check size={17} /> : <Copy size={17} />}
    </button>
  )
}

export function AccountCard({
  account,
  matchedHeroes,
  onEdit,
  onDelete,
  onHeroClick,
}: AccountCardProps) {
  const [showPassword, setShowPassword] = useState(false)
  const visibleHeroes = matchedHeroes.length ? matchedHeroes : account.heroes.slice(0, 6)
  const remaining = account.heroes.length - visibleHeroes.length

  return (
    <article className="account-card">
      <div className="account-card__top">
        <div>
          <p className="account-name">{account.nickname || account.username}</p>
          <div className="meta">
            {account.rank && <span>{account.rank}</span>}
            {account.level && <span>Lv.{account.level}</span>}
            {account.gold && <span>{account.gold} vàng</span>}
          </div>
        </div>
        <div className="card-actions">
          <button className="icon-button" onClick={onEdit} aria-label="Sửa tài khoản">
            <Pencil size={17} />
          </button>
          <button
            className="icon-button icon-button--danger"
            onClick={onDelete}
            aria-label="Xoá tài khoản"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="credentials">
        <div>
          <span>Username</span>
          <strong>{account.username}</strong>
          <CopyButton value={account.username} label="username" />
        </div>
        <div>
          <span>Password</span>
          <strong className={!account.password ? 'muted' : ''}>
            {account.password
              ? showPassword
                ? account.password
                : '••••••••'
              : 'Chưa có'}
          </strong>
          {account.password && (
            <>
              <button
                className="icon-button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              <CopyButton value={account.password} label="password" />
            </>
          )}
        </div>
      </div>

      <div className="hero-section">
        <div className="section-label">
          <span>Tướng {matchedHeroes.length ? 'phù hợp' : 'nổi bật'}</span>
          <strong>{account.heroes.length} tướng</strong>
        </div>
        <div className="hero-list">
          {visibleHeroes.map((name) => {
            const hero = heroByNormalizedName.get(normalizeText(name))
            return (
              <button
                className={`hero-chip ${matchedHeroes.includes(name) ? 'hero-chip--match' : ''}`}
                key={name}
                onClick={() => hero && onHeroClick(hero)}
                disabled={!hero}
              >
                <HeroAvatar hero={hero} name={name} />
                <span>{name}</span>
              </button>
            )
          })}
          {remaining > 0 && <span className="more-heroes">+{remaining}</span>}
        </div>
      </div>
      {(account.status || account.note) && (
        <p className="account-note">
          {account.status && <span>{account.status}</span>}
          {account.note}
        </p>
      )}
    </article>
  )
}
