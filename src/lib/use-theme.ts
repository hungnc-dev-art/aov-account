'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { parsePreference, resolveTheme, THEME_KEY, type ThemePreference } from './theme'

const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_KEY))
  } catch {
    return parsePreference(null)
  }
}

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference, prefersDark())
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0e14' : '#f5f6f8')
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => {
    if (readPreference() === 'system') applyTheme('system')
    callback()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) {
      applyTheme(readPreference())
      callback()
    }
  }
  media.addEventListener('change', onSystemChange)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useThemePreference(): [ThemePreference, (value: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribe, readPreference, () => parsePreference(null))
  // Đồng bộ DOM từ giá trị đã lưu sau khi mount (lưới an toàn nếu script boot bị chặn).
  useEffect(() => applyTheme(readPreference()), [])
  const setPreference = useCallback((value: ThemePreference) => {
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {
      // Chế độ riêng tư: vẫn đổi theme trong phiên hiện tại.
    }
    applyTheme(value)
    for (const listener of listeners) listener()
  }, [])
  return [preference, setPreference]
}
