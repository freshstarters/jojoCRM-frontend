import { useId } from 'react'
import { getStageColor } from '../../service/crmService.js'
import { OBJECT_LABELS } from '../../utils/catalog.js'
import { formatGhs } from '../../utils/formatters.js'
import { Card } from '../Card.jsx'

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#64748b']

function buildSparklinePoints(values, width = 120, height = 28) {
  const safe = values && values.length >= 2 ? values : [0, 0, 0, 0]
  const maxVal = Math.max(...safe, 1)
  const stepX = width / Math.max(safe.length - 1, 1)
  const coords = safe.map((val, idx) => {
    const x = Number((idx * stepX).toFixed(2))
    const ratio = Math.max(0, Math.min(1, Number(val || 0) / maxVal))
    const y = Number((height - 4 - ratio * (height - 8)).toFixed(2))
    return [x, y]
  })
  const line = coords
    .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return { line, area }
}

function buildDonutSegments(items) {
  const total = items.reduce((acc, item) => acc + item.count, 0)
  if (!total) return []
  const circumference = 100
  let cumulative = 0
  return items
    .filter((item) => item.count > 0)
    .map((item) => {
      const pct = (item.count / total) * circumference
      const seg = {
        ...item,
        dashArray: `${pct.toFixed(2)} ${(circumference - pct).toFixed(2)}`,
        dashOffset: `${(-cumulative).toFixed(2)}`,
        share: Math.round((item.count / total) * 100),
      }
      cumulative += pct
      return seg
    })
}

