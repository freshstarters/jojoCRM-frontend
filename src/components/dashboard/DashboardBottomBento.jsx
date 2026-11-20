import { useState } from 'react'
import { getStageBadgeClass, getStageColor } from '../../service/crmService.js'
import { formatDateOnly, formatDateTime, formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { Card } from '../Card.jsx'

const GHANA_REGIONS = [
  { name: 'Upper West', fill: '#F6E7A8', d: 'M46,34 L92,16 L100,54 L52,60 L44,46 Z' },
  { name: 'Upper East', fill: '#F5A623', d: 'M92,16 L128,14 L150,28 L154,48 L112,50 L100,54 Z' },
  { name: 'North East', fill: '#F4D03F', d: 'M112,50 L154,48 L150,72 L124,74 L118,62 Z' },
  { name: 'Savannah', fill: '#E6C34A', d: 'M52,60 L100,54 L98,104 L46,108 L42,80 Z' },
  { name: 'Northern', fill: '#3DB4E0', d: 'M100,54 L112,50 L118,62 L124,74 L150,72 L146,108 L108,116 L98,104 Z' },
  { name: 'Bono', fill: '#F4A7C3', d: 'M42,80 L46,108 L74,112 L72,148 L34,142 L36,110 Z' },
  { name: 'Bono East', fill: '#E23B3B', d: 'M74,112 L98,104 L108,116 L104,150 L72,148 Z' },
  { name: 'Oti', fill: '#6FBF73', d: 'M108,116 L146,108 L156,128 L150,156 L116,150 L112,128 Z' },
  { name: 'Ahafo', fill: '#6B3FA0', d: 'M34,142 L72,148 L68,170 L32,164 Z' },
  { name: 'Ashanti', fill: '#8B5A2B', d: 'M72,148 L104,150 L108,188 L66,186 L68,170 Z' },
  { name: 'Volta', fill: '#F3C1BC', d: 'M116,150 L150,156 L164,150 L174,168 L160,186 L128,178 L116,162 Z' },
  { name: 'Western North', fill: '#E25B2A', d: 'M32,164 L68,170 L66,186 L56,198 L34,184 Z' },
  { name: 'Western', fill: '#8E1E24', d: 'M34,184 L56,198 L52,214 L38,200 Z' },
  { name: 'Central', fill: '#2E7CD6', d: 'M56,198 L66,186 L108,188 L114,206 L86,218 L52,214 Z' },
  { name: 'Eastern', fill: '#F07A2A', d: 'M108,188 L128,178 L160,186 L152,204 L118,202 L114,206 Z' },
  { name: 'Greater Accra', fill: '#C62828', d: 'M114,206 L118,202 L152,204 L144,214 Z' },
]

const REGION_PINS = {
  'Greater Accra': { cx: 132, cy: 207, color: '#3b82f6' },
  Ashanti: { cx: 86, cy: 168, color: '#f59e0b' },
  Western: { cx: 46, cy: 200, color: '#10b981' },
  Northern: { cx: 122, cy: 86, color: '#8b5cf6' },
  Eastern: { cx: 132, cy: 190, color: '#f97316' },
  Central: { cx: 82, cy: 202, color: '#06b6d4' },
}

function getTicketStatusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'resolved' || s === 'closed') return 'badge badge-success'
  if (s === 'pending') return 'badge badge-warn'
  if (s === 'open') return 'badge badge-info'
  return 'badge badge-neutral'
}

