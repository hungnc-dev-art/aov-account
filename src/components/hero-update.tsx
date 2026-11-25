'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { HeroUpdateStatus } from '../types'
import { getHeroUpdateStatus, isApiError, startHeroUpdate } from '../lib/account-api'
import { Button } from './ui'
import { useToast } from './toast'

const POLL_MS = 15_000
/** GitHub cần vài giây mới liệt kê lần chạy vừa kích hoạt; coi lần chạy là "mới" nếu bắt đầu sau mốc này. */
const DISPATCH_SKEW_MS = 60_000

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
const formatTime = (iso: string | null) => (iso ? timeFormat.format(new Date(iso)) : '')

function describe(status: HeroUpdateStatus | null, waiting: boolean): string {
  if (waiting) return 'Đang cập nhật… (crawl Garena, kiểm tra rồi deploy lại, khoảng 3–5 phút)'
  if (!status) return ''
  if (!status.configured) return 'Chưa cấu hình cập nhật tự động (GITHUB_HEROES_TOKEN).'
  const run = status.run
  if (!run) return 'Tự kiểm tra tướng mới mỗi ngày.'
  if (run.running) return 'Đang cập nhật…'
  const when = formatTime(run.finishedAt ?? run.startedAt)
  const source = run.trigger === 'schedule' ? 'tự động' : 'thủ công'
  if (run.conclusion === 'success') return `Kiểm tra ${source} lúc ${when}: hoàn tất.`
  if (run.conclusion === 'cancelled') return `Lần cập nhật lúc ${when} đã bị huỷ.`
  return `Lần cập nhật lúc ${when} thất bại, dữ liệu tướng giữ nguyên.`
}

export function HeroUpdateControl() {
  const toast = useToast()
  const [status, setStatus] = useState<HeroUpdateStatus | null>(null)
  const [starting, setStarting] = useState(false)
  /** Đang chờ lần chạy do người dùng kích hoạt trong phiên này. */
  const [waiting, setWaiting] = useState(false)
  const dispatchedAt = useRef<number | null>(null)

  /** Nhận trạng thái mới; nếu lần chạy vừa kích hoạt đã xong thì báo kết quả một lần. */
  const apply = useCallback((next: HeroUpdateStatus) => {
    setStatus(next)
    const since = dispatchedAt.current
    const run = next.run
    if (since === null || !run?.startedAt || Date.parse(run.startedAt) < since - DISPATCH_SKEW_MS || run.running) return
    dispatchedAt.current = null
    setWaiting(false)
    if (run.conclusion === 'success') {
      toast({ tone: 'success', title: 'Đã kiểm tra tướng mới', description: 'Nếu có tướng mới, Vercel đang deploy lại; tải lại trang sau vài phút để thấy.' })
    } else {
      toast({ tone: 'error', title: 'Cập nhật tướng thất bại', description: 'Dữ liệu tướng giữ nguyên. Xem log workflow trên GitHub Actions.' })
    }
  }, [toast])

  const refresh = useCallback(() => {
    getHeroUpdateStatus().then(apply, () => {})
  }, [apply])

  const busy = waiting || Boolean(status?.run?.running)

  // Tải trạng thái khi mở trang; theo dõi định kỳ khi đang chạy (kể cả lần chạy theo lịch).
  useEffect(() => {
    let cancelled = false
    const load = () => getHeroUpdateStatus().then((next) => { if (!cancelled) apply(next) }, () => {})
    if (!busy) {
      load()
      return () => { cancelled = true }
    }
    const timer = window.setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [busy, apply])

  const start = async () => {
    setStarting(true)
    try {
      await startHeroUpdate()
      dispatchedAt.current = Date.now()
      setWaiting(true)
      toast({ tone: 'info', title: 'Đã bắt đầu cập nhật tướng', description: 'Quá trình chạy trên GitHub, bạn có thể tiếp tục dùng app.' })
      window.setTimeout(refresh, 5_000)
    } catch (error) {
      if (isApiError(error, 'HERO_UPDATE_RUNNING')) refresh()
      toast({ tone: 'error', title: 'Không thể cập nhật tướng', description: isApiError(error) ? error.message : 'Vui lòng thử lại sau.' })
    } finally {
      setStarting(false)
    }
  }

  const label = describe(status, waiting)
  return (
    <div className="page-header__actions hero-update">
      <Button
        icon={<RefreshCw size={16} aria-hidden="true" />}
        loading={starting || busy}
        disabled={status?.configured === false}
        onClick={start}
      >
        {busy ? 'Đang cập nhật…' : 'Cập nhật tướng'}
      </Button>
      {label && <p className="hero-update__status t-caption" aria-live="polite">{label}</p>}
    </div>
  )
}
