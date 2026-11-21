import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseIsoDatePart(raw) {
  if (!raw || typeof raw !== 'string') return null
  const datePart = raw.split('T')[0]
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const probe = new Date(year, month, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month ||
    probe.getDate() !== day
  ) {
    return null
  }
  return { year, month, day, dateStr: `${m[1]}-${m[2]}-${m[3]}` }
}

function parseIsoValue(raw, mode) {
  const dateParsed = parseIsoDatePart(raw)
  if (!dateParsed) return null
  if (mode === 'date') {
    return { ...dateParsed, hour: 0, minute: 0 }
  }
  const timePart = (raw.split('T')[1] || '').slice(0, 5)
  const tm = /^(\d{2}):(\d{2})$/.exec(timePart)
  const hour = tm ? Math.min(23, Math.max(0, Number(tm[1]))) : 9
  const minute = tm ? Math.min(59, Math.max(0, Number(tm[2]))) : 0
  return { ...dateParsed, hour, minute }
}

function formatDisplayLabel(parsed, mode, placeholder) {
  if (!parsed) return placeholder
  const dateLabel = `${pad2(parsed.day)} ${MONTH_SHORT[parsed.month]} ${parsed.year}`
  if (mode === 'date') return dateLabel
  return `${dateLabel} · ${pad2(parsed.hour)}:${pad2(parsed.minute)}`
}

function toValueString(year, month, day, hour, minute, mode) {
  const d = `${year}-${pad2(month + 1)}-${pad2(day)}`
  if (mode === 'date') return d
  return `${d}T${pad2(hour)}:${pad2(minute)}`
}

function buildCalendarCells(viewYear, viewMonth) {
  const firstDay = new Date(viewYear, viewMonth, 1)
  // Monday = 0, ..., Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()

  const cells = []
  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const d = prevMonthDays - i
    const prevDate = new Date(viewYear, viewMonth - 1, d)
    cells.push({
      year: prevDate.getFullYear(),
      month: prevDate.getMonth(),
      day: prevDate.getDate(),
      inCurrentMonth: false,
      dateStr: `${prevDate.getFullYear()}-${pad2(prevDate.getMonth() + 1)}-${pad2(prevDate.getDate())}`,
    })
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({
      year: viewYear,
      month: viewMonth,
      day: d,
      inCurrentMonth: true,
      dateStr: `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`,
    })
  }
  while (cells.length < 42) {
    const idx = cells.length - (startOffset + daysInMonth) + 1
    const nextDate = new Date(viewYear, viewMonth + 1, idx)
    cells.push({
      year: nextDate.getFullYear(),
      month: nextDate.getMonth(),
      day: nextDate.getDate(),
      inCurrentMonth: false,
      dateStr: `${nextDate.getFullYear()}-${pad2(nextDate.getMonth() + 1)}-${pad2(nextDate.getDate())}`,
    })
  }
  return cells
}

