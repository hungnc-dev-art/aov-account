'use client'

import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useIsClient } from '../lib/navigation'
import { IconButton, cx } from './ui'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
let openCount = 0

interface PanelProps {
  open: boolean
  onClose: () => void
  /** dialog: giữa màn hình (≥640px) | drawer: trượt từ phải (≥768px). Mobile luôn là bottom sheet. */
  variant?: 'dialog' | 'drawer'
  title: ReactNode
  description?: ReactNode
  /** Ẩn tiêu đề trực quan nhưng vẫn giữ cho trình đọc màn hình. */
  visuallyHiddenTitle?: boolean
  footer?: ReactNode
  children: ReactNode
  width?: number
  full?: boolean
  className?: string
  initialFocus?: RefObject<HTMLElement | null>
  role?: 'dialog' | 'alertdialog'
}

export function Panel(props: PanelProps) {
  const isClient = useIsClient()
  if (!props.open || !isClient) return null
  return createPortal(<PanelInner {...props} />, document.body)
}

function PanelInner({ onClose, variant = 'dialog', title, description, visuallyHiddenTitle, footer, children, width, full, className, initialFocus, role = 'dialog' }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const target = initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current
    target?.focus({ preventScroll: true })
    openCount += 1
    document.documentElement.style.overflow = 'hidden'
    return () => {
      openCount -= 1
      if (openCount === 0) document.documentElement.style.overflow = ''
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [initialFocus])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="overlay"
      data-variant={variant}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={cx('panel', full && 'panel--full', className)}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={width ? ({ '--panel-width': `${width}px` } as CSSProperties) : undefined}
        onKeyDown={onKeyDown}
      >
        <span className="panel__handle" aria-hidden="true" />
        <div className={cx('panel__header', visuallyHiddenTitle && 'sr-only')}>
          <div className="panel__titles">
            <h2 className="panel__title" id={titleId}>{title}</h2>
            {description && <p className="panel__desc" id={descId}>{description}</p>}
          </div>
          {!visuallyHiddenTitle && <IconButton label="Đóng" icon={<X size={20} aria-hidden="true" />} onClick={onClose} />}
        </div>
        <div className="panel__body">{children}</div>
        {footer && <div className="panel__footer">{footer}</div>}
      </div>
    </div>
  )
}
