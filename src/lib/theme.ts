// Theme: đọc localStorage TRƯỚC khi render (script boot) và không bao giờ ghi đè khi khởi tạo (B7).
// Giữ key cũ `aov-theme` để không mất lựa chọn của người dùng.

export type ThemePreference = 'system' | 'light' | 'dark'
export const THEME_KEY = 'aov-theme'
export const DEFAULT_THEME: ThemePreference = 'dark'

export function parsePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}

/** Chạy inline trong <head> (có nonce CSP) trước lần vẽ đầu tiên để không nháy theme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var v=localStorage.getItem('${THEME_KEY}');var p=v==='light'||v==='dark'||v==='system'?v:'${DEFAULT_THEME}';var t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}';}})();`