export function DashboardBottomBento({
  dashboardData,
  contactLabel = 'Contact',
  userTimezone = 'Africa/Accra',
  onSelectPane,
  onOpenRecord,
  onOpenAuditLog,
}) {
  const [hoveredRegion, setHoveredRegion] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')

  const dealSummary = dashboardData?.deal_summary || null
  const activeDeals = dashboardData?.active_deals || []
  const recentVisits = dashboardData?.recent_visits || []
  const upcomingAppointments = dashboardData?.upcoming_appointments || []
  const activeTickets = dashboardData?.active_tickets || []
  const ghanaHubs = dashboardData?.ghana_hubs || null
  const latestAudit = dashboardData?.latest_audit || null
  const readableKeys = dashboardData?.readable_object_keys || []

  const regionsMap = ghanaHubs?.regions || {}
  const activeRegionName = selectedRegion || hoveredRegion
  const activeRegionStats = activeRegionName ? regionsMap[activeRegionName] : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 cols: Active Deals Table (or Visits & Appointments) + Latest Audit Strip */}
      <Card className="lg:col-span-7 rounded-2xl p-5 flex flex-col justify-between gap-4">
        {dealSummary ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-main">Active Deals & Win Progress</h2>
                <p className="text-xs text-sub">
                  Recent pipeline deals updated across accessible records
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

            {activeDeals.length === 0 ? (
              <p className="text-xs text-sub py-6">No deals yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] uppercase text-sub border-b crm-border">
                      <th className="py-2 pr-3 font-semibold">Deal</th>
                      <th className="py-2 px-2 font-semibold">Stage</th>
                      <th className="py-2 px-2 font-semibold text-right">Value</th>
                      <th className="py-2 pl-3 font-semibold text-right">Win Prob.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y crm-border">
                    {activeDeals.map((deal) => {
                      const prob =
                        deal.win_probability !== undefined && deal.win_probability !== null
                          ? Math.max(0, Math.min(100, Number(deal.win_probability)))
                          : null
                      const stageColor = getStageColor(deal.stage_tone, deal.stage)
                      return (
                        <tr
                          key={deal.id}
                          onClick={() => onOpenRecord?.('deals', deal.id)}
                          className="cursor-pointer hover:bg-slate-500/5 transition-colors"
                        >
                          <td className="py-2.5 pr-3 min-w-[10rem]">
                            <div className="text-xs font-medium text-main truncate max-w-[15rem]">
                              {deal.title}
                            </div>
                            <div className="text-[11px] text-sub truncate max-w-[15rem]">
                              {deal.account_name || deal.contact_name || deal.record_code}
                              {deal.target_close_date
                                ? ` · Target ${formatDateOnly(deal.target_close_date)}`
                                : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            {deal.stage ? (
                              <span className={getStageBadgeClass(deal.stage_tone, deal.stage)}>
                                {deal.stage}
                              </span>
                            ) : (
                              <span className="text-[11px] text-sub">Hidden</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap text-xs font-semibold text-main num-tabular">
                            {deal.amount !== undefined && deal.amount !== null
                              ? formatGhs(deal.amount)
                              : 'Hidden'}
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            {prob !== null ? (
                              <div className="inline-flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${prob}%`,
                                      backgroundColor: stageColor,
                                    }}
                                  />
                                </div>
                                <span className="text-[11px] font-semibold text-main num-tabular w-8 text-right">
                                  {prob}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-sub">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-main">
                  Upcoming Appointments & Recent Visits
                </h2>
                <p className="text-xs text-sub">
                  Latest {contactLabel.toLowerCase()} consultations and scheduled sessions
                </p>
              </div>
              <div className="flex items-center gap-2">
                {readableKeys.includes('appointment') ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onSelectPane?.('appointments')}
                    className="px-2.5 py-1 text-xs"
                  >
                    Appointments
                  </Button>
                ) : null}
                {readableKeys.includes('visit') ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onSelectPane?.('visits')}
                    className="px-2.5 py-1 text-xs"
                  >
                    Visits
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {readableKeys.includes('appointment') ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-sub">
                    Appointments
                  </div>
                  {upcomingAppointments.length === 0 ? (
                    <p className="text-xs text-sub">No appointments yet.</p>
                  ) : (
                    <div className="divide-y crm-border">
                      {upcomingAppointments.slice(0, 4).map((appt) => (
                        <button
                          key={appt.id}
                          type="button"
                          onClick={() => onOpenRecord?.('appointments', appt.id)}
                          className="w-full py-2 text-left flex items-center justify-between gap-2 hover:opacity-80"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-main truncate">
                              {appt.title}
                            </div>
                            <div className="text-[11px] text-sub truncate num-tabular">
                              {appt.contact_name || appt.record_code}
                              {appt.scheduled_at
                                ? ` · ${formatDateTime(appt.scheduled_at, userTimezone)}`
                                : ''}
                            </div>
                          </div>
                          {appt.status ? (
                            <span className="badge badge-info text-[10px] shrink-0">
                              {appt.status}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {readableKeys.includes('visit') ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-sub">
                    Recent Visits
                  </div>
                  {recentVisits.length === 0 ? (
                    <p className="text-xs text-sub">No visits yet.</p>
                  ) : (
                    <div className="divide-y crm-border">
                      {recentVisits.slice(0, 4).map((visit) => (
                        <button
                          key={visit.id}
                          type="button"
                          onClick={() => onOpenRecord?.('visits', visit.id)}
                          className="w-full py-2 text-left flex items-center justify-between gap-2 hover:opacity-80"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-main truncate">
                              {visit.reason}
                            </div>
                            <div className="text-[11px] text-sub truncate num-tabular">
                              {visit.contact_name || visit.record_code}
                              {visit.date
                                ? ` · ${formatDateTime(visit.date, userTimezone)}`
                                : ''}
                            </div>
                          </div>
                          <span className="badge badge-neutral text-[10px] shrink-0">Visit</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Latest Audit Activity Strip */}
        <div className="pt-3 border-t crm-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <span className="badge badge-neutral shrink-0">Audit</span>
            {latestAudit ? (
              <span className="text-sub truncate">
                <strong className="font-medium text-main">
                  {latestAudit.actor || latestAudit.actor_label || 'System'}
                </strong>{' '}
                {latestAudit.action} {latestAudit.object_type}{' '}
                <strong className="font-medium text-main">{latestAudit.record_label}</strong> ·{' '}
                <span className="num-tabular">
                  {formatDateTime(latestAudit.created_at, userTimezone)}
                </span>
              </span>
            ) : (
              <span className="text-sub">No audit entries yet.</span>
            )}
          </div>
          {onOpenAuditLog ? (
            <button
              type="button"
              onClick={onOpenAuditLog}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              View Audit Log
            </button>
          ) : null}
        </div>
      </Card>

      {/* Right 5 cols: Ghana 16-Region Account Map + Active Support Tickets Queue */}
      <Card className="lg:col-span-5 rounded-2xl p-5 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between gap-2 border-b crm-border pb-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-main">Ghana Regional Footprint</h2>
              <p className="text-xs text-sub">
                {ghanaHubs
                  ? `${ghanaHubs.total_accounts_with_city} account${
                      ghanaHubs.total_accounts_with_city === 1 ? '' : 's'
                    } mapped by city`
                  : 'Account city distribution'}
              </p>
            </div>
            {readableKeys.includes('account') ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onSelectPane?.('accounts')}
                className="px-2.5 py-1 text-xs"
              >
                Accounts
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex flex-col items-center shrink-0">
              <svg
                viewBox="0 0 180 230"
                className="w-36 h-auto"
                role="img"
                aria-label="Map of Ghana divided into 16 regions"
              >
                <g onMouseLeave={() => setHoveredRegion('')}>
                  {GHANA_REGIONS.map((reg) => {
                    const stats = regionsMap[reg.name]
                    const hasAccounts = Boolean(stats && stats.count > 0)
                    const isSelected = selectedRegion === reg.name
                    const isHovered = hoveredRegion === reg.name
                    return (
                      <path
                        key={reg.name}
                        data-region={reg.name}
                        d={reg.d}
                        fill={reg.fill}
                        fillOpacity={isSelected || isHovered ? 0.95 : hasAccounts ? 0.8 : 0.24}
                        stroke={isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)'}
                        strokeWidth={isSelected ? 1.8 : 1}
                        className="cursor-pointer transition-opacity"
                        onMouseEnter={() => setHoveredRegion(reg.name)}
                        onClick={() =>
                          setSelectedRegion((prev) => (prev === reg.name ? '' : reg.name))
                        }
                      />
                    )
                  })}
                </g>

                {Object.entries(REGION_PINS).map(([regName, pin]) => {
                  const stats = regionsMap[regName]
                  if (!stats || stats.count <= 0) return null
                  return (
                    <g
                      key={regName}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedRegion((prev) => (prev === regName ? '' : regName))
                      }
                    >
                      <circle cx={pin.cx} cy={pin.cy} r="8" fill={pin.color} fillOpacity="0.28" />
                      <circle
                        cx={pin.cx}
                        cy={pin.cy}
                        r="4"
                        fill={pin.color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </g>
                  )
                })}
              </svg>
              <span
                id="ghanaMapSelectedLabel"
                className="text-[11px] font-medium text-sub text-center mt-1 num-tabular"
              >
                {activeRegionName
                  ? `${activeRegionName}: ${activeRegionStats?.count ?? 0} account${
                      (activeRegionStats?.count ?? 0) === 1 ? '' : 's'
                    } (${activeRegionStats?.percent ?? 0}%)`
                  : 'Click a region to inspect'}
              </span>
            </div>

            <div className="flex-1 w-full min-w-0 space-y-2">
              {!ghanaHubs ? (
                <p className="text-xs text-sub">
                  Account city data is unavailable for your current role.
                </p>
              ) : ghanaHubs.cities.length === 0 ? (
                <p className="text-xs text-sub">Add cities on Accounts to map Ghana regions.</p>
              ) : (
                ghanaHubs.cities.map((city) => (
                  <div key={city.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-medium text-main truncate">{city.name}</span>
                      <span className="text-sub num-tabular shrink-0">
                        {city.count} ({city.percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.max(4, city.percent)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Active Support Tickets Queue */}
        {readableKeys.includes('ticket') ? (
          <div className="pt-3 border-t crm-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sub">
                Active Support Tickets
              </span>
              <button
                type="button"
                onClick={() => onSelectPane?.('tickets')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all
              </button>
            </div>
            {activeTickets.length === 0 ? (
              <p className="text-xs text-sub">No tickets yet.</p>
            ) : (
              <div className="divide-y crm-border">
                {activeTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => onOpenRecord?.('tickets', ticket.id)}
                    className="w-full py-2 text-left flex items-center justify-between gap-2 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-main truncate">{ticket.title}</div>
                      <div className="text-[11px] text-sub truncate">
                        {ticket.account_name || ticket.record_code}
                        {ticket.priority ? ` · ${ticket.priority} priority` : ''}
                      </div>
                    </div>
                    {ticket.status ? (
                      <span className={`${getTicketStatusBadge(ticket.status)} text-[10px] shrink-0`}>
                        {ticket.status}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
