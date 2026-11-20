'use client'

import type { ReactNode } from 'react'
import { Download, LogOut, Monitor, Moon, Search, Sun, Swords, Upload, UsersRound } from 'lucide-react'
import type { Route } from '../lib/navigation'
import type { ThemePreference } from '../lib/theme'
import { useThemePreference } from '../lib/use-theme'
import { IconButton, Segmented } from './ui'

interface ShellProps {
  route: Route
  heroCount: number
  accountCount: number | null
  onOpenSearch: () => void
  onImport: () => void
  onExport: () => void
  onLogout: () => void
  children: ReactNode
}

const NAV = [
  { page: 'heroes', label: 'Tướng', icon: Swords },
  { page: 'accounts', label: 'Tài khoản', icon: UsersRound },
] as const

function Brand() {
  return (
    <a className="brand" href="#/heroes" aria-label="Kho tài khoản Liên Quân — về danh mục tướng">
      <span className="brand__mark">
        <img src="/assets/lien-quan-favicon.jpg" alt="" width={32} height={32} />
      </span>
      <span className="brand__name">
        <strong>Kho tài khoản</strong>
        <span>Liên Quân</span>
      </span>
    </a>
  )
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: ReactNode }> = [
  { value: 'dark', label: 'Tối', icon: <Moon size={14} aria-hidden="true" /> },
  { value: 'light', label: 'Sáng', icon: <Sun size={14} aria-hidden="true" /> },
  { value: 'system', label: 'Tự động', icon: <Monitor size={14} aria-hidden="true" /> },
]

export function AppShell({ route, heroCount, accountCount, onOpenSearch, onImport, onExport, onLogout, children }: ShellProps) {
  const [theme, setTheme] = useThemePreference()
  const counts = { heroes: heroCount, accounts: accountCount }
  const isDark = theme === 'dark' || (theme === 'system' && typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark')

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Bỏ qua tới nội dung chính</a>

      <aside className="sidebar" aria-label="Thanh điều hướng">
        <Brand />
        <button type="button" className="search-trigger" onClick={onOpenSearch}>
          <Search size={16} aria-hidden="true" />
          <span>Tìm kiếm…</span>
          <span className="kbd" aria-hidden="true">Ctrl&nbsp;K</span>
        </button>
        <nav className="sidebar__section" aria-label="Trang chính">
          {NAV.map(({ page, label, icon: Icon }) => (
            <a key={page} className="nav-item" href={`#/${page}`} aria-current={route.page === page ? 'page' : undefined}>
              <Icon size={18} aria-hidden="true" />
              {label}
              <span className="nav-item__count">{counts[page] ?? '—'}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar__section">
          <p className="sidebar__label">Dữ liệu</p>
          <button type="button" className="nav-item" onClick={onImport}>
            <Upload size={18} aria-hidden="true" /> Nhập từ Excel
          </button>
          <button type="button" className="nav-item" onClick={onExport}>
            <Download size={18} aria-hidden="true" /> Xuất Excel
          </button>
        </div>
        <div className="sidebar__footer">
          <Segmented label="Giao diện" options={THEME_OPTIONS} value={theme} onChange={setTheme} block />
          <button type="button" className="nav-item" onClick={onLogout}>
            <LogOut size={18} aria-hidden="true" /> Đăng xuất
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <Brand />
          <nav className="topbar__nav" aria-label="Trang chính">
            {NAV.map(({ page, label, icon: Icon }) => (
              <a key={page} className="nav-item" href={`#/${page}`} aria-current={route.page === page ? 'page' : undefined}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>
          <span className="topbar__spacer" />
          <IconButton label="Tìm kiếm" icon={<Search size={20} aria-hidden="true" />} onClick={onOpenSearch} />
          <IconButton
            label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            icon={isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          />
          <IconButton label="Đăng xuất" icon={<LogOut size={20} aria-hidden="true" />} onClick={onLogout} />
        </header>

        <main id="main" tabIndex={-1}>{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Điều hướng nhanh">
        <a className="bottom-nav__item" href="#/heroes" aria-current={route.page === 'heroes' ? 'page' : undefined}>
          <Swords size={22} aria-hidden="true" /> Tướng
        </a>
        <button type="button" className="bottom-nav__item" onClick={onOpenSearch}>
          <Search size={22} aria-hidden="true" /> Tìm kiếm
        </button>
        <a className="bottom-nav__item" href="#/accounts" aria-current={route.page === 'accounts' ? 'page' : undefined}>
          <UsersRound size={22} aria-hidden="true" /> Tài khoản
        </a>
      </nav>
    </div>
  )
}
