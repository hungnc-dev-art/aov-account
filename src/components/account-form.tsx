'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, AlertTriangle, Check, Eye, EyeOff, Save, X } from 'lucide-react'
import type { Account, AccountDraft, Hero, HeroRole } from '../types'
import { normalizeText } from '../utils/normalize'
import { fetchPassword } from '../lib/account-api'
import { ROLES, allHeroes, findHero } from '../lib/catalog'
import { Panel } from './overlay'
import { Button, Field, HeroAvatar, IconButton, SearchField, useFieldId } from './ui'

interface AccountFormProps {
  account: Account | null
  presetHero?: Hero
  onClose: () => void
  onSave: (draft: AccountDraft, id?: number) => Promise<void>
}

type Errors = { username?: string; heroes?: string; form?: string }

type DraftState = Required<Pick<AccountDraft, 'username' | 'nickname' | 'heroes'>> & { password: string }

export function AccountFormDialog({ account, presetHero, onClose, onSave }: AccountFormProps) {
  const initial = useMemo<DraftState>(() => ({
    username: account?.username ?? '',
    password: '',
    nickname: account?.nickname ?? '',
    heroes: account?.heroes ?? (presetHero ? [presetHero.name] : []),
  }), [account, presetHero])
  const [draft, setDraft] = useState<DraftState>(initial)
  const [showPassword, setShowPassword] = useState(false)
  // Khi sửa: mật khẩu hiện tại tải riêng; không chạm vào ô = giữ nguyên (không gửi lên server).
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [passwordState, setPasswordState] = useState<'idle' | 'loading' | 'loaded' | 'error'>(account?.hasPassword ? 'loading' : 'idle')

  useEffect(() => {
    if (!account?.hasPassword) return
    let cancelled = false
    fetchPassword(account.id)
      .then((password) => {
        if (cancelled) return
        setDraft((current) => ({ ...current, password }))
        setPasswordState('loaded')
      })
      .catch(() => {
        if (!cancelled) setPasswordState('error')
      })
    return () => {
      cancelled = true
    }
  }, [account])
  const [heroQuery, setHeroQuery] = useState('')
  const [role, setRole] = useState<'all' | HeroRole>('all')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const ids = { username: useFieldId(), password: useFieldId(), nickname: useFieldId() }
  const deferredQuery = useDeferredValue(heroQuery)

  const selected = useMemo(() => new Set(draft.heroes.map(normalizeText)), [draft.heroes])
  const dirty = passwordTouched || JSON.stringify({ ...draft, password: '' }) !== JSON.stringify({ ...initial, password: '' })
  const options = useMemo(() => {
    const normalized = normalizeText(deferredQuery)
    return allHeroes.filter((hero) => (!normalized || hero.normalizedName.includes(normalized)) && (role === 'all' || hero.roles.includes(role)))
  }, [deferredQuery, role])

  const requestClose = () => {
    if (saving) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  const toggleHero = (hero: Hero) => {
    setErrors((current) => ({ ...current, heroes: undefined }))
    setDraft((current) => {
      const has = current.heroes.some((name) => normalizeText(name) === hero.normalizedName)
      return {
        ...current,
        heroes: has ? current.heroes.filter((name) => normalizeText(name) !== hero.normalizedName) : [...current.heroes, hero.name],
      }
    })
  }

  const removeName = (name: string) => setDraft((current) => ({ ...current, heroes: current.heroes.filter((item) => item !== name) }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Errors = {}
    if (!draft.username.trim()) next.username = 'Nhập tên đăng nhập.'
    if (!draft.heroes.length) next.heroes = 'Chọn ít nhất một tướng.'
    setErrors(next)
    if (next.username) return usernameRef.current?.focus()
    if (next.heroes) return pickerRef.current?.focus()
    setSaving(true)
    try {
      const { password, ...rest } = draft
      const sendPassword = !account || passwordTouched
      await onSave({ ...rest, username: draft.username.trim(), ...(sendPassword ? { password } : {}) }, account?.id)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không lưu được tài khoản.'
      if (/tên đăng nhập/i.test(message)) {
        setErrors({ username: message })
        usernameRef.current?.focus()
      } else {
        setErrors({ form: message })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Panel
        open
        onClose={requestClose}
        width={760}
        full
        title={account ? 'Sửa tài khoản' : 'Thêm tài khoản'}
        description={account ? `Đang sửa ${account.username}` : 'Thông tin đăng nhập và danh sách tướng sở hữu.'}
        initialFocus={usernameRef}
        footer={
          <>
            <Button onClick={requestClose} disabled={saving}>Huỷ</Button>
            <Button variant="primary" type="submit" form="account-form" loading={saving} icon={<Save size={16} aria-hidden="true" />}>
              {saving ? 'Đang lưu…' : account ? 'Lưu thay đổi' : 'Thêm tài khoản'}
            </Button>
          </>
        }
      >
        <form id="account-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="form-grid">
            <Field label="Tên đăng nhập" required htmlFor={ids.username} error={errors.username} hint="Phải là duy nhất trong kho.">
              <div className="input-wrap" data-invalid={Boolean(errors.username) || undefined}>
                <input
                  ref={usernameRef}
                  id={ids.username}
                  name="username"
                  value={draft.username}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, username: event.target.value }))
                    if (errors.username) setErrors((current) => ({ ...current, username: undefined }))
                  }}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? `${ids.username}-error` : `${ids.username}-hint`}
                  placeholder="vd. demo.kho25…"
                  translate="no"
                />
              </div>
            </Field>
            <Field
              label="Mật khẩu"
              htmlFor={ids.password}
              hint={
                passwordState === 'loading' ? 'Đang tải mật khẩu hiện tại…'
                  : passwordState === 'error' ? 'Không tải được mật khẩu hiện tại — để trống sẽ giữ nguyên.'
                    : account ? 'Không sửa ô này thì mật khẩu được giữ nguyên.' : 'Có thể để trống và bổ sung sau.'
              }
            >
              <div className="input-wrap">
                <input
                  id={ids.password}
                  name="account-password"
                  type={showPassword ? 'text' : 'password'}
                  value={draft.password}
                  onChange={(event) => {
                    setPasswordTouched(true)
                    setDraft((current) => ({ ...current, password: event.target.value }))
                  }}
                  disabled={passwordState === 'loading'}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={`${ids.password}-hint`}
                  translate="no"
                />
                <IconButton
                  label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  size="sm"
                  aria-pressed={showPassword}
                  icon={showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  onClick={() => setShowPassword((value) => !value)}
                />
              </div>
            </Field>
            <Field label="Tên tài khoản" htmlFor={ids.nickname} hint="Tên gợi nhớ, hiển thị thay cho username." className="span-2">
              <div className="input-wrap">
                <input
                  id={ids.nickname}
                  name="nickname"
                  value={draft.nickname}
                  onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))}
                  autoComplete="off"
                  placeholder="vd. Acc Rank Cao Thủ…"
                />
              </div>
            </Field>
          </div>

          <fieldset className="picker" style={{ border: 0, borderTop: '1px solid var(--border)', marginInline: 0, paddingInline: 0, paddingBottom: 0 }} aria-describedby={errors.heroes ? 'heroes-error' : undefined}>
            <legend className="sr-only">Tướng sở hữu (bắt buộc)</legend>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <p className="t-heading" aria-hidden="true">Tướng sở hữu <span style={{ color: 'var(--danger)' }}>*</span></p>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="t-caption tabular" aria-live="polite">{draft.heroes.length} đã chọn</span>
                {draft.heroes.length > 0 && <Button size="sm" variant="ghost" onClick={() => setDraft((current) => ({ ...current, heroes: [] }))}>Bỏ chọn tất cả</Button>}
              </span>
            </div>
            {errors.heroes && (
              <span className="field__error" id="heroes-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {errors.heroes}</span>
            )}

            <ul className="picker__selected" data-empty="Chưa chọn tướng nào — chọn từ danh sách bên dưới." aria-label="Tướng đã chọn" style={{ margin: 0, listStyle: 'none' }}>
              {draft.heroes.map((name) => {
                const hero = findHero(name)
                return (
                  <li key={name} className="tag" data-unknown={!hero || undefined} title={hero ? undefined : 'Không có trong danh mục — vẫn được lưu nguyên tên'}>
                    <HeroAvatar hero={hero} name={name} size="xs" round />
                    {name}
                    {!hero && <AlertTriangle size={13} aria-label="Ngoài danh mục" />}
                    <button type="button" aria-label={`Bỏ chọn ${name}`} onClick={() => removeName(name)}><X size={14} aria-hidden="true" /></button>
                  </li>
                )
              })}
            </ul>

            <SearchField value={heroQuery} onChange={setHeroQuery} label="Lọc danh sách tướng" placeholder="Lọc tướng theo tên…" inputRef={pickerRef} />
            <div className="chip-row" role="radiogroup" aria-label="Lọc theo vai trò">
              <button type="button" role="radio" aria-checked={role === 'all'} className="chip" onClick={() => setRole('all')}>Tất cả</button>
              {ROLES.map((item) => (
                <button key={item} type="button" role="radio" aria-checked={role === item} className="chip" data-role={item} onClick={() => setRole(item)}>
                  <span className="role-dot" aria-hidden="true" />{item}
                </button>
              ))}
            </div>
            <div className="picker__grid" role="group" aria-label="Danh sách tướng">
              {options.map((hero) => (
                <label key={hero.id} className="pick">
                  <input type="checkbox" checked={selected.has(hero.normalizedName)} onChange={() => toggleHero(hero)} />
                  <span className="pick__check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
                  <HeroAvatar hero={hero} name={hero.name} size="lg" />
                  <span>{hero.name}</span>
                </label>
              ))}
              {!options.length && <p className="t-secondary" style={{ gridColumn: '1 / -1', padding: 'var(--space-4)', textAlign: 'center' }}>Không có tướng khớp “{heroQuery}”.</p>}
            </div>
          </fieldset>

          {errors.form && (
            <div className="callout callout--danger form-error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div><strong>Chưa lưu được</strong><p>{errors.form}</p></div>
            </div>
          )}
        </form>
      </Panel>

      <Panel
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        role="alertdialog"
        width={420}
        title="Bỏ thay đổi chưa lưu?"
        description="Những gì bạn vừa nhập sẽ mất nếu đóng biểu mẫu."
        footer={
          <>
            <Button onClick={() => setConfirmDiscard(false)} data-autofocus>Tiếp tục sửa</Button>
            <Button variant="danger" onClick={onClose}>Bỏ thay đổi</Button>
          </>
        }
      >
        {null}
      </Panel>
    </>
  )
}