export function DateTimePicker({
  id,
  mode = 'date',
  value = '',
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  required = false,
  clearable = true,
  min = '',
  max = '',
  className = '',
}) {
  const triggerRef = useRef(null)
  const portalRef = useRef(null)

  const parsed = useMemo(() => parseIsoValue(value, mode), [value, mode])
  const todayDate = useMemo(() => {
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      dateStr: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    }
  }, [])

  const minDateStr = useMemo(() => parseIsoDatePart(min)?.dateStr || '', [min])
  const maxDateStr = useMemo(() => parseIsoDatePart(max)?.dateStr || '', [max])

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? todayDate.year)
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? todayDate.month)
  const [yearMode, setYearMode] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0 })

  const resolvedPlaceholder =
    placeholder || (mode === 'datetime' ? 'Select date & time' : 'Select date')

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const popWidth = 284
    const estHeight = mode === 'datetime' ? 378 : 314
    const openAbove =
      rect.bottom + estHeight + 10 > window.innerHeight && rect.top > estHeight + 10
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popWidth - 8))
    const top = openAbove
      ? Math.max(8, rect.top - estHeight - 6)
      : Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - estHeight - 8))
    setPopoverStyle({ top, left })
  }, [mode])

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePosition()
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
      setYearMode(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        setYearMode(false)
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

  function handleToggleOpen() {
    if (disabled) return
    setOpen((prev) => {
      const next = !prev
      if (next) {
        setViewYear(parsed?.year ?? todayDate.year)
        setViewMonth(parsed?.month ?? todayDate.month)
        setYearMode(false)
      }
      return next
    })
  }

  function isOutOfRange(dateStr) {
    if (minDateStr && dateStr < minDateStr) return true
    if (maxDateStr && dateStr > maxDateStr) return true
    return false
  }

  function handleSelectCell(cell) {
    if (isOutOfRange(cell.dateStr)) return
    const hour = parsed?.hour ?? 9
    const minute = parsed?.minute ?? 0
    onChange?.(toValueString(cell.year, cell.month, cell.day, hour, minute, mode))
    setViewYear(cell.year)
    setViewMonth(cell.month)
    if (mode === 'date') {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  function handleTimeChange(nextHour, nextMinute) {
    const base = parsed || todayDate
    if (isOutOfRange(base.dateStr)) return
    onChange?.(
      toValueString(base.year, base.month, base.day, nextHour, nextMinute, 'datetime'),
    )
  }

  function handlePickToday() {
    if (isOutOfRange(todayDate.dateStr)) return
    onChange?.(
      toValueString(
        todayDate.year,
        todayDate.month,
        todayDate.day,
        todayDate.hour,
        todayDate.minute,
        mode,
      ),
    )
    setViewYear(todayDate.year)
    setViewMonth(todayDate.month)
    if (mode === 'date') {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  function handleShiftMonth(delta) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  )
  const yearChoices = useMemo(() => {
    const anchor = Math.floor(viewYear / 12) * 12
    return Array.from({ length: 12 }, (_, idx) => anchor + idx - 4)
  }, [viewYear])

  const selectedHour = parsed?.hour ?? 9
  const selectedMinute = parsed?.minute ?? 0
  const showClear = Boolean(parsed) && clearable && !required && !disabled

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel || resolvedPlaceholder}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={handleToggleOpen}
          className={`custom-select-trigger w-full pl-9 ${showClear ? 'pr-8' : 'pr-3'} py-2 ${open ? 'is-open' : ''} ${className}`.trim()}
        >
          <span
            className={`truncate num-tabular ${parsed ? 'text-main' : 'text-sub'}`}
          >
            {formatDisplayLabel(parsed, mode, resolvedPlaceholder)}
          </span>
        </button>

        <svg
          className="w-3.5 h-3.5 text-sub absolute left-3 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        {showClear ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange?.('')
            }}
            aria-label="Clear date"
            className="absolute right-2 p-1 rounded text-sub hover:text-main transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}
      </div>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={portalRef}
            role="dialog"
            aria-label={ariaLabel || resolvedPlaceholder}
            className="custom-datepicker-portal space-y-2.5"
            style={{
              top: `${popoverStyle.top}px`,
              left: `${popoverStyle.left}px`,
            }}
          >
            {/* Header Navigation */}
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => (yearMode ? setViewYear((y) => y - 12) : handleShiftMonth(-1))}
                aria-label={yearMode ? 'Previous years' : 'Previous month'}
                className="btn-secondary p-1.5 rounded-lg"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setYearMode((prev) => !prev)}
                className="px-2 py-1 rounded-lg text-xs font-semibold text-main hover:bg-slate-500/10 transition-colors num-tabular"
              >
                {yearMode ? `${yearChoices[0]} - ${yearChoices[yearChoices.length - 1]}` : `${MONTH_NAMES[viewMonth]} ${viewYear}`}
              </button>

              <button
                type="button"
                onClick={() => (yearMode ? setViewYear((y) => y + 12) : handleShiftMonth(1))}
                aria-label={yearMode ? 'Next years' : 'Next month'}
                className="btn-secondary p-1.5 rounded-lg"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {yearMode ? (
              <div className="grid grid-cols-3 gap-1.5 py-1">
                {yearChoices.map((yr) => {
                  const isCurrent = yr === viewYear
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setViewYear(yr)
                        setYearMode(false)
                      }}
                      className={`py-2 rounded-lg text-xs font-medium num-tabular transition-colors ${
                        isCurrent
                          ? 'btn-primary'
                          : 'text-main hover:bg-slate-500/10'
                      }`}
                    >
                      {yr}
                    </button>
                  )
                })}
              </div>
            ) : (
              <>
                {/* Weekday Header */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((dayName) => (
                    <div
                      key={dayName}
                      className="text-[10px] font-semibold uppercase tracking-wider text-sub py-0.5"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell) => {
                    const isSelected = parsed?.dateStr === cell.dateStr
                    const isToday = todayDate.dateStr === cell.dateStr
                    const blocked = isOutOfRange(cell.dateStr)
                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={blocked}
                        onClick={() => handleSelectCell(cell)}
                        className={`h-8 rounded-lg text-xs num-tabular flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'btn-primary font-semibold'
                            : blocked
                              ? 'text-sub/40 cursor-not-allowed'
                              : cell.inCurrentMonth
                                ? `text-main hover:bg-slate-500/10 ${isToday ? 'ring-1 ring-[var(--brand-primary)] font-semibold' : ''}`
                                : 'text-sub/60 hover:bg-slate-500/10'
                        }`}
                      >
                        {cell.day}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Time Selector in datetime mode */}
            {mode === 'datetime' ? (
              <div className="pt-2 border-t crm-border flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-sub">Time</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    aria-label="Hour"
                    value={pad2(selectedHour)}
                    onChange={(e) => {
                      const raw = Number(e.target.value)
                      const nextH = Number.isFinite(raw) ? Math.min(23, Math.max(0, raw)) : 0
                      handleTimeChange(nextH, selectedMinute)
                    }}
                    className="crm-input w-14 px-2 py-1 text-xs text-center num-tabular"
                  />
                  <span className="text-xs font-semibold text-sub">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    aria-label="Minute"
                    value={pad2(selectedMinute)}
                    onChange={(e) => {
                      const raw = Number(e.target.value)
                      const nextM = Number.isFinite(raw) ? Math.min(59, Math.max(0, raw)) : 0
                      handleTimeChange(selectedHour, nextM)
                    }}
                    className="crm-input w-14 px-2 py-1 text-xs text-center num-tabular"
                  />
                </div>
              </div>
            ) : null}

            {/* Footer Controls */}
            <div className="pt-2 border-t crm-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePickToday}
                  disabled={isOutOfRange(todayDate.dateStr)}
                  className="btn-secondary px-2.5 py-1 text-[11px]"
                >
                  {mode === 'datetime' ? 'Now' : 'Today'}
                </button>
                {clearable && !required && parsed ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange?.('')
                      setOpen(false)
                    }}
                    className="text-[11px] font-medium text-sub hover:text-main px-1.5 py-1"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                className="btn-primary px-2.5 py-1 text-[11px]"
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export function DatePicker(props) {
  return <DateTimePicker {...props} mode="date" />
}
