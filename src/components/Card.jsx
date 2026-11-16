export function Card({
  variant = 'surface',
  as: Component = 'div',
  className = '',
  children,
  ...props
}) {
  const surfaceClass = variant === 'subtle' ? 'crm-subtle' : 'crm-card'
  return (
    <Component className={`${surfaceClass} ${className}`.trim()} {...props}>
      {children}
    </Component>
  )
}
