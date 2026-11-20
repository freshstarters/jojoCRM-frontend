import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { Subtabs } from '../components/Subtabs.jsx'
import { ConversionResultBanner } from '../components/crm/ConversionResultBanner.jsx'
import { ConvertLeadModal } from '../components/crm/ConvertLeadModal.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { DealKanbanBoard } from '../components/crm/DealKanbanBoard.jsx'
import { FieldLabel } from '../components/crm/FieldLabel.jsx'
import { PipelineStageDistribution } from '../components/crm/PipelineStageDistribution.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import { RecordRelationPicker } from '../components/crm/RecordRelationPicker.jsx'
import {
  RecordSharingControl,
  SharingBadge,
} from '../components/crm/RecordSharingControl.jsx'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  canUserConvertLead,
  canUserManageSalesSettings,
  fetchDealsBoard,
  filterWritablePayload,
  getStageBadgeClass,
  isFieldHidden,
  isFieldReadOnly,
  updateCrmRecord,
} from '../service/crmService.js'
import { DEALS_SUBTABS } from '../utils/catalog.js'
import { formatDateOnly, formatGhs } from '../utils/formatters.js'

const FALLBACK_STAGES = [
  { id: null, name: 'New', tone: 'neutral' },
  { id: null, name: 'Qualified', tone: 'info' },
  { id: null, name: 'Proposal', tone: 'warn' },
  { id: null, name: 'Won', tone: 'success' },
  { id: null, name: 'Lost', tone: 'danger' },
]

const EMPTY_FORM = {
  title: '',
  account_id: '',
  contact_id: '',
  amount: '0.00',
  stage: '',
  target_close_date: '',
  win_probability: '',
  estimated_margin: '',
  notes: '',
  visibility: 'workspace',
  shared_role_id: '',
}

const DEAL_FIELD_MAP = {
  account_id: 'account',
  contact_id: 'contact',
}

function applyOptimisticBoardMove(currentBoard, deal, targetStageName) {
  if (!currentBoard || !Array.isArray(currentBoard.stages)) return currentBoard
  const oldStageName = deal.stage
  if (oldStageName === targetStageName) return currentBoard
  const dealAmount = Number(deal.amount || 0)
  const targetCol = currentBoard.stages.find((col) => col.name === targetStageName)
  if (!targetCol) return currentBoard

  const nextStages = currentBoard.stages.map((col) => {
    if (col.name === oldStageName) {
      const nextDeals = (col.deals || []).filter((item) => item.id !== deal.id)
      const nextCount = Math.max(0, Number(col.deal_count ?? 0) - 1)
      const nextAmount =
        col.total_amount !== null && col.total_amount !== undefined
          ? Math.max(0, Number(col.total_amount ?? 0) - dealAmount).toFixed(2)
          : null
      return {
        ...col,
        deals: nextDeals,
        deal_count: nextCount,
        total_amount: nextAmount,
      }
    }
    if (col.name === targetStageName) {
      const updatedDeal = {
        ...deal,
        stage: targetStageName,
        stage_tone: col.tone,
        pipeline_stage_id: col.id,
      }
      const nextDeals = [updatedDeal, ...(col.deals || [])]
      const nextCount = Number(col.deal_count ?? 0) + 1
      const nextAmount =
        col.total_amount !== null && col.total_amount !== undefined
          ? (Number(col.total_amount ?? 0) + dealAmount).toFixed(2)
          : null
      return {
        ...col,
        deals: nextDeals,
        deal_count: nextCount,
        total_amount: nextAmount,
      }
    }
    return col
  })

  const nextCounts = { ...(currentBoard.summary?.stage_counts || {}) }
  const nextAmounts = { ...(currentBoard.summary?.stage_amounts || {}) }
  for (const col of nextStages) {
    nextCounts[col.name] = col.deal_count
    if (col.total_amount !== null && col.total_amount !== undefined) {
      nextAmounts[col.name] = col.total_amount
    }
  }

  return {
    ...currentBoard,
    stages: nextStages,
    summary: {
      ...(currentBoard.summary || {}),
      stage_counts: nextCounts,
      stage_amounts: nextAmounts,
    },
  }
}

