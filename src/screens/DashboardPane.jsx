import { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { RefreshButton } from '../components/RefreshButton.jsx'
import { MiniDonutChart } from '../components/crm/SummaryMiniCharts.jsx'
import { fetchDashboardSummary } from '../service/crmService.js'
import { OBJECT_LABELS } from '../utils/catalog.js'
import { formatDateTime, formatGhs } from '../utils/formatters.js'

const STAGE_COLORS = {
  New: '#64748b',
  Qualified: '#3b82f6',
  Proposal: '#6366f1',
  Won: '#10b981',
  Lost: '#f43f5e',
}

export function DashboardPane({
  workspace,
  user,
  activeTablesSummary,
  onSelectPane,
  onOpenRecord,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const userTimezone = user?.timezone || 'Africa/Accra'

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(Boolean(workspaceSlug))
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const loadSummary = useCallback(() => {
    setLoading(true)
    setError('')
    setRefreshTick((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!workspaceSlug) return undefined
    let cancelled = false

    fetchDashboardSummary(workspaceSlug)
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
        setError('')
        setDashboardData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Network error while loading workspace dashboard.')
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
  }, [workspaceSlug, refreshTick, onSessionExpired])

  const countsByObject = dashboardData?.counts_by_object || {}
  const openCounts = dashboardData?.open_counts || {}
  const dealSummary = dashboardData?.deal_summary || null
  const recentRecords = dashboardData?.recent_records || []
  const totalRecords = dashboardData?.total_records ?? 0

  const stageDonutItems = dealSummary
    ? Object.entries(dealSummary.stage_counts || {}).map(([stage, count]) => ({
        label: stage,
        count,
        color: STAGE_COLORS[stage] || '#3b82f6',
      }))
    : []

  const objectCards = [
    { key: 'account', label: 'Accounts', paneId: 'accounts' },
    { key: 'contact', label: contactPlural, paneId: 'contacts' },
    {
      key: 'lead',
      label: 'Leads',
      paneId: 'leads',
      caption:
        openCounts.lead_open !== undefined
          ? `${openCounts.lead_open} open`
          : undefined,
    },
    {
      key: 'deal',
      label: 'Deals',
      paneId: 'deals',
      caption: dealSummary ? formatGhs(dealSummary.total_amount) : undefined,
    },
    {
      key: 'job',
      label: 'Jobs',
      paneId: 'jobs',
      caption:
        openCounts.job_open !== undefined
          ? `${openCounts.job_open} active`
          : undefined,
    },
    {
      key: 'appointment',
      label: 'Appointments',
      paneId: 'appointments',
      caption:
        openCounts.appointment_upcoming !== undefined
          ? `${openCounts.appointment_upcoming} upcoming`
          : undefined,
    },
    {
      key: 'ticket',
      label: 'Support Tickets',
      paneId: 'tickets',
      caption:
        openCounts.ticket_open !== undefined
          ? `${openCounts.ticket_open} open`
          : undefined,
    },
  ].filter((item) => Object.prototype.hasOwnProperty.call(countsByObject, item.key))

  function getObjectLabel(objKey) {
    if (objKey === 'contact') return contactLabel
    return OBJECT_LABELS[objKey]?.label || objKey
  }

  return (
    <section id="pane-dashboard" className="space-y-5 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b crm-border">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-info">
              {workspace?.business_type_label || 'CRM Workspace'}
            </span>
            <span className="badge badge-neutral num-tabular">
              {workspace?.active_table_count ?? 17} tables (
              {workspace?.core_table_count ?? 5} core +{' '}
              {workspace?.pack_table_count ?? 12} pack)
            </span>
            {workspace?.contact_label && workspace.contact_label !== 'Contact' ? (
              <span className="badge badge-info">
                Contact: {workspace.contact_label}
              </span>
            ) : null}
          </div>
          <h1 className="text-xl font-semibold text-main tracking-tight mt-2">
            {workspace?.name || 'Workspace'} Overview
          </h1>
          <p className="text-xs text-sub mt-0.5">
            Live CRM counts, pipeline breakdown, and recent activity across your active tables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <RefreshButton
            loading={loading}
            label="Refresh dashboard"
            onClick={loadSummary}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSelectPane?.('settings', 'packs')}
            className="px-3 py-1.5 text-xs"
          >
            Packs &amp; Tables
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSelectPane?.('settings', 'workspace')}
            className="px-3 py-1.5 text-xs"
          >
            Workspace Settings
          </Button>
        </div>
      </div>

      <FeedbackNotice message={error} tone="danger" />

      {loading && !dashboardData ? (
        <Card className="p-6">
          <p className="text-xs text-sub">Loading workspace overview...</p>
        </Card>
      ) : null}

      {dashboardData ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex flex-col justify-between">
              <span className="text-xs font-medium text-sub">
                Total CRM records
              </span>
              <div className="mt-1 text-xl font-bold text-main num-tabular">
                {totalRecords}
              </div>
              <span className="text-[11px] text-sub">
                Across readable starter tables
              </span>
            </Card>

            {dealSummary ? (
              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-sub">
                    Pipeline value
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectPane?.('deals', 'kanban')}
                    className="text-[11px]"
                  >
                    Board
                  </Button>
                </div>
                <div className="mt-1 text-xl font-bold text-main num-tabular">
                  {formatGhs(dealSummary.total_amount)}
                </div>
                <span className="text-[11px] text-sub num-tabular">
                  {dealSummary.total_count}{' '}
                  {dealSummary.total_count === 1 ? 'deal' : 'deals'}
                </span>
              </Card>
            ) : null}

            {openCounts.job_open !== undefined ? (
              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-sub">
                    Open jobs
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectPane?.('jobs')}
                    className="text-[11px]"
                  >
                    View
                  </Button>
                </div>
                <div className="mt-1 text-xl font-bold text-main num-tabular">
                  {openCounts.job_open}
                </div>
                <span className="text-[11px] text-sub">
                  Pending or in progress
                </span>
              </Card>
            ) : null}

            {openCounts.ticket_open !== undefined ? (
              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-sub">
                    Open support tickets
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectPane?.('tickets')}
                    className="text-[11px]"
                  >
                    View
                  </Button>
                </div>
                <div className="mt-1 text-xl font-bold text-main num-tabular">
                  {openCounts.ticket_open}
                </div>
                <span className="text-[11px] text-sub">
                  New, open, or pending
                </span>
              </Card>
            ) : openCounts.appointment_upcoming !== undefined ? (
              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-sub">
                    Upcoming appointments
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectPane?.('appointments')}
                    className="text-[11px]"
                  >
                    View
                  </Button>
                </div>
                <div className="mt-1 text-xl font-bold text-main num-tabular">
                  {openCounts.appointment_upcoming}
                </div>
                <span className="text-[11px] text-sub">
                  Scheduled or confirmed
                </span>
              </Card>
            ) : null}
          </div>

          {dealSummary ? (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-main">
                    Pipeline Stage Mix
                  </h2>
                  <p className="text-xs text-sub">
                    Active deals grouped across New, Qualified, Proposal, Won, and Lost.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onSelectPane?.('deals', 'kanban')}
                  className="px-2.5 py-1 text-xs"
                >
                  Open Board
                </Button>
              </div>
              <MiniDonutChart
                items={stageDonutItems}
                emptyLabel="No deals in the pipeline yet."
                ringSizeClass="w-16 h-16"
                centerValue={dealSummary.total_count}
                centerLabel="Deals"
              />
            </Card>
          ) : null}

          {objectCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {objectCards.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    onSelectPane?.(
                      item.paneId,
                      item.paneId === 'deals' ? 'kanban' : '',
                    )
                  }
                  className="crm-card crm-hover p-3 text-left space-y-1 transition-colors"
                >
                  <span className="text-[11px] font-medium text-sub block truncate">
                    {item.label}
                  </span>
                  <span className="text-lg font-bold text-main num-tabular block">
                    {countsByObject[item.key] ?? 0}
                  </span>
                  {item.caption ? (
                    <span className="text-[10px] text-sub block truncate num-tabular">
                      {item.caption}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b crm-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-main">
                  Recent CRM Records
                </h2>
                <p className="text-xs text-sub">
                  Latest updates across your readable core and pack tables.
                </p>
              </div>
              {countsByObject.activity !== undefined ? (
                <span className="badge badge-neutral num-tabular">
                  {countsByObject.activity}{' '}
                  {countsByObject.activity === 1 ? 'activity' : 'activities'}
                </span>
              ) : null}
            </div>

            {totalRecords === 0 || recentRecords.length === 0 ? (
              <div className="crm-subtle px-3.5 py-3 text-xs text-sub">
                No records yet. Open Accounts, {contactPlural}, or any active module from the sidebar to add your first record.
              </div>
            ) : (
              <div className="divide-y crm-border text-xs">
                {recentRecords.map((rec) => (
                  <div
                    key={`${rec.object_key}-${rec.id}`}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="badge badge-neutral shrink-0">
                        {getObjectLabel(rec.object_key)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-main truncate">
                          {rec.display_label}
                        </div>
                        <div className="text-[11px] text-sub truncate">
                          {rec.record_code}
                          {rec.meta ? ` · ${rec.meta}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-sub num-tabular hidden sm:inline">
                        {formatDateTime(rec.updated_at, userTimezone)}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenRecord?.(rec.pane_id, rec.id)}
                        className="px-2.5 py-1 text-[11px]"
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <Card variant="subtle" className="p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-main">Core tables</span>
            <span className="badge badge-info num-tabular">
              {activeTablesSummary.coreTables.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeTablesSummary.coreTables.map((tbl) =>
              tbl.paneId ? (
                <Button
                  key={tbl.key}
                  type="button"
                  variant="secondary"
                  onClick={() => onSelectPane?.(tbl.paneId, tbl.subtabId)}
                  className="px-2.5 py-1 text-[11px]"
                >
                  {tbl.label}
                </Button>
              ) : (
                <span key={tbl.key} className="badge badge-neutral">
                  {tbl.label}
                </span>
              ),
            )}
          </div>
        </Card>

        <Card variant="subtle" className="p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-main">Active pack tables</span>
            <span className="badge badge-success num-tabular">
              {activeTablesSummary.packTables.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeTablesSummary.packTables.map((tbl) =>
              tbl.paneId ? (
                <Button
                  key={tbl.key}
                  type="button"
                  variant="secondary"
                  onClick={() => onSelectPane?.(tbl.paneId, tbl.subtabId)}
                  className="px-2.5 py-1 text-[11px]"
                >
                  {tbl.label}
                </Button>
              ) : (
                <span key={tbl.key} className="badge badge-neutral">
                  {tbl.label}
                </span>
              ),
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}
