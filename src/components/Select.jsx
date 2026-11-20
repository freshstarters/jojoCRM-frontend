import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Select({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  ariaLabel,
  disabled = false,
  className = '',
}) {
  const triggerRef = useRef(null)
  const portalRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 220 })

  const selectedOption = options.find((opt) => opt.value === value) || null

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const estimatedMenuHeight = Math.min(256, Math.max(48, options.length * 34 + 14))
    const openAbove =
      rect.bottom + estimatedMenuHeight + 8 > viewportHeight &&
      rect.top > estimatedMenuHeight + 8

    setMenuStyle({
      left: Math.max(8, rect.left),
      width: Math.max(rect.width, 180),
      top: openAbove ? Math.max(8, rect.top - estimatedMenuHeight - 4) : rect.bottom + 4,
    })
  }, [options.length])

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePosition()
    const selectedEl = portalRef.current?.querySelector(
      '.custom-select-option.is-selected',
    )
    selectedEl?.scrollIntoView({ block: 'nearest' })
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (
        triggerRef.current?.contains(event.target) ||
        portalRef.current?.contains(event.target)
      ) {
        return
      }
      setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  function handleSelectOption(nextValue) {
    setOpen(false)
    if (onChange) {
      onChange(nextValue)
    }
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`custom-select-trigger w-full px-3 py-2 ${open ? 'is-open' : ''} ${className}`.trim()}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption?.swatchColor ? (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
              style={{ backgroundColor: selectedOption.swatchColor }}
              aria-hidden="true"
            />
          ) : null}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <svg
          className="custom-select-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={portalRef}
            role="listbox"
            aria-label={ariaLabel || placeholder}
            className="custom-select-portal"
            style={{
              top: `${menuStyle.top}px`,
              left: `${menuStyle.left}px`,
              width: `${menuStyle.width}px`,
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectOption(opt.value)}
                  className={`custom-select-option ${isSelected ? 'is-selected' : ''}`.trim()}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {opt.swatchColor ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                        style={{ backgroundColor: opt.swatchColor }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
