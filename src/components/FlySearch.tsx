import { Search, X } from 'lucide-react'

interface FlySearchProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  className?: string
}

export function FlySearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = '',
}: FlySearchProps) {
  return (
    <div className={`fly-search ${className}`.trim()}>
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Xoá nội dung tìm kiếm"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
