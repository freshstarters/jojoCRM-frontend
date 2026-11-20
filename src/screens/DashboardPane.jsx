import { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { RefreshButton } from '../components/RefreshButton.jsx'
import { DashboardBottomBento } from '../components/dashboard/DashboardBottomBento.jsx'
import { DashboardKpiRow } from '../components/dashboard/DashboardKpiRow.jsx'
import { DashboardVelocityBento } from '../components/dashboard/DashboardVelocityBento.jsx'
import { fetchDashboardSummary, getObjectRights, updateCrmRecord } from '../service/crmService.js'

function getTimeOfDayGreeting(timeZone = 'Africa/Accra') {
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timeZone || 'Africa/Accra',
    }).format(new Date())
    const hour = Number(hourStr)
    if (Number.isFinite(hour)) {
      if (hour < 12) return 'Good morning'
      if (hour < 17) return 'Good afternoon'
      return 'Good evening'
    }
  } catch {
    // Fallback to browser local hour when timezone lookup fails
  }
  const localHour = new Date().getHours()
  if (localHour < 12) return 'Good morning'
  if (localHour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  activeTablesSummary,
  onSelectPane,
  onOpenRecord,
  onOpenAuditLog,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const userTimezone = user?.timezone || 'Africa/Accra'
  const firstName = user?.full_name?.trim()
    ? user.full_name.trim().split(/\s+/)[0]
    : (user?.email?.split('@')[0] || 'there')

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(Boolean(workspaceSlug))
  const [error, setError] = useState('')
  const [taskError, setTaskError] = useState('')
  const [togglingTaskIds, setTogglingTaskIds] = useState({})
  const [refreshTick, setRefreshTick] = useState(0)

  const loadSummary = useCallback(() => {
    setLoading(true)
    setError('')
    setTaskError('')
    setRefreshTick((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!workspaceSlug) return undefined
    let cancelled = false

    fetchDashboardSummary(workspaceSlug, { force: refreshTick > 0 })
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(data?.error || data?.detail || 'Could not load dashboard summary.')
          return
        }
        setDashboardData(data)
        setError('')
      })
      .catch(() => {
        if (!cancelled) {
          setError('Network error while loading dashboard summary.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [workspaceSlug, refreshTick, permissionsRevision, onSessionExpired])

  async function handleToggleTask(item) {
    if (!workspaceSlug || !item?.id || togglingTaskIds[item.id]) return
    const nextCompleted = !item.is_completed
    setTaskError('')
    setTogglingTaskIds((prev) => ({ ...prev, [item.id]: true }))

    try {
      const { response, data } = await updateCrmRecord(workspaceSlug, 'activity', item.id, {
        is_completed: nextCompleted,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setTaskError(data?.error || data?.detail || 'Could not update task status.')
        return
      }
      onAuditRecorded?.()
      loadSummary()
    } catch {
      setTaskError('Network error while updating task status.')
    } finally {
      setTogglingTaskIds((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    }
  }

  const readableKeys = dashboardData?.readable_object_keys || []
  const packTables = activeTablesSummary?.packTables || []
  const coreTables = activeTablesSummary?.coreTables || []
  const accessibleTables = [...packTables, ...coreTables].filter((entry) => {
    if (!entry.paneId) return false
    if (permissions && !getObjectRights(permissions, entry.key).canRead) return false
    return true
  })

  const primaryAction = (() => {
    if (readableKeys.includes('deal')) {
      return {
        label: 'Open Pipeline',
        onClick: () => onSelectPane?.('deals', 'kanban'),
      }
    }
    if (readableKeys.includes('visit')) {
      return {
        label: 'Open Visits',
        onClick: () => onSelectPane?.('visits'),
      }
    }
    if (readableKeys.includes('appointment')) {
      return {
        label: 'Open Schedule',
        onClick: () => onSelectPane?.('appointments'),
      }
    }
    if (readableKeys.includes('contact')) {
      return {
        label: `Open ${contactPlural}`,
        onClick: () => onSelectPane?.('contacts'),
      }
    }
    return null
  })()

  return (
    <section id="pane-dashboard" className="w-full space-y-6 my-4 sm:my-6 px-1 sm:px-2">
      {/* Top Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-main tracking-tight">
            {getTimeOfDayGreeting(userTimezone)}, {firstName}
          </h1>
          <p className="text-xs text-sub mt-0.5">
            {workspace?.business_type_label || 'Workspace'} overview ·{' '}
            <span className="num-tabular">{dashboardData?.total_records ?? 0}</span> accessible
            records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton
            onClick={loadSummary}
            loading={loading}
            label="Refresh dashboard summary"
          />
          {onOpenAuditLog ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenAuditLog}
              className="px-3 py-1.5 text-xs"
            >
              Audit Log
            </Button>
          ) : null}
          {primaryAction ? (
            <Button
              type="button"
              variant="primary"
              onClick={primaryAction.onClick}
              className="px-3 py-1.5 text-xs"
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <FeedbackNotice variant="error" message={error} onDismiss={() => setError('')} />
      ) : null}
      {taskError ? (
        <FeedbackNotice variant="error" message={taskError} onDismiss={() => setTaskError('')} />
      ) : null}

      {loading && !dashboardData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((slot) => (
            <Card key={slot} className="rounded-xl p-4 h-32 animate-pulse">
              <div className="h-3 w-24 rounded crm-subtle" />
              <div className="h-6 w-32 rounded crm-subtle mt-3" />
            </Card>
          ))}
        </div>
      ) : !dashboardData ? (
        <Card className="p-5">
          <p className="text-xs text-sub">Dashboard metrics unavailable.</p>
        </Card>
      ) : (
        <>
          {/* Row 1: 4 Mini-Chart KPI Cards */}
          <DashboardKpiRow
            dashboardData={dashboardData}
            contactPlural={contactPlural}
            onSelectPane={onSelectPane}
          />

          {/* Row 2: Hero Velocity Bento, Action Items Checklist & Activity Mix */}
          <DashboardVelocityBento
            dashboardData={dashboardData}
            userTimezone={userTimezone}
            togglingTaskIds={togglingTaskIds}
            onToggleTask={handleToggleTask}
            onOpenRecord={onOpenRecord}
          />

          {/* Row 3: Active Deals / Visits-Appointments + Ghana 16-Region Map + Tickets */}
          <DashboardBottomBento
            dashboardData={dashboardData}
            contactLabel={contactLabel}
            userTimezone={userTimezone}
            onSelectPane={onSelectPane}
            onOpenRecord={onOpenRecord}
            onOpenAuditLog={onOpenAuditLog}
          />

          {/* Active Tables Directory */}
          {accessibleTables.length > 0 ? (
            <Card className="rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-sub">Workspace Modules</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {accessibleTables.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => onSelectPane?.(entry.paneId, entry.subtabId)}
                    className="badge badge-neutral hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </section>
  )
}
