export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const variantClasses =
    variant === 'secondary'
      ? 'btn-secondary px-3 py-1.5 text-xs'
      : variant === 'secondary-icon'
        ? 'btn-secondary p-1.5 inline-flex items-center justify-center shrink-0 text-sub hover:text-main'
        : variant === 'icon'
          ? 'icon-plain'
          : variant === 'nav'
            ? 'nav-item w-full flex items-center justify-between px-3.5 py-2 text-xs text-left'
            : variant === 'ghost'
              ? 'text-xs font-medium text-sub hover:text-main transition-colors'
              : 'btn-primary px-3 py-1.5 text-xs'

  return (
    <button
      type={type}
      className={`${variantClasses} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
