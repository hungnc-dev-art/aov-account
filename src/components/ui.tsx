'use client'

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { AlertTriangle, Check, Copy, Eye, EyeOff, Search, X } from 'lucide-react'
import { ApiError, fetchPassword } from '../lib/account-api'
import { copyText } from '../lib/clipboard'
import type { Hero, HeroRole } from '../types'
import { useToast } from './toast'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/* ---------- Button ---------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  loading?: boolean
  block?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, block, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md'
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ label, icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx('icon-btn', variant === 'outline' && 'icon-btn--outline', variant === 'danger' && 'icon-btn--danger', size === 'sm' && 'icon-btn--sm', className)}
      {...rest}
    >
      {icon}
    </button>
  )
}

/* ---------- Badges ---------- */
export function Badge({ tone, children, className }: { tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline'; children: ReactNode; className?: string }) {
  return <span className={cx('badge', tone && `badge--${tone}`, className)}>{children}</span>
}

export function RoleBadge({ role }: { role: HeroRole }) {
  return (
    <span className="badge badge--outline" data-role={role}>
      <span className="role-dot" aria-hidden="true" />
      {role}
    </span>
  )
}

/* ---------- Avatars ---------- */
const AVATAR_PX = { xs: 24, sm: 32, md: 40, lg: 56, xl: 88 } as const

export function HeroAvatar({ hero, name, size = 'md', round, priority }: { hero?: Hero; name: string; size?: keyof typeof AVATAR_PX; round?: boolean; priority?: boolean }) {
  const [failed, setFailed] = useState(false)
  const px = AVATAR_PX[size]
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className={cx('avatar', `avatar--${size}`, round && 'avatar--round')} data-unknown={!hero || undefined} title={hero ? undefined : `${name} (không có trong danh mục)`}>
      {hero?.imageUrl && !failed ? (
        <img src={hero.imageUrl} alt="" width={px} height={px} loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{initials || '?'}</span>
      )}
    </span>
  )
}

export function AvatarStack({ heroes, names, max = 5 }: { heroes: Array<Hero | undefined>; names: string[]; max?: number }) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <span className="avatar-stack" aria-label={`${names.length} tướng`}>
      {shown.map((name, index) => <HeroAvatar key={name} hero={heroes[index]} name={name} size="sm" round />)}
      {rest > 0 && <span className="avatar-stack__more">+{rest}</span>}
    </span>
  )
}

export function Monogram({ text, size }: { text: string; size?: 'lg' }) {
  const letters = text.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').slice(0, 2).map((word) => word[0]).join('')
  return <span className={cx('monogram', size && `monogram--${size}`)} aria-hidden="true">{letters || '#'}</span>
}

/* ---------- Copy / credential ---------- */
export function CopyButton({ value, label, size = 'sm' }: { value: string | (() => Promise<string>); label: string; size?: 'sm' | 'md' }) {
  const toast = useToast()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const timer = useRef(0)
  const copy = async () => {
    setState('busy')
    try {
      await copyText(value)
      setState('done')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setState('idle'), 1400)
      toast({ tone: 'success', title: `Đã sao chép ${label}` })
    } catch (error) {
      setState('idle')
      toast({
        tone: 'error',
        title: 'Không sao chép được',
        description: error instanceof ApiError ? error.message : 'Trình duyệt chặn clipboard. Hãy hiện giá trị rồi sao chép thủ công.',
      })
    }
  }
  return (
    <IconButton
      label={`Sao chép ${label}`}
      size={size}
      data-state={state === 'done' ? 'done' : undefined}
      disabled={state === 'busy'}
      icon={state === 'busy' ? <span className="spinner" aria-hidden="true" /> : state === 'done' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      onClick={() => void copy()}
    />
  )
}

/** Username: hiển thị + sao chép. */
export function Secret({ value }: { value: string; kind?: 'username' }) {
  return (
    <span className="secret">
      <span className="secret__value" translate="no">{value}</span>
      <CopyButton value={value} label="username" />
    </span>
  )
}

const AUTO_MASK_MS = 30_000

/**
 * Mật khẩu: che mặc định, chỉ tải từ API khi bấm hiện/sao chép, giữ trong state của
 * component (không localStorage), tự che lại sau 30 giây.
 */
