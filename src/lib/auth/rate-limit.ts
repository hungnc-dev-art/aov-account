// Giới hạn tốc độ đăng nhập trong bộ nhớ instance.
// Đây là lớp phụ: lớp chính là Vercel WAF rate-limit rule ở edge (áp dụng mọi instance,
// xem .claude/skills/account-security). Trên serverless, bộ nhớ không chia sẻ giữa instance
// nên lớp này chỉ làm chậm tấn công từ một instance nóng.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export function hitRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey)
  }
  const current = buckets.get(key)
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current
  bucket.count += 1
  buckets.set(key, bucket)
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  return { allowed: bucket.count <= limit, retryAfterSeconds }
}

export function resetRateLimit(key: string): void {
  buckets.delete(key)
}

export function clearAllRateLimits(): void {
  buckets.clear()
}

/** IP client do Vercel đặt (không tin header từ client khi chạy sau proxy của Vercel). */
export function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}

export const LOGIN_LIMIT = { perIp: 5, global: 30, windowMs: 15 * 60 * 1000 }
