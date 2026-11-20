'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import type { Account, Hero } from '../types'
import { fuzzyMatch, normalizeText } from '../utils/normalize'
import { accountLabel, allHeroes } from '../lib/catalog'
import { Panel } from './overlay'
import { HeroAvatar, Monogram } from './ui'

type Item = { kind: 'hero'; hero: Hero; owners: number } | { kind: 'account'; account: Account }

export function CommandPalette({ accounts, ownerIndex, onClose, onPickHero, onPickAccount }: {
  accounts: Account[]
  ownerIndex: Map<string, Account[]>
  onClose: () => void
  onPickHero: (hero: Hero) => void
  onPickAccount: (account: Account) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const groups = useMemo(() => {
    const normalized = normalizeText(query)
    const heroes = normalized
      ? allHeroes.filter((hero) => fuzzyMatch(hero.normalizedName, normalized))
      : allHeroes.toSorted((a, b) => (ownerIndex.get(b.normalizedName)?.length ?? 0) - (ownerIndex.get(a.normalizedName)?.length ?? 0))
    const matched = normalized
      ? accounts.filter((account) =>
          normalizeText(account.username).includes(normalized) ||
          normalizeText(account.nickname).includes(normalized) ||
          account.heroNamesNormalized.includes(normalized))
      : accounts.toSorted((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    return {
      heroes: heroes.slice(0, 6).map((hero): Item => ({ kind: 'hero', hero, owners: ownerIndex.get(hero.normalizedName)?.length ?? 0 })),
      accounts: matched.slice(0, 6).map((account): Item => ({ kind: 'account', account })),
      heading: normalized ? null : { heroes: 'Tướng nhiều tài khoản nhất', accounts: 'Tài khoản cập nhật gần đây' },
    }
  }, [query, accounts, ownerIndex])

  const items = [...groups.heroes, ...groups.accounts]
  const pick = (item: Item | undefined) => {
    if (!item) return
    if (item.kind === 'hero') onPickHero(item.hero)
    else onPickAccount(item.account)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(items[active])
    }
  }
  const optionId = (index: number) => `${listId}-opt-${index}`

  const renderItem = (item: Item, index: number) => (
    <li key={item.kind === 'hero' ? `h-${item.hero.id}` : `a-${item.account.id}`} role="none">
      <button
        type="button"
        role="option"
        id={optionId(index)}
        aria-selected={index === active}
        tabIndex={-1}
        className="cmdk-item"
        onMouseEnter={() => setActive(index)}
        onClick={() => pick(item)}
      >
        {item.kind === 'hero' ? (
          <>
            <HeroAvatar hero={item.hero} name={item.hero.name} size="sm" />
            <span className="truncate">{item.hero.name}</span>
            <small>{item.owners ? `${item.owners} tài khoản` : item.hero.roles.join(' · ')}</small>
          </>
        ) : (
          <>
            <Monogram text={accountLabel(item.account)} />
            <span style={{ minWidth: 0, display: 'grid' }}>
              <span className="truncate">{accountLabel(item.account)}</span>
              <span className="t-caption truncate" translate="no">{item.account.username}</span>
            </span>
            <small>{item.account.heroes.length} tướng</small>
          </>
        )}
        {index === active && <CornerDownLeft size={14} aria-hidden="true" style={{ color: 'var(--text-tertiary)', flex: 'none' }} />}
      </button>
    </li>
  )

  return (
    <Panel open onClose={onClose} width={600} visuallyHiddenTitle title="Tìm kiếm nhanh" className="cmdk" initialFocus={inputRef}>
      <div className="input-wrap cmdk-input">
        <Search size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={items.length ? optionId(active) : undefined}
          aria-label="Tìm tướng hoặc tài khoản"
          placeholder="Tìm tướng, username, tên tài khoản…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="kbd" aria-hidden="true">Esc</span>
      </div>
      <div id={listId} role="listbox" aria-label="Kết quả">
        {groups.heroes.length > 0 && (
          <div className="cmdk-group" role="presentation">
            <p className="cmdk-group__label">{groups.heading?.heroes ?? `Tướng (${groups.heroes.length})`}</p>
            <ul role="group" aria-label="Tướng" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {groups.heroes.map((item, index) => renderItem(item, index))}
            </ul>
          </div>
        )}
        {groups.accounts.length > 0 && (
          <div className="cmdk-group" role="presentation">
            <p className="cmdk-group__label">{groups.heading?.accounts ?? `Tài khoản (${groups.accounts.length})`}</p>
            <ul role="group" aria-label="Tài khoản" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {groups.accounts.map((item, index) => renderItem(item, groups.heroes.length + index))}
            </ul>
          </div>
        )}
        {!items.length && <p className="cmdk-empty">Không có tướng hoặc tài khoản khớp “{query}”.</p>}
      </div>
    </Panel>
  )
}
