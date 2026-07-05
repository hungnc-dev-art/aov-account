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
  const accountName = account.nickname || account.username

  return (
    <tr>
      <td className="hero-owner__name" title={accountName}>
        <strong>{accountName}</strong>
      </td>
      <td>
        <div className="hero-owner__value">
          <strong title={account.username}>{account.username}</strong>
          <CopyValue value={account.username} label="username" />
        </div>
      </td>
      <td>
        <div className="hero-owner__value">
          <strong className={account.password ? '' : 'muted'}>
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
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <CopyValue value={account.password} label="password" />
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
