import { useEffect } from 'react'
import { Button } from './Button.jsx'

export function Drawer({
  open,
  onClose,
  title,
  subtitle = '',
  variant = 'default',
  headerActions = null,
  footer = null,
  ariaLabel,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const panelClass =
    variant === 'audit' ? 'crm-drawer-panel crm-drawer-panel-audit' : 'crm-drawer-panel'

  return (
    <div
      className="crm-drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Panel'}
    >
      <div
        className="crm-drawer-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={panelClass}>
        <div className="flex items-start justify-between gap-3 border-b crm-border px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-main truncate">{title}</h2>
            {subtitle ? (
              <p className="text-xs text-sub mt-0.5 leading-relaxed">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <Button
              type="button"
              variant="secondary-icon"
              onClick={onClose}
              data-tooltip={`Close ${title || 'panel'}`}
              aria-label={`Close ${title || 'panel'}`}
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
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="border-t crm-border px-5 py-3 shrink-0">{footer}</div>
        ) : null}
      </aside>
    </div>
  )
}
