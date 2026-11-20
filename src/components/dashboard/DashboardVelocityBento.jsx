import { useId, useState } from 'react'
import { formatDateTime, formatGhs } from '../../utils/formatters.js'
import { Card } from '../Card.jsx'
import { Subtabs } from '../Subtabs.jsx'

const VELOCITY_TABS = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
]

export function DashboardVelocityBento({
  dashboardData,
  userTimezone = 'Africa/Accra',
  togglingTaskIds = {},
  onToggleTask,
  onOpenRecord,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const barGradId = `dashVelocityBar-${uid}`
  const lineGradId = `dashVelocityArea-${uid}`
  const mixGradId = `dashMixLine-${uid}`

  const [period, setPeriod] = useState('year')
  const [hoveredBucketIdx, setHoveredBucketIdx] = useState(null)

  const dealSummary = dashboardData?.deal_summary || null
  const taskSummary = dashboardData?.task_summary || null
  const breakdown = dashboardData?.activity_breakdown || null
  const countsByObject = dashboardData?.counts_by_object || {}
  const openCounts = dashboardData?.open_counts || {}
  const velocitySeries = dashboardData?.velocity_series || {}

  const points = velocitySeries[period] || velocitySeries.year || []
  const hasDealAmount =
    dealSummary && dealSummary.total_amount !== null && dealSummary.total_amount !== undefined
  const metricValues = points.map((p) => (hasDealAmount ? Number(p.value || 0) : Number(p.count || 0)))
  const countValues = points.map((p) => Number(p.count || 0))
  const maxMetric = Math.max(...metricValues, 1)
  const maxCount = Math.max(...countValues, 1)

  const svgWidth = 420
  const svgHeight = 160
  const padX = 24
  const padTop = 16
  const padBottom = 26
  const plotW = svgWidth - padX * 2
  const plotH = svgHeight - padTop - padBottom
  const barStep = points.length > 0 ? plotW / points.length : plotW
  const barW = Math.max(14, Math.min(34, barStep * 0.48))

  const linePoints = points.map((pt, idx) => {
    const cx = padX + barStep * idx + barStep / 2
    const cy = padTop + plotH - (Number(pt.count || 0) / maxCount) * (plotH * 0.85)
    return [Number(cx.toFixed(1)), Number(cy.toFixed(1))]
  })
  const linePath = linePoints
    .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ')
  const areaPath = linePoints.length
    ? `${linePath} L${linePoints[linePoints.length - 1][0]},${padTop + plotH} L${linePoints[0][0]},${padTop + plotH} Z`
    : ''

  const avgDealAmount =
    hasDealAmount && dealSummary.total_count > 0
      ? Number(dealSummary.total_amount || 0) / dealSummary.total_count
      : 0

  const inspectedBucket =
    hoveredBucketIdx !== null && points[hoveredBucketIdx] ? points[hoveredBucketIdx] : null

  // Right 3-col Activity Mix & Weekly Trend
  const weekSeries = velocitySeries.week || []
  const weekMax = Math.max(...weekSeries.map((pt) => Number(pt.count || 0)), 1)
  const mixCoords = weekSeries.map((pt, idx) => {
    const x = 14 + (idx / Math.max(weekSeries.length - 1, 1)) * 212
    const y = 92 - (Number(pt.count || 0) / weekMax) * 68
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), ...pt }
  })
  const mixLinePath = mixCoords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x},${pt.y}`)
    .join(' ')
  const mixAreaPath = mixCoords.length
    ? `${mixLinePath} L${mixCoords[mixCoords.length - 1].x},100 L${mixCoords[0].x},100 Z`
    : ''

  const breakdownRows = [
    { key: 'task', label: 'Tasks', value: breakdown?.task ?? 0, color: '#3b82f6' },
    { key: 'call', label: 'Calls', value: breakdown?.call ?? 0, color: '#10b981' },
    { key: 'meeting', label: 'Meetings', value: breakdown?.meeting ?? 0, color: '#8b5cf6' },
    { key: 'note', label: 'Notes', value: breakdown?.note ?? 0, color: '#f59e0b' },
  ]
  const totalMix = breakdown?.total || 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 5 cols: Hero Velocity Combo Bar + Line Chart */}
      <Card className="lg:col-span-5 rounded-2xl p-5 flex flex-col justify-between gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-main">
              {dealSummary ? 'Pipeline Velocity' : 'Workspace Activity'}
            </h2>
            <p className="text-xs text-sub">
              {inspectedBucket
                ? `${inspectedBucket.label}: ${inspectedBucket.count} record${inspectedBucket.count === 1 ? '' : 's'}${
                    hasDealAmount ? ` · ${formatGhs(inspectedBucket.value)}` : ''
                  }`
                : dealSummary
                  ? 'Deals by target close or creation period'
                  : 'Visits, appointments & activities by period'}
            </p>
          </div>
          <Subtabs
            tabs={VELOCITY_TABS}
            activeId={period}
            onChange={(nextId) => {
              setPeriod(nextId)
              setHoveredBucketIdx(null)
            }}
            ariaLabel="Velocity period"
          />
        </div>

        <div className="w-full">
          {points.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-sub">
              No dated records yet.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-40 overflow-visible"
              role="img"
              aria-label="Workspace velocity chart"
            >
              <defs>
                <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0.22" />
                </linearGradient>
                <linearGradient id={lineGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75, 1].map((step) => {
                const y = padTop + plotH * (1 - step)
                return (
                  <line
                    key={step}
                    x1={padX}
                    y1={y}
                    x2={svgWidth - padX}
                    y2={y}
                    stroke="var(--border-color)"
                    strokeDasharray="3 3"
                  />
                )
              })}

              {areaPath ? <path d={areaPath} fill={`url(#${lineGradId})`} /> : null}

              {points.map((pt, idx) => {
                const val = hasDealAmount ? Number(pt.value || 0) : Number(pt.count || 0)
                const rawH = (val / maxMetric) * plotH
                const barH = val > 0 ? Math.max(6, rawH) : 2
                const x = padX + barStep * idx + (barStep - barW) / 2
                const y = padTop + plotH - barH
                const isActive = hoveredBucketIdx === idx
                return (
                  <g
                    key={pt.label}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredBucketIdx(idx)}
                    onMouseLeave={() => setHoveredBucketIdx(null)}
                    onClick={() => setHoveredBucketIdx((prev) => (prev === idx ? null : idx))}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="4"
                      fill={`url(#${barGradId})`}
                      opacity={isActive ? 1 : 0.78}
                    />
                    <text
                      x={x + barW / 2}
                      y={svgHeight - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--text-secondary)"
                    >
                      {pt.label}
                    </text>
                  </g>
                )
              })}

              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {linePoints.map(([cx, cy], idx) => (
                <circle
                  key={`${points[idx]?.label}-dot`}
                  cx={cx}
                  cy={cy}
                  r={hoveredBucketIdx === idx ? 4.5 : 3}
                  fill="#10b981"
                  stroke="var(--bg-surface)"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t crm-border">
          <div>
            <p className="text-[11px] text-sub uppercase tracking-wider">
              {dealSummary ? 'Pipeline' : 'Visits'}
            </p>
            <p className="text-xs font-semibold text-main num-tabular mt-0.5 truncate">
              {dealSummary
                ? hasDealAmount
                  ? formatGhs(dealSummary.total_amount)
                  : `${dealSummary.total_count} Deals`
                : countsByObject.visit ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-sub uppercase tracking-wider">
              {dealSummary ? 'Won' : 'Upcoming'}
            </p>
            <p className="text-xs font-semibold text-main num-tabular mt-0.5">
              {dealSummary
                ? dealSummary.won_count
                : openCounts.appointment_upcoming ?? countsByObject.appointment ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-sub uppercase tracking-wider">
              {dealSummary ? 'Open' : 'Tasks Open'}
            </p>
            <p className="text-xs font-semibold text-main num-tabular mt-0.5">
              {dealSummary ? dealSummary.open_count : openCounts.task_open ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-sub uppercase tracking-wider">
              {dealSummary ? 'Avg Deal' : 'Open Leads'}
            </p>
            <p className="text-xs font-semibold text-main num-tabular mt-0.5 truncate">
              {dealSummary
                ? hasDealAmount
                  ? formatGhs(avgDealAmount)
                  : `${dealSummary.win_rate ?? 0}%`
                : openCounts.lead_open ?? countsByObject.ticket ?? 0}
            </p>
          </div>
        </div>
      </Card>

      {/* Middle 4 cols: Interactive Action Items Checklist */}
      <Card className="lg:col-span-4 rounded-2xl p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2 border-b crm-border pb-2.5">
          <div>
            <h2 className="text-sm font-semibold text-main">Action Items</h2>
            <p className="text-xs text-sub">Live CRM tasks assigned across workspace</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {taskSummary?.overdue_count > 0 ? (
              <span className="badge badge-danger num-tabular">
                {taskSummary.overdue_count} overdue
              </span>
            ) : null}
            <span className="badge badge-neutral num-tabular">
              {taskSummary?.open_count ?? 0} open
            </span>
          </div>
        </div>

        {!taskSummary ? (
          <p className="text-xs text-sub py-6">Tasks are unavailable for your role.</p>
        ) : taskSummary.items.length === 0 ? (
          <p className="text-xs text-sub py-6">No action items yet.</p>
        ) : (
          <div className="divide-y crm-border flex-1">
            {taskSummary.items.map((item) => {
              const isCompleted = Boolean(item.is_completed)
              const busy = Boolean(togglingTaskIds[item.id])
              const canToggle = Boolean(taskSummary.can_toggle)
              return (
                <div key={item.id} className="py-2.5 flex items-start gap-2.5">
                  <button
                    type="button"
                    disabled={!canToggle || busy}
                    onClick={() => onToggleTask?.(item)}
                    aria-label={isCompleted ? `Mark "${item.summary}" open` : `Complete "${item.summary}"`}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'crm-border hover:border-blue-500'
                    } ${!canToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-xs font-medium leading-snug ${
                          isCompleted ? 'line-through text-sub' : 'text-main'
                        }`}
                      >
                        {item.summary}
                      </span>
                      {item.is_overdue ? (
                        <span className="badge badge-danger text-[10px] shrink-0">Overdue</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-sub">
                      {item.due_at ? (
                        <span className="num-tabular">{formatDateTime(item.due_at, userTimezone)}</span>
                      ) : null}
                      {item.target_record_label && item.target_pane_id && item.target_object_id ? (
                        <button
                          type="button"
                          onClick={() => onOpenRecord?.(item.target_pane_id, item.target_object_id)}
                          className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[11rem]"
                        >
                          {item.target_record_label}
                        </button>
                      ) : item.target_record_label ? (
                        <span className="truncate max-w-[11rem]">{item.target_record_label}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Right 3 cols: Activity Engagement Line Chart & Mix */}
      <Card className="lg:col-span-3 rounded-2xl p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2 border-b crm-border pb-2.5">
          <div>
            <h2 className="text-sm font-semibold text-main">Activity Mix</h2>
            <p className="text-xs text-sub">Logged notes, tasks, calls & meetings</p>
          </div>
          <span className="badge badge-info num-tabular">{totalMix}</span>
        </div>

        <div className="w-full">
          <svg
            viewBox="0 0 240 112"
            className="w-full h-24 overflow-visible"
            aria-label="Weekly activity trend"
          >
            <defs>
              <linearGradient id={mixGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="14" y1="100" x2="226" y2="100" stroke="var(--border-color)" />
            {mixAreaPath ? <path d={mixAreaPath} fill={`url(#${mixGradId})`} /> : null}
            {mixLinePath ? (
              <path
                d={mixLinePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {mixCoords.map((pt) => (
              <g key={pt.label}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill="#3b82f6"
                  stroke="var(--bg-surface)"
                  strokeWidth="1.5"
                />
                <text
                  x={pt.x}
                  y="111"
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--text-secondary)"
                >
                  {pt.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {!breakdown ? (
          <p className="text-xs text-sub">Activity breakdown unavailable.</p>
        ) : (
          <div className="space-y-2 pt-2 border-t crm-border">
            {breakdownRows.map((row) => {
              const pct = totalMix > 0 ? Math.round((row.value / totalMix) * 100) : 0
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-sub">{row.label}</span>
                    <span className="font-semibold text-main num-tabular">{row.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: row.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
