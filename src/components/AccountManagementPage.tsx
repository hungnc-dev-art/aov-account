import { useMemo, useState } from 'react'
import { Download, Plus, Search, Upload } from 'lucide-react'
import type { Account, AccountDraft, Hero, ImportResult } from '../types'
import {
  createAccount,
  deleteAccount as deleteAccountRequest,
  importAccounts as importAccountsRequest,
  updateAccount,
} from '../lib/account-api'
import { AccountCard } from './AccountCard'
import { AccountForm } from './AccountForm'
import { FlySearch } from './FlySearch'
import { ImportDialog } from './ImportDialog'
import { normalizeText } from '../utils/normalize'

interface AccountManagementPageProps {
  accounts: Account[]
  loading: boolean
  onAccountsChanged: () => Promise<void>
  onHeroClick: (hero: Hero) => void
}

export function AccountManagementPage({
  accounts,
  loading,
  onAccountsChanged,
  onHeroClick,
}: AccountManagementPageProps) {
  const [editing, setEditing] = useState<Account | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [accountQuery, setAccountQuery] = useState('')

  const filteredAccounts = useMemo(() => {
    const query = normalizeText(accountQuery)
    if (!query) return accounts
    return accounts.filter(
      (account) =>
        normalizeText(account.nickname).includes(query) ||
        normalizeText(account.username).includes(query),
    )
  }, [accountQuery, accounts])

  const saveAccount = async (draft: AccountDraft) => {
    if (editing?.id) {
      await updateAccount(editing.id, { ...editing, ...draft })
    } else {
      await createAccount(draft)
    }
    await onAccountsChanged()
  }

  const deleteAccount = async (account: Account) => {
    if (!account.id || !window.confirm(`Xoá tài khoản ${account.username}?`)) return
    await deleteAccountRequest(account.id)
    await onAccountsChanged()
  }

  const importAccounts = async (result: ImportResult, replace: boolean) => {
    await importAccountsRequest(result, replace)
    await onAccountsChanged()
  }

  const exportExcel = async () => {
    const { exportAccountsToExcel } = await import('../utils/excel')
    exportAccountsToExcel(accounts)
  }

  return (
    <section className="account-management-page">
      <div className="management-heading">
        <div>
          <p className="eyebrow">QUẢN LÝ DỮ LIỆU</p>
          <h1>Tài khoản Liên Quân</h1>
          <p>{accounts.length} tài khoản đang lưu trên Neon Postgres.</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={18} /> Thêm tài khoản
        </button>
      </div>

      <div className="management-toolbar">
        <FlySearch
          value={accountQuery}
          onChange={setAccountQuery}
          placeholder="Tìm theo tên tài khoản hoặc username…"
          ariaLabel="Tìm tài khoản"
        />
        <button
          className="button button--secondary"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={17} /> Import Excel
        </button>
        <button
          className="button button--ghost"
          onClick={() => void exportExcel()}
          disabled={!accounts.length}
        >
          <Download size={17} /> Export Excel
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Đang tải dữ liệu từ Neon Postgres…</div>
      ) : !filteredAccounts.length ? (
        <div className="empty-state account-search-empty">
          <Search size={28} />
          <h3>Không tìm thấy tài khoản</h3>
          <p>Thử tìm bằng tên tài khoản hoặc username khác.</p>
        </div>
      ) : (
        <div className="account-grid">
          {filteredAccounts.map((account) => (
            <AccountCard
              account={account}
              matchedHeroes={[]}
              onEdit={() => {
                setEditing(account)
                setFormOpen(true)
              }}
              onDelete={() => void deleteAccount(account)}
              onHeroClick={onHeroClick}
              key={account.id ?? account.username}
            />
          ))}
        </div>
      )}

      <AccountForm
        key={`${editing?.id ?? 'new'}-${formOpen ? 'open' : 'closed'}`}
        account={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={saveAccount}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importAccounts}
      />
    </section>
  )
}
