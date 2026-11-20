'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountDrawer, AccountsPage, DeleteDialog } from './components/accounts'
import { AccountFormDialog } from './components/account-form'
import { CatalogPage } from './components/catalog'
import { CommandPalette } from './components/command-palette'
import { ExportDialog, ImportWizard } from './components/excel-dialogs'
import { HeroDrawer } from './components/hero-drawer'
import { ReauthProvider } from './components/reauth'
import { AppShell } from './components/shell'
import { ToastProvider, useToast } from './components/toast'
import {
  createAccount,
  deleteAccount as deleteAccountRequest,
  importAccounts,
  isApiError,
  listAccounts,
  logout,
  onUnauthorized,
  updateAccount,
} from './lib/account-api'
import { accountLabel, allHeroes, buildOwnerIndex, heroById } from './lib/catalog'
import { readLegacyAccounts, runLegacyMigration } from './lib/legacy-indexed-db'
import { useHashRoute } from './lib/navigation'
import type { Account, AccountDraft, Hero, ImportSummary } from './types'

export type DataState = 'ready' | 'loading' | 'error'
type FormState = { key: number; account: Account | null; presetHero?: Hero }

const EMPTY: Account[] = []
let legacyMigrationStarted = false

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return window.localStorage
  } catch {
    const memory = new Map<string, string>()
    return { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => void memory.set(key, value) }
  }
}

export default function App() {
  return (
    <ToastProvider>
      <ReauthProvider>
        <AppContent />
      </ReauthProvider>
    </ToastProvider>
  )
}

