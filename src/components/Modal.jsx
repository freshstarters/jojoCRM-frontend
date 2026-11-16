import { useEffect } from 'react'
import { Button } from './Button.jsx'

export function Modal({
  open,
  title,
  subtitle = '',
  onClose,
  children,
  footer = null,
  maxWidthClass = 'max-w-md',
}) {
  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalDialogTitle"
      onClick={(event) => {
        if (event.target === event.currentTarget && onClose) {
          onClose()
        }
      }}
    >
      <div className={`w-full ${maxWidthClass} crm-modal p-6 space-y-4`.trim()}>
        <div className="flex items-start justify-between gap-3 pb-3 border-b crm-border">
          <div>
            <h3
              id="modalDialogTitle"
              className="text-base font-semibold text-main"
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-sub mt-0.5">{subtitle}</p>
            )}
          </div>
          {onClose && (
            <Button
              type="button"
              variant="secondary-icon"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          )}
        </div>

        <div className="text-xs text-body">{children}</div>

        {footer && (
          <div className="pt-3 border-t crm-border flex justify-end space-x-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
