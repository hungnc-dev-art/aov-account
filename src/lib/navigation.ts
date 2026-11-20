'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

/** Route bằng hash, deep-link được: #/heroes, #/heroes/:id, #/accounts, #/accounts/:id. */
export type Route = { page: 'heroes' | 'accounts'; id?: string }

/** Tương thích link cũ: `#accounts` → tài khoản, `#top`/rỗng → danh mục tướng. */
export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '')
  if (cleaned === 'accounts') return { page: 'accounts' }
  const [page, rawId] = cleaned.split('/')
  let id: string | undefined
  try {
    id = rawId ? decodeURIComponent(rawId) : undefined
  } catch {
    id = undefined
  }
  return { page: page === 'accounts' ? 'accounts' : 'heroes', id: id || undefined }
}

export function formatHash(route: Route): string {
  return `#/${route.page}${route.id ? `/${encodeURIComponent(route.id)}` : ''}`
}

/** Hash cũ cần chuẩn hoá (thay thế trong lịch sử, không thêm bước Back). */
export function canonicalHash(hash: string): string | null {
  if (hash === '#accounts') return '#/accounts'
  if (hash === '#top' || hash === '#' ) return '#/heroes'
  return null
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  useEffect(() => {
    const canonical = canonicalHash(window.location.hash)
    if (canonical) {
      window.history.replaceState(null, '', canonical)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }, [hash])
  const route = useMemo(() => parseHash(hash), [hash])
  const navigate = useCallback((next: Route) => {
    window.location.hash = formatHash(next)
  }, [])
  return [route, navigate]
}

export function useIsClient(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false)
}
