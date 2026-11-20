'use client'

import { createContext, useCallback, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { isApiError, reauthenticate } from '../lib/account-api'
import { Panel } from './overlay'
import { Button, Field } from './ui'

/** Người dùng huỷ hộp nhập lại mật khẩu: thao tác dừng, không coi là lỗi. */
export class ReauthCancelledError extends Error {
  constructor() {
    super('Đã huỷ xác thực lại.')
    this.name = 'ReauthCancelledError'
  }
}

type WithReauth = <T>(action: () => Promise<T>) => Promise<T>
const ReauthContext = createContext<WithReauth>((action) => action())

export function useReauth(): WithReauth {
  return useContext(ReauthContext)
}

export function ReauthProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ resolve: () => void; reject: (error: Error) => void } | null>(null)

  const withReauth = useCallback<WithReauth>(async (action) => {
    try {
      return await action()
    } catch (error) {
      if (!isApiError(error, 'REAUTH_REQUIRED')) throw error
      await new Promise<void>((resolve, reject) => setPending({ resolve, reject }))
      return action()
    }
  }, [])

  return (
    <ReauthContext value={withReauth}>
      {children}
      {pending && (
        <ReauthDialog
          onCancel={() => {
            pending.reject(new ReauthCancelledError())
            setPending(null)
          }}
          onSuccess={() => {
            pending.resolve()
            setPending(null)
          }}
        />
      )}
    </ReauthContext>
  )
}

function ReauthDialog({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      await reauthenticate(password)
      setPassword('')
      onSuccess()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không xác thực được.')
      inputRef.current?.select()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      open
      onClose={busy ? () => {} : onCancel}
      width={440}
      initialFocus={inputRef}
      title="Nhập lại mật khẩu"
      description="Thao tác nhạy cảm cần xác nhận lại mật khẩu chủ sở hữu (hiệu lực 5 phút)."
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>Huỷ</Button>
          <Button variant="primary" type="submit" form="reauth-form" loading={busy} icon={<ShieldCheck size={16} aria-hidden="true" />}>
            {busy ? 'Đang xác nhận…' : 'Xác nhận'}
          </Button>
        </>
      }
    >
      <form id="reauth-form" onSubmit={(event) => void submit(event)} noValidate>
        <Field label="Mật khẩu chủ sở hữu" htmlFor="reauth-password" error={error || undefined}>
          <div className="input-wrap" data-invalid={error ? true : undefined}>
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              id="reauth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'reauth-password-error' : undefined}
            />
          </div>
        </Field>
        {!error && (
          <p className="t-caption" style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={14} aria-hidden="true" /> Mật khẩu không được lưu trên trình duyệt.
          </p>
        )}
      </form>
    </Panel>
  )
}
