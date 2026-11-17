import { useEffect, useState } from 'react'
import { apiGet } from '../utils/api.js'
import { Button } from './Button.jsx'
import { Drawer } from './Drawer.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'
import { RefreshButton } from './RefreshButton.jsx'
import { Select } from './Select.jsx'

const ACTOR_KIND_OPTIONS = [
  { value: '', label: 'All actor kinds' },
  { value: 'person', label: 'Person' },
  { value: 'script', label: 'Script' },
  { value: 'automation', label: 'Automation' },
  { value: 'agent', label: 'Agent' },
]

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

const OBJECT_TYPE_LABELS = {
  workspace: 'Workspace',
  workspace_pack: 'Pack',
  workspace_table: 'Table',
  user: 'User',
  workspace_invite: 'Invite',
  external_identity: 'Sign-in link',
  passkey: 'Passkey',
  role: 'Role',
  account: 'Account',
  contact: 'Contact',
  lead: 'Lead',
  deal: 'Deal',
  activity: 'Activity',
  job: 'Job',
  appointment: 'Appointment',
  ticket: 'Ticket',
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

export function AuditLogDrawer({
  open,
  onClose,
  workspaceSlug,
  userTimezone = 'Africa/Accra',
  contactLabel = 'Contact',
  canManageUsers = false,
  refreshKey = 0,
  onSessionExpired,
}) {
  const [page, setPage] = useState(1)
  const [actorKind, setActorKind] = useState('')
  const [error, setError] = useState('')
  const [auditData, setAuditData] = useState(null)
  const [manualRefresh, setManualRefresh] = useState(0)
  const [completedRequestKey, setCompletedRequestKey] = useState('')

  const requestKey = open
    ? `${workspaceSlug || ''}:${page}:${actorKind}:${refreshKey}:${manualRefresh}`
    : ''
  const loading = Boolean(open && workspaceSlug && completedRequestKey !== requestKey)

  useEffect(() => {
    if (!open || !workspaceSlug) return
    let cancelled = false
    const activeKey = requestKey
    const params = new URLSearchParams({
      page: String(page),
      page_size: '20',
    })
    if (actorKind) {
      params.set('actor_kind', actorKind)
    }

    apiGet(
      `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/audit/?${params.toString()}`,
    )
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(
            data?.error || data?.detail || 'Could not load audit log entries.',
          )
          return
        }
        setError('')
        setAuditData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Network error while loading audit log entries.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedRequestKey(activeKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, workspaceSlug, page, actorKind, requestKey, onSessionExpired])

  const entries = auditData?.results || []
  const totalCount = auditData?.total_count ?? 0
  const totalPages = auditData?.total_pages ?? 1
  const scopeNote = canManageUsers
    ? 'Showing workspace-wide changes with actor, timestamp, and before/after values.'
    : 'Showing your account activity and workspace record changes.'

  return (
    <Drawer
      open={open}
      onClose={onClose}
      variant="audit"
      title="Workspace Audit Log"
      subtitle={scopeNote}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-sub num-tabular">
            Page {auditData?.page ?? page} of {totalPages} ({totalCount}{' '}
            {totalCount === 1 ? 'entry' : 'entries'})
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary-icon"
              disabled={loading || !auditData?.has_previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              data-tooltip="Previous page"
              aria-label="Previous page"
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
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Button>
            <Button
              type="button"
              variant="secondary-icon"
              disabled={loading || !auditData?.has_next}
              onClick={() => setPage((prev) => prev + 1)}
              data-tooltip="Next page"
              aria-label="Next page"
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
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="w-48">
            <Select
              id="audit-actor-kind-filter"
              ariaLabel="Filter audit log by actor kind"
              value={actorKind}
              onChange={(nextValue) => {
                setPage(1)
                setActorKind(nextValue)
              }}
              options={ACTOR_KIND_OPTIONS}
            />
          </div>
          <RefreshButton
            loading={loading}
            label="Refresh audit log"
            onClick={() => setManualRefresh((prev) => prev + 1)}
          />
        </div>

        <FeedbackNotice tone="danger" message={error} />

        {loading && entries.length === 0 ? (
          <p className="text-xs text-sub py-6">Loading audit log entries...</p>
        ) : null}

        {!loading && !error && entries.length === 0 ? (
          <div className="crm-subtle px-3.5 py-3 text-xs text-sub">
            No audit entries match the current view yet.
          </div>
        ) : null}

        {entries.length > 0 ? (
          <div className="space-y-2.5">
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
              const objectLabel =
                entry.object_type === 'contact'
                  ? contactLabel
                  : OBJECT_TYPE_LABELS[entry.object_type] || entry.object_type

              return (
                <div key={entry.id} className="crm-subtle p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="text-xs font-medium text-main truncate">
                        {entry.actor}
                      </span>
                      <span className={actorBadge.className}>{actorBadge.label}</span>
                      <span className={actionBadge.className}>
                        {actionBadge.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-sub num-tabular shrink-0">
                      {formatTimestamp(entry.created_at, userTimezone)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-sub">
                    <span className="badge badge-neutral">{objectLabel}</span>
                    {entry.record_label ? (
                      <span className="font-medium text-main break-all">
                        {entry.record_label}
                      </span>
                    ) : null}
                    <span>·</span>
                    <span className="font-mono text-[11px] text-main">
                      {entry.field_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="rounded-lg border crm-border px-2.5 py-1.5">
                      <span className="block text-[10px] uppercase tracking-wider text-sub">
                        Previous value
                      </span>
                      <span className="text-sub break-all">
                        {formatAuditValue(entry.previous_value)}
                      </span>
                    </div>
                    <div className="rounded-lg border crm-border px-2.5 py-1.5">
                      <span className="block text-[10px] uppercase tracking-wider text-sub">
                        New value
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
    </Drawer>
  )
}