function AppContent() {
  const toast = useToast()
  const [route, navigate] = useHashRoute()
  const [accounts, setAccounts] = useState<Account[]>(EMPTY)
  const [dataState, setDataState] = useState<DataState>('loading')
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [importKey, setImportKey] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const formSeq = useRef(0)
  const loaded = useRef(false)

  const visibleAccounts = dataState === 'ready' ? accounts : EMPTY
  const ownerIndex = useMemo(() => buildOwnerIndex(visibleAccounts), [visibleAccounts])
  const selectedHero = route.page === 'heroes' && route.id ? heroById.get(route.id) : undefined
  const selectedAccount = route.page === 'accounts' && route.id ? visibleAccounts.find((account) => String(account.id) === route.id) : undefined

  /** Tải lại danh sách. Lỗi lần đầu → trạng thái lỗi (không giả làm kho rỗng); lỗi khi đã có dữ liệu → toast. */
  const refresh = useCallback(async () => {
    if (!loaded.current) setDataState('loading')
    try {
      const list = await listAccounts()
      setAccounts(list)
      setDataState('ready')
      loaded.current = true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tải được danh sách tài khoản.'
      if (loaded.current) toast({ tone: 'error', title: 'Không làm mới được danh sách', description: message })
      else setDataState('error')
    }
  }, [toast])

  useEffect(() => {
    onUnauthorized(() => window.location.assign('/login'))
    return () => onUnauthorized(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // B1: luôn tải danh sách trước; migrate IndexedDB cũ chạy nền sau đó và không chặn gì.
      await refresh()
      if (cancelled || legacyMigrationStarted) return
      legacyMigrationStarted = true
      const outcome = await runLegacyMigration({
        readLegacy: readLegacyAccounts,
        importRows: (rows) => importAccounts({ mode: 'create-only', accounts: rows }),
        storage: safeStorage(),
        isAuthError: (error) => isApiError(error) && (error.status === 401 || error.status === 403),
      })
      if (outcome.status !== 'done') return
      const { created, skipped, invalid } = outcome.summary
      if (created > 0) await refresh()
      if (created || skipped || invalid) {
        toast({
          tone: created ? 'success' : 'info',
          title: `Đã chuyển ${created} tài khoản từ bộ nhớ trình duyệt cũ`,
          description: `${skipped} đã có trên máy chủ (giữ nguyên) · ${invalid} không hợp lệ`,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, toast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openForm = (account: Account | null, presetHero?: Hero) => {
    formSeq.current += 1
    setForm({ key: formSeq.current, account, presetHero })
  }

  // Lỗi được ném lại cho form/dialog để hiển thị tại chỗ (B4, B5) — không có promise bị bỏ rơi.
  const saveAccount = async (draft: AccountDraft, id?: number) => {
    if (id) await updateAccount(id, draft)
    else await createAccount(draft)
    setForm(null)
    toast({ tone: 'success', title: id ? 'Đã lưu thay đổi' : 'Đã thêm tài khoản', description: draft.username })
    await refresh()
  }

  const deleteAccount = async (account: Account) => {
    await deleteAccountRequest(account.id)
    setDeleting(null)
    if (route.page === 'accounts' && route.id === String(account.id)) navigate({ page: 'accounts' })
    toast({ tone: 'success', title: 'Đã xoá tài khoản', description: accountLabel(account) })
    await refresh()
  }

  const onImported = (summary: ImportSummary) => {
    toast({ tone: 'success', title: `Đã nhập ${summary.created + summary.updated} tài khoản`, description: summary.warnings.length ? `${summary.warnings.length} cảnh báo` : undefined })
    void refresh()
  }

  const signOut = async () => {
    await logout().catch(() => {})
    window.location.assign('/login')
  }

  return (
    <>
      <AppShell
        route={route}
        heroCount={allHeroes.length}
        accountCount={dataState === 'ready' ? accounts.length : null}
        onOpenSearch={() => setPaletteOpen(true)}
        onImport={() => setImportKey((key) => key + 1)}
        onExport={() => setExportOpen(true)}
        onLogout={() => void signOut()}
      >
        {route.page === 'heroes' ? (
          <CatalogPage ownerIndex={ownerIndex} dataState={dataState} accountCount={visibleAccounts.length} onOpenHero={(hero) => navigate({ page: 'heroes', id: hero.id })} onRetry={() => void refresh()} />
        ) : (
          <AccountsPage
            accounts={visibleAccounts}
            dataState={dataState}
            onRetry={() => void refresh()}
            onOpen={(account) => navigate({ page: 'accounts', id: String(account.id) })}
            onAdd={() => openForm(null)}
            onEdit={(account) => openForm(account)}
            onDelete={setDeleting}
            onImport={() => setImportKey((key) => key + 1)}
            onExport={() => setExportOpen(true)}
          />
        )}
      </AppShell>

      <HeroDrawer
        hero={selectedHero}
        owners={selectedHero ? (ownerIndex.get(selectedHero.normalizedName) ?? EMPTY) : EMPTY}
        dataState={dataState}
        onClose={() => navigate({ page: 'heroes' })}
        onOpenAccount={(account) => navigate({ page: 'accounts', id: String(account.id) })}
        onAddWithHero={(hero) => openForm(null, hero)}
      />
      <AccountDrawer
        key={selectedAccount?.id ?? 'none'}
        account={selectedAccount}
        onClose={() => navigate({ page: 'accounts' })}
        onEdit={(account) => openForm(account)}
        onDelete={setDeleting}
        onOpenHero={(heroId) => navigate({ page: 'heroes', id: heroId })}
      />
      {form && <AccountFormDialog key={form.key} account={form.account} presetHero={form.presetHero} onClose={() => setForm(null)} onSave={saveAccount} />}
      <DeleteDialog account={deleting} onCancel={() => setDeleting(null)} onConfirm={deleteAccount} />
      {importKey > 0 && (
        <ImportWizard
          key={importKey}
          existingAccounts={visibleAccounts}
          onClose={() => setImportKey(0)}
          onImported={onImported}
          onViewAccounts={() => {
            setImportKey(0)
            navigate({ page: 'accounts' })
          }}
        />
      )}
      {exportOpen && <ExportDialog count={visibleAccounts.length} onClose={() => setExportOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          accounts={visibleAccounts}
          ownerIndex={ownerIndex}
          onClose={() => setPaletteOpen(false)}
          onPickHero={(hero) => {
            setPaletteOpen(false)
            navigate({ page: 'heroes', id: hero.id })
          }}
          onPickAccount={(account) => {
            setPaletteOpen(false)
            navigate({ page: 'accounts', id: String(account.id) })
          }}
        />
      )}
    </>
  )
}
