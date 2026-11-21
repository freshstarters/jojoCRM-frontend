import { useState } from 'react'
import { upsertInventoryStock } from '../../service/inventoryService.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { Select } from '../Select.jsx'

export function StockAdjustModal({
  open,
  onClose,
  workspaceSlug,
  products = [],
  warehouses = [],
  initialProductId = '',
  initialWarehouseId = '',
  onSaved,
  onSessionExpired,
}) {
  const activeWarehouses = warehouses.filter((w) => w.is_active)
  const [productId, setProductId] = useState(
    initialProductId ? String(initialProductId) : String(products[0]?.product_id || ''),
  )
  const [warehouseId, setWarehouseId] = useState(
    initialWarehouseId
      ? String(initialWarehouseId)
      : String(activeWarehouses[0]?.id || ''),
  )
  const [qty, setQty] = useState('0.00')
  const [reorder, setReorder] = useState('0.00')
  const [seededKey, setSeededKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const effectiveProdId =
    productId || String(initialProductId || products[0]?.product_id || '')
  const effectiveWhId =
    warehouseId || String(initialWarehouseId || activeWarehouses[0]?.id || '')
  const targetKey = open ? `${initialProductId}:${initialWarehouseId}` : ''

  if (open && targetKey !== seededKey) {
    setSeededKey(targetKey)
    const nextPid = String(initialProductId || products[0]?.product_id || '')
    const nextWid = String(initialWarehouseId || activeWarehouses[0]?.id || '')
    setProductId(nextPid)
    setWarehouseId(nextWid)
    const prodRow = products.find((p) => String(p.product_id) === nextPid)
    const cell = prodRow?.stocks_by_warehouse?.[nextWid]
    setQty(cell?.quantity_on_hand ?? '0.00')
    setReorder(cell?.reorder_level ?? '0.00')
    setError('')
  }

  function syncFromSelection(nextPid, nextWid) {
    const prodRow = products.find((p) => String(p.product_id) === String(nextPid))
    const cell = prodRow?.stocks_by_warehouse?.[String(nextWid)]
    setQty(cell?.quantity_on_hand ?? '0.00')
    setReorder(cell?.reorder_level ?? '0.00')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!workspaceSlug) return
    setError('')
    setSaving(true)
    try {
      const { response, data } = await upsertInventoryStock(workspaceSlug, {
        product_id: Number(effectiveProdId),
        warehouse_id: Number(effectiveWhId),
        quantity_on_hand: qty,
        reorder_level: reorder,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not update stock level.')
        return
      }
      await onSaved?.(data?.message || 'Stock updated.')
      onClose()
    } catch {
      setError('Network error while saving stock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Set Warehouse Stock"
      subtitle="Update quantity on hand and reorder threshold for a product in a warehouse."
      onClose={() => {
        if (!saving) onClose()
      }}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={onClose}
            className="px-3 py-1.5 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="stock-adjust-form"
            variant="primary"
            disabled={saving || !effectiveProdId || !effectiveWhId}
            className="px-3 py-1.5 text-xs font-semibold"
          >
            {saving ? 'Saving...' : 'Save Stock Level'}
          </Button>
        </>
      }
    >
      <form id="stock-adjust-form" onSubmit={handleSubmit} className="space-y-3 text-xs">
        <FeedbackNotice tone="danger" message={error} />

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-sub">Product *</label>
          <Select
            ariaLabel="Product"
            value={effectiveProdId}
            onChange={(val) => {
              setProductId(val)
              syncFromSelection(val, effectiveWhId)
            }}
            options={products.map((p) => ({
              value: String(p.product_id),
              label: p.product_sku ? `${p.product_name} (${p.product_sku})` : p.product_name,
            }))}
            placeholder="Select product..."
            disabled={saving}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-sub">Warehouse *</label>
          <Select
            ariaLabel="Warehouse"
            value={effectiveWhId}
            onChange={(val) => {
              setWarehouseId(val)
              syncFromSelection(effectiveProdId, val)
            }}
            options={activeWarehouses.map((w) => ({
              value: String(w.id),
              label: w.is_default ? `${w.name} (Default)` : w.name,
            }))}
            placeholder="Select warehouse..."
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="stk-qty" className="block text-[11px] font-medium text-sub">
              Quantity on hand *
            </label>
            <input
              id="stk-qty"
              type="number"
              min="0"
              step="0.01"
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={saving}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="stk-reorder" className="block text-[11px] font-medium text-sub">
              Reorder level *
            </label>
            <input
              id="stk-reorder"
              type="number"
              min="0"
              step="0.01"
              required
              value={reorder}
              onChange={(e) => setReorder(e.target.value)}
              disabled={saving}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
