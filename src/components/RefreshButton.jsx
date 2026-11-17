import { Button } from './Button.jsx'

export function RefreshButton({
  loading = false,
  onClick,
  label = 'Refresh',
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <Button
      type="button"
      variant="secondary-icon"
      disabled={loading || disabled}
      onClick={onClick}
      data-tooltip={label}
      aria-label={label}
      className={className}
      {...props}
    >
      <svg
        className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </Button>
  )
}
