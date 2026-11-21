import { useState } from 'react'
import {
  createWorkspaceWarehouse,
  deleteWorkspaceWarehouse,
  updateWorkspaceWarehouse,
} from '../../service/inventoryService.js'
import { Button } from '../Button.jsx'
import { Checkbox } from '../Checkbox.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'

export function WarehouseManageModal({
  open,
  onClose,
  workspaceSlug,
  warehouses = [],
  rights = {},
  onChanged,
  onSessionExpired,
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [location, setLocation] = useState('')
  const [isDefault, setIsDefault] = useState(warehouses.length === 0)
  const [busyId, setBusyId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ name: '', code: '', location: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleCreate(event) {
    event.preventDefault()
    if (!workspaceSlug || !name.trim()) return
    setError('')
    setNotice('')
    setCreating(true)
    try {
      const { response, data } = await createWorkspaceWarehouse(workspaceSlug, {
        name: name.trim(),
        code: code.trim(),
        location: location.trim(),
        is_default: warehouses.length === 0 ? true : isDefault,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not create warehouse.')
        return
      }
      setName('')
      setCode('')
      setLocation('')
      setIsDefault(false)
      setNotice(data?.message || 'Warehouse created.')
      await onChanged?.()
    } catch {
      setError('Network error while creating warehouse.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(whId) {
    if (!workspaceSlug) return
    setError('')
    setNotice('')
    setBusyId(whId)
    try {
      const { response, data } = await updateWorkspaceWarehouse(workspaceSlug, whId, {
        name: editDraft.name.trim(),
        code: editDraft.code.trim(),
        location: editDraft.location.trim(),
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not update warehouse.')
        return
      }
      setEditingId(null)
      setNotice(data?.message || 'Warehouse updated.')
      await onChanged?.()
    } catch {
      setError('Network error while updating warehouse.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleSetDefault(wh) {
    if (!workspaceSlug) return
    setError('')
    setNotice('')
    setBusyId(wh.id)
    try {
      const { response, data } = await updateWorkspaceWarehouse(workspaceSlug, wh.id, {
        is_default: true,
        is_active: true,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not change default warehouse.')
        return
      }
      setNotice(`"${wh.name}" is now the default warehouse.`)
      await onChanged?.()
    } catch {
      setError('Network error while updating default warehouse.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(wh) {
    if (!workspaceSlug) return
    setError('')
    setNotice('')
    setBusyId(wh.id)
    try {
      const { response, data } = await updateWorkspaceWarehouse(workspaceSlug, wh.id, {
        is_active: !wh.is_active,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not update warehouse status.')
        return
      }
      setNotice(data?.message || 'Warehouse status updated.')
      await onChanged?.()
    } catch {
      setError('Network error while updating warehouse status.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(wh) {
    if (!workspaceSlug) return
    setError('')
    setNotice('')
    setBusyId(wh.id)
    try {
      const { response, data } = await deleteWorkspaceWarehouse(workspaceSlug, wh.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not delete warehouse.')
        return
      }
      setNotice(data?.message || 'Warehouse deleted.')
      await onChanged?.()
    } catch {
      setError('Network error while deleting warehouse.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      open={open}
      title="Manage Warehouses"
      subtitle="Configure stock locations, default fulfillment warehouse, and archive unused depots."
      maxWidthClass="max-w-2xl"
      onClose={() => {
        if (!creating && !busyId) onClose()
      }}
      footer={
        <Button
          type="button"
          variant="secondary"
          disabled={creating || Boolean(busyId)}
          onClick={onClose}
          className="px-4 py-1.5 text-xs"
        >
          Close
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        <FeedbackNotice tone="danger" message={error} />
        <FeedbackNotice tone="success" message={notice} />

        {warehouses.length === 0 ? (
          <p className="text-xs text-sub">
            No warehouses yet. Add your first warehouse below — it will be marked as the workspace default.
          </p>
        ) : (
          <div className="space-y-2">
            {warehouses.map((wh) => {
              const isEditing = editingId === wh.id
              const isRowBusy = busyId === wh.id
              return (
                <div
                  key={wh.id}
                  className="p-3 rounded-lg crm-subtle border crm-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  {isEditing ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="Warehouse name"
                        className="crm-input px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={editDraft.code}
                        onChange={(e) => setEditDraft((d) => ({ ...d, code: e.target.value }))}
                        placeholder="Code (optional)"
                        className="crm-input px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={editDraft.location}
                        onChange={(e) => setEditDraft((d) => ({ ...d, location: e.target.value }))}
                        placeholder="Location"
                        className="crm-input px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-main">{wh.name}</span>
                        {wh.code ? (
                          <span className="badge badge-neutral text-[10px] num-tabular">{wh.code}</span>
                        ) : null}
                        {wh.is_default ? (
                          <span className="badge badge-info text-[10px]">Default</span>
                        ) : null}
                        {!wh.is_active ? (
                          <span className="badge badge-warn text-[10px]">Inactive</span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-sub num-tabular">
                        {wh.location || 'No location specified'} ·{' '}
                        {Number(wh.total_units || 0).toFixed(0)} units across {wh.sku_count ?? 0} SKUs
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={isRowBusy}
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-[11px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          disabled={isRowBusy}
                          onClick={() => handleSaveEdit(wh.id)}
                          className="px-2.5 py-1 text-[11px]"
                        >
                          {isRowBusy ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <>
                        {rights.canUpdate && !wh.is_default && wh.is_active ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isRowBusy}
                            onClick={() => handleSetDefault(wh)}
                            className="px-2.5 py-1 text-[11px]"
                          >
                            Set Default
                          </Button>
                        ) : null}
                        {rights.canUpdate ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isRowBusy}
                            onClick={() => {
                              setEditingId(wh.id)
                              setEditDraft({
                                name: wh.name || '',
                                code: wh.code || '',
                                location: wh.location || '',
                              })
                            }}
                            className="px-2.5 py-1 text-[11px]"
                          >
                            Edit
                          </Button>
                        ) : null}
                        {rights.canUpdate && !wh.is_default ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isRowBusy}
                            onClick={() => handleToggleActive(wh)}
                            className="px-2.5 py-1 text-[11px]"
                          >
                            {wh.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        ) : null}
                        {rights.canDelete && !wh.is_default ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isRowBusy}
                            onClick={() => handleDelete(wh)}
                            className="px-2.5 py-1 text-[11px] text-rose-600"
                          >
                            Delete
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {rights.canCreate ? (
          <form onSubmit={handleCreate} className="pt-3 border-t crm-border space-y-3">
            <div className="text-xs font-semibold text-main">Add Warehouse</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="new-wh-name" className="block text-[11px] font-medium text-sub">
                  Name *
                </label>
                <input
                  id="new-wh-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Accra Central"
                  disabled={creating}
                  className="crm-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-wh-code" className="block text-[11px] font-medium text-sub">
                  Code
                </label>
                <input
                  id="new-wh-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. WH-ACC"
                  disabled={creating}
                  className="crm-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-wh-location" className="block text-[11px] font-medium text-sub">
                  Location
                </label>
                <input
                  id="new-wh-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Accra Industrial Area"
                  disabled={creating}
                  className="crm-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            {warehouses.length > 0 ? (
              <Checkbox
                id="new-wh-default"
                checked={isDefault}
                onChange={setIsDefault}
                label="Set as default warehouse"
                disabled={creating}
              />
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={creating}
                className="px-3 py-1.5 text-xs font-semibold"
              >
                {creating ? 'Adding...' : 'Add Warehouse'}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </Modal>
  )
}
