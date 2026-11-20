import { useEffect, useMemo, useState } from 'react'
import {
  createInvoiceStatus,
  fetchWorkspaceInvoiceStatuses,
  getStatusBadgeClass,
  getStatusColor,
  INVOICE_STATUS_CATEGORY_LABELS,
  removeInvoiceStatus,
  reorderInvoiceStatuses,
  updateInvoiceStatus,
} from '../service/commercialService.js'
import { canUserManageSalesSettings } from '../service/crmService.js'
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

const DEFAULT_CATEGORY_OPTIONS = [
  { value: 'draft', label: 'Draft (Lines editable)' },
  { value: 'issued', label: 'Issued (Unpaid)' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid (Settled)' },
  { value: 'void', label: 'Void (Cancelled)' },
]

export function SettingsInvoiceStatusesSection({
  workspace,
  permissions,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const [statusData, setStatusData] = useState(null)
  const [loading, setLoading] = useState(Boolean(workspaceSlug))
  const [loadError, setLoadError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const [draftOrderIds, setDraftOrderIds] = useState(null)
  const [draggedStatusId, setDraggedStatusId] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const [newName, setNewName] = useState('')
  const [newTone, setNewTone] = useState('info')
  const [newCategory, setNewCategory] = useState('issued')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editTone, setEditTone] = useState('info')
  const [editCategory, setEditCategory] = useState('issued')
  const [savingEdit, setSavingEdit] = useState(false)

  const [removeTarget, setRemoveTarget] = useState(null)
  const [replacementId, setReplacementId] = useState('')
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!workspaceSlug) return undefined
    let cancelled = false

    fetchWorkspaceInvoiceStatuses(workspaceSlug, { force: refreshTick > 0 })
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setLoadError(data?.error || data?.detail || 'Could not load invoice statuses.')
          return
        }
        setLoadError('')
        setStatusData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Network error while loading invoice statuses.')
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
    if (statusData?.permissions?.can_manage_sales_settings !== undefined) {
      return Boolean(statusData.permissions.can_manage_sales_settings)
    }
    return canUserManageSalesSettings(permissions)
  }, [statusData, permissions])

  const serverStatuses = useMemo(() => statusData?.statuses || [], [statusData?.statuses])
  const serverOrderIds = useMemo(
    () => serverStatuses.map((item) => item.id),
    [serverStatuses],
  )

  const orderedStatuses = useMemo(() => {
    if (!draftOrderIds) return serverStatuses
    const byId = new Map(serverStatuses.map((item) => [item.id, item]))
    const ordered = draftOrderIds.map((id) => byId.get(id)).filter(Boolean)
    return ordered.length === serverStatuses.length ? ordered : serverStatuses
  }, [draftOrderIds, serverStatuses])

  const isOrderDirty = useMemo(() => {
    if (!draftOrderIds || draftOrderIds.length !== serverOrderIds.length) return false
    return draftOrderIds.some((id, idx) => id !== serverOrderIds[idx])
  }, [draftOrderIds, serverOrderIds])

  const toneOptions = useMemo(() => {
    const raw = statusData?.tone_choices
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
      swatchColor: getStatusColor(opt.value),
    }))
  }, [statusData?.tone_choices])

  const categoryOptions = useMemo(() => {
    const raw = statusData?.category_choices
    if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_CATEGORY_OPTIONS
    return raw.map((choice) => ({
      value: choice.value,
      label:
        DEFAULT_CATEGORY_OPTIONS.find((opt) => opt.value === choice.value)?.label ||
        choice.label,
    }))
  }, [statusData?.category_choices])

  const isBusy = savingOrder || adding || savingEdit || removing

  function handleRefresh() {
    setLoadError('')
    setActionError('')
    setActionSuccess('')
    setDraftOrderIds(null)
    setRefreshTick((prev) => prev + 1)
  }

  function moveInOrder(statusId, delta) {
    const ids = (draftOrderIds || serverOrderIds).slice()
    const index = ids.indexOf(statusId)
    const targetIndex = index + delta
    if (index < 0 || targetIndex < 0 || targetIndex >= ids.length) return
    const [moved] = ids.splice(index, 1)
    ids.splice(targetIndex, 0, moved)
    setDraftOrderIds(ids)
    setActionError('')
    setActionSuccess('')
  }

  function handleDrop(targetId) {
    if (!draggedStatusId || draggedStatusId === targetId) {
      setDraggedStatusId(null)
      return
    }
    const ids = (draftOrderIds || serverOrderIds).slice()
    const fromIdx = ids.indexOf(draggedStatusId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) {
      setDraggedStatusId(null)
      return
    }
    const [moved] = ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, moved)
    setDraftOrderIds(ids)
    setDraggedStatusId(null)
  }

  async function handleSaveOrder() {
    if (!workspaceSlug || !isOrderDirty) return
    setSavingOrder(true)
    setActionError('')
    setActionSuccess('')
    try {
      const { response, data } = await reorderInvoiceStatuses(workspaceSlug, draftOrderIds)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not reorder invoice statuses.')
        return
      }
      setStatusData(data)
      setDraftOrderIds(null)
      setActionSuccess(data?.message || 'Invoice status order updated.')
      onAuditRecorded?.()
    } catch {
      setActionError('Network error while saving status order.')
    } finally {
      setSavingOrder(false)
    }
  }

  async function handleAddStatus(event) {
    event.preventDefault()
    if (!workspaceSlug || !newName.trim()) return
    setAdding(true)
    setActionError('')
    setActionSuccess('')
    try {
      const { response, data } = await createInvoiceStatus(workspaceSlug, {
        name: newName.trim(),
        tone: newTone,
        category: newCategory,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not add invoice status.')
        return
      }
      setStatusData(data)
      setDraftOrderIds(null)
      setNewName('')
      setNewTone('info')
      setNewCategory('issued')
      setActionSuccess(data?.message || 'Invoice status added.')
      onAuditRecorded?.()
    } catch {
      setActionError('Network error while adding invoice status.')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(statusId) {
    if (!workspaceSlug || !editName.trim()) return
    setSavingEdit(true)
    setActionError('')
    setActionSuccess('')
    try {
      const { response, data } = await updateInvoiceStatus(workspaceSlug, statusId, {
        name: editName.trim(),
        tone: editTone,
        category: editCategory,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not update invoice status.')
        return
      }
      setStatusData(data)
      setEditingId(null)
      setActionSuccess(data?.message || 'Invoice status updated.')
      onAuditRecorded?.()
    } catch {
      setActionError('Network error while updating invoice status.')
    } finally {
      setSavingEdit(false)
    }
  }

  function openRemoveModal(item) {
    const others = orderedStatuses.filter((s) => s.id !== item.id)
    setRemoveTarget(item)
    setReplacementId(others[0] ? String(others[0].id) : '')
    setActionError('')
    setActionSuccess('')
  }

  async function handleConfirmRemove() {
    if (!workspaceSlug || !removeTarget) return
    setRemoving(true)
    setActionError('')
    setActionSuccess('')
    try {
      const { response, data } = await removeInvoiceStatus(
        workspaceSlug,
        removeTarget.id,
        removeTarget.invoice_count > 0 ? replacementId : null,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not remove invoice status.')
        return
      }
      setStatusData(data)
      setDraftOrderIds(null)
      setRemoveTarget(null)
      setReplacementId('')
      setActionSuccess(data?.message || 'Invoice status removed.')
      onAuditRecorded?.()
    } catch {
      setActionError('Network error while removing invoice status.')
    } finally {
      setRemoving(false)
    }
  }

  const replacementOptions = useMemo(() => {
    if (!removeTarget) return []
    return orderedStatuses
      .filter((s) => s.id !== removeTarget.id)
      .map((s) => ({
        value: String(s.id),
        label: `${s.name} (${INVOICE_STATUS_CATEGORY_LABELS[s.category] || s.category})`,
      }))
  }, [orderedStatuses, removeTarget])

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b crm-border pb-4">
          <div>
            <h2 className="text-sm font-semibold text-main">Invoice Statuses</h2>
            <p className="text-xs text-sub mt-0.5">
              Customize invoice status labels, colors, and lifecycle roles. Renaming updates existing invoices; removing a status held by invoices requires selecting a replacement status.
            </p>
          </div>
          <RefreshButton
            onClick={handleRefresh}
            loading={loading}
            label="Refresh invoice statuses"
          />
        </div>

        {!canManageSales && !loading ? (
          <FeedbackNotice
            tone="info"
            message="Read-only view: only the workspace Owner or a role with Theme & layouts or Users & roles access can edit invoice statuses."
          />
        ) : null}

        <FeedbackNotice tone="danger" message={loadError || actionError} />
        <FeedbackNotice tone="success" message={actionSuccess} />

        {loading && !statusData ? (
          <p className="text-xs text-sub py-4">Loading invoice statuses...</p>
        ) : statusData ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-sub">
                <span className="num-tabular font-semibold text-main">
                  {orderedStatuses.length}
                </span>
                <span>configured statuses</span>
                <span>·</span>
                <span className="num-tabular font-semibold text-main">
                  {statusData.total_invoices ?? 0}
                </span>
                <span>invoices across workspace</span>
              </div>

              {canManageSales && isOrderDirty ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={savingOrder}
                    onClick={() => setDraftOrderIds(null)}
                    className="px-3 py-1.5 text-xs"
                  >
                    Reset order
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={savingOrder}
                    onClick={handleSaveOrder}
                    className="px-3 py-1.5 text-xs font-medium"
                  >
                    {savingOrder ? 'Saving...' : 'Save order'}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {orderedStatuses.map((item, idx) => {
                const isEditing = editingId === item.id
                const canDeleteStatus = orderedStatuses.length > 1
                return (
                  <div
                    key={item.id}
                    draggable={canManageSales && !isEditing && !isBusy}
                    onDragStart={() => setDraggedStatusId(item.id)}
                    onDragOver={(e) => {
                      if (canManageSales && !isEditing) e.preventDefault()
                    }}
                    onDrop={() => handleDrop(item.id)}
                    className="p-3 rounded-lg border crm-border crm-subtle space-y-2.5 text-xs"
                  >
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-4 space-y-1">
                          <label className="block font-medium text-main">Status name</label>
                          <input
                            type="text"
                            maxLength={100}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={savingEdit}
                            className="crm-input w-full px-3 py-1.5"
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <label className="block font-medium text-main">Badge tone</label>
                          <Select
                            ariaLabel="Edit status tone"
                            value={editTone}
                            onChange={setEditTone}
                            options={toneOptions}
                            disabled={savingEdit}
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <label className="block font-medium text-main">Lifecycle role</label>
                          <Select
                            ariaLabel="Edit lifecycle category"
                            value={editCategory}
                            onChange={setEditCategory}
                            options={categoryOptions}
                            disabled={savingEdit}
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={savingEdit}
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1.5 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            disabled={savingEdit || !editName.trim()}
                            onClick={() => handleSaveEdit(item.id)}
                            className="px-2.5 py-1.5 text-xs"
                          >
                            {savingEdit ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                          <span className="text-[11px] font-semibold text-sub num-tabular w-5">
                            {idx + 1}.
                          </span>
                          <span className={getStatusBadgeClass(item.tone, item.name)}>
                            {item.name}
                          </span>
                          <span className="badge badge-neutral">
                            {INVOICE_STATUS_CATEGORY_LABELS[item.category] || item.category}
                          </span>
                          <span className="text-sub num-tabular">
                            {item.invoice_count ?? 0}{' '}
                            {item.invoice_count === 1 ? 'invoice' : 'invoices'}
                            {item.total_amount !== null && item.total_amount !== undefined
                              ? ` · ${formatGhs(item.total_amount)}`
                              : ''}
                          </span>
                        </div>

                        {canManageSales ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isBusy || idx === 0}
                              onClick={() => moveInOrder(item.id, -1)}
                              className="px-2 py-1 text-xs"
                              aria-label={`Move ${item.name} up`}
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isBusy || idx === orderedStatuses.length - 1}
                              onClick={() => moveInOrder(item.id, 1)}
                              className="px-2 py-1 text-xs"
                              aria-label={`Move ${item.name} down`}
                            >
                              Down
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isBusy}
                              onClick={() => {
                                setEditingId(item.id)
                                setEditName(item.name)
                                setEditTone(item.tone || 'info')
                                setEditCategory(item.category || 'issued')
                              }}
                              className="px-2.5 py-1 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isBusy || !canDeleteStatus}
                              onClick={() => openRemoveModal(item)}
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
                onSubmit={handleAddStatus}
                className="pt-3 border-t crm-border grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs"
              >
                <div className="sm:col-span-4 space-y-1">
                  <label htmlFor="newInvoiceStatusName" className="block font-medium text-main">
                    Add invoice status
                  </label>
                  <input
                    id="newInvoiceStatusName"
                    type="text"
                    maxLength={100}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Awaiting Approval"
                    disabled={isBusy}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label htmlFor="newInvoiceStatusTone" className="block font-medium text-main">
                    Tone
                  </label>
                  <Select
                    id="newInvoiceStatusTone"
                    ariaLabel="New invoice status tone"
                    value={newTone}
                    onChange={setNewTone}
                    options={toneOptions}
                    disabled={isBusy}
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label htmlFor="newInvoiceStatusCategory" className="block font-medium text-main">
                    Lifecycle role
                  </label>
                  <Select
                    id="newInvoiceStatusCategory"
                    ariaLabel="New invoice status lifecycle role"
                    value={newCategory}
                    onChange={setNewCategory}
                    options={categoryOptions}
                    disabled={isBusy}
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isBusy || !newName.trim()}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-medium"
                  >
                    {adding ? 'Adding...' : 'Add status'}
                  </Button>
                </div>
              </form>
            ) : null}
          </>
        ) : null}
      </Card>

      <Modal
        open={Boolean(removeTarget)}
        title={removeTarget ? `Remove "${removeTarget.name}"?` : 'Remove status'}
        subtitle={
          removeTarget?.invoice_count > 0
            ? 'Reassign existing invoices to another status before removing this status'
            : 'Remove this unused status from the workspace'
        }
        onClose={() => {
          if (!removing) setRemoveTarget(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={removing}
              onClick={() => setRemoveTarget(null)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                removing ||
                (removeTarget?.invoice_count > 0 && !replacementId)
              }
              onClick={handleConfirmRemove}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {removing
                ? 'Removing...'
                : removeTarget?.invoice_count > 0
                  ? 'Reassign & remove'
                  : 'Remove status'}
            </Button>
          </>
        }
      >
        {removeTarget ? (
          <div className="space-y-3 text-xs">
            <FeedbackNotice tone="danger" message={actionError} />
            {removeTarget.invoice_count > 0 ? (
              <>
                <p className="text-sub leading-relaxed">
                  <span className="font-semibold text-main">{removeTarget.name}</span>{' '}
                  is currently assigned to{' '}
                  <span className="font-semibold text-main num-tabular">
                    {removeTarget.invoice_count}{' '}
                    {removeTarget.invoice_count === 1 ? 'invoice' : 'invoices'}
                  </span>
                  . Choose a replacement status before removing it:
                </p>
                <div className="space-y-1">
                  <label
                    htmlFor="replacementInvoiceStatusSelect"
                    className="block font-medium text-main"
                  >
                    Replacement status
                  </label>
                  <Select
                    id="replacementInvoiceStatusSelect"
                    ariaLabel="Replacement invoice status"
                    value={replacementId}
                    onChange={setReplacementId}
                    options={replacementOptions}
                    disabled={removing}
                  />
                </div>
              </>
            ) : (
              <p className="text-sub leading-relaxed">
                No invoices currently hold{' '}
                <span className="font-semibold text-main">{removeTarget.name}</span>.
                Removing it updates invoice status choices immediately.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
