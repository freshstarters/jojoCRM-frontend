import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getObjectRights, searchWorkspaceRecords } from '../service/crmService.js'
import { Button } from './Button.jsx'

const BASE_SEARCH_OBJECTS = [
  { key: 'account', label: 'Account', plural: 'Accounts' },
  { key: 'contact', label: 'Contact', plural: 'Contacts' },
  { key: 'lead', label: 'Lead', plural: 'Leads' },
  { key: 'deal', label: 'Deal', plural: 'Deals' },
  { key: 'job', label: 'Job', plural: 'Jobs' },
  { key: 'appointment', label: 'Appointment', plural: 'Appointments' },
  { key: 'visit', label: 'Visit', plural: 'Visits' },
  { key: 'ticket', label: 'Ticket', plural: 'Tickets' },
  { key: 'activity', label: 'Activity', plural: 'Activities' },
]

const BADGE_TONE_CLASSES = {
  neutral: 'badge badge-neutral',
  info: 'badge badge-info',
  indigo: 'badge badge-indigo',
  violet: 'badge badge-violet',
  teal: 'badge badge-teal',
  success: 'badge badge-success',
  warn: 'badge badge-warn',
  orange: 'badge badge-orange',
  danger: 'badge badge-danger',
  pink: 'badge badge-pink',
}

