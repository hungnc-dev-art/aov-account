'use client'

import { memo, useDeferredValue, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Download, FileSpreadsheet, Pencil, Plus, RotateCw, SearchX, Trash2, Upload, UsersRound } from 'lucide-react'
import type { Account } from '../types'
import { normalizeText } from '../utils/normalize'
import { accountLabel, findHero } from '../lib/catalog'
import { formatDateTime, formatRelative } from '../lib/format'
import { Panel } from './overlay'
import type { DataState } from '../App'
import { AvatarStack, Badge, Button, HeroAvatar, IconButton, Monogram, PasswordSecret, SearchField, Secret, Skeleton, StateView } from './ui'

type Filter = 'all' | 'missing-password' | 'unknown-hero'
type Sort = 'updated' | 'name' | 'heroes'

interface AccountsPageProps {
  accounts: Account[]
  dataState: DataState
  onRetry: () => void
  onOpen: (account: Account) => void
  onAdd: () => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
  onImport: () => void
  onExport: () => void
}

const hasUnknownHero = (account: Account) => account.heroes.some((name) => !findHero(name))

export function AccountsPage({ accounts, dataState, onRetry, onOpen, onAdd, onEdit, onDelete, onImport, onExport }: AccountsPageProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('updated')
  const deferredQuery = useDeferredValue(query)

  const missingPassword = useMemo(() => accounts.filter((account) => !account.hasPassword).length, [accounts])
  const unknownHero = useMemo(() => accounts.filter(hasUnknownHero).length, [accounts])

  const visible = useMemo(() => {
    const normalized = normalizeText(deferredQuery)
    const list = accounts.filter((account) => {
      if (filter === 'missing-password' && account.hasPassword) return false
      if (filter === 'unknown-hero' && !hasUnknownHero(account)) return false
      if (!normalized) return true
      return (
        normalizeText(account.username).includes(normalized) ||
        normalizeText(account.nickname).includes(normalized) ||
        account.heroNamesNormalized.some((name) => name.includes(normalized))
      )
    })
    if (sort === 'name') return list.toSorted((a, b) => accountLabel(a).localeCompare(accountLabel(b), 'vi'))
    if (sort === 'heroes') return list.toSorted((a, b) => b.heroes.length - a.heroes.length)
    return list.toSorted((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [accounts, deferredQuery, filter, sort])

  const ready = dataState === 'ready'
  const resetFilters = () => {
    setQuery('')
    setFilter('all')
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__titles">
          <p className="t-eyebrow">Quản lý kho</p>
          <h1 className="t-display">Tài khoản</h1>
          <p className="t-secondary" aria-live="polite">
            {ready
              ? `${accounts.length} tài khoản${missingPassword ? ` · ${missingPassword} chưa có mật khẩu` : ''}`
              : dataState === 'loading' ? 'Đang tải dữ liệu…' : 'Không tải được dữ liệu'}
          </p>
        </div>
        <div className="page-header__actions">
          <Button icon={<Upload size={16} aria-hidden="true" />} onClick={onImport}>Nhập Excel</Button>
          <Button variant="ghost" icon={<Download size={16} aria-hidden="true" />} onClick={onExport} disabled={!accounts.length || !ready}>Xuất</Button>
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={onAdd}>Thêm tài khoản</Button>
        </div>
      </header>

      {ready && accounts.length > 0 && (
        <div className="toolbar">
          <div className="toolbar__row">
            <SearchField value={query} onChange={setQuery} label="Tìm tài khoản" placeholder="Tìm username, tên tài khoản hoặc tướng…" />
          </div>
          <div className="chip-row" role="radiogroup" aria-label="Lọc tài khoản">
            <button type="button" role="radio" aria-checked={filter === 'all'} className="chip" onClick={() => setFilter('all')}>
              Tất cả <span className="count">{accounts.length}</span>
            </button>
            <button type="button" role="radio" aria-checked={filter === 'missing-password'} className="chip" onClick={() => setFilter('missing-password')}>
              <AlertTriangle size={14} aria-hidden="true" /> Chưa có mật khẩu <span className="count">{missingPassword}</span>
            </button>
            <button type="button" role="radio" aria-checked={filter === 'unknown-hero'} className="chip" onClick={() => setFilter('unknown-hero')}>
              Tướng ngoài danh mục <span className="count">{unknownHero}</span>
            </button>
          </div>
        </div>
      )}

      {dataState === 'loading' ? (
        <div className="acc-list" aria-busy="true" aria-label="Đang tải danh sách tài khoản">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="acc-row" style={{ contentVisibility: 'visible' }}>
              <div className="acc-row__name"><Skeleton width={40} height={40} radius={8} /><span style={{ display: 'grid', gap: 6, flex: 1 }}><Skeleton width="60%" /><Skeleton width="35%" height={12} /></span></div>
              <div className="acc-row__creds"><Skeleton height={36} /><Skeleton height={36} /></div>
              <div className="acc-row__heroes"><Skeleton width={140} height={32} radius={16} /></div>
            </div>
          ))}
        </div>
      ) : dataState === 'error' ? (
        <StateView
          kind="error"
          icon={<AlertCircle size={22} />}
          title="Không tải được danh sách tài khoản"
          description="Máy chủ hoặc kết nối đang gặp sự cố. Dữ liệu trong kho không bị thay đổi."
          actions={<Button variant="primary" icon={<RotateCw size={16} aria-hidden="true" />} onClick={onRetry}>Thử lại</Button>}
        />
      ) : !accounts.length ? (
        <StateView
          icon={<UsersRound size={22} />}
          title="Kho chưa có tài khoản nào"
          description="Nhập nhanh từ file Excel đang có, hoặc thêm từng tài khoản thủ công."
          actions={
            <>
              <Button variant="primary" icon={<FileSpreadsheet size={16} aria-hidden="true" />} onClick={onImport}>Nhập từ Excel</Button>
              <Button icon={<Plus size={16} aria-hidden="true" />} onClick={onAdd}>Thêm tài khoản</Button>
            </>
          }
        />
      ) : !visible.length ? (
        <StateView
          icon={<SearchX size={22} />}
          title="Không có tài khoản phù hợp"
          description={query ? `Không tìm thấy kết quả cho “${query}”. Thử username, tên tài khoản hoặc tên tướng khác.` : 'Không có tài khoản nào khớp bộ lọc hiện tại.'}
          actions={<Button onClick={resetFilters}>Xoá bộ lọc</Button>}
        />
      ) : (
        <>
          <div className="toolbar__meta results-meta">
            <span aria-live="polite">
              {visible.length === accounts.length ? `${accounts.length} tài khoản` : `Hiển thị ${visible.length} / ${accounts.length} tài khoản`}
            </span>
            <span className="results-meta__actions">
              <label className="sr-only" htmlFor="account-sort">Sắp xếp tài khoản</label>
              <select id="account-sort" className="select select--sm" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="updated">Mới cập nhật</option>
                <option value="name">Tên A → Z</option>
                <option value="heroes">Nhiều tướng nhất</option>
              </select>
            </span>
          </div>
          <div className="acc-list">
            <div className="acc-list__head" aria-hidden="true">
              <span>Tài khoản</span><span>Username</span><span>Mật khẩu</span><span>Tướng</span><span>Cập nhật</span><span />
            </div>
            <ul style={{ display: 'contents', listStyle: 'none' }} aria-label="Danh sách tài khoản">
              {visible.map((account) => (
                <AccountRow key={account.id} account={account} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

const AccountRow = memo(function AccountRow({ account, onOpen, onEdit, onDelete }: { account: Account; onOpen: (a: Account) => void; onEdit: (a: Account) => void; onDelete: (a: Account) => void }) {
  const label = accountLabel(account)
  const heroes = account.heroes.slice(0, 5).map((name) => findHero(name))
  return (
    <li className="acc-row">
      <button type="button" className="acc-row__name" onClick={() => onOpen(account)}>
        <Monogram text={label} />
        <span className="acc-row__text">
          <strong className="acc-row__title truncate" title={label}>{label}</strong>
          <span className="acc-row__sub truncate">{account.heroes.length} tướng{account.rank ? ` · ${account.rank}` : ''}</span>
        </span>
      </button>
      <div className="acc-row__creds">
        <div className="acc-row__cred"><span className="cred-label">Username</span><Secret kind="username" value={account.username} /></div>
        <div className="acc-row__cred"><span className="cred-label">Mật khẩu</span><PasswordSecret accountId={account.id} hasPassword={account.hasPassword} /></div>
      </div>
      <div className="acc-row__heroes">
        <AvatarStack heroes={heroes} names={account.heroes} />
        <time className="acc-row__updated" dateTime={account.updatedAt} title={formatDateTime(account.updatedAt)} suppressHydrationWarning>{formatRelative(account.updatedAt)}</time>
      </div>
      <time className="acc-row__updated-col" dateTime={account.updatedAt} title={formatDateTime(account.updatedAt)} suppressHydrationWarning>{formatRelative(account.updatedAt)}</time>
      <div className="acc-row__actions">
        <IconButton label={`Sửa ${label}`} icon={<Pencil size={16} aria-hidden="true" />} onClick={() => onEdit(account)} />
        <IconButton label={`Xoá ${label}`} variant="danger" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => onDelete(account)} />
      </div>
    </li>
  )
})

/* ---------- Account detail drawer ---------- */
export function AccountDrawer({ account, onClose, onEdit, onDelete, onOpenHero }: {
  account: Account | undefined
  onClose: () => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
  onOpenHero: (heroId: string) => void
}) {
  const [query, setQuery] = useState('')
  const heroes = useMemo(() => {
    if (!account) return []
    const normalized = normalizeText(query)
    return account.heroes
      .map((name) => ({ name, hero: findHero(name) }))
      .filter((item) => !normalized || normalizeText(item.name).includes(normalized))
  }, [account, query])

  if (!account) return null
  const label = accountLabel(account)
  const meta = [
    ['Rank', account.rank],
    ['Level', account.level],
    ['Vàng', account.gold],
    ['Tình trạng', account.status],
    ['Cập nhật', formatDateTime(account.updatedAt)],
  ].filter(([, value]) => value)

  return (
    <Panel
      open
      onClose={onClose}
      variant="drawer"
      width={560}
      full
      title={label}
      description={account.nickname ? account.username : 'Chưa đặt tên tài khoản'}
      footer={
        <>
          <Button variant="danger-soft" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => onDelete(account)}>Xoá</Button>
          <Button variant="primary" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => onEdit(account)}>Sửa tài khoản</Button>
        </>
      }
    >
      <div className="acc-detail">
        <section aria-label="Thông tin đăng nhập" className="cred-block">
          <div className="cred-block__row"><span className="cred-block__label">Username</span><Secret kind="username" value={account.username} /></div>
          <div className="cred-block__row"><span className="cred-block__label">Mật khẩu</span><PasswordSecret accountId={account.id} hasPassword={account.hasPassword} /></div>
        </section>

        {meta.length > 0 && (
          <dl className="meta-grid" style={{ margin: 0 }}>
            {meta.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
        {account.note && <p className="callout"><span>{account.note}</span></p>}

        <section>
          <div className="section-title">
            <h3>Tướng sở hữu</h3>
            <Badge tone="accent">{account.heroes.length}</Badge>
          </div>
          {account.heroes.length > 12 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <SearchField value={query} onChange={setQuery} label="Lọc tướng của tài khoản" placeholder="Lọc tướng…" />
            </div>
          )}
          <ul className="hero-chip-grid" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {heroes.map(({ name, hero }) => (
              <li key={name} style={{ minWidth: 0 }}>
                {hero ? (
                  <button type="button" className="hero-chip" onClick={() => onOpenHero(hero.id)}>
                    <HeroAvatar hero={hero} name={name} size="sm" />
                    <span>{name}</span>
                  </button>
                ) : (
                  <span className="hero-chip" data-unknown="true" title="Tướng không có trong danh mục — vẫn được lưu nguyên tên">
                    <HeroAvatar name={name} size="sm" />
                    <span>{name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Panel>
  )
}

/* ---------- Delete confirm ---------- */
export function DeleteDialog({ account, onCancel, onConfirm }: { account: Account | null; onCancel: () => void; onConfirm: (account: Account) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    if (busy) return
    setError('')
    onCancel()
  }
  const confirm = async () => {
    if (!account) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(account)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không xoá được tài khoản.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel
      open={Boolean(account)}
      onClose={close}
      role="alertdialog"
      width={440}
      initialFocus={cancelRef}
      title="Xoá tài khoản này?"
      description={account ? `“${accountLabel(account)}” (${account.username}) sẽ bị xoá vĩnh viễn khỏi kho. Thao tác không thể hoàn tác.` : undefined}
      footer={
        <>
          <Button ref={cancelRef} onClick={close} disabled={busy}>Huỷ</Button>
          <Button variant="danger" loading={busy} icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => void confirm()}>
            {busy ? 'Đang xoá…' : 'Xoá tài khoản'}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="callout callout--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div><strong>Chưa xoá được</strong><p>{error}</p></div>
        </div>
      ) : (
        <p className="t-secondary" style={{ fontSize: 'var(--text-sm)' }}>Mẹo: xuất Excel trước nếu bạn muốn giữ bản sao lưu.</p>
      )}
    </Panel>
  )
}
