'use client'

import { memo, useDeferredValue, useMemo, useState } from 'react'
import { AlertCircle, CircleSlash, Layers, RotateCw, SearchX, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import type { Account, Hero, HeroRole } from '../types'
import { fuzzyMatch, normalizeText } from '../utils/normalize'
import { ROLES, allHeroes } from '../lib/catalog'
import type { DataState } from '../App'
import { Button, SearchField, Segmented, Skeleton, StateView, cx } from './ui'

type Ownership = 'all' | 'owned' | 'unowned'

interface CatalogProps {
  ownerIndex: Map<string, Account[]>
  dataState: DataState
  accountCount: number
  onOpenHero: (hero: Hero) => void
  onRetry: () => void
}

export function CatalogPage({ ownerIndex, dataState, accountCount, onOpenHero, onRetry }: CatalogProps) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'all' | HeroRole>('all')
  const [ownership, setOwnership] = useState<Ownership>('all')
  const [sort, setSort] = useState<'name' | 'owners'>('name')
  const deferredQuery = useDeferredValue(query)
  const ready = dataState === 'ready'
  const ownersOf = (hero: Hero) => ownerIndex.get(hero.normalizedName)?.length ?? 0

  const ownedCount = useMemo(() => allHeroes.filter((hero) => ownerIndex.has(hero.normalizedName)).length, [ownerIndex])
  const roleCounts = useMemo(() => {
    const counts = new Map<HeroRole, number>()
    for (const hero of allHeroes) for (const heroRole of hero.roles) counts.set(heroRole, (counts.get(heroRole) ?? 0) + 1)
    return counts
  }, [])

  const filtered = useMemo(() => {
    const normalized = normalizeText(deferredQuery)
    const list = allHeroes.filter((hero) => {
      if (normalized && !fuzzyMatch(hero.normalizedName, normalized)) return false
      if (role !== 'all' && !hero.roles.includes(role)) return false
      if (ownership !== 'all' && ready) {
        const owned = ownerIndex.has(hero.normalizedName)
        if ((ownership === 'owned') !== owned) return false
      }
      return true
    })
    if (sort === 'owners') {
      return list.toSorted((a, b) => (ownerIndex.get(b.normalizedName)?.length ?? 0) - (ownerIndex.get(a.normalizedName)?.length ?? 0))
    }
    return list
  }, [deferredQuery, role, ownership, sort, ownerIndex, ready])

  const filtersActive = Boolean(query) || role !== 'all' || ownership !== 'all'
  const resetFilters = () => {
    setQuery('')
    setRole('all')
    setOwnership('all')
  }
  const coverage = Math.round((ownedCount / allHeroes.length) * 100)

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__titles">
          <p className="t-eyebrow">Danh mục tướng</p>
          <h1 className="t-display">Tướng & tài khoản sở hữu</h1>
          <p className="t-secondary">Tìm tướng, xem kỹ năng và biết ngay tài khoản nào đang sở hữu.</p>
        </div>
      </header>

      <section className="kpis" aria-label="Tổng quan kho">
        <div className="kpi kpi--feature">
          <span className="kpi__label"><Layers size={16} aria-hidden="true" /> Tướng trong danh mục</span>
          <span className="kpi__value">{allHeroes.length}</span>
        </div>
        <button type="button" className="kpi" onClick={() => setOwnership('owned')} disabled={!ready} aria-label={`Lọc ${ownedCount} tướng đã có tài khoản`}>
          <span className="kpi__label"><ShieldCheck size={16} aria-hidden="true" /> Tướng đã có tài khoản</span>
          {ready ? (
            <>
              <span className="kpi__value">{ownedCount}<small>/ {allHeroes.length}</small></span>
              <span className="progress" aria-hidden="true"><span style={{ width: `${coverage}%` }} /></span>
            </>
          ) : <Skeleton width={96} height={28} />}
        </button>
        <button type="button" className="kpi" onClick={() => setOwnership('unowned')} disabled={!ready} aria-label={`Lọc ${allHeroes.length - ownedCount} tướng chưa có tài khoản`}>
          <span className="kpi__label"><CircleSlash size={16} aria-hidden="true" /> Chưa có tài khoản</span>
          {ready ? <span className="kpi__value">{allHeroes.length - ownedCount}</span> : <Skeleton width={64} height={28} />}
        </button>
        <a className="kpi" href="#/accounts">
          <span className="kpi__label"><UsersRound size={16} aria-hidden="true" /> Tài khoản trong kho</span>
          {ready ? <span className="kpi__value">{accountCount}</span> : <Skeleton width={64} height={28} />}
        </a>
      </section>

      {dataState === 'error' && (
        <div className="banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={18} aria-hidden="true" />
          <span className="banner__text">Không tải được dữ liệu tài khoản. Danh mục tướng vẫn dùng bình thường, số tài khoản sở hữu tạm ẩn.</span>
          <Button size="sm" icon={<RotateCw size={14} aria-hidden="true" />} onClick={onRetry}>Thử lại</Button>
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar__row">
          <SearchField value={query} onChange={setQuery} label="Tìm theo tên tướng" placeholder="Tìm tướng, ví dụ: Điêu Thuyền…" />
          <Segmented
            label="Lọc theo sở hữu"
            value={ownership}
            onChange={setOwnership}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'owned', label: 'Có tài khoản' },
              { value: 'unowned', label: 'Chưa có' },
            ]}
          />
        </div>
        <div className="chip-row" role="radiogroup" aria-label="Lọc theo vai trò">
          <button type="button" role="radio" aria-checked={role === 'all'} className="chip" onClick={() => setRole('all')}>
            Tất cả <span className="count">{allHeroes.length}</span>
          </button>
          {ROLES.map((item) => (
            <button key={item} type="button" role="radio" aria-checked={role === item} className="chip" data-role={item} onClick={() => setRole(item)}>
              <span className="role-dot" aria-hidden="true" />
              {item} <span className="count">{roleCounts.get(item) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar__meta results-meta">
        <span aria-live="polite">
          {filtersActive ? `Hiển thị ${filtered.length} / ${allHeroes.length} tướng` : `${allHeroes.length} tướng`}
        </span>
        <span className="results-meta__actions">
          {filtersActive && <Button size="sm" variant="ghost" onClick={resetFilters}>Xoá bộ lọc</Button>}
          <label className="sr-only" htmlFor="hero-sort">Sắp xếp tướng</label>
          <select id="hero-sort" className="select select--sm" value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'owners')}>
            <option value="name">Tên A → Z</option>
            <option value="owners">Nhiều tài khoản nhất</option>
          </select>
        </span>
      </div>

      {filtered.length ? (
        <ul className="hero-grid" role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filtered.map((hero, index) => (
            <li key={hero.id} style={{ minWidth: 0 }}>
              <HeroCard hero={hero} owners={ready ? ownersOf(hero) : null} priority={index < 12} onOpen={onOpenHero} />
            </li>
          ))}
        </ul>
      ) : (
        <StateView
          icon={<SearchX size={22} />}
          title="Không tìm thấy tướng phù hợp"
          description="Thử tên không dấu, bỏ bớt bộ lọc vai trò hoặc trạng thái sở hữu."
          actions={<Button onClick={resetFilters}>Xoá bộ lọc</Button>}
        />
      )}
    </div>
  )
}

const HeroCard = memo(function HeroCard({ hero, owners, priority, onOpen }: { hero: Hero; owners: number | null; priority: boolean; onOpen: (hero: Hero) => void }) {
  return (
    <button type="button" className="hero-card" onClick={() => onOpen(hero)} aria-label={`${hero.name}${owners ? `, ${owners} tài khoản sở hữu` : ''}`}>
      <span className="hero-card__art">
        {hero.imageUrl ? (
          <img src={hero.imageUrl} alt="" width={136} height={136} loading={priority ? 'eager' : 'lazy'} decoding="async" />
        ) : null}
        {owners === null ? null : owners > 0 ? (
          <span className="hero-card__owners" aria-hidden="true"><UserRound size={12} strokeWidth={2.5} /> {owners}</span>
        ) : null}
      </span>
      <span className="hero-card__body">
        <span className="hero-card__name">{hero.name}</span>
        <span className={cx('hero-card__role')} data-role={hero.roles[0]}>
          <span className="role-dot" aria-hidden="true" />
          <span>{hero.roles.length ? hero.roles.join(' · ') : 'Đang cập nhật'}</span>
        </span>
      </span>
    </button>
  )
})
