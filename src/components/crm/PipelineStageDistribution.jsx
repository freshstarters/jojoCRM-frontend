import { formatGhs } from '../../utils/formatters.js'
import { Card } from '../Card.jsx'

const DEFAULT_STAGE_COLORS = {
  New: '#64748b',
  Qualified: '#3b82f6',
  Proposal: '#6366f1',
  Won: '#10b981',
  Lost: '#f43f5e',
}

const DEFAULT_STAGES = ['New', 'Qualified', 'Proposal', 'Won', 'Lost']

export function PipelineStageDistribution({
  summary = {},
  stages = DEFAULT_STAGES,
}) {
  const stageCounts = summary?.stage_counts || {}
  const stageAmounts = summary?.stage_amounts || {}
  const totalAmount = Number(summary?.total_amount || 0)
  const divisor = totalAmount > 0 ? totalAmount : 1

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-main">
            Pipeline Value Distribution by Stage
          </span>
          <span className="text-sub">
            Proportional GHS weight across filtered stages
          </span>
        </div>
        <span className="font-bold text-main num-tabular">
          Total: {formatGhs(totalAmount)}
        </span>
      </div>

      <div className="w-full h-3 rounded-full overflow-hidden flex crm-subtle">
        {totalAmount > 0 ? (
          stages.map((stage) => {
            const amount = Number(stageAmounts[stage] || 0)
            if (amount <= 0) return null
            const pct = (amount / divisor) * 100
            const color = DEFAULT_STAGE_COLORS[stage] || '#3b82f6'
            return (
              <div
                key={stage}
                style={{ width: `${pct}%`, backgroundColor: color }}
                className="h-full transition-all duration-300"
                data-tooltip={`${stage}: ${formatGhs(amount)} (${Math.round(pct)}%)`}
              />
            )
          })
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
        {stages.map((stage) => {
          const amount = Number(stageAmounts[stage] || 0)
          const count = Number(stageCounts[stage] || 0)
          const color = DEFAULT_STAGE_COLORS[stage] || '#3b82f6'
          return (
            <div key={stage} className="flex items-center space-x-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-main">{stage}:</span>
              <span className="text-sub num-tabular">
                {formatGhs(amount)} ({count})
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
