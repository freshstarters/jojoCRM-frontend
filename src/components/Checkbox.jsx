import { useEffect, useId, useRef } from 'react'

/**
 * Reusable custom checkbox matching the app's frosted B2B SaaS design tokens.
 */
export function Checkbox({
  id,
  name,
  checked = false,
  indeterminate = false,
  disabled = false,
  onChange,
  label,
  children,
  ariaLabel,
  'aria-label': ariaLabelProp,
  className = '',
  labelClassName = '',
  boxClassName = '',
  ...props
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate) && !checked
    }
  }, [indeterminate, checked])

  const labelContent = label ?? children
  const resolvedAriaLabel = ariaLabel ?? ariaLabelProp
  const isIndeterminate = Boolean(indeterminate) && !checked

  return (
    <label
      htmlFor={inputId}
      className={`crm-checkbox ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
    >
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={onChange}
        aria-label={resolvedAriaLabel}
        aria-checked={isIndeterminate ? 'mixed' : Boolean(checked)}
        className="crm-checkbox-input"
        {...props}
      />
      <span
        aria-hidden="true"
        className={`crm-checkbox-box ${isIndeterminate ? 'is-indeterminate' : ''} ${boxClassName}`.trim()}
      >
        {isIndeterminate ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="crm-checkbox-icon"
          >
            <line x1="6" y1="12" x2="18" y2="12" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="crm-checkbox-icon"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {labelContent ? (
        <span className={`crm-checkbox-label ${labelClassName}`.trim()}>
          {labelContent}
        </span>
      ) : null}
    </label>
  )
}