export function DealsPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  activeSubtab = 'kanban',
  onSubtabChange,
  onOpenPipelineSettings,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenLinkedRecord,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const viewMode = activeSubtab === 'kanban' ? 'kanban' : 'list'
  const { conversionEnabled, canConvert } = canUserConvertLead(permissions, workspace)
  const canManageSales = canUserManageSalesSettings(permissions)

  const pane = useCrmRecordsPane({
    workspaceSlug,
    objectKey: 'deal',
    permissions,
    permissionsRevision,
    enabled: viewMode === 'list',
    urlInspectRecordId,
    onInspectRecord,
    onCloseInspect,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const [boardData, setBoardData] = useState(null)
  const [completedBoardKey, setCompletedBoardKey] = useState('')
  const [boardError, setBoardError] = useState('')
  const [boardRefreshTick, setBoardRefreshTick] = useState(0)
  const [debouncedBoardSearch, setDebouncedBoardSearch] = useState('')

  const [movingDealId, setMovingDealId] = useState(null)
  const [moveError, setMoveError] = useState('')
  const [moveNotice, setMoveNotice] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [conversionResult, setConversionResult] = useState(null)

  const fr = boardData?.permissions?.field_rights || pane.fieldRights
  const hideTitle = isFieldHidden(fr, 'title')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideAmount = isFieldHidden(fr, 'amount')
  const hideStage = isFieldHidden(fr, 'stage')
  const hideCloseDate = isFieldHidden(fr, 'target_close_date')
  const hideWinProb = isFieldHidden(fr, 'win_probability')
  const hideMargin = isFieldHidden(fr, 'estimated_margin')
  const hideNotes = isFieldHidden(fr, 'notes')

  const reloadBoard = useCallback(() => {
    setBoardRefreshTick((prev) => prev + 1)
  }, [])

  useEffect(() => {
    const trimmed = pane.search.trim()
    if (!trimmed) return undefined
    const timer = setTimeout(() => {
      setDebouncedBoardSearch(trimmed)
    }, 250)
    return () => clearTimeout(timer)
  }, [pane.search])

  const effectiveBoardSearch = pane.search.trim() ? debouncedBoardSearch : ''
  const boardVisibilityFilter = pane.filters.visibility || ''

  const boardRequestKey =
    workspaceSlug && pane.rights.canRead && viewMode === 'kanban'
      ? `${workspaceSlug}:${effectiveBoardSearch}:${boardVisibilityFilter}:${boardRefreshTick}:${permissionsRevision}`
      : ''
  const boardLoading = Boolean(
    boardRequestKey && completedBoardKey !== boardRequestKey,
  )

  useEffect(() => {
    if (!boardRequestKey) return undefined
    let cancelled = false
    const activeKey = boardRequestKey

    const params = {}
    if (effectiveBoardSearch) params.q = effectiveBoardSearch
    if (boardVisibilityFilter) params.visibility = boardVisibilityFilter

    fetchDealsBoard(workspaceSlug, params)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setBoardError(data?.error || data?.detail || 'Could not load pipeline board.')
          return
        }
        setBoardError('')
        setBoardData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setBoardError('Network error while loading pipeline board.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedBoardKey(activeKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [boardRequestKey, workspaceSlug, effectiveBoardSearch, boardVisibilityFilter, onSessionExpired])

  const activeStages = useMemo(() => {
    if (viewMode === 'kanban' && Array.isArray(boardData?.stages) && boardData.stages.length > 0) {
      return boardData.stages
    }
    if (Array.isArray(pane.summary?.stages) && pane.summary.stages.length > 0) {
      return pane.summary.stages
    }
    const optStages = pane.optionsData?.constants?.deal_pipeline_stages
    if (Array.isArray(optStages) && optStages.length > 0) {
      return optStages
    }
    if (Array.isArray(boardData?.stages) && boardData.stages.length > 0) {
      return boardData.stages
    }
    return FALLBACK_STAGES
  }, [viewMode, boardData?.stages, pane.summary?.stages, pane.optionsData?.constants?.deal_pipeline_stages])

  const stageToneByName = useMemo(() => {
    const map = {}
    for (const stage of activeStages) {
      map[stage.name] = stage.tone
    }
    return map
  }, [activeStages])

  const stageFilterOptions = useMemo(
    () => [
      { value: '', label: 'All stages' },
      ...activeStages.map((stage) => ({ value: stage.name, label: stage.name })),
    ],
    [activeStages],
  )

  const stageFieldOptions = useMemo(
    () => activeStages.map((stage) => ({ value: stage.name, label: stage.name })),
    [activeStages],
  )

  const defaultStageName = activeStages[0]?.name || 'New'

  const [pickedAccountsById, setPickedAccountsById] = useState({})
  const [pickedContactsById, setPickedContactsById] = useState({})

  const allContacts = useMemo(
    () => pane.optionsData.contacts || [],
    [pane.optionsData.contacts],
  )

  function applyAccountContactChange(currentForm, field, nextVal, pickedRecord = null) {
    if (field === 'account_id') {
      if (pickedRecord?.id) {
        setPickedAccountsById((prev) => ({ ...prev, [String(pickedRecord.id)]: pickedRecord }))
      }
      let nextContactId = currentForm.contact_id
      if (nextVal && nextContactId) {
        const chosen =
          pickedContactsById[nextContactId] ||
          (active?.contact && String(active.contact.id) === nextContactId ? active.contact : null) ||
          allContacts.find((c) => String(c.id) === nextContactId)
        if (chosen?.account_id && String(chosen.account_id) !== nextVal) {
          nextContactId = ''
        }
      }
      return { ...currentForm, account_id: nextVal, contact_id: nextContactId }
    }
    if (field === 'contact_id') {
      if (pickedRecord?.id) {
        setPickedContactsById((prev) => ({ ...prev, [String(pickedRecord.id)]: pickedRecord }))
      }
      let nextAccountId = currentForm.account_id
      if (nextVal && !nextAccountId) {
        const chosen =
          pickedRecord ||
          pickedContactsById[nextVal] ||
          allContacts.find((c) => String(c.id) === nextVal)
        if (chosen?.account_id) {
          nextAccountId = String(chosen.account_id)
          const linkedAccount = chosen.account || (chosen.account_name ? { id: chosen.account_id, name: chosen.account_name } : null)
          if (linkedAccount?.id) {
            setPickedAccountsById((prev) => ({ ...prev, [String(linkedAccount.id)]: linkedAccount }))
          }
        }
      }
      return { ...currentForm, account_id: nextAccountId, contact_id: nextVal }
    }
    return currentForm
  }

  const active = pane.activeRecord
  const formValues = draft ?? {
    title: active?.title || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    amount: active?.amount ?? '0.00',
    stage: active?.stage || defaultStageName,
    target_close_date: active?.target_close_date || '',
    win_probability:
      active?.win_probability !== null && active?.win_probability !== undefined
        ? String(active.win_probability)
        : '',
    estimated_margin: active?.estimated_margin ?? '',
    notes: active?.notes || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'title', label: 'Deal Name' }]
    if (!hideAccount || !hideContact) {
      cols.push({ key: 'account', label: `Account & ${contactLabel}` })
    }
    if (!hideStage) cols.push({ key: 'stage', label: 'Stage' })
    if (!hideAmount) cols.push({ key: 'amount', label: 'Value (GHS)' })
    if (!hideMargin) cols.push({ key: 'estimated_margin', label: 'Est. Margin' })
    if (!hideCloseDate) cols.push({ key: 'close', label: 'Target Close' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideAccount, hideContact, hideStage, hideAmount, hideMargin, hideCloseDate, contactLabel])

  function openCreateModal() {
    setCreateForm({ ...EMPTY_FORM, stage: defaultStageName })
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideTitle && !isFieldReadOnly(fr, 'title') && !createForm.title.trim()) {
      setCreateError('Deal title is required.')
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this deal with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        title: createForm.title.trim(),
        account_id: createForm.account_id ? Number(createForm.account_id) : null,
        contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
        amount: createForm.amount || '0.00',
        stage: createForm.stage || defaultStageName,
        target_close_date: createForm.target_close_date || null,
        win_probability: createForm.win_probability === '' ? null : Number(createForm.win_probability),
        estimated_margin: createForm.estimated_margin === '' ? null : createForm.estimated_margin,
        notes: createForm.notes,
      },
      fr,
      DEAL_FIELD_MAP,
    )
    const res = await pane.createRecord({
      ...fieldPayload,
      visibility: createForm.visibility,
      ...(createForm.visibility === 'role'
        ? { shared_role_id: Number(createForm.shared_role_id) }
        : {}),
    })
    setCreating(false)
    if (!res.ok) {
      if (res.error) setCreateError(res.error)
      return
    }
    setCreateOpen(false)
    reloadBoard()
  }

  async function handleSaveInspector() {
    const fieldPayload = filterWritablePayload(
      {
        title: formValues.title.trim(),
        account_id: formValues.account_id ? Number(formValues.account_id) : null,
        contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
        amount: formValues.amount || '0.00',
        stage: formValues.stage,
        target_close_date: formValues.target_close_date || null,
        win_probability: formValues.win_probability === '' ? null : Number(formValues.win_probability),
        estimated_margin: formValues.estimated_margin === '' ? null : formValues.estimated_margin,
        notes: formValues.notes,
      },
      fr,
      DEAL_FIELD_MAP,
    )
    const sharingPayload = active?.can_manage_sharing
      ? {
          visibility: formValues.visibility,
          shared_role_id:
            formValues.visibility === 'role' && formValues.shared_role_id
              ? Number(formValues.shared_role_id)
              : null,
        }
      : {}
    const ok = await pane.saveInspectorRecord({
      ...fieldPayload,
      ...sharingPayload,
    })
    if (ok) {
      setDraft(null)
      reloadBoard()
    }
  }

  async function handleDeleteActiveRecord() {
    const res = await pane.deleteActiveRecord()
    if (res?.ok) {
      reloadBoard()
    }
    return res
  }

  function handleInspect(recordId) {
    setDraft(null)
    pane.openInspector(recordId)
  }

  async function handleMoveDealStage(deal, targetStageName) {
    if (!workspaceSlug || !deal || !targetStageName || deal.stage === targetStageName) {
      return
    }
    const oldStageName = deal.stage
    const previousBoard = boardData
    setMoveError('')
    setMoveNotice('')
    setMovingDealId(deal.id)
    setBoardData((prev) => applyOptimisticBoardMove(prev, deal, targetStageName))

    try {
      const { response, data } = await updateCrmRecord(
        workspaceSlug,
        'deal',
        deal.id,
        { stage: targetStageName },
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setBoardData(previousBoard)
        setMoveError(data?.error || 'Could not update deal stage.')
        reloadBoard()
        pane.reload()
        return
      }

      setMoveNotice(`Moved "${deal.title ?? deal.display_label}" from ${oldStageName} to ${targetStageName}.`)
      onAuditRecorded?.()
      pane.bumpRecordAuditRevision()
      reloadBoard()
      pane.reload()
      if (pane.activeRecord?.id === deal.id) {
        pane.refreshActiveRecord()
      }
    } catch {
      setBoardData(previousBoard)
      setMoveError('Unable to reach the server while moving deal stage.')
    } finally {
      setMovingDealId(null)
    }
  }

  function handleViewStageInTable(stageName) {
    pane.updateFilter('stage', stageName)
    onSubtabChange?.('list')
  }

  const effectiveSummary =
    viewMode === 'kanban' ? boardData?.summary || pane.summary : pane.summary
  const effectiveTotalCount =
    viewMode === 'kanban'
      ? boardData?.total_count ?? pane.totalCount
      : pane.totalCount
  const effectiveLoading = viewMode === 'kanban' ? boardLoading : pane.loading
  const effectiveLoadError =
    viewMode === 'kanban' ? boardError || pane.loadError : pane.loadError
  const pipelineLabel =
    boardData?.pipeline?.name ||
    pane.summary?.pipeline?.name ||
    pane.optionsData?.constants?.pipeline?.name ||
    'Sales Pipeline'

  const kanbanBoardContent =
    viewMode === 'kanban' ? (
      <DealKanbanBoard
        stages={boardData?.stages || []}
        loading={boardLoading}
        canUpdate={pane.rights.canUpdate}
        fieldRights={fr}
        movingDealId={movingDealId}
        moveError={moveError}
        moveNotice={moveNotice}
        onMoveDeal={handleMoveDealStage}
        onInspectDeal={handleInspect}
        onViewStageInTable={handleViewStageInTable}
      />
    ) : null

  return (
    <>
      <CrmListPage
        id="pane-deals"
        title="Deals & Pipeline"
        subtitle={`Manage opportunities across your ${pipelineLabel} stages. Drag cards across columns or inspect any deal.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Deal"
        onCreateClick={openCreateModal}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {conversionEnabled ? (
              <Button
                type="button"
                variant="secondary"
                disabled={!canConvert}
                data-tooltip={
                  canConvert
                    ? undefined
                    : `Your ${roleName} role lacks permission to convert leads`
                }
                onClick={() => setConvertModalOpen(true)}
                className="px-3 py-1.5 text-xs flex items-center space-x-1.5"
              >
                <svg
                  className="w-3.5 h-3.5 text-sub shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                <span>Convert Lead</span>
              </Button>
            ) : null}
            {canManageSales && onOpenPipelineSettings ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onOpenPipelineSettings}
                className="px-3 py-1.5 text-xs flex items-center space-x-1.5"
              >
                <svg
                  className="w-3.5 h-3.5 text-sub shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                </svg>
                <span>Edit Stages</span>
              </Button>
            ) : null}
            <Subtabs
              tabs={DEALS_SUBTABS}
              activeId={viewMode}
              onChange={(nextTab) => onSubtabChange?.(nextTab)}
              ariaLabel="Deals views"
            />
          </div>
        }
        stats={[
          {
            label: 'Visible deals',
            value: effectiveTotalCount,
            caption: 'Opportunities in this view',
          },
          ...(!hideAmount
            ? [
                {
                  label: 'Pipeline value',
                  value: formatGhs(effectiveSummary?.total_amount || 0),
                  caption: 'Total GHS across visible deals',
                },
              ]
            : []),
        ]}
        extraContent={
          <div className="space-y-4">
            <ConversionResultBanner
              result={conversionResult}
              contactLabel={contactLabel}
              onOpenRecord={onOpenLinkedRecord}
              onDismiss={() => setConversionResult(null)}
            />
            {!hideStage && !hideAmount ? (
              <PipelineStageDistribution
                summary={effectiveSummary}
                stages={activeStages}
              />
            ) : null}
          </div>
        }
        toolbarCaption={
          viewMode === 'kanban'
            ? canManageSales
              ? 'Drag cards across stages or use card arrows to move deals. Use Edit Stages to customize columns.'
              : 'Drag cards across stages or use card arrows to move deals.'
            : 'Open a deal to update details, change stage, or log activities.'
        }
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search deals..."
        filters={
          <>
            {viewMode === 'list' && !hideStage ? (
              <div className="w-40">
                <Select
                  id="deal-stage-filter"
                  ariaLabel="Filter deals by stage"
                  value={pane.filters.stage || ''}
                  onChange={(val) => pane.updateFilter('stage', val)}
                  options={stageFilterOptions}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="deal-visibility-filter"
                ariaLabel="Filter deals by sharing"
                value={pane.filters.visibility || ''}
                onChange={(val) => pane.updateFilter('visibility', val)}
                options={VISIBILITY_FILTER_OPTIONS}
              />
            </div>
          </>
        }
        loading={effectiveLoading}
        error={effectiveLoadError}
        records={pane.records}
        emptyMessage="No deals yet."
        hideTable={viewMode === 'kanban'}
        keepToolbarWhenTableHidden
        hidePaginationWhenTableHidden
        customTableContent={kanbanBoardContent}
        columns={columns}
        renderRow={(deal) => (
          <tr
            key={deal.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(deal.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              <div>{deal.title ?? deal.display_label}</div>
              {deal.source_lead?.record_code ? (
                <div className="text-[11px] text-sub font-normal num-tabular">
                  From {deal.source_lead.record_code}
                </div>
              ) : null}
            </td>
            {!hideAccount || !hideContact ? (
              <td className="py-3 px-4 text-sub">
                {[deal.account?.name, deal.contact?.name].filter(Boolean).join(' · ') || 'Unlinked'}
              </td>
            ) : null}
            {!hideStage ? (
              <td className="py-3 px-4">
                <span
                  className={getStageBadgeClass(
                    deal.stage_tone || stageToneByName[deal.stage],
                    deal.stage,
                  )}
                >
                  {deal.stage}
                </span>
              </td>
            ) : null}
            {!hideAmount ? (
              <td className="py-3 px-4 font-semibold text-main num-tabular">
                {formatGhs(deal.amount)}
              </td>
            ) : null}
            {!hideMargin ? (
              <td className="py-3 px-4 text-sub num-tabular">
                {deal.estimated_margin !== null && deal.estimated_margin !== undefined
                  ? formatGhs(deal.estimated_margin)
                  : 'Not set'}
              </td>
            ) : null}
            {!hideCloseDate ? (
              <td className="py-3 px-4 text-sub num-tabular">
                {deal.target_close_date ? formatDateOnly(deal.target_close_date) : 'Not set'}
              </td>
            ) : null}
            <td className="py-3 px-4">
              <SharingBadge record={deal} />
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(deal.id)}
                className="px-2.5 py-1 text-xs"
              >
                Inspect
              </Button>
            </td>
          </tr>
        )}
        page={pane.page}
        totalPages={pane.totalPages}
        totalCount={effectiveTotalCount}
        hasPrevious={pane.hasPrevious}
        hasNext={pane.hasNext}
        onPageChange={pane.setPage}
        itemLabel="deal"
        pluralLabel="deals"
      />

      <Modal
        open={createOpen}
        title="Create New Deal"
        subtitle={`Add a sales opportunity to ${pipelineLabel}.`}
        onClose={() => {
          if (!creating) setCreateOpen(false)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-deal-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Deal'}
            </Button>
          </>
        }
      >
        <form id="create-deal-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          {!hideTitle ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-deal-title" label="Deal title" readOnly={isFieldReadOnly(fr, 'title')} />
              <input
                id="new-deal-title"
                type="text"
                required={!isFieldReadOnly(fr, 'title')}
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Tema Refinery Pump Replacement"
                disabled={creating || isFieldReadOnly(fr, 'title')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideAccount || !hideContact ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideAccount ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-deal-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
                  <RecordRelationPicker
                    id="new-deal-account"
                    ariaLabel="Account"
                    workspaceSlug={workspaceSlug}
                    objectKey="account"
                    objectPluralLabel="Accounts"
                    value={createForm.account_id}
                    selectedRecord={pickedAccountsById[createForm.account_id] || null}
                    fallbackOptions={pane.optionsData.accounts || []}
                    emptyLabel="No Account"
                    searchPlaceholder="Search Accounts..."
                    getOptionMeta={(acc) => acc.city || acc.email || ''}
                    onChange={(val, rec) =>
                      setCreateForm((f) => applyAccountContactChange(f, 'account_id', val, rec))
                    }
                    disabled={creating || isFieldReadOnly(fr, 'account')}
                    onSessionExpired={onSessionExpired}
                  />
                </div>
              ) : null}
              {!hideContact ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-deal-contact" label={contactLabel} readOnly={isFieldReadOnly(fr, 'contact')} />
                  <RecordRelationPicker
                    id="new-deal-contact"
                    ariaLabel={contactLabel}
                    workspaceSlug={workspaceSlug}
                    objectKey="contact"
                    objectPluralLabel={contactPlural}
                    value={createForm.contact_id}
                    selectedRecord={pickedContactsById[createForm.contact_id] || null}
                    fallbackOptions={allContacts}
                    queryParams={
                      createForm.account_id
                        ? { compatible_account_id: createForm.account_id }
                        : {}
                    }
                    emptyLabel={`No ${contactLabel}`}
                    searchPlaceholder={`Search ${contactPlural}...`}
                    getOptionLabel={(con) => {
                      const accName = con.account?.name || con.account_name
                      return accName ? `${con.name || con.display_label} (${accName})` : con.name || con.display_label
                    }}
                    getOptionMeta={(con) => con.email || con.phone || ''}
                    onChange={(val, rec) =>
                      setCreateForm((f) => applyAccountContactChange(f, 'contact_id', val, rec))
                    }
                    disabled={creating || isFieldReadOnly(fr, 'contact')}
                    onSessionExpired={onSessionExpired}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideAmount || !hideStage ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideAmount ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-deal-amount" label="Amount (GHS)" readOnly={isFieldReadOnly(fr, 'amount')} />
                  <input
                    id="new-deal-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
                    disabled={creating || isFieldReadOnly(fr, 'amount')}
                    className="crm-input w-full px-3 py-2 num-tabular"
                  />
                </div>
              ) : null}
              {!hideStage ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-deal-stage" label="Stage" readOnly={isFieldReadOnly(fr, 'stage')} />
                  <Select
                    id="new-deal-stage"
                    ariaLabel="Stage"
                    value={createForm.stage}
                    onChange={(val) => setCreateForm((f) => ({ ...f, stage: val }))}
                    options={stageFieldOptions}
                    disabled={creating || isFieldReadOnly(fr, 'stage')}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideCloseDate || !hideWinProb ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideCloseDate ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-deal-close" label="Target close date" readOnly={isFieldReadOnly(fr, 'target_close_date')} />
                  <input
                    id="new-deal-close"
                    type="date"
                    value={createForm.target_close_date}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, target_close_date: e.target.value }))
                    }
                    disabled={creating || isFieldReadOnly(fr, 'target_close_date')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
              {!hideWinProb ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-deal-prob" label="Win probability (%)" readOnly={isFieldReadOnly(fr, 'win_probability')} />
                  <input
                    id="new-deal-prob"
                    type="number"
                    min="0"
                    max="100"
                    value={createForm.win_probability}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, win_probability: e.target.value }))
                    }
                    placeholder="0 - 100"
                    disabled={creating || isFieldReadOnly(fr, 'win_probability')}
                    className="crm-input w-full px-3 py-2 num-tabular"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideMargin ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-deal-margin" label="Estimated margin (GHS)" readOnly={isFieldReadOnly(fr, 'estimated_margin')} />
              <input
                id="new-deal-margin"
                type="number"
                min="0"
                step="0.01"
                value={createForm.estimated_margin}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, estimated_margin: e.target.value }))
                }
                placeholder="Optional internal margin"
                disabled={creating || isFieldReadOnly(fr, 'estimated_margin')}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          ) : null}

          {!hideNotes ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-deal-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
              <textarea
                id="new-deal-notes"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={creating || isFieldReadOnly(fr, 'notes')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          <RecordSharingControl
            idPrefix="new-deal-sharing"
            visibility={createForm.visibility}
            sharedRoleId={createForm.shared_role_id}
            roles={pane.optionsData?.roles || []}
            disabled={creating}
            onChange={(next) => setCreateForm((f) => ({ ...f, ...next }))}
          />
        </form>
      </Modal>

      <RecordInspectorDrawer
        open={pane.inspectorOpen}
        onClose={() => {
          setDraft(null)
          pane.closeInspector()
        }}
        objectKey="deal"
        objectLabel="Deal"
        contactLabel={contactLabel}
        contactPluralLabel={contactPlural}
        assignees={pane.optionsData?.assignees || []}
        roles={pane.optionsData?.roles || []}
        workspaceSlug={workspaceSlug}
        userTimezone={user?.timezone || 'Africa/Accra'}
        permissions={permissions}
        record={active}
        loading={pane.inspectorLoading}
        saving={pane.savingInspector}
        deleting={pane.deletingInspector}
        error={pane.inspectorError}
        notice={pane.actionNotice}
        canUpdate={pane.rights.canUpdate}
        canDelete={pane.rights.canDelete}
        sharingValue={{
          visibility: formValues.visibility,
          shared_role_id: formValues.shared_role_id,
        }}
        onSharingChange={(next) => setDraft({ ...formValues, ...next })}
        onSave={handleSaveInspector}
        onDelete={handleDeleteActiveRecord}
        onActivityChanged={pane.refreshActiveRecord}
        auditRefreshKey={pane.recordAuditRevision}
        onOpenLinkedRecord={onOpenLinkedRecord}
        onSessionExpired={onSessionExpired}
        badgeText={!hideStage ? active?.stage || '' : ''}
        badgeClassName={getStageBadgeClass(
          active?.stage_tone || stageToneByName[active?.stage],
          active?.stage,
        )}
      >
        {!hideTitle ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="deal-insp-title" label="Deal title" readOnly={isFieldReadOnly(fr, 'title')} />
            <input
              id="deal-insp-title"
              type="text"
              value={formValues.title}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'title')}
              onChange={(e) => setDraft({ ...formValues, title: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        {!hideAccount || !hideContact ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideAccount ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="deal-insp-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
                <RecordRelationPicker
                  id="deal-insp-account"
                  ariaLabel="Account"
                  workspaceSlug={workspaceSlug}
                  objectKey="account"
                  objectPluralLabel="Accounts"
                  value={formValues.account_id}
                  selectedRecord={
                    pickedAccountsById[formValues.account_id] || active?.account || null
                  }
                  fallbackOptions={pane.optionsData.accounts || []}
                  emptyLabel="No Account"
                  searchPlaceholder="Search Accounts..."
                  getOptionMeta={(acc) => acc.city || acc.email || ''}
                  onChange={(val, rec) =>
                    setDraft(applyAccountContactChange(formValues, 'account_id', val, rec))
                  }
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'account')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
            {!hideContact ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="deal-insp-contact" label={contactLabel} readOnly={isFieldReadOnly(fr, 'contact')} />
                <RecordRelationPicker
                  id="deal-insp-contact"
                  ariaLabel={contactLabel}
                  workspaceSlug={workspaceSlug}
                  objectKey="contact"
                  objectPluralLabel={contactPlural}
                  value={formValues.contact_id}
                  selectedRecord={
                    pickedContactsById[formValues.contact_id] || active?.contact || null
                  }
                  fallbackOptions={allContacts}
                  queryParams={
                    formValues.account_id
                      ? { compatible_account_id: formValues.account_id }
                      : {}
                  }
                  emptyLabel={`No ${contactLabel}`}
                  searchPlaceholder={`Search ${contactPlural}...`}
                  getOptionLabel={(con) => {
                    const accName = con.account?.name || con.account_name
                    return accName ? `${con.name || con.display_label} (${accName})` : con.name || con.display_label
                  }}
                  getOptionMeta={(con) => con.email || con.phone || ''}
                  onChange={(val, rec) =>
                    setDraft(applyAccountContactChange(formValues, 'contact_id', val, rec))
                  }
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'contact')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideAmount || !hideStage ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideAmount ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="deal-insp-amount" label="Amount (GHS)" readOnly={isFieldReadOnly(fr, 'amount')} />
                <input
                  id="deal-insp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.amount}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'amount')}
                  onChange={(e) => setDraft({ ...formValues, amount: e.target.value })}
                  className="crm-input w-full px-3 py-2 num-tabular"
                />
              </div>
            ) : null}
            {!hideStage ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="deal-insp-stage" label="Stage" readOnly={isFieldReadOnly(fr, 'stage')} />
                <Select
                  id="deal-insp-stage"
                  ariaLabel="Stage"
                  value={formValues.stage}
                  onChange={(val) => setDraft({ ...formValues, stage: val })}
                  options={stageFieldOptions}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'stage')}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideCloseDate || !hideWinProb ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideCloseDate ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="deal-insp-close" label="Target close date" readOnly={isFieldReadOnly(fr, 'target_close_date')} />
                <input
                  id="deal-insp-close"
                  type="date"
                  value={formValues.target_close_date}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'target_close_date')}
                  onChange={(e) =>
                    setDraft({ ...formValues, target_close_date: e.target.value })
                  }
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
            {!hideWinProb ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="deal-insp-prob" label="Win probability (%)" readOnly={isFieldReadOnly(fr, 'win_probability')} />
                <input
                  id="deal-insp-prob"
                  type="number"
                  min="0"
                  max="100"
                  value={formValues.win_probability}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'win_probability')}
                  onChange={(e) =>
                    setDraft({ ...formValues, win_probability: e.target.value })
                  }
                  className="crm-input w-full px-3 py-2 num-tabular"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideMargin ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="deal-insp-margin" label="Estimated margin (GHS)" readOnly={isFieldReadOnly(fr, 'estimated_margin')} />
            <input
              id="deal-insp-margin"
              type="number"
              min="0"
              step="0.01"
              value={formValues.estimated_margin}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'estimated_margin')}
              onChange={(e) =>
                setDraft({ ...formValues, estimated_margin: e.target.value })
              }
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="deal-insp-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
            <textarea
              id="deal-insp-notes"
              rows={3}
              value={formValues.notes}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'notes')}
              onChange={(e) => setDraft({ ...formValues, notes: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
      </RecordInspectorDrawer>

      {conversionEnabled ? (
        <ConvertLeadModal
          open={convertModalOpen}
          onClose={() => setConvertModalOpen(false)}
          workspaceSlug={workspaceSlug}
          contactLabel={contactLabel}
          onConverted={(data) => {
            setConversionResult(data)
            onAuditRecorded?.()
            reloadBoard()
            pane.reload()
          }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </>
  )
}
