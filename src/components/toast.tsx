'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastInput = { tone: 'success' | 'error' | 'info'; title: string; description?: string }
type ToastItem = ToastInput & { id: number }

const ToastContext = createContext<(toast: ToastInput) => void>(() => {})
let sequence = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  const push = useCallback((toast: ToastInput) => {
    const id = ++sequence
    setToasts((current) => [...current.slice(-2), { ...toast, id }])
    window.setTimeout(() => dismiss(id), toast.tone === 'error' ? 6000 : 3500)
  }, [dismiss])

  return (
    <ToastContext value={push}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.tone === 'success' ? <CheckCircle2 size={18} aria-hidden="true" /> : toast.tone === 'error' ? <AlertCircle size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
            <div className="toast__body">
              <strong>{toast.title}</strong>
              {toast.description && <span>{toast.description}</span>}
            </div>
            <button type="button" className="icon-btn icon-btn--sm" aria-label="Đóng thông báo" onClick={() => dismiss(toast.id)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
