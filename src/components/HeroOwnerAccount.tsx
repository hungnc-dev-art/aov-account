import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { Account } from '../types'

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button className="icon-button" onClick={() => void copy()} aria-label={`Copy ${label}`}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  )
}

export function HeroOwnerAccount({ account }: { account: Account }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <article className="hero-owner">
      <div className="hero-owner__heading">
        <div>
          <strong>{account.nickname || account.username}</strong>
          {account.rank && <span>{account.rank}</span>}
        </div>
        {account.note && <p>{account.note}</p>}
      </div>
      <div className="hero-owner__credential">
        <span>Username</span>
        <strong>{account.username}</strong>
        <CopyValue value={account.username} label="username" />
      </div>
      <div className="hero-owner__credential">
        <span>Password</span>
        <strong>{account.password ? (showPassword ? account.password : '••••••••') : 'Chưa có'}</strong>
        {account.password && (
          <>
            <button
              className="icon-button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <CopyValue value={account.password} label="password" />
          </>
        )}
      </div>
    </article>
  )
}
