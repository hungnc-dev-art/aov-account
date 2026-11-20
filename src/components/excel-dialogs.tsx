'use client'

import { useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertCircle, AlertTriangle, ArrowLeft, Check, CircleX, Download, FileSpreadsheet, GitMerge, Replace } from 'lucide-react'
import { exportAccounts, importAccounts } from '../lib/account-api'
import { findHero } from '../lib/catalog'
import { timestampSlug } from '../lib/format'
import type { Account, ImportMode, ImportResult, ImportSummary } from '../types'
import { Panel } from './overlay'
import { ReauthCancelledError, useReauth } from './reauth'
import { useToast } from './toast'
import { Badge, Button, cx, Field, useFieldId } from './ui'

const REPLACE_PHRASE = 'THAY THẾ'
type Step = 'select' | 'review' | 'confirm' | 'done'
const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'select', label: 'Chọn file' },
  { id: 'review', label: 'Kiểm tra' },
  { id: 'confirm', label: 'Xác nhận' },
  { id: 'done', label: 'Kết quả' },
]
const usernameKey = (username: string) => username.trim().toLowerCase()

/** Component được mount mới mỗi lần mở → không giữ kết quả/chế độ cũ (B6, S11). */
export function ImportWizard({ existingAccounts, onClose, onImported, onViewAccounts }: {
  existingAccounts: Account[]
  onClose: () => void
  onImported: (summary: ImportSummary) => void
  onViewAccounts: () => void
}) {
  const toast = useToast()
  const withReauth = useReauth()
  const [step, setStep] = useState<Step>('select')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [drag, setDrag] = useState(false)
  const [mode, setMode] = useState<Extract<ImportMode, 'merge' | 'replace'>>('merge')
  const [confirmText, setConfirmText] = useState('')
  const [backup, setBackup] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const backupDone = useRef(false)
  const confirmId = useFieldId()
  const existingCount = existingAccounts.length
  const replaceConfirmed = confirmText.normalize('NFC').trim().toLocaleUpperCase('vi') === REPLACE_PHRASE

  const stats = useMemo(() => {
    if (!result) return null
    const existing = new Set(existingAccounts.map((account) => usernameKey(account.username)))
    const heroes = new Set<string>()
    const unknown = new Set<string>()
    for (const row of result.accounts) {
      for (const name of row.heroes) {
        heroes.add(name)
        if (!findHero(name)) unknown.add(name)
      }
    }
    const matches = result.accounts.filter((row) => existing.has(usernameKey(row.username))).length
    return {
      valid: result.accounts.length,
      matches,
      fresh: result.accounts.length - matches,
      heroes: heroes.size,
      unknown: [...unknown],
      missingPasswords: result.accounts.filter((row) => !row.password).length,
    }
  }, [result, existingAccounts])

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setParseError('')
    setResult(null)
    setParsing(true)
    try {
      const { parseExcelFile, validateExcelFile } = await import('../utils/excel')
      const invalid = await validateExcelFile(file)
      if (invalid) {
        setParseError(invalid)
        return
      }
      const parsed = await parseExcelFile(file)
      if (!parsed.accounts.length) {
        setParseError(parsed.errors[0] ?? 'Không tìm thấy tài khoản hợp lệ trong file.')
        return
      }
      setResult(parsed)
      setStep('review')
    } catch {
      setParseError('Không đọc được file. Hãy kiểm tra file có bị hỏng hoặc được bảo vệ bằng mật khẩu không.')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDrag(false)
    const file = event.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const runImport = async () => {
    if (!result) return
    setImporting(true)
    setImportError('')
    try {
      const done = await withReauth(async () => {
        if (mode === 'replace' && backup && !backupDone.current) {
          const rows = await exportAccounts(true)
          const { exportAccountsToExcel } = await import('../utils/excel')
          exportAccountsToExcel(rows, true, `aov-sao-luu-truoc-thay-the-${timestampSlug()}`)
          backupDone.current = true
          toast({ tone: 'info', title: 'Đã tải bản sao lưu', description: `${rows.length} tài khoản · lưu file ở nơi an toàn` })
        }
        return importAccounts({
          mode,
          accounts: result.accounts,
          ...(mode === 'replace' ? { confirm: { phrase: confirmText, expectedCount: existingCount } } : {}),
        })
      })
      setSummary(done)
      setStep('done')
      onImported(done)
    } catch (error) {
      if (error instanceof ReauthCancelledError) return
      setImportError(error instanceof Error ? error.message : 'Không nhập được dữ liệu.')
    } finally {
      setImporting(false)
    }
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step)
  const footer = step === 'select' ? (
    <Button onClick={onClose}>Huỷ</Button>
  ) : step === 'review' ? (
    <>
      <Button icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => setStep('select')}>Chọn file khác</Button>
      <Button variant="primary" onClick={() => setStep('confirm')}>Tiếp tục</Button>
    </>
  ) : step === 'confirm' ? (
    <>
      <Button icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => setStep('review')} disabled={importing}>Quay lại</Button>
      <Button
        variant={mode === 'replace' ? 'danger' : 'primary'}
        loading={importing}
        disabled={mode === 'replace' && !replaceConfirmed}
        onClick={() => void runImport()}
      >
        {importing ? 'Đang nhập…' : mode === 'replace' ? `Thay thế bằng ${stats?.valid ?? 0} tài khoản` : `Gộp ${stats?.valid ?? 0} tài khoản`}
      </Button>
    </>
  ) : (
    <>
      <Button onClick={onClose}>Đóng</Button>
      <Button variant="primary" onClick={onViewAccounts}>Xem danh sách tài khoản</Button>
    </>
  )

  return (
    <Panel open onClose={importing ? () => {} : onClose} width={680} full title="Nhập tài khoản từ Excel" description="Dữ liệu chỉ được ghi sau khi bạn xác nhận ở bước 3." footer={footer}>
      <ol className="stepper" aria-label="Các bước nhập" style={{ marginBottom: 'var(--space-5)' }}>
        {STEPS.map((item, index) => (
          <li key={item.id} data-state={index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo'} aria-current={index === stepIndex ? 'step' : undefined}>
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>

      {step === 'select' && (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            className="dropzone"
            data-drag={drag || undefined}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            aria-busy={parsing}
            disabled={parsing}
            data-autofocus
          >
            <span className="dropzone__icon" aria-hidden="true">{parsing ? <span className="spinner" /> : <FileSpreadsheet size={26} />}</span>
            <strong>{parsing ? `Đang phân tích ${fileName}…` : 'Kéo thả file vào đây hoặc bấm để chọn'}</strong>
            <p>.xlsx, .xls hoặc .csv · tối đa 5 MB · tự chọn sheet có dữ liệu đầy đủ nhất</p>
          </button>
          {parseError && (
            <div className="callout callout--danger" role="alert">
              <CircleX size={18} aria-hidden="true" />
              <div><strong>{fileName ? `${fileName}: không đọc được dữ liệu` : 'Không đọc được dữ liệu'}</strong><p>{parseError}</p></div>
            </div>
          )}
          <details className="format-list">
            <summary>Các định dạng được hỗ trợ</summary>
            <ul>
              <li><strong>Ma trận cột</strong>: mỗi tài khoản một cột, tướng theo hàng, đánh dấu x / 1 / có.</li>
              <li><strong>Ma trận hàng</strong>: mỗi tài khoản một hàng, mỗi tướng một cột.</li>
              <li><strong>Bảng phẳng</strong>: cột username, password, heroes (ngăn cách bằng dấu phẩy).</li>
            </ul>
          </details>
          <p className="t-caption">File được đọc ngay trong trình duyệt; chỉ dữ liệu tài khoản hợp lệ được gửi lên máy chủ khi bạn xác nhận.</p>
        </div>
      )}

      {step === 'review' && result && stats && (
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <p className="t-secondary" style={{ fontSize: 'var(--text-sm)' }}>
            <FileSpreadsheet size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {fileName} · sheet <strong>{result.sourceSheet}</strong>
          </p>
          <div className="stat-tiles">
            <div className="stat-tile"><strong>{stats.valid}</strong><span>Tài khoản hợp lệ</span></div>
            <div className="stat-tile" data-tone={result.errors.length ? 'warning' : undefined}><strong>{result.errors.length}</strong><span>Cảnh báo</span></div>
            <div className="stat-tile"><strong>{stats.heroes}</strong><span>Tướng khác nhau</span></div>
            <div className="stat-tile"><strong>{stats.matches}</strong><span>Trùng tài khoản đang có</span></div>
          </div>
          {(result.errors.length > 0 || stats.unknown.length > 0) && (
            <section aria-labelledby="issues-title">
              <h3 id="issues-title" className="t-heading" style={{ marginBottom: 'var(--space-3)' }}>Cần lưu ý</h3>
              <ul className="issue-list">
                {stats.unknown.length > 0 && (
                  <li className="issue">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <div><strong>{stats.unknown.length} tướng ngoài danh mục</strong><small>{stats.unknown.slice(0, 6).join(', ')}{stats.unknown.length > 6 ? '…' : ''} — vẫn được lưu nguyên tên.</small></div>
                    <Badge tone="warning">Vẫn nhập</Badge>
                  </li>
                )}
                {result.errors.slice(0, 30).map((message) => (
                  <li key={message} className="issue" data-tone={message.startsWith('Bỏ qua') ? 'danger' : undefined}>
                    {message.startsWith('Bỏ qua') ? <CircleX size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
                    <div><small style={{ color: 'var(--text)' }}>{message}</small></div>
                    <Badge tone={message.startsWith('Bỏ qua') ? 'danger' : 'warning'}>{message.startsWith('Bỏ qua') ? 'Bỏ qua' : 'Vẫn nhập'}</Badge>
                  </li>
                ))}
              </ul>
              {result.errors.length > 30 && <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>… và {result.errors.length - 30} cảnh báo khác.</p>}
            </section>
          )}
          <section aria-labelledby="sample-title">
            <h3 id="sample-title" className="t-heading" style={{ marginBottom: 'var(--space-3)' }}>Xem trước {Math.min(8, stats.valid)} / {stats.valid} dòng</h3>
            <div className="table-wrap">
              <table className="mini-table">
                <thead><tr><th scope="col">Username</th><th scope="col">Mật khẩu</th><th scope="col" className="num">Tướng</th></tr></thead>
                <tbody>
                  {result.accounts.slice(0, 8).map((row) => (
                    <tr key={row.username}>
                      <td translate="no">{row.username}</td>
                      <td>{row.password ? <Badge tone="success">Có</Badge> : <Badge tone="warning">Thiếu</Badge>}</td>
                      <td className="num">{row.heroes.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {step === 'confirm' && stats && (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <fieldset style={{ display: 'grid', gap: 'var(--space-3)', margin: 0, padding: 0, border: 0 }}>
            <legend className="t-heading" style={{ marginBottom: 'var(--space-3)' }}>Cách nhập dữ liệu</legend>
            <label className="radio-card">
              <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              <span>
                <strong><GitMerge size={16} aria-hidden="true" /> Gộp vào kho <Badge tone="accent">Khuyến nghị</Badge></strong>
                <p>Thêm {stats.fresh} tài khoản mới, cập nhật {stats.matches} tài khoản trùng username. Không xoá tài khoản nào.</p>
              </span>
            </label>
            <label className="radio-card" data-tone="danger">
              <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              <span>
                <strong><Replace size={16} aria-hidden="true" /> Thay thế toàn bộ kho</strong>
                <p>Xoá {existingCount} tài khoản hiện có rồi nhập {stats.valid} tài khoản từ file.</p>
              </span>
            </label>
          </fieldset>

          {mode === 'replace' && (
            <div className={cx('callout', 'callout--danger')} style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--danger)', flex: 'none' }} />
                <div>
                  <strong>{existingCount} tài khoản sẽ bị xoá vĩnh viễn</strong>
                  <p>Cần nhập lại mật khẩu chủ sở hữu. Thao tác chạy trong một giao dịch: lỗi giữa chừng sẽ không xoá gì; nếu kho đã thay đổi kể từ khi tải trang, máy chủ sẽ từ chối.</p>
                </div>
              </div>
              <label className="check-row">
                <input type="checkbox" className="checkbox" checked={backup} onChange={(event) => setBackup(event.target.checked)} />
                Tải bản sao lưu Excel (kèm mật khẩu) về máy trước khi thay thế
              </label>
              <Field label={`Gõ ${REPLACE_PHRASE} để xác nhận`} htmlFor={confirmId}>
                <div className="input-wrap" data-invalid={confirmText && !replaceConfirmed ? true : undefined}>
                  <input id={confirmId} value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" spellCheck={false} placeholder={REPLACE_PHRASE} />
                </div>
              </Field>
            </div>
          )}

          {importError && (
            <div className="callout callout--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div><strong>Chưa nhập được</strong><p>{importError}</p></div>
            </div>
          )}
        </div>
      )}

      {step === 'done' && summary && (
        <div className="result" role="status">
          <span className="result__icon" aria-hidden="true"><Check size={28} strokeWidth={2.5} /></span>
          <h3 className="t-title">Đã nhập {summary.created + summary.updated} tài khoản</h3>
          <p className="t-secondary">
            {summary.created} mới · {summary.updated} cập nhật
            {summary.skipped ? ` · ${summary.skipped} bỏ qua` : ''}
            {summary.invalid ? ` · ${summary.invalid} dòng không hợp lệ` : ''}
            {summary.mode === 'replace' ? ` · đã xoá ${summary.deleted} tài khoản cũ` : ' · không xoá tài khoản nào'}
          </p>
          {summary.warnings.length > 0 && (
            <div className="callout callout--warning" style={{ textAlign: 'left', width: '100%' }}>
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>Cảnh báo từ máy chủ ({summary.warnings.length})</strong>
                <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)' }}>
                  {summary.warnings.slice(0, 10).map((warning) => <li key={warning}><p>{warning}</p></li>)}
                </ul>
                {summary.warnings.length > 10 && <p>… và {summary.warnings.length - 10} cảnh báo khác.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

export function ExportDialog({ count, onClose }: { count: number; onClose: () => void }) {
  const toast = useToast()
  const withReauth = useReauth()
  const [withPasswords, setWithPasswords] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const rows = await withReauth(() => exportAccounts(withPasswords))
      const { exportAccountsToExcel } = await import('../utils/excel')
      exportAccountsToExcel(rows, withPasswords, withPasswords ? `aov-sao-luu-day-du-${timestampSlug()}` : `aov-danh-sach-${timestampSlug()}`)
      toast({ tone: 'success', title: 'Đã tạo file Excel', description: `${rows.length} tài khoản${withPasswords ? ' · kèm mật khẩu' : ''}` })
      onClose()
    } catch (caught) {
      if (caught instanceof ReauthCancelledError) return
      setError(caught instanceof Error ? caught.message : 'Không xuất được file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      open
      onClose={busy ? () => {} : onClose}
      width={520}
      title="Xuất Excel"
      description={`${count} tài khoản · file .xlsx tạo ngay trong trình duyệt`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Huỷ</Button>
          <Button variant="primary" loading={busy} icon={<Download size={16} aria-hidden="true" />} onClick={() => void download()}>
            {busy ? 'Đang tạo file…' : 'Tải xuống'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <fieldset style={{ display: 'grid', gap: 'var(--space-3)', margin: 0, padding: 0, border: 0 }}>
          <legend className="sr-only">Nội dung file</legend>
          <label className="radio-card">
            <input type="radio" name="export-mode" checked={!withPasswords} onChange={() => setWithPasswords(false)} />
            <span><strong>Danh sách không kèm mật khẩu <Badge tone="accent">Mặc định</Badge></strong><p>Username, tên tài khoản và tướng — an toàn để chia sẻ.</p></span>
          </label>
          <label className="radio-card" data-tone="danger">
            <input type="radio" name="export-mode" checked={withPasswords} onChange={() => setWithPasswords(true)} />
            <span><strong>Bản sao lưu đầy đủ</strong><p>Kèm mật khẩu — cần nhập lại mật khẩu chủ sở hữu.</p></span>
          </label>
        </fieldset>
        {withPasswords && (
          <div className="callout callout--warning">
            <AlertTriangle size={18} aria-hidden="true" />
            <div><strong>File sẽ chứa mật khẩu dạng văn bản thường</strong><p>Chỉ lưu ở nơi an toàn; không gửi qua chat hoặc email.</p></div>
          </div>
        )}
        {error && (
          <div className="callout callout--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div><strong>Chưa xuất được</strong><p>{error}</p></div>
          </div>
        )}
      </div>
    </Panel>
  )
}
