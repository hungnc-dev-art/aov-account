// Kích hoạt và theo dõi workflow GitHub "update-heroes" (chỉ dùng phía server).
// Danh mục tướng là dữ liệu tĩnh trong repo: workflow crawl Garena, commit nếu có thay đổi,
// Vercel tự deploy lại. Token GitHub KHÔNG bao giờ được gửi xuống trình duyệt.
import { HttpError } from './http'
import type { HeroUpdateStatus } from '../types'

export const HERO_UPDATE_WORKFLOW = 'update-heroes.yml'
const GITHUB_API = 'https://api.github.com'
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const REF_PATTERN = /^[A-Za-z0-9._/-]{1,100}$/

export interface HeroUpdateConfig {
  token: string
  repo: string
  ref: string
}

/** `null` khi thiếu token hoặc tên repo → tính năng tắt, không gọi GitHub. */
export function getHeroUpdateConfig(): HeroUpdateConfig | null {
  const token = (process.env.GITHUB_HEROES_TOKEN ?? '').trim()
  const vercelRepo = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : ''
  const repo = ((process.env.GITHUB_HEROES_REPO ?? '').trim() || vercelRepo).trim()
  const ref = (process.env.GITHUB_HEROES_REF ?? '').trim() || 'main'
  if (!token || !REPO_PATTERN.test(repo) || !REF_PATTERN.test(ref)) return null
  return { token, repo, ref }
}

async function github(config: HeroUpdateConfig, path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${GITHUB_API}/repos/${config.repo}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${config.token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'aov-account-hero-update',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    })
  } catch {
    throw new HttpError(502, 'GITHUB_UNREACHABLE', 'Không kết nối được GitHub. Vui lòng thử lại sau.')
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, 'GITHUB_FORBIDDEN', 'Token GitHub không hợp lệ hoặc thiếu quyền Actions (read & write).')
  }
  if (response.status === 404) {
    throw new HttpError(502, 'GITHUB_WORKFLOW_MISSING', 'Không tìm thấy workflow cập nhật tướng trên nhánh mặc định của repo.')
  }
  if (!response.ok) {
    throw new HttpError(502, 'GITHUB_ERROR', 'GitHub từ chối yêu cầu. Vui lòng thử lại sau.')
  }
  return response
}

interface WorkflowRun {
  status?: unknown
  conclusion?: unknown
  created_at?: unknown
  updated_at?: unknown
  event?: unknown
}

const RUN_STATES = new Set(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending'])

/** Lần chạy gần nhất (chỉ trả field cần cho UI, không lộ URL/tên actor). */
export async function getLatestHeroUpdate(config: HeroUpdateConfig): Promise<HeroUpdateStatus> {
  const response = await github(config, `/actions/workflows/${HERO_UPDATE_WORKFLOW}/runs?per_page=1`)
  const payload = (await response.json().catch(() => null)) as { workflow_runs?: WorkflowRun[] } | null
  const run = payload?.workflow_runs?.[0]
  if (!run) return { configured: true, run: null }
  const status = typeof run.status === 'string' && RUN_STATES.has(run.status) ? run.status : 'completed'
  return {
    configured: true,
    run: {
      running: status !== 'completed',
      conclusion: typeof run.conclusion === 'string' ? run.conclusion : null,
      trigger: run.event === 'schedule' ? 'schedule' : 'manual',
      startedAt: typeof run.created_at === 'string' ? run.created_at : null,
      finishedAt: status === 'completed' && typeof run.updated_at === 'string' ? run.updated_at : null,
    },
  }
}

export async function dispatchHeroUpdate(config: HeroUpdateConfig): Promise<void> {
  await github(config, `/actions/workflows/${HERO_UPDATE_WORKFLOW}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: config.ref }),
  })
}