export function GlobalSearchBar({
  workspace,
  permissions,
  permissionsRevision = 0,
  onSelectResult,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug || ''
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const portalRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [objectType, setObjectType] = useState('')
  const [page, setPage] = useState(1)
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchData, setSearchData] = useState(null)
  const [error, setError] = useState('')
  const [completedKey, setCompletedKey] = useState('')
  const [popoverStyle, setPopoverStyle] = useState({ top: 64, left: 16, width: 448 })

  const fallbackObjects = useMemo(() => {
    const enabled = new Set(
      Array.isArray(workspace?.enabled_object_keys)
        ? workspace.enabled_object_keys
        : ['account', 'contact', 'activity'],
    )
    const contactLabel = workspace?.contact_label || 'Contact'
    const contactPlural = workspace?.contact_plural_label || `${contactLabel}s`
    return BASE_SEARCH_OBJECTS.filter(
      (item) => enabled.has(item.key) && getObjectRights(permissions, item.key).canRead,
    ).map((item) => ({
      key: item.key,
      label: item.key === 'contact' ? contactLabel : item.label,
      plural_label: item.key === 'contact' ? contactPlural : item.plural,
      count: null,
    }))
  }, [workspace, permissions])

  const placeholderText = useMemo(() => {
    const labels = fallbackObjects
      .filter((obj) => obj.key !== 'activity')
      .slice(0, 3)
      .map((obj) => obj.plural_label.toLowerCase())
    if (labels.length === 0) return 'Search workspace records...'
    return `Search ${labels.join(', ')}...`
  }, [fallbackObjects])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return undefined
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const effectiveQuery = query.trim() ? debouncedQuery : ''

  const effectiveObjectType = useMemo(() => {
    if (!objectType) return ''
    const validKeys = new Set(
      (searchData?.searchable_objects || fallbackObjects).map((o) => o.key),
    )
    return validKeys.has(objectType) ? objectType : ''
  }, [objectType, searchData?.searchable_objects, fallbackObjects])

  const requestKey =
    open && workspaceSlug
      ? `${workspaceSlug}:${effectiveQuery}:${effectiveObjectType}:${page}:${permissionsRevision}`
      : ''
  const loading = Boolean(requestKey && completedKey !== requestKey)

  useEffect(() => {
    if (!requestKey) return undefined
    let cancelled = false
    const activeKey = requestKey

    searchWorkspaceRecords(workspaceSlug, {
      q: effectiveQuery,
      object_type: effectiveObjectType,
      page,
      page_size: 15,
    })
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(data?.error || data?.detail || 'Could not search workspace records.')
          return
        }
        setError('')
        setSearchData(data)
        setActiveIndex(0)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Network error while searching workspace records.')
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
  }, [requestKey, workspaceSlug, effectiveQuery, effectiveObjectType, page, onSessionExpired])

  const updatePosition = useCallback(() => {
    const anchor =
      mobileExpanded && inputRef.current
        ? inputRef.current.parentElement || inputRef.current
        : containerRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const desiredWidth = Math.min(viewportWidth - 24, Math.max(rect.width, 460))
    const left = Math.max(
      12,
      Math.min(rect.left + (rect.width - desiredWidth) / 2, viewportWidth - desiredWidth - 12),
    )
    setPopoverStyle({
      top: rect.bottom + 8,
      left,
      width: desiredWidth,
    })
  }, [mobileExpanded])

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, mobileExpanded, updatePosition])

  useEffect(() => {
    function handleGlobalKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMobileExpanded(true)
        setOpen(true)
        setTimeout(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        }, 0)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  useEffect(() => {
    if (!open && !mobileExpanded) return undefined
    function handlePointerDown(event) {
      if (
        containerRef.current?.contains(event.target) ||
        portalRef.current?.contains(event.target)
      ) {
        return
      }
      setOpen(false)
      setMobileExpanded(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        setMobileExpanded(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, mobileExpanded])

  const results = useMemo(() => searchData?.results || [], [searchData?.results])
  const searchableObjects = searchData?.searchable_objects || fallbackObjects
  const totalCount = searchData?.total_count ?? 0
  const allObjectsTotal = searchData?.all_objects_total_count ?? totalCount
  const totalPages = searchData?.total_pages ?? 1

  function handleSelectHit(hit) {
    if (!hit) return
    setOpen(false)
    setMobileExpanded(false)
    onSelectResult?.(hit)
  }

  function handleInputKeyDown(event) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        setOpen(true)
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length)
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length)
      }
    } else if (event.key === 'Enter') {
      if (results[activeIndex]) {
        event.preventDefault()
        handleSelectHit(results[activeIndex])
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 max-w-md mx-1 sm:mx-4 relative min-w-0 flex justify-end sm:block"
    >
      {!mobileExpanded && (
        <Button
          type="button"
          variant="icon"
          className="sm:hidden shrink-0"
          data-tooltip="Search"
          aria-label="Open search"
          onClick={() => {
            setMobileExpanded(true)
            setOpen(true)
            setTimeout(() => {
              inputRef.current?.focus()
            }, 0)
          }}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Button>
      )}

      <div
        className={
          mobileExpanded
            ? 'fixed top-3 inset-x-3 h-[3.5rem] px-3 rounded-[1.35rem] bg-[var(--bg-modal)] border crm-border shadow-lg flex items-center gap-2 z-50 sm:static sm:inset-auto sm:h-auto sm:px-0 sm:rounded-none sm:bg-transparent sm:border-0 sm:shadow-none sm:flex'
            : 'hidden sm:flex relative items-center'
        }
      >
        <div className="relative flex items-center flex-1 min-w-0">
          <svg
            className="w-4 h-4 text-sub absolute left-3 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            id="globalSearchInput"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="globalSearchResults"
            aria-autocomplete="list"
            aria-label="Global workspace search"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
              setOpen(true)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholderText}
            className="crm-input w-full pl-9 pr-14 py-1.5 text-xs"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setPage(1)
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="absolute right-2.5 text-[11px] text-sub hover:text-main px-1.5 py-0.5 rounded"
            >
              Clear
            </button>
          ) : (
            <span className="absolute right-2.5 text-[11px] text-sub hidden sm:inline px-1.5 py-0.5 rounded crm-subtle pointer-events-none">
              Ctrl K
            </span>
          )}
        </div>
        {mobileExpanded && (
          <Button
            type="button"
            variant="icon"
            className="sm:hidden shrink-0"
            aria-label="Close search"
            onClick={() => {
              setMobileExpanded(false)
              setOpen(false)
            }}
          >
            <svg
              className="w-4 h-4"
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

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={portalRef}
            id="globalSearchResults"
            role="dialog"
            aria-label="Global search results"
            style={{
              top: `${popoverStyle.top}px`,
              left: `${popoverStyle.left}px`,
              width: `${popoverStyle.width}px`,
            }}
          >
            {/* Pack- & permission-aware object filter pills */}
            <div className="px-3 py-2 border-b crm-border flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setObjectType('')
                  setPage(1)
                }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  effectiveObjectType === ''
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                All
                {searchData ? (
                  <span className="ml-1 opacity-80 num-tabular">({allObjectsTotal})</span>
                ) : null}
              </button>
              {searchableObjects.map((obj) => {
                const isSelected = effectiveObjectType === obj.key
                return (
                  <button
                    key={obj.key}
                    type="button"
                    data-search-object-pill={obj.key}
                    onClick={() => {
                      setObjectType(obj.key)
                      setPage(1)
                    }}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                      isSelected ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {obj.plural_label}
                    {obj.count !== null && obj.count !== undefined ? (
                      <span className="ml-1 opacity-80 num-tabular">({obj.count})</span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {/* Results list */}
            <div id="globalSearchResultsList" className="divide-y crm-border">
              {error ? (
                <div className="px-3.5 py-4 text-xs text-rose-600">{error}</div>
              ) : loading && results.length === 0 ? (
                <div className="px-3.5 py-4 text-xs text-sub">Searching workspace records...</div>
              ) : results.length === 0 ? (
                <div className="px-3.5 py-5 text-xs text-sub">
                  {effectiveQuery
                    ? `No matching records found for "${effectiveQuery}".`
                    : 'No readable records yet in the selected scope.'}
                </div>
              ) : (
                results.map((hit, idx) => {
                  const isHighlighted = idx === activeIndex
                  const badgeClass =
                    BADGE_TONE_CLASSES[hit.badge_tone] || 'badge badge-neutral'
                  return (
                    <button
                      key={`${hit.object_type}-${hit.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelectHit(hit)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isHighlighted ? 'brand-soft' : 'hover:bg-white/20 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="badge badge-neutral shrink-0">
                            {hit.object_label}
                          </span>
                          <span className="text-[11px] font-mono text-sub num-tabular shrink-0">
                            {hit.record_code}
                          </span>
                          <span className="text-xs font-medium text-main truncate">
                            {hit.title}
                          </span>
                        </div>
                        {hit.subtitle ? (
                          <div className="text-[11px] text-sub truncate">{hit.subtitle}</div>
                        ) : null}
                      </div>
                      {hit.badge ? (
                        <span className={`${badgeClass} shrink-0`}>{hit.badge}</span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>

            {/* Pagination footer */}
            <div className="px-3.5 py-2 border-t crm-border flex items-center justify-between gap-2 text-[11px] text-sub">
              <span className="num-tabular truncate">
                {loading
                  ? 'Updating...'
                  : totalCount > 0
                    ? `Page ${searchData?.page ?? page} of ${totalPages} (${totalCount} ${
                        totalCount === 1 ? 'result' : 'results'
                      })`
                    : '0 results'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !searchData?.has_previous}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="px-2 py-0.5 text-[11px]"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !searchData?.has_next}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="px-2 py-0.5 text-[11px]"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
