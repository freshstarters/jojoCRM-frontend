import { useState } from 'react'
import {
  createCrmRecord,
  deleteCrmRecord,
  updateCrmRecord,
} from '../../service/crmService.js'
import { formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Select } from '../Select.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'

function calcLineTotal(qty, unitPrice) {
  const q = Number(qty || 0)
  const p = Number(unitPrice || 0)
  if (!Number.isFinite(q) || !Number.isFinite(p)) return '0.00'
  return (q * p).toFixed(2)
}

export function InvoiceLineItemsEditor({
  workspaceSlug,
  parentObjectKey = 'invoice',
  parentId = null,
  items = [],
  onDraftItemsChange = null,
  products = [],
  warehouses = [],
  inventoryEnabled = false,
  onOpenWarehouses = null,
  productEnabled = true,
  lineItemEnabled = true,
  canEdit = true,
  locked = false,
  lockMessage = '',
  onChanged,
  onSessionExpired,
}) {
  const isDraftMode = typeof onDraftItemsChange === 'function' && !parentId
  const productRequired = productEnabled && lineItemEnabled
  const requireWarehouse = parentObjectKey === 'invoice' && inventoryEnabled

  const [addingProductId, setAddingProductId] = useState('')
  const [addingProductObj, setAddingProductObj] = useState(null)
  const [addingWarehouseId, setAddingWarehouseId] = useState('')
  const [addingDesc, setAddingDesc] = useState('')
  const [addingQty, setAddingQty] = useState('1')
  const [addingPrice, setAddingPrice] = useState('0.00')
  const [savingLine, setSavingLine] = useState(false)
  const [editingLineId, setEditingLineId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [lineError, setLineError] = useState('')

  const warehouseOptions = warehouses.map((wh) => ({
    value: String(wh.id),
    label: wh.is_default ? `${wh.name} (Default)` : wh.name,
  }))

  function handleSelectAddProduct(val, rec) {
    setAddingProductId(val)
    setAddingProductObj(rec || null)
    if (rec) {
      if (rec.unit_price !== undefined && rec.unit_price !== null) {
        setAddingPrice(String(rec.unit_price))
      }
      if (!addingDesc && rec.description) {
        setAddingDesc(rec.description.slice(0, 255))
      }
    }
  }

  async function handleAddLine() {
    setLineError('')
    const qtyNum = Number(addingQty)
    const priceNum = Number(addingPrice)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setLineError('Quantity must be greater than zero.')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setLineError('Unit price must be zero or greater.')
      return
    }
    if (productRequired && !addingProductId) {
      setLineError('Select a Product for this line item.')
      return
    }
    if (!productRequired && !addingProductId && !addingDesc.trim()) {
      setLineError('Provide a description for this line item.')
      return
    }
    if (requireWarehouse && (addingProductId || productRequired) && !addingWarehouseId) {
      setLineError('Select a warehouse for this line item.')
      return
    }

    const pickedWarehouse = warehouses.find(
      (wh) => String(wh.id) === String(addingWarehouseId),
    )

    if (isDraftMode) {
      const nextItem = {
        tempKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        product_id: addingProductId ? Number(addingProductId) : null,
        product_name:
          addingProductObj?.name || addingDesc.trim() || 'Custom line',
        product_sku: addingProductObj?.sku || '',
        warehouse_id: addingWarehouseId ? Number(addingWarehouseId) : null,
        warehouse_name: pickedWarehouse?.name || '',
        description: addingDesc.trim(),
        quantity: qtyNum.toFixed(2),
        unit_price: priceNum.toFixed(2),
        line_total: calcLineTotal(qtyNum, priceNum),
      }
      onDraftItemsChange([...items, nextItem])
      setAddingProductId('')
      setAddingProductObj(null)
      setAddingWarehouseId('')
      setAddingDesc('')
      setAddingQty('1')
      setAddingPrice('0.00')
      return
    }

    setSavingLine(true)
    try {
      const payload = {
        [parentObjectKey === 'deal' ? 'deal_id' : 'invoice_id']: parentId,
        ...(addingProductId ? { product_id: Number(addingProductId) } : {}),
        ...(requireWarehouse && addingWarehouseId
          ? { warehouse_id: Number(addingWarehouseId) }
          : {}),
        description: addingDesc.trim(),
        quantity: qtyNum.toFixed(2),
        unit_price: priceNum.toFixed(2),
      }
      const { response, data } = await createCrmRecord(
        workspaceSlug,
        'line_item',
        payload,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setLineError(data?.error || data?.detail || 'Could not add line item.')
        return
      }
      setAddingProductId('')
      setAddingProductObj(null)
      setAddingWarehouseId('')
      setAddingDesc('')
      setAddingQty('1')
      setAddingPrice('0.00')
      await onChanged?.()
    } catch {
      setLineError('Network error while adding line item.')
    } finally {
      setSavingLine(false)
    }
  }

  async function handleSaveEditLine(item) {
    if (!editDraft) return
    setLineError('')
    const qtyNum = Number(editDraft.quantity)
    const priceNum = Number(editDraft.unit_price)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setLineError('Quantity must be greater than zero.')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setLineError('Unit price must be zero or greater.')
      return
    }
    if (requireWarehouse && editDraft.product_id && !editDraft.warehouse_id) {
      setLineError('Select a warehouse for this line item.')
      return
    }

    const editPickedWh = warehouses.find(
      (wh) => String(wh.id) === String(editDraft.warehouse_id),
    )

    if (isDraftMode) {
      const next = items.map((row) =>
        row.tempKey === item.tempKey
          ? {
              ...row,
              warehouse_id: editDraft.warehouse_id ? Number(editDraft.warehouse_id) : null,
              warehouse_name: editPickedWh?.name || '',
              description: editDraft.description,
              quantity: qtyNum.toFixed(2),
              unit_price: priceNum.toFixed(2),
              line_total: calcLineTotal(qtyNum, priceNum),
            }
          : row,
      )
      onDraftItemsChange(next)
      setEditingLineId(null)
      setEditDraft(null)
      return
    }

    setSavingLine(true)
    try {
      const { response, data } = await updateCrmRecord(
        workspaceSlug,
        'line_item',
        item.id,
        {
          ...(editDraft.product_id ? { product_id: Number(editDraft.product_id) } : {}),
          ...(requireWarehouse && editDraft.warehouse_id
            ? { warehouse_id: Number(editDraft.warehouse_id) }
            : {}),
          description: editDraft.description,
          quantity: qtyNum.toFixed(2),
          unit_price: priceNum.toFixed(2),
        },
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setLineError(data?.error || data?.detail || 'Could not update line item.')
        return
      }
      setEditingLineId(null)
      setEditDraft(null)
      await onChanged?.()
    } catch {
      setLineError('Network error while updating line item.')
    } finally {
      setSavingLine(false)
    }
  }

  async function handleDeleteLine(item) {
    setLineError('')
    if (isDraftMode) {
      onDraftItemsChange(items.filter((row) => row.tempKey !== item.tempKey))
      return
    }
    setSavingLine(true)
    try {
      const { response, data } = await deleteCrmRecord(
        workspaceSlug,
        'line_item',
        item.id,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setLineError(data?.error || data?.detail || 'Could not delete line item.')
        return
      }
      await onChanged?.()
    } catch {
      setLineError('Network error while deleting line item.')
    } finally {
      setSavingLine(false)
    }
  }

  const linesSum = items.reduce((sum, row) => sum + Number(row.line_total || 0), 0)
  const allowControls = canEdit && !locked

  return (
    <div className="space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-sub">
          Product Line Items
        </h4>
        <span className="text-xs font-semibold text-main num-tabular">
          Total: {formatGhs(linesSum)}
        </span>
      </div>

      {locked && lockMessage ? (
        <FeedbackNotice tone="info" message={lockMessage} />
      ) : null}

      <FeedbackNotice tone="danger" message={lineError} />

      {items.length === 0 ? (
        <p className="text-xs text-sub">No line items yet.</p>
      ) : (
        <div className="rounded-lg border crm-border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b crm-border text-[11px] font-semibold uppercase text-sub crm-subtle">
                <th className="py-2 px-2.5">Item</th>
                {requireWarehouse ? <th className="py-2 px-2.5">Warehouse</th> : null}
                <th className="py-2 px-2.5 text-right">Qty</th>
                <th className="py-2 px-2.5 text-right">Unit (GHS)</th>
                <th className="py-2 px-2.5 text-right">Total</th>
                {allowControls ? <th className="py-2 px-2.5 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y crm-border text-xs">
              {items.map((item) => {
                const rowKey = item.id ?? item.tempKey
                const isEditing = editingLineId === rowKey
                return (
                  <tr key={rowKey}>
                    <td className="py-2 px-2.5 align-top">
                      {isEditing ? (
                        <div className="space-y-1">
                          <div className="font-medium text-main">
                            {item.product_name || item.description}
                          </div>
                          <input
                            type="text"
                            value={editDraft.description}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, description: e.target.value }))
                            }
                            placeholder="Description..."
                            className="crm-input w-full px-2 py-1 text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-main">
                            {item.product_name || item.description || 'Line item'}
                          </div>
                          {item.product_sku ? (
                            <div className="text-[11px] text-sub num-tabular">
                              SKU: {item.product_sku}
                            </div>
                          ) : null}
                          {item.description && item.description !== item.product_name ? (
                            <div className="text-[11px] text-sub">{item.description}</div>
                          ) : null}
                        </>
                      )}
                    </td>
                    {requireWarehouse ? (
                      <td className="py-2 px-2.5 align-top">
                        {isEditing ? (
                          <div className="min-w-[8.5rem]">
                            <Select
                              ariaLabel="Edit line warehouse"
                              value={editDraft.warehouse_id || ''}
                              onChange={(val) =>
                                setEditDraft((d) => ({ ...d, warehouse_id: val }))
                              }
                              options={warehouseOptions}
                              placeholder="Select warehouse..."
                              disabled={savingLine}
                            />
                          </div>
                        ) : item.warehouse_name || item.warehouse?.name ? (
                          <span className="badge badge-neutral">
                            {item.warehouse_name || item.warehouse?.name}
                          </span>
                        ) : (
                          <span className="badge badge-warn">Select warehouse</span>
                        )}
                      </td>
                    ) : null}
                    <td className="py-2 px-2.5 text-right align-top num-tabular">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editDraft.quantity}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, quantity: e.target.value }))
                          }
                          className="crm-input w-16 px-2 py-1 text-right num-tabular"
                        />
                      ) : (
                        Number(item.quantity).toFixed(2).replace(/\.00$/, '')
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right align-top num-tabular">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editDraft.unit_price}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, unit_price: e.target.value }))
                          }
                          className="crm-input w-24 px-2 py-1 text-right num-tabular"
                        />
                      ) : (
                        formatGhs(item.unit_price)
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right align-top font-semibold text-main num-tabular">
                      {isEditing
                        ? formatGhs(calcLineTotal(editDraft.quantity, editDraft.unit_price))
                        : formatGhs(item.line_total)}
                    </td>
                    {allowControls ? (
                      <td className="py-2 px-2.5 text-right align-top whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={savingLine}
                              onClick={() => {
                                setEditingLineId(null)
                                setEditDraft(null)
                              }}
                              className="px-2 py-1 text-[11px]"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              disabled={savingLine}
                              onClick={() => handleSaveEditLine(item)}
                              className="px-2 py-1 text-[11px]"
                            >
                              Save
                            </Button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={savingLine}
                              onClick={() => {
                                setEditingLineId(rowKey)
                                setEditDraft({
                                  product_id: item.product_id ? String(item.product_id) : '',
                                  warehouse_id: item.warehouse_id ? String(item.warehouse_id) : '',
                                  description: item.description || '',
                                  quantity: String(item.quantity || '1'),
                                  unit_price: String(item.unit_price || '0.00'),
                                })
                              }}
                              className="px-2 py-1 text-[11px]"
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={savingLine}
                              onClick={() => handleDeleteLine(item)}
                              className="px-2 py-1 text-[11px] text-rose-600"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {allowControls ? (
        <div className="p-3 rounded-lg crm-subtle border crm-border space-y-2">
          {requireWarehouse && warehouses.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-md border crm-border bg-amber-500/10 text-xs">
              <span className="text-main">
                No active warehouses yet. Create a warehouse in Inventory before adding invoice lines.
              </span>
              {onOpenWarehouses ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onOpenWarehouses}
                  className="px-2.5 py-1 text-[11px]"
                >
                  Open Inventory
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            {productEnabled ? (
              <div className="sm:col-span-5 space-y-1">
                <label className="block text-[11px] font-medium text-sub">
                  Product {productRequired ? '*' : '(optional)'}
                </label>
                <RecordRelationPicker
                  ariaLabel="Line item product"
                  workspaceSlug={workspaceSlug}
                  objectKey="product"
                  objectPluralLabel="Products"
                  value={addingProductId}
                  selectedRecord={addingProductObj}
                  fallbackOptions={products}
                  queryParams={{ is_active: 'true' }}
                  allowEmpty={!productRequired}
                  emptyLabel="Custom line"
                  placeholder="Choose Product..."
                  searchPlaceholder="Search products..."
                  getOptionLabel={(prod) =>
                    prod.sku ? `${prod.name} (${prod.sku})` : prod.name || prod.display_label
                  }
                  getOptionMeta={(prod) =>
                    prod.unit_price !== undefined ? formatGhs(prod.unit_price) : ''
                  }
                  onChange={handleSelectAddProduct}
                  disabled={savingLine}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : (
              <div className="sm:col-span-5 space-y-1">
                <label className="block text-[11px] font-medium text-sub">
                  Item Description *
                </label>
                <input
                  type="text"
                  value={addingDesc}
                  onChange={(e) => setAddingDesc(e.target.value)}
                  placeholder="Service or item description..."
                  disabled={savingLine}
                  className="crm-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>
            )}

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-[11px] font-medium text-sub">Qty</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={addingQty}
                onChange={(e) => setAddingQty(e.target.value)}
                disabled={savingLine}
                className="crm-input w-full px-2.5 py-1.5 text-xs num-tabular"
              />
            </div>

            <div className="sm:col-span-3 space-y-1">
              <label className="block text-[11px] font-medium text-sub">Unit Price (GHS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={addingPrice}
                onChange={(e) => setAddingPrice(e.target.value)}
                disabled={savingLine}
                className="crm-input w-full px-2.5 py-1.5 text-xs num-tabular"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={savingLine}
                onClick={handleAddLine}
                className="w-full px-2.5 py-1.5 text-xs font-medium"
              >
                {savingLine ? 'Adding...' : 'Add Line'}
              </Button>
            </div>
          </div>

          {requireWarehouse ? (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-5 space-y-1">
                <label className="block text-[11px] font-medium text-sub">
                  Warehouse *
                </label>
                <Select
                  ariaLabel="Line item warehouse"
                  value={addingWarehouseId}
                  onChange={setAddingWarehouseId}
                  options={warehouseOptions}
                  placeholder="Choose warehouse..."
                  disabled={savingLine || warehouses.length === 0}
                />
              </div>
              {productEnabled ? (
                <div className="sm:col-span-7 space-y-1">
                  <label className="block text-[11px] font-medium text-sub">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={addingDesc}
                    onChange={(e) => setAddingDesc(e.target.value)}
                    placeholder="Optional line note or specification..."
                    disabled={savingLine}
                    className="crm-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
              ) : null}
            </div>
          ) : productEnabled ? (
            <input
              type="text"
              value={addingDesc}
              onChange={(e) => setAddingDesc(e.target.value)}
              placeholder="Optional line note or specification..."
              disabled={savingLine}
              className="crm-input w-full px-2.5 py-1.5 text-xs"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
