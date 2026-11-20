'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Eye, EyeOff, LockKeyhole, LogIn } from 'lucide-react'

type LoginError = { message: string; retryAt?: number } | null

export function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<LoginError>(null)
  const [now, setNow] = useState(() => Date.now())
  const inputRef = useRef<HTMLInputElement>(null)

  // Cookie SameSite=Strict không được gửi khi mở app từ link bên ngoài: hỏi lại phiên bằng fetch cùng site.
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { authenticated?: boolean } | null) => {
        if (!cancelled && data?.authenticated) window.location.replace(`/${window.location.hash}`)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!error?.retryAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [error?.retryAt])

  const waitSeconds = error?.retryAt ? Math.max(0, Math.ceil((error.retryAt - now) / 1000)) : 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password || busy || waitSeconds > 0) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      })
      if (response.ok) {
        setPassword('')
        window.location.replace(`/${window.location.hash}`)
        return
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '60')
        setError({ message: data.error ?? 'Bạn đã thử quá nhiều lần.', retryAt: Date.now() + retryAfter * 1000 })
      } else {
        setError({ message: data.error ?? 'Không đăng nhập được. Vui lòng thử lại.' })
      }
      inputRef.current?.select()
    } catch {
      setError({ message: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand__mark">
            <img src="/assets/lien-quan-favicon.jpg" alt="" width={40} height={40} />
          </span>
          <span className="brand__name">
            <strong>Kho tài khoản</strong>
            <span>Liên Quân</span>
          </span>
        </div>
        <div className="login-titles">
          <h1 id="login-title" className="t-title">Đăng nhập</h1>
          <p className="t-secondary">Khu vực riêng của chủ sở hữu kho tài khoản.</p>
        </div>

        {!configured ? (
          <div className="callout callout--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Chưa cấu hình đăng nhập</strong>
              <p>Máy chủ thiếu biến môi trường xác thực. Liên hệ quản trị để hoàn tất cấu hình.</p>
            </div>
          </div>
        ) : (
          <form className="login-form" onSubmit={(event) => void submit(event)} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="owner-password">Mật khẩu chủ sở hữu</label>
              <div className="input-wrap input-wrap--lg" data-invalid={error && !error.retryAt ? true : undefined}>
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  ref={inputRef}
                  id="owner-password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                  aria-invalid={Boolean(error && !error.retryAt)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={visible}
                  onClick={() => setVisible((value) => !value)}
                >
                  {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {error && (
              <p className="field__error" id="login-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {error.message}
                {waitSeconds > 0 ? ` Thử lại sau ${waitSeconds} giây.` : ''}
              </p>
            )}
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || !password || waitSeconds > 0} aria-busy={busy || undefined}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        )}
        <p className="login-foot t-caption">Phiên đăng nhập kéo dài 12 giờ. Thao tác nhạy cảm sẽ yêu cầu nhập lại mật khẩu.</p>
      </section>
    </main>
  )
}
