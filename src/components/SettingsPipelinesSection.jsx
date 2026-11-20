import { useEffect, useMemo, useState } from 'react'
import {
  canUserManageSalesSettings,
  createPipelineStage,
  fetchWorkspacePipeline,
  getStageBadgeClass,
  getStageColor,
  removePipelineStage,
  reorderPipelineStages,
  updatePipelineStage,
  updateWorkspacePipeline,
} from '../service/crmService.js'
import { formatGhs } from '../utils/formatters.js'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'
import { Modal } from './Modal.jsx'
import { RefreshButton } from './RefreshButton.jsx'
import { Select } from './Select.jsx'

const DEFAULT_TONE_OPTIONS = [
  { value: 'neutral', label: 'Slate (Neutral)' },
  { value: 'info', label: 'Blue (Info)' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'violet', label: 'Violet' },
  { value: 'teal', label: 'Teal' },
  { value: 'success', label: 'Emerald (Success)' },
  { value: 'warn', label: 'Amber (Warm)' },
  { value: 'orange', label: 'Orange' },
  { value: 'danger', label: 'Rose (Danger)' },
  { value: 'pink', label: 'Pink' },
]

export function SettingsPipelinesSection({
  workspace,
  permissions,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const [pipelineData, setPipelineData] = useState(null)
  const [loading, setLoading] = useState(Boolean(workspaceSlug))
  const [loadError, setLoadError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const [draftPipelineName, setDraftPipelineName] = useState(null)
  const [savingPipelineName, setSavingPipelineName] = useState(false)

  const [draftOrderIds, setDraftOrderIds] = useState(null)
  const [draggedStageId, setDraggedStageId] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const [newStageName, setNewStageName] = useState('')
  const [newStageTone, setNewStageTone] = useState('info')
  const [addingStage, setAddingStage] = useState(false)

  const [editingStageId, setEditingStageId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editTone, setEditTone] = useState('info')
  const [savingStageEdit, setSavingStageEdit] = useState(false)

  const [removeTarget, setRemoveTarget] = useState(null)
  const [moveToStageId, setMoveToStageId] = useState('')
  const [removingStage, setRemovingStage] = useState(false)

  useEffect(() => {
    if (!workspaceSlug) return undefined
    let cancelled = false

    fetchWorkspacePipeline(workspaceSlug)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setLoadError(data?.error || data?.detail || 'Could not load sales pipeline.')
          return
        }
        setLoadError('')
        setPipelineData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Network error while loading pipeline settings.')
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

  const canManageSales = useMemo(() => {
    if (pipelineData?.permissions?.can_manage_sales_settings !== undefined) {
      return Boolean(pipelineData.permissions.can_manage_sales_settings)
    }
    return canUserManageSalesSettings(permissions)
  }, [pipelineData, permissions])

  const serverStages = useMemo(() => pipelineData?.stages || [], [pipelineData?.stages])
  const serverOrderIds = useMemo(
    () => serverStages.map((stage) => stage.id),
    [serverStages],
  )

  const orderedStages = useMemo(() => {
    if (!draftOrderIds) return serverStages
    const byId = new Map(serverStages.map((stage) => [stage.id, stage]))
    const ordered = draftOrderIds.map((id) => byId.get(id)).filter(Boolean)
    return ordered.length === serverStages.length ? ordered : serverStages
  }, [draftOrderIds, serverStages])

  const isOrderDirty = useMemo(() => {
    if (!draftOrderIds || draftOrderIds.length !== serverOrderIds.length) return false
    return draftOrderIds.some((id, idx) => id !== serverOrderIds[idx])
  }, [draftOrderIds, serverOrderIds])

  const toneOptions = useMemo(() => {
    const raw = pipelineData?.tone_choices
    const base =
      Array.isArray(raw) && raw.length > 0
        ? raw.map((choice) => ({
            value: choice.value,
            label:
              DEFAULT_TONE_OPTIONS.find((opt) => opt.value === choice.value)?.label ||
              choice.label,
          }))
        : DEFAULT_TONE_OPTIONS
    return base.map((opt) => ({
      ...opt,
      swatchColor: getStageColor(opt.value),
    }))
  }, [pipelineData?.tone_choices])

  const pipelineNameValue =
    draftPipelineName ?? (pipelineData?.pipeline?.name || 'Sales Pipeline')

  const isBusy =
    savingPipelineName ||
    savingOrder ||
    addingStage ||
    savingStageEdit ||
    removingStage

  function handleRefresh() {
    setLoadError('')
    setActionError('')
    setActionSuccess('')
    setDraftOrderIds(null)
    setDraftPipelineName(null)
    setEditingStageId(null)
    setLoading(true)
    setRefreshTick((prev) => prev + 1)
  }

  function applyPipelineResponse(data, successFallback) {
    setPipelineData(data)
    setDraftOrderIds(null)
    setActionError('')
    setActionSuccess(data?.message || successFallback)
    onAuditRecorded?.()
  }

  async function handleSavePipelineName(event) {
    event.preventDefault()
    if (!canManageSales || !workspaceSlug) return
    const trimmed = pipelineNameValue.trim()
    if (!trimmed) {
      setActionError('Pipeline name is required.')
      return
    }
    setActionError('')
    setActionSuccess('')
    setSavingPipelineName(true)
    try {
      const { response, data } = await updateWorkspacePipeline(workspaceSlug, {
        name: trimmed,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || 'Could not rename pipeline.')
        return
      }
      setDraftPipelineName(null)
      setPipelineData(data)
      setActionSuccess(data?.message || 'Pipeline name updated.')
      if (data?.changed) {
        onAuditRecorded?.()
      }
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setSavingPipelineName(false)
    }
  }

  function moveStageInDraft(index, delta) {
    if (!canManageSales || isBusy) return
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= orderedStages.length) return
    const nextIds = orderedStages.map((stage) => stage.id)
    const [moved] = nextIds.splice(index, 1)
    nextIds.splice(targetIndex, 0, moved)
    setDraftOrderIds(nextIds)
    setActionError('')
    setActionSuccess('')
  }

  function handleStageDragOver(event, targetId) {
    if (!canManageSales || isBusy || editingStageId !== null) return
    event.preventDefault()
    if (!draggedStageId || draggedStageId === targetId) return
    const currentIds = orderedStages.map((stage) => stage.id)
    const fromIdx = currentIds.indexOf(draggedStageId)
    const toIdx = currentIds.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
    const nextIds = [...currentIds]
    const [moved] = nextIds.splice(fromIdx, 1)
    nextIds.splice(toIdx, 0, moved)
    setDraftOrderIds(nextIds)
  }

  async function handleSaveOrder() {
    if (!canManageSales || !workspaceSlug || !isOrderDirty) return
    setActionError('')
    setActionSuccess('')
    setSavingOrder(true)
    try {
      const { response, data } = await reorderPipelineStages(workspaceSlug, draftOrderIds)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || 'Could not save stage order.')
        return
      }
      applyPipelineResponse(data, 'Pipeline stage order saved.')
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setSavingOrder(false)
    }
  }

  async function handleAddStage(event) {
    event.preventDefault()
    if (!canManageSales || !workspaceSlug) return
    const trimmed = newStageName.trim()
    if (!trimmed) {
      setActionError('Enter a name for the new stage.')
      return
    }
    setActionError('')
    setActionSuccess('')
    setAddingStage(true)
    try {
      const { response, data } = await createPipelineStage(workspaceSlug, {
        name: trimmed,
        tone: newStageTone,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || 'Could not add stage.')
        return
      }
      setNewStageName('')
      setNewStageTone('info')
      applyPipelineResponse(data, 'Added pipeline stage.')
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setAddingStage(false)
    }
  }

  function startEditStage(stage) {
    setEditingStageId(stage.id)
    setEditName(stage.name)
    setEditTone(stage.tone || 'info')
    setActionError('')
    setActionSuccess('')
  }

  async function handleSaveStageEdit(event) {
    event.preventDefault()
    if (!canManageSales || !workspaceSlug || !editingStageId) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setActionError('Stage name cannot be empty.')
      return
    }
    setActionError('')
    setActionSuccess('')
    setSavingStageEdit(true)
    try {
      const { response, data } = await updatePipelineStage(workspaceSlug, editingStageId, {
        name: trimmed,
        tone: editTone,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || 'Could not update stage.')
        return
      }
      setEditingStageId(null)
      applyPipelineResponse(data, 'Updated pipeline stage.')
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setSavingStageEdit(false)
    }
  }

  function openRemoveModal(stage) {
    const alternatives = orderedStages.filter((item) => item.id !== stage.id)
    setRemoveTarget(stage)
    setMoveToStageId(alternatives[0] ? String(alternatives[0].id) : '')
    setActionError('')
    setActionSuccess('')
  }

  async function handleConfirmRemoveStage() {
    if (!canManageSales || !workspaceSlug || !removeTarget) return
    if (removeTarget.deal_count > 0 && !moveToStageId) {
      setActionError('Select a destination stage for existing deals.')
      return
    }
    setActionError('')
    setActionSuccess('')
    setRemovingStage(true)
    try {
      const { response, data } = await removePipelineStage(
        workspaceSlug,
        removeTarget.id,
        removeTarget.deal_count > 0 ? Number(moveToStageId) : null,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || 'Could not remove stage.')
        setRemoveTarget(null)
        setRefreshTick((prev) => prev + 1)
        return
      }
      setRemoveTarget(null)
      applyPipelineResponse(data, 'Removed pipeline stage.')
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setRemovingStage(false)
    }
  }

  const destinationStageOptions = useMemo(() => {
    if (!removeTarget) return []
    return orderedStages
      .filter((stage) => stage.id !== removeTarget.id)
      .map((stage) => ({
        value: String(stage.id),
        label: `${stage.name} (${stage.deal_count} ${stage.deal_count === 1 ? 'deal' : 'deals'})`,
      }))
  }, [removeTarget, orderedStages])

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-main">
            Sales Pipeline &amp; Stages
          </h2>
          <p className="text-xs text-sub">
            Rename your pipeline, reorder stages, add new stages, or remove unused stages. Deals on a removed stage move to a stage you choose.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pipelineData ? (
            <>
              <span className="badge badge-info num-tabular">
                {orderedStages.length} {orderedStages.length === 1 ? 'stage' : 'stages'}
              </span>
              <span className="badge badge-neutral num-tabular">
                {pipelineData.total_deals ?? 0}{' '}
                {pipelineData.total_deals === 1 ? 'deal' : 'deals'}
              </span>
            </>
          ) : null}
          <RefreshButton
            loading={loading}
            label="Refresh pipeline stages"
            onClick={handleRefresh}
          />
        </div>
      </Card>

      {!canManageSales && (
        <FeedbackNotice
          tone="info"
          message="Read-only view: only the workspace Owner or a role with Theme & layouts or Users & roles access can edit pipeline settings."
        />
      )}

      <FeedbackNotice tone="danger" message={loadError} />
      <FeedbackNotice tone="danger" message={actionError} />
      <FeedbackNotice tone="success" message={actionSuccess} />

      {loading && !pipelineData ? (
        <Card className="p-6">
          <p className="text-xs text-sub">Loading pipeline settings...</p>
        </Card>
      ) : null}

      {pipelineData ? (
        <>
          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-main">Pipeline name</h3>
                <p className="text-xs text-sub mt-0.5">
                  Display title for your workspace deal pipeline.
                </p>
              </div>
              <span className="badge badge-neutral">Default pipeline</span>
            </div>

            <form
              onSubmit={handleSavePipelineName}
              className="flex flex-col sm:flex-row gap-2.5 sm:items-end text-xs"
            >
              <div className="flex-1 space-y-1">
                <label
                  htmlFor="pipelineNameInput"
                  className="block font-medium text-main"
                >
                  Pipeline title
                </label>
                <input
                  id="pipelineNameInput"
                  type="text"
                  maxLength={120}
                  required
                  disabled={!canManageSales || isBusy}
                  value={pipelineNameValue}
                  onChange={(e) => setDraftPipelineName(e.target.value)}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
              {canManageSales ? (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    isBusy ||
                    !pipelineNameValue.trim() ||
                    pipelineNameValue.trim() === pipelineData.pipeline?.name
                  }
                  className="px-4 py-2 text-xs font-medium shrink-0"
                >
                  {savingPipelineName ? 'Saving...' : 'Save name'}
                </Button>
              ) : null}
            </form>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-main">
                  Ordered pipeline stages
                </h3>
                <p className="text-xs text-sub mt-0.5">
                  {canManageSales
                    ? 'Drag rows or use the arrow buttons to reorder stages, then click Save order to update the Kanban board.'
                    : 'Stages appear left-to-right in this order on the Deals Kanban board.'}
                </p>
              </div>
              {canManageSales && isOrderDirty ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isBusy}
                    onClick={() => setDraftOrderIds(null)}
                    className="px-3 py-1.5 text-xs"
                  >
                    Discard
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isBusy}
                    onClick={handleSaveOrder}
                    className="px-3 py-1.5 text-xs font-semibold"
                  >
                    {savingOrder ? 'Saving order...' : 'Save order'}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {orderedStages.map((stage, idx) => {
                const isEditing = editingStageId === stage.id
                const canRemove = orderedStages.length > 1 && !isOrderDirty && !isBusy

                return (
                  <div
                    key={stage.id}
                    draggable={canManageSales && !isBusy && !isEditing}
                    onDragStart={() => setDraggedStageId(stage.id)}
                    onDragOver={(e) => handleStageDragOver(e, stage.id)}
                    onDragEnd={() => setDraggedStageId(null)}
                    className={`crm-subtle p-3 rounded-lg transition-colors ${
                      draggedStageId === stage.id ? 'opacity-60' : ''
                    } ${canManageSales && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    {isEditing ? (
                      <form
                        onSubmit={handleSaveStageEdit}
                        className="flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs"
                      >
                        <span className="badge badge-neutral num-tabular shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          maxLength={100}
                          required
                          aria-label="Edit stage name"
                          value={editName}
                          disabled={savingStageEdit}
                          onChange={(e) => setEditName(e.target.value)}
                          className="crm-input flex-1 px-3 py-1.5"
                        />
                        <div className="w-full sm:w-44">
                          <Select
                            ariaLabel="Stage tone"
                            value={editTone}
                            onChange={setEditTone}
                            options={toneOptions}
                            disabled={savingStageEdit}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={savingStageEdit}
                            onClick={() => setEditingStageId(null)}
                            className="px-2.5 py-1.5 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={savingStageEdit}
                            className="px-3 py-1.5 text-xs font-medium"
                          >
                            {savingStageEdit ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                          <span className="text-[11px] font-semibold text-sub num-tabular w-5 text-center">
                            {idx + 1}
                          </span>
                          <span className={getStageBadgeClass(stage.tone, stage.name)}>
                            {stage.name}
                          </span>
                          <span className="badge badge-neutral num-tabular">
                            {stage.deal_count}{' '}
                            {stage.deal_count === 1 ? 'deal' : 'deals'}
                          </span>
                          {stage.total_amount !== null &&
                          stage.total_amount !== undefined ? (
                            <span className="text-sub num-tabular">
                              {formatGhs(stage.total_amount)}
                            </span>
                          ) : null}
                        </div>

                        {canManageSales ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              variant="secondary-icon"
                              disabled={idx === 0 || isBusy}
                              onClick={() => moveStageInDraft(idx, -1)}
                              data-tooltip="Move stage up"
                              aria-label={`Move ${stage.name} up`}
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
                                <line x1="12" y1="19" x2="12" y2="5" />
                                <polyline points="5 12 12 5 19 12" />
                              </svg>
                            </Button>
                            <Button
                              type="button"
                              variant="secondary-icon"
                              disabled={idx === orderedStages.length - 1 || isBusy}
                              onClick={() => moveStageInDraft(idx, 1)}
                              data-tooltip="Move stage down"
                              aria-label={`Move ${stage.name} down`}
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
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <polyline points="19 12 12 19 5 12" />
                              </svg>
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isOrderDirty || isBusy}
                              data-tooltip={
                                isOrderDirty
                                  ? 'Save or discard stage order changes first'
                                  : `Edit ${stage.name}`
                              }
                              onClick={() => startEditStage(stage)}
                              className="px-2.5 py-1 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={!canRemove}
                              data-tooltip={
                                orderedStages.length <= 1
                                  ? 'A pipeline must keep at least one stage'
                                  : isOrderDirty
                                    ? 'Save or discard stage order changes first'
                                    : `Remove ${stage.name}`
                              }
                              onClick={() => openRemoveModal(stage)}
                              className="px-2.5 py-1 text-xs text-rose-600"
                            >
                              Remove
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {canManageSales ? (
              <form
                onSubmit={handleAddStage}
                className="pt-3 border-t crm-border flex flex-col sm:flex-row gap-2.5 sm:items-end text-xs"
              >
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor="newStageNameInput"
                    className="block font-medium text-main"
                  >
                    Add stage
                  </label>
                  <input
                    id="newStageNameInput"
                    type="text"
                    maxLength={100}
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="New stage name (e.g. Negotiation)..."
                    disabled={isBusy}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
                <div className="w-full sm:w-48 space-y-1">
                  <label
                    htmlFor="newStageToneSelect"
                    className="block font-medium text-main"
                  >
                    Stage tone
                  </label>
                  <Select
                    id="newStageToneSelect"
                    ariaLabel="New stage tone"
                    value={newStageTone}
                    onChange={setNewStageTone}
                    options={toneOptions}
                    disabled={isBusy}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className={getStageBadgeClass(newStageTone, newStageName)}>
                    {newStageName.trim() || 'Stage preview'}
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isBusy || !newStageName.trim()}
                    className="px-4 py-2 text-xs font-medium shrink-0"
                  >
                    {addingStage ? 'Adding...' : 'Add stage'}
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        </>
      ) : null}

      <Modal
        open={Boolean(removeTarget)}
        title={removeTarget ? `Remove "${removeTarget.name}"?` : 'Remove stage'}
        subtitle={
          removeTarget?.deal_count > 0
            ? 'Move existing deals on this stage to another stage before removal'
            : 'Remove this empty stage from the pipeline'
        }
        onClose={() => {
          if (!removingStage) setRemoveTarget(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={removingStage}
              onClick={() => setRemoveTarget(null)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                removingStage ||
                (removeTarget?.deal_count > 0 && !moveToStageId)
              }
              onClick={handleConfirmRemoveStage}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {removingStage
                ? 'Removing...'
                : removeTarget?.deal_count > 0
                  ? 'Move deals & remove'
                  : 'Remove stage'}
            </Button>
          </>
        }
      >
        {removeTarget ? (
          <div className="space-y-3 text-xs">
            {removeTarget.deal_count > 0 ? (
              <>
                <p className="text-sub leading-relaxed">
                  <span className="font-semibold text-main">
                    {removeTarget.name}
                  </span>{' '}
                  currently holds{' '}
                  <span className="font-semibold text-main num-tabular">
                    {removeTarget.deal_count}{' '}
                    {removeTarget.deal_count === 1 ? 'deal' : 'deals'}
                  </span>
                  . Choose the stage where those deals should be moved:
                </p>
                <div className="space-y-1">
                  <label
                    htmlFor="removeStageTargetSelect"
                    className="block font-medium text-main"
                  >
                    Move deals to stage
                  </label>
                  <Select
                    id="removeStageTargetSelect"
                    ariaLabel="Destination stage for deals"
                    value={moveToStageId}
                    onChange={setMoveToStageId}
                    options={destinationStageOptions}
                    disabled={removingStage}
                  />
                </div>
              </>
            ) : (
              <p className="text-sub leading-relaxed">
                No deals are currently in{' '}
                <span className="font-semibold text-main">
                  {removeTarget.name}
                </span>
                . Removing it updates the pipeline and Kanban columns immediately.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
