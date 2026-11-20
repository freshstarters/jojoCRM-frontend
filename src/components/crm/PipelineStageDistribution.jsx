import { getStageColor } from '../../service/crmService.js'
import { formatGhs } from '../../utils/formatters.js'
import { Card } from '../Card.jsx'

const DEFAULT_STAGES = [
  { name: 'New', tone: 'neutral' },
  { name: 'Qualified', tone: 'info' },
  { name: 'Proposal', tone: 'warn' },
  { name: 'Won', tone: 'success' },
  { name: 'Lost', tone: 'danger' },
]

export function PipelineStageDistribution({
  summary = {},
  stages = null,
}) {
  const stageCounts = summary?.stage_counts || {}
  const stageAmounts = summary?.stage_amounts || {}
  const stageTones = summary?.stage_tones || {}
  const totalAmount = Number(summary?.total_amount || 0)
  const divisor = totalAmount > 0 ? totalAmount : 1

  const resolvedStages = (() => {
    const source =
      Array.isArray(stages) && stages.length > 0
        ? stages
        : Array.isArray(summary?.stages) && summary.stages.length > 0
          ? summary.stages
          : Object.keys(stageCounts).length > 0
            ? Object.keys(stageCounts).map((name) => ({
                name,
                tone: stageTones[name],
              }))
            : DEFAULT_STAGES
    return source.map((item) =>
      typeof item === 'string'
        ? { name: item, tone: stageTones[item] }
        : { name: item.name, tone: item.tone ?? stageTones[item.name] },
    )
  })()

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-main">
            Pipeline Value Distribution by Stage
          </span>
          <span className="text-sub">
            Proportional GHS weight across active stages
          </span>
        </div>
        <span className="font-bold text-main num-tabular">
          Total: {formatGhs(totalAmount)}
        </span>
      </div>

      <div className="w-full h-3 rounded-full overflow-hidden flex crm-subtle">
        {totalAmount > 0 ? (
          resolvedStages.map((stage) => {
            const amount = Number(stageAmounts[stage.name] || 0)
            if (amount <= 0) return null
            const pct = (amount / divisor) * 100
            const color = getStageColor(stage.tone, stage.name)
            return (
              <div
                key={stage.name}
                style={{ width: `${pct}%`, backgroundColor: color }}
                className="h-full transition-all duration-300"
                data-tooltip={`${stage.name}: ${formatGhs(amount)} (${Math.round(pct)}%)`}
              />
            )
          })
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
        {resolvedStages.map((stage) => {
          const amount = Number(stageAmounts[stage.name] || 0)
          const count = Number(stageCounts[stage.name] || 0)
          const color = getStageColor(stage.tone, stage.name)
          return (
            <div key={stage.name} className="flex items-center space-x-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-main">{stage.name}:</span>
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
