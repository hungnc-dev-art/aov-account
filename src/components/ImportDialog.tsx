import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import type { ImportResult } from '../types'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (result: ImportResult, replace: boolean) => Promise<void>
}

export function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fatalError, setFatalError] = useState('')

  if (!open) return null

  const chooseFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setFileName(file.name)
    setFatalError('')
    try {
      const { parseExcelFile } = await import('../utils/excel')
      const parsed = await parseExcelFile(file)
      setResult(parsed)
      if (!parsed.accounts.length) setFatalError(parsed.errors[0])
    } catch {
      setResult(null)
      setFatalError('Không thể đọc file. Hãy kiểm tra file Excel có bị hỏng hay không.')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!result?.accounts.length) return
    setBusy(true)
    setFatalError('')
    try {
      await onImport(result, replace)
      onClose()
    } catch (error) {
      setFatalError(
        error instanceof Error ? error.message : 'Không thể import dữ liệu.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal import-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Nhập dữ liệu</p>
            <h2>Import Excel</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => void chooseFile(event.target.files?.[0])}
        />
        <button className="drop-zone" onClick={() => inputRef.current?.click()}>
          <FileSpreadsheet size={34} />
          <strong>{fileName || 'Chọn file Excel'}</strong>
          <span>Hỗ trợ ma trận account theo cột như file Lq ex và bảng phẳng.</span>
        </button>

        {busy && <p className="notice">Đang phân tích workbook…</p>}
        {fatalError && <p className="notice notice--error">{fatalError}</p>}
        {result?.accounts.length ? (
          <div className="import-summary">
            <div>
              <strong>{result.accounts.length}</strong>
              <span>account</span>
            </div>
            <div>
              <strong>{result.sourceSheet}</strong>
              <span>sheet được chọn</span>
            </div>
            <div>
              <strong>
                {new Set(result.accounts.flatMap((account) => account.heroes)).size}
              </strong>
              <span>tướng</span>
            </div>
          </div>
        ) : null}
        {result?.errors.length ? (
          <details className="warning-list">
            <summary>{result.errors.length} cảnh báo dữ liệu</summary>
            <ul>
              {result.errors.slice(0, 12).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </details>
        ) : null}

        <label className="check-row">
          <input
            type="checkbox"
            checked={replace}
            onChange={(event) => setReplace(event.target.checked)}
          />
          Xoá dữ liệu hiện tại trước khi import
        </label>
        <div className="modal-actions">
          <button className="button button--ghost" onClick={onClose}>
            Huỷ
          </button>
          <button
            className="button button--primary"
            onClick={() => void confirm()}
            disabled={busy || !result?.accounts.length}
          >
            <Upload size={17} /> Import dữ liệu
          </button>
        </div>
      </section>
    </div>
  )
}