export function PasswordSecret({ accountId, hasPassword }: { accountId: number; hasPassword: boolean }) {
  const toast = useToast()
  const [value, setValue] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const pending = useRef<Promise<string> | null>(null)
  const maskTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(maskTimer.current), [])

  const load = (): Promise<string> => {
    if (value !== null) return Promise.resolve(value)
    if (!pending.current) {
      pending.current = fetchPassword(accountId)
        .then((password) => {
          setValue(password)
          return password
        })
        .finally(() => {
          pending.current = null
        })
    }
    return pending.current
  }

  const toggle = async () => {
    if (revealed) {
      setRevealed(false)
      return
    }
    setLoading(true)
    try {
      await load()
      setRevealed(true)
      window.clearTimeout(maskTimer.current)
      maskTimer.current = window.setTimeout(() => setRevealed(false), AUTO_MASK_MS)
    } catch (error) {
      toast({ tone: 'error', title: 'Không tải được mật khẩu', description: error instanceof Error ? error.message : undefined })
    } finally {
      setLoading(false)
    }
  }

  if (!hasPassword) {
    return (
      <span className="secret">
        <span className="secret__value" data-empty="true">
          <AlertTriangle size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Chưa có mật khẩu
        </span>
      </span>
    )
  }
  const masked = !revealed || value === null
  return (
    <span className="secret">
      <span className="secret__value" data-masked={masked || undefined} translate="no">
        {masked ? '••••••' : value}
      </span>
      <IconButton
        label={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        size="sm"
        aria-pressed={revealed}
        disabled={loading}
        icon={loading ? <span className="spinner" aria-hidden="true" /> : revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        onClick={() => void toggle()}
      />
      <CopyButton value={load} label="mật khẩu" />
    </span>
  )
}

/* ---------- Search ---------- */
export function SearchField({ value, onChange, label, placeholder, shortcut, size, inputRef, id }: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  shortcut?: string
  size?: 'lg'
  inputRef?: Ref<HTMLInputElement>
  id?: string
}) {
  return (
    <div className={cx('input-wrap', size === 'lg' && 'input-wrap--lg')}>
      <Search size={18} aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {value ? (
        <IconButton label="Xoá nội dung tìm kiếm" size="sm" icon={<X size={16} aria-hidden="true" />} onClick={() => onChange('')} />
      ) : shortcut ? (
        <span className="kbd" aria-hidden="true">{shortcut}</span>
      ) : null}
    </div>
  )
}

/* ---------- Segmented (radiogroup) ---------- */
function rovingKey<T>(event: KeyboardEvent, values: T[], current: T, select: (value: T) => void, root: HTMLElement | null) {
  const index = values.indexOf(current)
  const targets: Record<string, number> = {
    ArrowRight: (index + 1) % values.length,
    ArrowDown: (index + 1) % values.length,
    ArrowLeft: (index - 1 + values.length) % values.length,
    ArrowUp: (index - 1 + values.length) % values.length,
    Home: 0,
    End: values.length - 1,
  }
  const next = targets[event.key]
  if (next === undefined) return
  event.preventDefault()
  select(values[next])
  root?.querySelectorAll<HTMLElement>('[data-roving]')[next]?.focus()
}

export function Segmented<T extends string>({ label, options, value, onChange, block }: {
  label: string
  options: Array<{ value: T; label: string; icon?: ReactNode; count?: number }>
  value: T
  onChange: (value: T) => void
  block?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={root}
      className={cx('segmented', block && 'segmented--block')}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => rovingKey(event, options.map((option) => option.value), value, onChange, root.current)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          data-roving
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className="segmented__item"
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
          {option.count !== undefined && <span className="tabular t-tertiary">{option.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ label, tabs, value, onChange, idPrefix }: {
  label: string
  tabs: Array<{ id: T; label: string; count?: number }>
  value: T
  onChange: (value: T) => void
  idPrefix: string
}) {
  const root = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={root}
      className="tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => rovingKey(event, tabs.map((tab) => tab.id), value, onChange, root.current)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          data-roving
          aria-selected={tab.id === value}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={tab.id === value ? 0 : -1}
          className="tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && <Badge tone={tab.id === value ? 'accent' : undefined}>{tab.count}</Badge>}
        </button>
      ))}
    </div>
  )
}

/* ---------- Field ---------- */
export function Field({ label, required, hint, error, children, className, htmlFor }: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
  htmlFor: string
}) {
  return (
    <div className={cx('field', className)}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <span className="field__error" id={`${htmlFor}-error`} role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={`${htmlFor}-hint`}>{hint}</span>
      ) : null}
    </div>
  )
}

export function useFieldId(): string {
  return useId().replace(/:/g, '')
}

/* ---------- Skeleton & states ---------- */
export function Skeleton({ width = '100%', height = 14, radius, className }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={cx('skeleton', className)} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}

export function StateView({ kind = 'empty', icon, title, description, actions }: {
  kind?: 'empty' | 'error'
  icon: ReactNode
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className={cx('state', kind === 'error' && 'state--error')} role={kind === 'error' ? 'alert' : undefined}>
      <span className="state__icon" aria-hidden="true">{icon}</span>
      <p className="state__title">{title}</p>
      <p className="state__desc">{description}</p>
      {actions && <div className="state__actions">{actions}</div>}
    </div>
  )
}
