import { Card } from '../Card.jsx'

export function SummaryChartCard({
  title,
  subtitle = '',
  className = '',
  children,
}) {
  return (
    <Card
      className={`px-4 h-[6.75rem] flex-1 min-w-[16rem] max-w-xl flex items-center gap-4 overflow-hidden ${className}`.trim()}
    >
      <div className="shrink-0 w-36">
        <h3 className="text-xs font-semibold text-main leading-tight">{title}</h3>
        {subtitle ? (
          <p className="text-[11px] text-sub leading-snug mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex-1 min-w-0 self-stretch py-2.5 flex items-center">
        {children}
      </div>
    </Card>
  )
}

export function HorizontalBarChart({
  items = [],
  emptyLabel = 'No data yet',
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-[11px] text-sub">{emptyLabel}</p>
  }

  const maxCount = Math.max(1, ...items.map((item) => Number(item.count || 0)))

  return (
    <div className="flex flex-col justify-center gap-1 w-full h-full">
      {items.map((item) => {
        const count = Number(item.count || 0)
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div
            key={item.label}
            className="flex items-center gap-2 min-w-0 leading-none"
          >
            <span className="w-20 shrink-0 text-[11px] font-medium text-main truncate">
              {item.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full crm-subtle overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || 'var(--brand-primary)',
                }}
              />
            </div>
            <span className="w-6 text-right text-[11px] text-sub num-tabular shrink-0">
              {item.value ?? count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function MiniDonutChart({
  items = [],
  emptyLabel = 'No data yet',
  ringSizeClass = 'w-12 h-12',
  centerValue = null,
  centerLabel = '',
}) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0)
  if (!total) {
    return <p className="text-[11px] text-sub">{emptyLabel}</p>
  }

  const radius = 15.5
  const circumference = 2 * Math.PI * radius

  const slices = items
    .filter((item) => Number(item.count || 0) > 0)
    .reduce((acc, item) => {
      const prev = acc[acc.length - 1]
      const offset = prev ? prev.offset + prev.length : 0
      const count = Number(item.count || 0)
      const length = (count / total) * circumference
      return [
        ...acc,
        {
          ...item,
          length,
          offset,
        },
      ]
    }, [])

  return (
    <div className="flex items-center gap-4 w-full min-w-0">
      <div className={`relative ${ringSizeClass} shrink-0 flex items-center justify-center`}>
        <svg viewBox="0 0 42 42" className={`${ringSizeClass} -rotate-90`}>
          {slices.map((slice) => (
            <circle
              key={slice.label}
              cx="21"
              cy="21"
              r={radius}
              fill="none"
              stroke={slice.color || 'var(--brand-primary)'}
              strokeWidth="6"
              strokeDasharray={`${slice.length} ${circumference - slice.length}`}
              strokeDashoffset={-slice.offset}
            />
          ))}
        </svg>
        {centerValue !== null ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xs font-bold text-main num-tabular leading-none">
              {centerValue}
            </span>
            {centerLabel ? (
              <span className="text-[9px] text-sub mt-0.5">{centerLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 min-w-0">
        {items.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-1.5 text-[11px]"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color || 'var(--brand-primary)' }}
            />
            <span className="text-sub">{item.label}</span>
            <span className="font-semibold text-main num-tabular">
              {item.count ?? 0}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