export function DashboardKpiRow({
  dashboardData,
  contactPlural = 'Contacts',
  onSelectPane,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const blueGradId = `dashSparkBlue-${uid}`
  const roseGradId = `dashSparkRose-${uid}`

  const countsByObject = dashboardData?.counts_by_object || {}
  const openCounts = dashboardData?.open_counts || {}
  const dealSummary = dashboardData?.deal_summary || null
  const taskSummary = dashboardData?.task_summary || null
  const readableKeys = dashboardData?.readable_object_keys || []
  const totalRecords = dashboardData?.total_records ?? 0
  const velocityWeek = dashboardData?.velocity_series?.week || []

  // Card 1: Pipeline Revenue (or Workspace Records for Deal-less workspaces)
  const sparkValues = velocityWeek.map((pt) => (dealSummary ? pt.value || pt.count : pt.count))
  const blueSpark = buildSparklinePoints(sparkValues)
  const hasDealAmount =
    dealSummary && dealSummary.total_amount !== null && dealSummary.total_amount !== undefined

  // Card 2: Compact Donut Mix (Pipeline stages when Deals readable, else enabled object mix)
  const donutItems = dealSummary
    ? Object.entries(dealSummary.stage_counts || {}).map(([stageName, cnt]) => ({
        key: stageName,
        label: stageName,
        count: Number(cnt || 0),
        color: getStageColor(dealSummary.stage_tones?.[stageName], stageName),
      }))
    : readableKeys
        .filter((key) => key !== 'activity' && (countsByObject[key] || 0) > 0)
        .slice(0, 4)
        .map((key, idx) => ({
          key,
          label:
            key === 'contact' ? contactPlural : OBJECT_LABELS[key]?.label || key,
          count: Number(countsByObject[key] || 0),
          color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
        }))
  const donutSegments = buildDonutSegments(donutItems)
  const donutTotal = donutItems.reduce((sum, item) => sum + item.count, 0)
  const donutCenterLabel = dealSummary
    ? dealSummary.win_rate !== null && dealSummary.win_rate !== undefined
      ? `${dealSummary.win_rate}%`
      : `${dealSummary.total_count}`
    : `${donutTotal}`

  // Card 3: Highest-priority live operational queue
  const queueCard = (() => {
    if (readableKeys.includes('ticket')) {
      const openTickets = openCounts.ticket_open ?? 0
      const totalTickets = countsByObject.ticket ?? 0
      return {
        label: 'Open Tickets',
        badge: totalTickets ? `${totalTickets} total` : 'Queue',
        value: openTickets,
        subtitle:
          openTickets > 0
            ? `${openTickets} awaiting resolution`
            : 'No unresolved tickets',
        paneId: 'tickets',
        series: [Math.max(1, totalTickets - openTickets), Math.max(0, totalTickets), Math.max(0, openTickets)],
      }
    }
    if (readableKeys.includes('appointment')) {
      const upcoming = openCounts.appointment_upcoming ?? 0
      const totalAppts = countsByObject.appointment ?? 0
      return {
        label: 'Upcoming Appts',
        badge: totalAppts ? `${totalAppts} total` : 'Schedule',
        value: upcoming,
        subtitle: `${countsByObject.visit ?? 0} visits recorded`,
        paneId: 'appointments',
        series: [totalAppts, upcoming, countsByObject.visit ?? 0],
      }
    }
    if (readableKeys.includes('lead')) {
      const openLeads = openCounts.lead_open ?? 0
      const totalLeads = countsByObject.lead ?? 0
      return {
        label: 'Open Leads',
        badge: totalLeads ? `${totalLeads} total` : 'Funnel',
        value: openLeads,
        subtitle: `${Math.max(0, totalLeads - openLeads)} converted or closed`,
        paneId: 'leads',
        series: [totalLeads, Math.max(0, totalLeads - openLeads), openLeads],
      }
    }
    return {
      label: contactPlural,
      badge: `${countsByObject.account ?? 0} accounts`,
      value: countsByObject.contact ?? 0,
      subtitle: `${totalRecords} workspace records`,
      paneId: readableKeys.includes('contact') ? 'contacts' : null,
      series: sparkValues,
    }
  })()
  const roseSpark = buildSparklinePoints(queueCard.series)

  // Card 4: Tasks Completed Progress Bar (or Active Modules if activity is hidden/off)
  const taskTotal = taskSummary?.total_count ?? 0
  const taskDone = taskSummary?.completed_count ?? 0
  const taskPct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI Card 1: Pipeline Revenue or Workspace Records */}
      <Card
        onClick={() => onSelectPane?.(dealSummary ? 'deals' : 'accounts', dealSummary ? 'kanban' : '')}
        className="rounded-xl p-4 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-sub uppercase tracking-wider">
              {dealSummary ? 'Pipeline Value' : 'Workspace Records'}
            </span>
            <p className="text-2xl font-bold text-main num-tabular mt-1 truncate">
              {dealSummary
                ? hasDealAmount
                  ? formatGhs(dealSummary.total_amount)
                  : `${dealSummary.total_count} Deals`
                : totalRecords}
            </p>
          </div>
          <span className="badge badge-info num-tabular shrink-0">
            {dealSummary ? `${dealSummary.open_count} open` : `${readableKeys.length} tables`}
          </span>
        </div>

        <p className="text-[11px] text-sub mt-1 truncate num-tabular">
          {dealSummary
            ? hasDealAmount
              ? `${dealSummary.total_count} deals · ${dealSummary.won_count} won`
              : 'Amount hidden by role · open pipeline summary'
            : `${countsByObject.contact ?? 0} ${contactPlural.toLowerCase()} · ${countsByObject.account ?? 0} accounts`}
        </p>

        <div className="mt-2.5 h-8 w-full">
          <svg
            viewBox="0 0 120 28"
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={blueGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={blueSpark.area} fill={`url(#${blueGradId})`} />
            <path
              d={blueSpark.line}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Card>

      {/* KPI Card 2: Compact Stage / Record Mix Donut */}
      <Card className="rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden="true">
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="4.2"
            />
            {donutSegments.map((seg) => (
              <circle
                key={seg.key}
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke={seg.color}
                strokeWidth="4.2"
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-main num-tabular">{donutCenterLabel}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-sub uppercase tracking-wider truncate">
              {dealSummary ? 'Pipeline Mix' : 'Record Mix'}
            </span>
            {dealSummary ? (
              <button
                type="button"
                onClick={() => onSelectPane?.('deals', 'kanban')}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                Board
              </button>
            ) : null}
          </div>
          {donutItems.length === 0 ? (
            <p className="text-xs text-sub">No records yet.</p>
          ) : (
            <div className="space-y-1">
              {donutItems.slice(0, 3).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 min-w-0 text-sub truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="font-semibold text-main num-tabular shrink-0">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* KPI Card 3: Active Operational Queue + Rose Sparkline */}
      <Card
        onClick={() => queueCard.paneId && onSelectPane?.(queueCard.paneId)}
        className={`rounded-xl p-4 flex flex-col justify-between ${
          queueCard.paneId ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-sub uppercase tracking-wider">
              {queueCard.label}
            </span>
            <p className="text-2xl font-bold text-main num-tabular mt-1">{queueCard.value}</p>
          </div>
          <span className="badge badge-danger num-tabular shrink-0">{queueCard.badge}</span>
        </div>

        <p className="text-[11px] text-sub mt-1 truncate">{queueCard.subtitle}</p>

        <div className="mt-2.5 h-8 w-full">
          <svg
            viewBox="0 0 120 28"
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={roseGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={roseSpark.area} fill={`url(#${roseGradId})`} />
            <path
              d={roseSpark.line}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Card>

      {/* KPI Card 4: Tasks Completed Progress */}
      <Card className="rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-sub uppercase tracking-wider">
              {taskSummary ? 'Tasks Completed' : 'Active Modules'}
            </span>
            <p className="text-2xl font-bold text-main num-tabular mt-1">
              {taskSummary ? (
                <>
                  {taskDone}
                  <span className="text-sm font-medium text-sub">/{taskTotal}</span>
                </>
              ) : (
                readableKeys.length
              )}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${taskSummary ? taskPct : 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-sub num-tabular">
            <span>
              {taskSummary
                ? `${taskSummary.open_count} open${
                    taskSummary.overdue_count ? ` · ${taskSummary.overdue_count} overdue` : ''
                  }`
                : 'Workspace tables ready'}
            </span>
            <span className="font-semibold text-main">{taskSummary ? `${taskPct}%` : 'Active'}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
