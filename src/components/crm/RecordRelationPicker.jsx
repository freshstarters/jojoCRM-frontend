import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { listCrmRecords } from '../../service/crmService.js'
import { Button } from '../Button.jsx'

export function RecordRelationPicker({
  id,
  ariaLabel,
  workspaceSlug,
  objectKey,
  objectPluralLabel = 'records',
  value = '',
  selectedRecord = null,
  fallbackOptions = [],
  suggestedItems = [],
  suggestedHeading = 'Suggested matches',
  queryParams = {},
  allowEmpty = true,
  emptyLabel = 'None',
  placeholder = 'Select a record',
  searchPlaceholder = 'Search records...',
  getOptionLabel,
  getOptionMeta,
  getOptionBadge,
  pageSize = 25,
  disabled = false,
  className = '',
  onChange,
  onSessionExpired,
}) {
  const triggerRef = useRef(null)
  const portalRef = useRef(null)
  const searchInputRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [listData, setListData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [completedKey, setCompletedKey] = useState('')
  const [pickedCache, setPickedCache] = useState({})
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 260 })

  const serializedExtraParams = JSON.stringify(queryParams || {})

  useEffect(() => {
    const trimmed = search.trim()
    if (!trimmed) return undefined
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed)
    }, 200)
    return () => clearTimeout(timer)
  }, [search])

  const effectiveSearch = search.trim() ? debouncedSearch : ''
  const requestKey =
    open && workspaceSlug && objectKey
      ? `${workspaceSlug}:${objectKey}:${page}:${pageSize}:${effectiveSearch}:${serializedExtraParams}`
      : ''
  const loading = Boolean(requestKey && completedKey !== requestKey)

  useEffect(() => {
    if (!requestKey) return undefined
    let cancelled = false
    const activeKey = requestKey
    const extra = JSON.parse(serializedExtraParams)

    listCrmRecords(workspaceSlug, objectKey, {
      page,
      page_size: pageSize,
      ...(effectiveSearch ? { q: effectiveSearch } : {}),
      ...extra,
    })
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setLoadError(data?.error || data?.detail || `Could not load ${objectPluralLabel}.`)
          return
        }
        setLoadError('')
        setListData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(`Network error while loading ${objectPluralLabel}.`)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedKey(activeKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    requestKey,
    workspaceSlug,
    objectKey,
    page,
    pageSize,
    effectiveSearch,
    serializedExtraParams,
    objectPluralLabel,
    onSessionExpired,
  ])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const estimatedHeight = 330
    const openAbove =
      rect.bottom + estimatedHeight + 8 > viewportHeight &&
      rect.top > estimatedHeight + 8
    const width = Math.min(viewportWidth - 16, Math.max(rect.width, 280))
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8))

    setMenuStyle({
      left,
      width,
      top: openAbove ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4,
    })
  }, [])

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
    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)

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
      clearTimeout(focusTimer)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  const formatLabel = useCallback(
    (item) => {
      if (!item) return ''
      if (getOptionLabel) return getOptionLabel(item)
      return item.display_label || item.name || item.title || `#${item.id}`
    },
    [getOptionLabel],
  )

  const formatMeta = useCallback(
    (item) => {
      if (!item) return ''
      if (getOptionMeta) return getOptionMeta(item)
      return ''
    },
    [getOptionMeta],
  )

  const formatBadge = useCallback(
    (item) => {
      if (!item || !getOptionBadge) return null
      return getOptionBadge(item)
    },
    [getOptionBadge],
  )

  const resolvedSelectedItem = useMemo(() => {
    const stringVal = value ? String(value) : ''
    if (!stringVal) return null
    if (selectedRecord && String(selectedRecord.id) === stringVal) {
      return selectedRecord
    }
    if (pickedCache[stringVal]) {
      return pickedCache[stringVal]
    }
    const fromSuggested = (suggestedItems || []).find((item) => String(item.id) === stringVal)
    if (fromSuggested) return fromSuggested
    const fromList = (listData?.results || []).find((item) => String(item.id) === stringVal)
    if (fromList) return fromList
    const fromFallback = (fallbackOptions || []).find((item) => String(item.id) === stringVal)
    if (fromFallback) return fromFallback
    return null
  }, [value, selectedRecord, pickedCache, suggestedItems, listData?.results, fallbackOptions])

  const triggerText = useMemo(() => {
    if (!value) {
      return allowEmpty ? emptyLabel : placeholder
    }
    if (resolvedSelectedItem) {
      return formatLabel(resolvedSelectedItem)
    }
    return `Record #${value}`
  }, [value, allowEmpty, emptyLabel, placeholder, resolvedSelectedItem, formatLabel])

  const results = useMemo(() => listData?.results || [], [listData?.results])
  const totalCount = listData?.total_count ?? 0
  const currentPage = listData?.page ?? page
  const totalPages = listData?.total_pages ?? 1
  const isTruncated = totalCount > results.length || totalPages > 1
  const rangeStart = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = totalCount > 0 ? Math.min(totalCount, rangeStart + results.length - 1) : 0

  const showSuggested = !effectiveSearch && currentPage === 1 && (suggestedItems || []).length > 0
  const suggestedIdSet = useMemo(
    () => new Set(showSuggested ? suggestedItems.map((item) => String(item.id)) : []),
    [showSuggested, suggestedItems],
  )
  const visiblePageResults = useMemo(
    () =>
      showSuggested
        ? results.filter((item) => !suggestedIdSet.has(String(item.id)))
        : results,
    [showSuggested, results, suggestedIdSet],
  )

  function handlePick(item) {
    if (!item) {
      setOpen(false)
      onChange?.('', null)
      triggerRef.current?.focus()
      return
    }
    const strId = String(item.id)
    setPickedCache((prev) => ({ ...prev, [strId]: item }))
    setOpen(false)
    onChange?.(strId, item)
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
        onClick={() => {
          setOpen((prev) => {
            if (!prev) {
              setPage(1)
            }
            return !prev
          })
        }}
        className={`custom-select-trigger w-full px-3 py-2 ${open ? 'is-open' : ''} ${className}`.trim()}
      >
        <span className="truncate">{triggerText}</span>
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
            role="dialog"
            aria-label={ariaLabel || placeholder}
            className="custom-select-portal relation-picker-portal"
            style={{
              top: `${menuStyle.top}px`,
              left: `${menuStyle.left}px`,
              width: `${menuStyle.width}px`,
            }}
          >
            {/* Search bar */}
            <div className="p-2 border-b crm-border space-y-1.5">
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="crm-input w-full px-2.5 py-1.5 text-xs"
              />
              {isTruncated ? (
                <div className="text-[11px] text-sub num-tabular px-0.5">
                  Showing {rangeStart}-{rangeEnd} of {totalCount} {objectPluralLabel}. Search or paginate to view more.
                </div>
              ) : null}
            </div>

            {/* Scrollable options list */}
            <div role="listbox" className="relation-picker-list p-1.5 space-y-0.5">
              {allowEmpty ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => handlePick(null)}
                  className={`custom-select-option ${!value ? 'is-selected' : ''}`.trim()}
                >
                  <span className="truncate">{emptyLabel}</span>
                  {!value ? (
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
                  ) : null}
                </button>
              ) : null}

              {showSuggested ? (
                <>
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sub">
                    {suggestedHeading}
                  </div>
                  {suggestedItems.map((item) => {
                    const strId = String(item.id)
                    const isSelected = strId === String(value || '')
                    const meta = formatMeta(item)
                    const badge = formatBadge(item)
                    return (
                      <button
                        key={`sug-${strId}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handlePick(item)}
                        className={`custom-select-option ${isSelected ? 'is-selected' : ''}`.trim()}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{formatLabel(item)}</span>
                            {badge ? (
                              <span className={`${badge.className} shrink-0`}>
                                {badge.label}
                              </span>
                            ) : null}
                          </div>
                          {meta ? (
                            <div className="text-[10px] text-sub truncate">{meta}</div>
                          ) : null}
                        </div>
                        {isSelected ? (
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
                        ) : null}
                      </button>
                    )
                  })}
                  <div className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sub border-t crm-border mt-1">
                    All workspace {objectPluralLabel}
                  </div>
                </>
              ) : null}

              {loadError ? (
                <div className="px-2.5 py-2 text-[11px] text-rose-600">{loadError}</div>
              ) : loading && visiblePageResults.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-sub">
                  Loading {objectPluralLabel}...
                </div>
              ) : visiblePageResults.length === 0 && !showSuggested ? (
                <div className="px-2.5 py-2 text-[11px] text-sub">
                  {effectiveSearch
                    ? `No matching ${objectPluralLabel} for "${effectiveSearch}".`
                    : `No readable ${objectPluralLabel} found.`}
                </div>
              ) : (
                visiblePageResults.map((item) => {
                  const strId = String(item.id)
                  const isSelected = strId === String(value || '')
                  const meta = formatMeta(item)
                  const badge = formatBadge(item)
                  return (
                    <button
                      key={strId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handlePick(item)}
                      className={`custom-select-option ${isSelected ? 'is-selected' : ''}`.trim()}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{formatLabel(item)}</span>
                          {badge ? (
                            <span className={`${badge.className} shrink-0`}>
                              {badge.label}
                            </span>
                          ) : null}
                        </div>
                        {meta ? (
                          <div className="text-[10px] text-sub truncate">{meta}</div>
                        ) : null}
                      </div>
                      {isSelected ? (
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
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 || totalCount > 0 ? (
              <div className="px-2.5 py-1.5 border-t crm-border flex items-center justify-between gap-2 text-[11px] text-sub">
                <span className="num-tabular">
                  Page {currentPage} of {totalPages} ({totalCount})
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading || !listData?.has_previous}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="px-2 py-0.5 text-[11px]"
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading || !listData?.has_next}
                    onClick={() => setPage((prev) => prev + 1)}
                    className="px-2 py-0.5 text-[11px]"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>,
          document.body,
        )}
    </>
  )
}
