const relative = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })
const absolute = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})

export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000)
  if (Math.abs(minutes) < 1) return 'vừa xong'
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return relative.format(days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return relative.format(months, 'month')
  return relative.format(Math.round(days / 365), 'year')
}

export function formatDateTime(iso: string): string {
  return absolute.format(new Date(iso))
}

export function timestampSlug(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}
