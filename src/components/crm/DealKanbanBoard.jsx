import { useState } from 'react'
import {
  getStageBadgeClass,
  isFieldEditable,
  isFieldHidden,
} from '../../service/crmService.js'
import { formatDateOnly, formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { Card } from '../Card.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { SharingBadge } from './RecordSharingControl.jsx'

const GRID_XL_COLS = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
}

export function DealKanbanBoard({
  stages = [],
  loading = false,
  canUpdate = false,
  fieldRights = {},
  movingDealId = null,
  moveError = '',
  moveNotice = '',
  onMoveDeal,
  onInspectDeal,
  onViewStageInTable,
}) {
  const [draggedDealId, setDraggedDealId] = useState(null)
  const [dragOverStage, setDragOverStage] = useState('')
  const canMoveStage = canUpdate && isFieldEditable(fieldRights, 'stage')
  const hideAmount = isFieldHidden(fieldRights, 'amount')
  const hideWinProb = isFieldHidden(fieldRights, 'win_probability')
  const hideCloseDate = isFieldHidden(fieldRights, 'target_close_date')

  function findDealById(dealId) {
    for (const col of stages) {
      const found = (col.deals || []).find((item) => item.id === dealId)
      if (found) return found
    }
    return null
  }

  function handleCardDragStart(event, deal) {
    if (!canMoveStage || movingDealId) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(deal.id))
    setDraggedDealId(deal.id)
  }

  function handleCardDragEnd() {
    setDraggedDealId(null)
    setDragOverStage('')
  }

  function handleColumnDragOver(event, stageName) {
    if (!canMoveStage) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverStage !== stageName) {
      setDragOverStage(stageName)
    }
  }

  function handleColumnDragLeave(event, stageName) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    if (dragOverStage === stageName) {
      setDragOverStage('')
    }
  }

  function handleColumnDrop(event, targetStageName) {
    event.preventDefault()
    setDragOverStage('')
    const rawId = event.dataTransfer.getData('text/plain') || String(draggedDealId || '')
    setDraggedDealId(null)
    if (!canMoveStage || movingDealId) return
    const parsedId = Number(rawId)
    if (!parsedId) return
    const deal = findDealById(parsedId)
    if (!deal || deal.stage === targetStageName) return
    onMoveDeal?.(deal, targetStageName)
  }

  const useScrollLayout = stages.length > 5
  const containerClass = useScrollLayout
    ? 'flex gap-4 overflow-x-auto pb-2 items-start'
    : `grid grid-cols-1 md:grid-cols-3 ${GRID_XL_COLS[stages.length] || 'xl:grid-cols-5'} gap-4 items-start`

  return (
    <div className="space-y-3">
      <FeedbackNotice tone="danger" message={moveError} />
      <FeedbackNotice tone="success" message={moveNotice} />

      {!canMoveStage ? (
        <FeedbackNotice
          tone="info"
          message={
            !canUpdate
              ? 'Read-only board: your role does not have update permission for Deal, so stage moves are disabled.'
              : 'Stage moves are disabled because the Deal stage field is restricted for your role.'
          }
        />
      ) : null}

      {loading && stages.length === 0 ? (
        <Card className="p-5">
          <p className="text-xs text-sub">Loading pipeline board...</p>
        </Card>
      ) : stages.length === 0 ? (
        <Card className="p-5">
          <p className="text-xs text-sub">No pipeline stages configured yet.</p>
        </Card>
      ) : (
        <div className={containerClass}>
          {stages.map((col, colIndex) => {
            const items = col.deals || []
            const isDragOver = dragOverStage === col.name
            const colWidthClass = useScrollLayout ? 'w-72 shrink-0' : ''

            return (
              <div
                key={col.id ?? col.name}
                data-stage-col={col.name}
                onDragOver={(e) => handleColumnDragOver(e, col.name)}
                onDragLeave={(e) => handleColumnDragLeave(e, col.name)}
                onDrop={(e) => handleColumnDrop(e, col.name)}
                className={`kanban-col crm-subtle p-3 rounded-lg flex flex-col space-y-3 min-h-[360px] transition-colors ${colWidthClass} ${
                  isDragOver ? 'drag-over' : ''
                }`.trim()}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b crm-border">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`${getStageBadgeClass(col.tone, col.name)} truncate`}
                    >
                      {col.name}
                    </span>
                    <span className="badge badge-neutral text-[10px] py-0 px-1.5 num-tabular shrink-0">
                      {col.deal_count ?? items.length}
                    </span>
                  </div>
                  {!hideAmount && col.total_amount !== null && col.total_amount !== undefined ? (
                    <span className="text-xs font-semibold text-sub num-tabular shrink-0">
                      {formatGhs(col.total_amount || 0)}
                    </span>
                  ) : null}
                </div>

                {items.length === 0 ? (
                  <p className="text-[11px] text-sub py-2">
                    No deals in {col.name}.
                  </p>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {items.map((deal) => {
                      const isMoving = movingDealId === deal.id
                      const prevStage = colIndex > 0 ? stages[colIndex - 1] : null
                      const nextStage =
                        colIndex < stages.length - 1 ? stages[colIndex + 1] : null

                      return (
                        <div
                          key={deal.id}
                          role="button"
                          tabIndex={0}
                          data-deal-id={deal.id}
                          draggable={canMoveStage && !movingDealId}
                          onDragStart={(e) => handleCardDragStart(e, deal)}
                          onDragEnd={handleCardDragEnd}
                          onClick={() => onInspectDeal?.(deal.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onInspectDeal?.(deal.id)
                            }
                          }}
                          className={`crm-card crm-hover p-3.5 transition-all space-y-2 ${
                            canMoveStage && !movingDealId
                              ? 'cursor-grab active:cursor-grabbing'
                              : 'cursor-pointer'
                          } ${draggedDealId === deal.id || isMoving ? 'opacity-65' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-medium text-sub num-tabular">
                                {deal.record_code}
                              </span>
                              <SharingBadge record={deal} />
                              {deal.source_lead?.record_code ? (
                                <span className="badge badge-neutral text-[10px] py-0 num-tabular">
                                  From {deal.source_lead.record_code}
                                </span>
                              ) : null}
                            </div>

                            {canMoveStage && stages.length > 1 ? (
                              <div
                                className="flex items-center gap-0.5 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  type="button"
                                  variant="icon"
                                  disabled={!prevStage || Boolean(movingDealId)}
                                  onClick={() =>
                                    prevStage && onMoveDeal?.(deal, prevStage.name)
                                  }
                                  data-tooltip={
                                    prevStage
                                      ? `Move to ${prevStage.name}`
                                      : 'First stage'
                                  }
                                  aria-label={
                                    prevStage
                                      ? `Move ${deal.title} to ${prevStage.name}`
                                      : 'First stage'
                                  }
                                  className="disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
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
                                  variant="icon"
                                  disabled={!nextStage || Boolean(movingDealId)}
                                  onClick={() =>
                                    nextStage && onMoveDeal?.(deal, nextStage.name)
                                  }
                                  data-tooltip={
                                    nextStage
                                      ? `Move to ${nextStage.name}`
                                      : 'Last stage'
                                  }
                                  aria-label={
                                    nextStage
                                      ? `Move ${deal.title} to ${nextStage.name}`
                                      : 'Last stage'
                                  }
                                  className="disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
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
                            ) : null}
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-main leading-snug">
                              {deal.title ?? deal.display_label}
                            </div>
                            <div className="text-[11px] text-sub truncate mt-0.5">
                              {deal.account?.name ||
                                deal.contact?.name ||
                                'Unlinked'}
                            </div>
                          </div>

                          <div className="pt-2 border-t crm-border flex items-center justify-between gap-2">
                            {!hideAmount && deal.amount !== undefined ? (
                              <span className="text-xs font-bold text-main num-tabular">
                                {formatGhs(deal.amount)}
                              </span>
                            ) : (
                              <span />
                            )}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!hideWinProb &&
                              deal.win_probability !== null &&
                              deal.win_probability !== undefined ? (
                                <span className="badge badge-info text-[10px] py-0 num-tabular">
                                  {deal.win_probability}%
                                </span>
                              ) : null}
                              {!hideCloseDate && deal.target_close_date ? (
                                <span className="text-[10px] text-sub num-tabular">
                                  {formatDateOnly(deal.target_close_date)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {col.has_more ? (
                  <div className="pt-2 border-t crm-border flex items-center justify-between gap-2 text-[11px] text-sub">
                    <span className="num-tabular">
                      Showing {items.length} of {col.deal_count}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onViewStageInTable?.(col.name)}
                      className="text-[11px]"
                    >
                      View in Table
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
