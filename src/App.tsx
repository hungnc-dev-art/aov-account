'use client'

import { useEffect, useMemo, useState } from 'react'
import { Moon, Search, Sun } from 'lucide-react'
import { AccountManagementPage } from './components/AccountManagementPage'
import { FlySearch } from './components/FlySearch'
import { HeroCard } from './components/HeroCard'
import { HeroDetails } from './components/HeroDetails'
import { heroes } from './data/heroes'
import { listAccounts } from './lib/account-api'
import { migrateLegacyIndexedDb } from './lib/legacy-indexed-db'
import type { Account, Hero } from './types'
import { fuzzyMatch, normalizeText } from './utils/normalize'

function App() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [view, setView] = useState<'catalog' | 'accounts'>('catalog')
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const stored = localStorage.getItem('aov-theme')
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored)
        return
      }
      setTheme(
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('aov-theme', theme)
  }, [theme])

  const refreshAccounts = async () => {
    const nextAccounts = await listAccounts()
    setAccounts(nextAccounts)
    setAccountsLoading(false)
  }

  useEffect(() => {
    void (async () => {
      try {
        await migrateLegacyIndexedDb()
        await refreshAccounts()
      } catch {
        setAccountsLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const updateView = () =>
      setView(window.location.hash === '#accounts' ? 'accounts' : 'catalog')
    updateView()
    window.addEventListener('hashchange', updateView)
    return () => window.removeEventListener('hashchange', updateView)
  }, [])

  const accountByHero = useMemo(() => {
    const index = new Map<string, Account[]>()
    for (const account of accounts) {
      for (const heroName of account.heroNamesNormalized) {
        const owners = index.get(heroName)
        if (owners) owners.push(account)
        else index.set(heroName, [account])
      }
    }
    return index
  }, [accounts])

  const normalizedQuery = normalizeText(searchInput)
  const filteredHeroes = useMemo(() => {
    if (!normalizedQuery) return heroes
    return heroes.filter((hero) =>
      fuzzyMatch(hero.normalizedName, normalizedQuery),
    )
  }, [normalizedQuery])

  const selectedHeroAccounts = selectedHero
    ? (accountByHero.get(selectedHero.normalizedName) ?? [])
    : []

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Kho tài khoản Liên Quân">
          <span className="brand-mark">
            <img src="/assets/lien-quan-favicon.jpg" alt="" />
          </span>
          <span>
            <strong>Kho tài khoản</strong>
            <small>LIÊN QUÂN</small>
          </span>
        </a>
        <div className="topbar-actions">
          <a className="management-link" href={view === 'catalog' ? '#accounts' : '#top'}>
            {view === 'catalog' ? 'Quản lý account' : 'Danh mục tướng'}
          </a>
          <button
            className="icon-button theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Đổi giao diện"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
      </header>

      <main
        id="top"
        className={view === 'catalog' ? 'catalog-page' : 'management-page-shell'}
      >
        {view === 'catalog' ? (
          <>
        <section className="catalog-intro">
          <p className="eyebrow">DANH MỤC TƯỚNG</p>
          <h1>Khám phá tướng Liên Quân</h1>
          <p>Tìm nhanh theo tên và xem đầy đủ bộ kỹ năng của từng tướng.</p>
        </section>

        <div className="hero-search">
          <FlySearch
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm theo tên tướng, ví dụ: Điêu Thuyền…"
            ariaLabel="Tìm theo tên tướng"
          />
        </div>

        <section className="results">
          <div className="results-heading">
            <div>
              <p className="eyebrow">
                {normalizedQuery ? 'KẾT QUẢ TÌM KIẾM' : 'TẤT CẢ TƯỚNG'}
              </p>
              <h2>{filteredHeroes.length} tướng</h2>
            </div>
            {normalizedQuery && <span>“{searchInput.trim()}”</span>}
          </div>

          {filteredHeroes.length ? (
            <div className="hero-catalog-grid">
              {filteredHeroes.map((hero) => (
                <HeroCard
                  hero={hero}
                  onClick={() => setSelectedHero(hero)}
                  key={hero.id}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={30} />
              <h3>Không tìm thấy tướng</h3>
              <p>Hãy thử tên không dấu hoặc kiểm tra lại chính tả.</p>
            </div>
          )}
        </section>
          </>
        ) : (
          <AccountManagementPage
            accounts={accounts}
            loading={accountsLoading}
            onAccountsChanged={refreshAccounts}
            onHeroClick={setSelectedHero}
          />
        )}
      </main>

      <HeroDetails
        hero={selectedHero}
        accounts={selectedHeroAccounts}
        onClose={() => setSelectedHero(null)}
      />
    </div>
  )
}

export default App
