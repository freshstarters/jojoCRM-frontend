import { useEffect, useState } from 'react'
import { fetchRecordAudit } from '../../service/crmService.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'

const ACTOR_KIND_BADGES = {
  person: { label: 'Person', className: 'badge badge-info' },
  script: { label: 'Script', className: 'badge badge-neutral' },
  automation: { label: 'Automation', className: 'badge badge-warn' },
  agent: { label: 'Agent', className: 'badge badge-success' },
}

const ACTION_BADGES = {
  create: { label: 'Created', className: 'badge badge-success' },
  update: { label: 'Updated', className: 'badge badge-info' },
  delete: { label: 'Removed', className: 'badge badge-danger' },
}

function formatAuditValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'None'
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function formatTimestamp(isoString, timeZone) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || 'Africa/Accra',
    }).format(date)
  } catch {
    return new Date(isoString).toLocaleString()
  }
}

export function RecordAuditHistory({
  workspaceSlug,
  objectKey,
  recordId,
  userTimezone = 'Africa/Accra',
  refreshKey = 0,
  onSessionExpired,
}) {
  const scopeKey = `${objectKey || ''}:${recordId || ''}`
  const [pageState, setPageState] = useState({ scope: scopeKey, page: 1 })
  const [auditData, setAuditData] = useState(null)
  const [error, setError] = useState('')
  const [completedKey, setCompletedKey] = useState('')

  const effectivePage = pageState.scope === scopeKey ? pageState.page : 1
  const requestKey =
    workspaceSlug && objectKey && recordId
      ? `${workspaceSlug}:${objectKey}:${recordId}:${effectivePage}:${refreshKey}`
      : ''
  const loading = Boolean(requestKey && completedKey !== requestKey)

  function goToPage(nextPage) {
    setPageState({ scope: scopeKey, page: Math.max(1, nextPage) })
  }

  useEffect(() => {
    if (!requestKey) return undefined
    let cancelled = false
    const activeKey = requestKey

    fetchRecordAudit(workspaceSlug, objectKey, recordId, {
      page: effectivePage,
      page_size: 10,
    })
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(data?.error || data?.detail || 'Could not load change history.')
          return
        }
        setError('')
        setAuditData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Network error while loading change history.')
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
  }, [requestKey, workspaceSlug, objectKey, recordId, effectivePage, onSessionExpired])

  const entries = auditData?.results || []
  const totalCount = auditData?.total_count ?? 0
  const totalPages = auditData?.total_pages ?? 1

  return (
    <div className="pt-3 border-t crm-border space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-main">
          Change History
          {auditData ? (
            <span className="ml-1.5 text-[11px] font-normal text-sub num-tabular">
              ({totalCount})
            </span>
          ) : null}
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-sub num-tabular">
              Page {auditData?.page ?? effectivePage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !auditData?.has_previous}
              onClick={() => goToPage(effectivePage - 1)}
              className="px-2 py-0.5 text-[11px]"
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !auditData?.has_next}
              onClick={() => goToPage(effectivePage + 1)}
              className="px-2 py-0.5 text-[11px]"
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <FeedbackNotice tone="danger" message={error} />

      {loading && entries.length === 0 ? (
        <p className="text-xs text-sub">Loading change history...</p>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <div className="crm-subtle px-3 py-2.5 text-xs text-sub">
          No recorded audit changes yet for this record.
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map((entry) => {
            const actorBadge =
              ACTOR_KIND_BADGES[entry.actor_kind] || {
                label: entry.actor_kind || 'Actor',
                className: 'badge badge-neutral',
              }
            const actionBadge =
              ACTION_BADGES[entry.action] || {
                label: entry.action || 'Change',
                className: 'badge badge-neutral',
              }
            return (
              <div key={entry.id} className="crm-subtle p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-main truncate">
                      {entry.actor}
                    </span>
                    <span className={actorBadge.className}>{actorBadge.label}</span>
                    <span className={actionBadge.className}>{actionBadge.label}</span>
                  </div>
                  <span className="text-[11px] text-sub num-tabular shrink-0">
                    {formatTimestamp(entry.created_at, userTimezone)}
                  </span>
                </div>

                <div className="text-[11px] text-sub">
                  Field:{' '}
                  <span className="font-mono text-main">{entry.field_name}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border crm-border px-2.5 py-1.5">
                    <span className="block text-[10px] uppercase tracking-wider text-sub">
                      Previous
                    </span>
                    <span className="text-sub break-all">
                      {formatAuditValue(entry.previous_value)}
                    </span>
                  </div>
                  <div className="rounded-lg border crm-border px-2.5 py-1.5">
                    <span className="block text-[10px] uppercase tracking-wider text-sub">
                      New
                    </span>
                    <span className="font-medium text-main break-all">
                      {formatAuditValue(entry.new_value)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
