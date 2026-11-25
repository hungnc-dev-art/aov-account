import { requireOwner } from '../../../../src/lib/auth/guard'
import { hitRateLimit } from '../../../../src/lib/auth/rate-limit'
import { errorResponse, HttpError, json } from '../../../../src/lib/http'
import { dispatchHeroUpdate, getHeroUpdateConfig, getLatestHeroUpdate } from '../../../../src/lib/hero-update'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Trạng thái lần cập nhật danh mục tướng gần nhất. */
export async function GET(request: Request) {
  const guard = await requireOwner(request)
  if (!guard.ok) return guard.response
  const config = getHeroUpdateConfig()
  if (!config) return json({ configured: false, run: null })
  try {
    return json(await getLatestHeroUpdate(config))
  } catch (error) {
    return errorResponse(error, 'heroes:update-status')
  }
}

/** Kích hoạt workflow crawl Garena → commit → Vercel deploy lại. */
export async function POST(request: Request) {
  const guard = await requireOwner(request, { write: true })
  if (!guard.ok) return guard.response
  const config = getHeroUpdateConfig()
  if (!config) {
    return json({ error: 'Máy chủ chưa cấu hình cập nhật tướng (thiếu GITHUB_HEROES_TOKEN).', code: 'HERO_UPDATE_NOT_CONFIGURED' }, { status: 503 })
  }
  try {
    const limit = hitRateLimit('heroes:update', 3, 10 * 60 * 1000)
    if (!limit.allowed) {
      throw new HttpError(429, 'RATE_LIMITED', 'Bạn vừa yêu cầu cập nhật nhiều lần. Vui lòng thử lại sau ít phút.', { 'retry-after': String(limit.retryAfterSeconds) })
    }
    const current = await getLatestHeroUpdate(config)
    if (current.run?.running) {
      throw new HttpError(409, 'HERO_UPDATE_RUNNING', 'Đang có một lần cập nhật tướng chạy. Vui lòng đợi hoàn tất.')
    }
    await dispatchHeroUpdate(config)
    return json({ started: true }, { status: 202 })
  } catch (error) {
    return errorResponse(error, 'heroes:update')
  }
}
