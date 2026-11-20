'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, ArrowUpRight, ExternalLink, Plus, UserRoundX, X } from 'lucide-react'
import type { Account, Hero } from '../types'
import { normalizeText } from '../utils/normalize'
import { accountLabel } from '../lib/catalog'
import { Panel } from './overlay'
import type { DataState } from '../App'
import { Badge, Button, HeroAvatar, IconButton, Monogram, PasswordSecret, RoleBadge, SearchField, Secret, Skeleton, StateView, Tabs } from './ui'

interface HeroDrawerProps {
  hero: Hero | undefined
  owners: Account[]
  dataState: DataState
  onClose: () => void
  onOpenAccount: (account: Account) => void
  onAddWithHero: (hero: Hero) => void
}

export function HeroDrawer({ hero, owners, dataState, onClose, onOpenAccount, onAddWithHero }: HeroDrawerProps) {
  return (
    <Panel open={Boolean(hero)} onClose={onClose} variant="drawer" width={560} visuallyHiddenTitle title={hero?.name ?? ''} full>
      {hero && <HeroDrawerBody key={hero.id} hero={hero} owners={owners} dataState={dataState} onClose={onClose} onOpenAccount={onOpenAccount} onAddWithHero={onAddWithHero} />}
    </Panel>
  )
}

function HeroDrawerBody({ hero, owners, dataState, onClose, onOpenAccount, onAddWithHero }: HeroDrawerProps & { hero: Hero }) {
  // Tab mặc định theo dữ liệu (kể cả khi danh sách còn đang tải qua deep-link) cho tới khi người dùng tự chọn.
  const [chosenTab, setTab] = useState<'owners' | 'skills' | null>(null)
  const tab = chosenTab ?? (owners.length || dataState === 'loading' ? 'owners' : 'skills')
  const [query, setQuery] = useState('')
  const loading = dataState === 'loading'
  const filteredOwners = useMemo(() => {
    const normalized = normalizeText(query)
    if (!normalized) return owners
    return owners.filter((account) => normalizeText(`${account.nickname} ${account.username}`).includes(normalized))
  }, [owners, query])

  return (
    <>
      <div className="hero-hero">
        {hero.imageUrl && <div className="hero-hero__backdrop" style={{ backgroundImage: `url(${hero.imageUrl})` }} aria-hidden="true" />}
        <div className="hero-hero__close">
          <IconButton label="Đóng" variant="outline" icon={<X size={20} aria-hidden="true" />} onClick={onClose} data-autofocus />
        </div>
        <div className="hero-hero__row">
          <HeroAvatar hero={hero} name={hero.name} size="xl" priority />
          <div className="hero-hero__info">
            <p className="t-eyebrow">Tướng</p>
            <p className="t-display" aria-hidden="true" style={{ fontWeight: 700 }}>{hero.name}</p>
            <div className="hero-hero__meta">
              {hero.roles.map((role) => <RoleBadge key={role} role={role} />)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <a className="btn btn--ghost btn--sm" href={hero.sourceUrl} target="_blank" rel="noreferrer">
            Nguồn Garena <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <Tabs
        label="Thông tin tướng"
        idPrefix={`hero-${hero.id}`}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'owners', label: 'Tài khoản sở hữu', count: loading ? undefined : owners.length },
          { id: 'skills', label: 'Kỹ năng', count: hero.skills.length },
        ]}
      />

      <div
        role="tabpanel"
        id={`hero-${hero.id}-panel-${tab}`}
        aria-labelledby={`hero-${hero.id}-tab-${tab}`}
        tabIndex={0}
        style={{ paddingTop: 'var(--space-4)' }}
      >
        {tab === 'skills' ? (
          hero.skills.length ? (
            <ol className="skill-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {hero.skills.map((skill, index) => (
                <li key={skill.name} className="skill-row">
                  {skill.iconUrl ? <img src={skill.iconUrl} alt="" width={44} height={44} loading="lazy" /> : <span className="avatar avatar--md" aria-hidden="true">{index}</span>}
                  <div>
                    <div className="skill-row__head">
                      <strong>{skill.name}</strong>
                      <Badge>{index === 0 ? 'Nội tại' : `Kỹ năng ${index}`}</Badge>
                    </div>
                    <p>{skill.description.replace(/^Nội tại:\s*/, '')}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <StateView icon={<AlertCircle size={22} />} title="Chưa có dữ liệu kỹ năng" description="Chạy lại cập nhật dữ liệu tướng để bổ sung." />
          )
        ) : loading ? (
          <div className="owner-list" aria-busy="true" aria-label="Đang tải tài khoản">
            {[0, 1, 2].map((item) => <Skeleton key={item} height={112} radius={12} />)}
          </div>
        ) : dataState === 'error' ? (
          <StateView kind="error" icon={<AlertCircle size={22} />} title="Không tải được tài khoản" description="Danh sách tài khoản sở hữu tạm thời không khả dụng. Thử lại sau ít phút." />
        ) : owners.length ? (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {owners.length > 4 && (
              <SearchField value={query} onChange={setQuery} label={`Lọc tài khoản sở hữu ${hero.name}`} placeholder="Lọc theo tên hoặc username…" />
            )}
            <ul className="owner-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {filteredOwners.map((account) => (
                <li key={account.id} className="owner-row">
                  <div className="owner-row__name">
                    <Monogram text={accountLabel(account)} />
                    <div style={{ minWidth: 0 }}>
                      <strong className="truncate">{accountLabel(account)}</strong>
                      <span className="t-caption">{account.heroes.length} tướng{account.rank ? ` · ${account.rank}` : ''}</span>
                    </div>
                  </div>
                  <IconButton label={`Mở chi tiết ${accountLabel(account)}`} icon={<ArrowUpRight size={18} aria-hidden="true" />} onClick={() => onOpenAccount(account)} />
                  <div className="owner-row__creds">
                    <div className="owner-row__cred"><span className="cred-label">Username</span><Secret kind="username" value={account.username} /></div>
                    <div className="owner-row__cred"><span className="cred-label">Mật khẩu</span><PasswordSecret accountId={account.id} hasPassword={account.hasPassword} /></div>
                  </div>
                </li>
              ))}
            </ul>
            {!filteredOwners.length && <p className="t-secondary" style={{ textAlign: 'center' }}>Không có tài khoản khớp “{query}”.</p>}
          </div>
        ) : (
          <StateView
            icon={<UserRoundX size={22} />}
            title={`Chưa có tài khoản sở hữu ${hero.name}`}
            description="Thêm tài khoản mới với tướng này được chọn sẵn, hoặc nhập từ Excel."
            actions={<Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => onAddWithHero(hero)}>Thêm tài khoản</Button>}
          />
        )}
      </div>
    </>
  )
}
