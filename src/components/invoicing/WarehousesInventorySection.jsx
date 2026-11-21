import { useCallback, useEffect, useMemo, useState } from 'react'
import { getObjectRights } from '../../service/crmService.js'
import {
  createStockTransfer,
  fetchWorkspaceInventoryOverview,
} from '../../service/inventoryService.js'
import { formatDateTime } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { Card } from '../Card.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { RefreshButton } from '../RefreshButton.jsx'
import { Select } from '../Select.jsx'
import { StockAdjustModal } from './StockAdjustModal.jsx'
import { WarehouseManageModal } from './WarehouseManageModal.jsx'

function statusBadgeClass(statusLabel) {
  if (statusLabel === 'In Stock') return 'badge badge-success'
  if (statusLabel === 'Low Stock') return 'badge badge-warn'
  if (statusLabel === 'Out of Stock') return 'badge badge-danger'
  return 'badge badge-neutral'
}

export function WarehousesInventorySection({
  workspaceSlug,
  user,
  permissions,
  permissionsRevision = 0,
  subtabsBar = null,
  refreshRevision = 0,
  onInventoryMutated,
  onAuditRecorded,
  onSessionExpired,
}) {
  const rights = getObjectRights(permissions, 'inventory')
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const userTz = user?.timezone || 'Africa/Accra'

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('ALL')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  const [manageOpen, setManageOpen] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState(null)

  const [transferProductId, setTransferProductId] = useState('')
  const [transferFromId, setTransferFromId] = useState('')
  const [transferToId, setTransferToId] = useState('')
  const [transferQty, setTransferQty] = useState('1')
  const [transferNotes, setTransferNotes] = useState('')
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferError, setTransferError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const loadOverview = useCallback(async () => {
    if (!workspaceSlug || !rights.canRead) return
    setLoading(true)
    try {
      const { response, data } = await fetchWorkspaceInventoryOverview(workspaceSlug, {
        warehouseId: warehouseFilter,
        q: debouncedSearch,
        includeInactive: true,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setLoadError(data?.error || 'Could not load warehouse inventory.')
        return
      }
      setLoadError('')
      setOverview(data)
    } catch {
      setLoadError('Network error while loading warehouse inventory.')
    } finally {
      setLoading(false)
    }
  }, [workspaceSlug, rights.canRead, warehouseFilter, debouncedSearch, onSessionExpired])

  useEffect(() => {
    loadOverview()
  }, [loadOverview, reloadTick, refreshRevision, permissionsRevision])

  const allWarehouses = useMemo(() => overview?.warehouses || [], [overview?.warehouses])
  const activeWarehouses = useMemo(
    () => allWarehouses.filter((w) => w.is_active),
    [allWarehouses],
  )
  const products = useMemo(() => overview?.products || [], [overview?.products])
  const transfers = useMemo(
    () => overview?.recent_transfers || [],
    [overview?.recent_transfers],
  )
  const summary = overview?.summary || {
    sku_count: 0,
    low_stock_count: 0,
    warehouse_count: 0,
    total_units: '0.00',
  }

  const defaultWarehouse = activeWarehouses.find((w) => w.is_default) || activeWarehouses[0] || null
  const visibleColumnsWarehouses = useMemo(() => {
    if (warehouseFilter !== 'ALL') {
      const match = allWarehouses.find((w) => String(w.id) === String(warehouseFilter))
      return match ? [match] : activeWarehouses
    }
    return activeWarehouses
  }, [warehouseFilter, allWarehouses, activeWarehouses])

  const maxWhUnits = useMemo(
    () =>
      Math.max(
        1,
        ...activeWarehouses.map((w) => Number(w.total_units || 0)),
      ),
    [activeWarehouses],
  )

  const resolvedTransferProductId =
    transferProductId || (products[0] ? String(products[0].product_id) : '')
  const resolvedFromId =
    transferFromId ||
    (activeWarehouses[1]
      ? String(activeWarehouses[1].id)
      : activeWarehouses[0]
        ? String(activeWarehouses[0].id)
        : '')
  const resolvedToId =
    transferToId ||
    (activeWarehouses[0] && String(activeWarehouses[0].id) !== resolvedFromId
      ? String(activeWarehouses[0].id)
      : activeWarehouses[1]
        ? String(activeWarehouses[1].id)
        : '')

  const selectedTransferProduct = products.find(
    (p) => String(p.product_id) === String(resolvedTransferProductId),
  )
  const sourceAvailableQty = Number(
    selectedTransferProduct?.stocks_by_warehouse?.[String(resolvedFromId)]
      ?.quantity_on_hand || 0,
  )

  async function handleTransferSubmit(event) {
    event.preventDefault()
    if (!workspaceSlug) return
    setTransferError('')
    setActionNotice('')

    if (!resolvedTransferProductId || !resolvedFromId || !resolvedToId) {
      setTransferError('Select a product, source warehouse, and destination warehouse.')
      return
    }
    if (resolvedFromId === resolvedToId) {
      setTransferError('Source and destination warehouses must be different.')
      return
    }
    const qtyNum = Number(transferQty)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setTransferError('Transfer quantity must be greater than zero.')
      return
    }
    if (qtyNum > sourceAvailableQty) {
      setTransferError(
        `Cannot transfer ${qtyNum} units: only ${sourceAvailableQty.toFixed(2).replace(/\.00$/, '')} available in source warehouse.`,
      )
      return
    }

    setTransferBusy(true)
    try {
      const { response, data } = await createStockTransfer(workspaceSlug, {
        product_id: Number(resolvedTransferProductId),
        from_warehouse_id: Number(resolvedFromId),
        to_warehouse_id: Number(resolvedToId),
        quantity: qtyNum.toFixed(2),
        notes: transferNotes.trim(),
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setTransferError(data?.error || 'Could not complete stock transfer.')
        return
      }
      setActionNotice(data?.message || 'Stock transfer completed.')
      setTransferNotes('')
      setReloadTick((t) => t + 1)
      onAuditRecorded?.()
      onInventoryMutated?.()
    } catch {
      setTransferError('Network error while transferring stock.')
    } finally {
      setTransferBusy(false)
    }
  }

  if (!rights.canRead) {
    return (
      <section id="pane-invoicing" className="space-y-5 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b crm-border">
          <div>
            <h1 className="text-xl font-semibold text-main tracking-tight">
              Warehouses &amp; Inventory
            </h1>
            <p className="text-xs text-sub mt-0.5">
              Track per-warehouse stock levels and transfer inventory between locations.
            </p>
          </div>
          {subtabsBar}
        </div>
        <Card className="p-6 max-w-2xl">
          <p className="text-xs text-sub">
            Your role ({roleName}) does not have permission to view Inventory.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section id="pane-invoicing" className="space-y-5 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b crm-border">
        <div>
          <h1 className="text-xl font-semibold text-main tracking-tight">
            Warehouses &amp; Inventory
          </h1>
          <p className="text-xs text-sub mt-0.5">
            Track quantity on hand and reorder levels per warehouse. Issuing an invoice deducts from the chosen warehouse; voiding an unpaid invoice restores it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subtabsBar}
          <RefreshButton
            loading={loading}
            onClick={() => setReloadTick((t) => t + 1)}
          />
          {rights.canCreate || rights.canUpdate || rights.canDelete ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setManageOpen(true)}
              className="px-3 py-1.5 text-xs"
            >
              Manage Warehouses
            </Button>
          ) : null}
          {rights.canUpdate && activeWarehouses.length > 0 && products.length > 0 ? (
            <Button
              type="button"
              variant="primary"
              onClick={() =>
                setAdjustTarget({
                  productId: products[0]?.product_id || '',
                  warehouseId: defaultWarehouse?.id || '',
                })
              }
              className="px-3 py-1.5 text-xs font-semibold"
            >
              Set Stock Level
            </Button>
          ) : null}
        </div>
      </div>

      <FeedbackNotice tone="danger" message={loadError} />
      <FeedbackNotice tone="success" message={actionNotice} />

      {!loading && allWarehouses.length === 0 ? (
        <Card className="p-6 max-w-2xl space-y-3">
          <div className="text-sm font-semibold text-main">
            Create your first warehouse to start tracking inventory
          </div>
          <p className="text-xs text-sub">
            This workspace has no warehouses yet. Add at least one warehouse (for example, Accra Central) before adding product line items or issuing invoices.
          </p>
          {rights.canCreate ? (
            <div>
              <Button
                type="button"
                variant="primary"
                onClick={() => setManageOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold"
              >
                Create First Warehouse
              </Button>
            </div>
          ) : (
            <p className="text-xs text-sub">
              Ask a workspace owner or inventory manager to create a warehouse.
            </p>
          )}
        </Card>
      ) : null}

      {allWarehouses.length > 0 ? (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <Card className="p-4 w-max max-w-xs min-w-[11rem] h-[6.75rem] overflow-hidden">
              <span className="text-xs font-medium text-sub">SKUs</span>
              <div className="mt-1 text-xl font-bold text-main num-tabular">
                {summary.sku_count}
              </div>
              <span className="text-[11px] text-sub">Products in catalog</span>
            </Card>
            <Card className="p-4 w-max max-w-xs min-w-[11rem] h-[6.75rem] overflow-hidden">
              <span className="text-xs font-medium text-sub">Low stock</span>
              <div className="mt-1 text-xl font-bold text-main num-tabular">
                {summary.low_stock_count}
              </div>
              <span className="text-[11px] text-sub">At or under reorder level</span>
            </Card>
            <Card className="p-4 w-max max-w-xs min-w-[11rem] h-[6.75rem] overflow-hidden">
              <span className="text-xs font-medium text-sub">Warehouses</span>
              <div className="mt-1 text-xl font-bold text-main num-tabular">
                {summary.warehouse_count}
              </div>
              <span className="text-[11px] text-sub">
                Default: {defaultWarehouse?.name || '-'}
              </span>
            </Card>
            <Card className="p-4 w-max max-w-xs min-w-[11rem] h-[6.75rem] overflow-hidden">
              <span className="text-xs font-medium text-sub">Total units</span>
              <div className="mt-1 text-xl font-bold text-main num-tabular">
                {Number(summary.total_units || 0).toFixed(0)}
              </div>
              <span className="text-[11px] text-sub">Units on hand across depots</span>
            </Card>
          </div>

          {activeWarehouses.length > 0 ? (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-main">
                    Warehouse Capacity &amp; Stock Health
                  </h3>
                  <p className="text-[11px] text-sub">
                    Units on hand across active workspace depots
                  </p>
                </div>
                <span className="badge badge-info text-[10px] num-tabular">
                  {activeWarehouses.length}{' '}
                  {activeWarehouses.length === 1 ? 'Depot' : 'Depots'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {activeWarehouses.map((wh) => {
                  const units = Number(wh.total_units || 0)
                  const pct = Math.max(4, Math.round((units / maxWhUnits) * 100))
                  return (
                    <div key={wh.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-main truncate">
                          {wh.name}
                          {wh.is_default ? ' (Default)' : ''}
                        </span>
                        <span className="text-sub num-tabular shrink-0">
                          {units.toFixed(0)} units
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full crm-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${units > 0 ? pct : 0}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-8 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b crm-border">
                <div>
                  <h2 className="text-sm font-semibold text-main">
                    Warehouse Inventory Levels
                  </h2>
                  <p className="text-xs text-sub mt-0.5">
                    Default warehouse:{' '}
                    <strong className="text-main">
                      {defaultWarehouse?.name || 'None'}
                    </strong>
                    .{' '}
                    {rights.canUpdate
                      ? 'Click any stock cell to adjust quantity or reorder level.'
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    className="crm-input px-3 py-1.5 text-xs w-44"
                  />
                  <div className="w-44">
                    <Select
                      ariaLabel="Filter by warehouse"
                      value={warehouseFilter}
                      onChange={setWarehouseFilter}
                      options={[
                        { value: 'ALL', label: 'All Warehouses' },
                        ...allWarehouses.map((w) => ({
                          value: String(w.id),
                          label: w.is_default
                            ? `${w.name} (Default)`
                            : !w.is_active
                              ? `${w.name} (Inactive)`
                              : w.name,
                        })),
                      ]}
                    />
                  </div>
                </div>
              </div>

              {loading && !overview ? (
                <p className="text-xs text-sub">Loading inventory levels...</p>
              ) : products.length === 0 ? (
                <p className="text-xs text-sub">
                  No products found. Add products in the Products view to track stock.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b crm-border text-[11px] font-semibold uppercase text-sub crm-subtle">
                        <th className="py-2.5 px-3">Product &amp; SKU</th>
                        {visibleColumnsWarehouses.map((wh) => (
                          <th key={wh.id} className="py-2.5 px-3">
                            <div>{wh.name}</div>
                            {wh.is_default ? (
                              <span className="text-[9px] text-sub font-normal normal-case">
                                Default
                              </span>
                            ) : null}
                          </th>
                        ))}
                        <th className="py-2.5 px-3">Stock Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y crm-border text-xs">
                      {products.map((row) => (
                        <tr
                          key={row.product_id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-main">
                              {row.product_name}
                            </div>
                            {row.product_sku ? (
                              <div className="text-[11px] text-sub num-tabular">
                                {row.product_sku}
                              </div>
                            ) : null}
                          </td>
                          {visibleColumnsWarehouses.map((wh) => {
                            const cell = row.stocks_by_warehouse?.[String(wh.id)]
                            const qtyVal = Number(cell?.quantity_on_hand || 0)
                            const reorderVal = Number(cell?.reorder_level || 0)
                            const isLow = Boolean(cell?.is_low_stock)
                            return (
                              <td key={wh.id} className="py-2.5 px-3 num-tabular">
                                {rights.canUpdate && wh.is_active ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAdjustTarget({
                                        productId: row.product_id,
                                        warehouseId: wh.id,
                                      })
                                    }
                                    className="text-left hover:underline focus:outline-none"
                                  >
                                    <div
                                      className={`font-semibold ${
                                        isLow ? 'text-amber-600 dark:text-amber-400' : 'text-main'
                                      }`}
                                    >
                                      {qtyVal.toFixed(2).replace(/\.00$/, '')}
                                    </div>
                                    <div className="text-[10px] text-sub">
                                      Min: {reorderVal.toFixed(2).replace(/\.00$/, '')}
                                    </div>
                                  </button>
                                ) : (
                                  <div>
                                    <div className="font-semibold text-main">
                                      {qtyVal.toFixed(2).replace(/\.00$/, '')}
                                    </div>
                                    <div className="text-[10px] text-sub">
                                      Min: {reorderVal.toFixed(2).replace(/\.00$/, '')}
                                    </div>
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          <td className="py-2.5 px-3">
                            <span className={statusBadgeClass(row.stock_status)}>
                              {row.stock_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="lg:col-span-4 p-5 flex flex-col justify-between space-y-4">
              <form onSubmit={handleTransferSubmit} className="space-y-3.5">
                <div className="pb-3 border-b crm-border">
                  <h2 className="text-sm font-semibold text-main">
                    Transfer Warehouse Stock
                  </h2>
                  <p className="text-xs text-sub mt-0.5">
                    Move inventory between locations. Both source and destination changes are recorded in the Audit Log.
                  </p>
                </div>

                {activeWarehouses.length < 2 ? (
                  <p className="text-xs text-sub">
                    Add at least two active warehouses to transfer stock between locations.
                  </p>
                ) : !rights.canCreate ? (
                  <p className="text-xs text-sub">
                    Your role ({roleName}) does not have permission to create stock transfers.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-body">
                        Product
                      </label>
                      <Select
                        ariaLabel="Transfer product"
                        value={resolvedTransferProductId}
                        onChange={setTransferProductId}
                        options={products.map((p) => ({
                          value: String(p.product_id),
                          label: p.product_sku
                            ? `${p.product_name} (${p.product_sku})`
                            : p.product_name,
                        }))}
                        placeholder="Select product..."
                        disabled={transferBusy}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-body">
                          From Warehouse
                        </label>
                        <Select
                          ariaLabel="Source warehouse"
                          value={resolvedFromId}
                          onChange={setTransferFromId}
                          options={activeWarehouses.map((w) => {
                            const avail =
                              selectedTransferProduct?.stocks_by_warehouse?.[String(w.id)]
                                ?.quantity_on_hand ?? '0.00'
                            return {
                              value: String(w.id),
                              label: `${w.name} (${Number(avail).toFixed(0)})`,
                            }
                          })}
                          disabled={transferBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-body">
                          To Warehouse
                        </label>
                        <Select
                          ariaLabel="Destination warehouse"
                          value={resolvedToId}
                          onChange={setTransferToId}
                          options={activeWarehouses.map((w) => ({
                            value: String(w.id),
                            label: w.name,
                          }))}
                          disabled={transferBusy}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="transfer-qty-input"
                          className="block text-xs font-medium text-body"
                        >
                          Quantity to Transfer
                        </label>
                        <span className="text-[11px] text-sub num-tabular">
                          Available: {sourceAvailableQty.toFixed(2).replace(/\.00$/, '')}
                        </span>
                      </div>
                      <input
                        id="transfer-qty-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        disabled={transferBusy}
                        className="crm-input w-full px-3 py-2 text-xs num-tabular"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="transfer-notes-input"
                        className="block text-xs font-medium text-body"
                      >
                        Notes (optional)
                      </label>
                      <input
                        id="transfer-notes-input"
                        type="text"
                        value={transferNotes}
                        onChange={(e) => setTransferNotes(e.target.value)}
                        placeholder="e.g. Regional restock"
                        disabled={transferBusy}
                        className="crm-input w-full px-3 py-2 text-xs"
                      />
                    </div>

                    <FeedbackNotice tone="danger" message={transferError} />

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={transferBusy || products.length === 0}
                      className="w-full py-2 px-3 text-xs font-semibold"
                    >
                      {transferBusy ? 'Transferring...' : 'Complete Stock Transfer'}
                    </Button>
                  </>
                )}
              </form>

              <div className="pt-3 border-t crm-border text-[11px] text-sub">
                Transfers cannot exceed the available quantity on hand in the source warehouse.
              </div>
            </Card>
          </div>

          <Card className="p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-main">Recent Stock Transfers</h2>
              <p className="text-xs text-sub mt-0.5">
                Every transfer names the person who completed it and records both warehouse updates in the Audit Log.
              </p>
            </div>
            {transfers.length === 0 ? (
              <p className="text-xs text-sub">No stock transfers recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b crm-border text-[11px] font-semibold uppercase text-sub crm-subtle">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">From</th>
                      <th className="py-2 px-3">To</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3">Transferred By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y crm-border text-xs">
                    {transfers.map((tr) => (
                      <tr key={tr.id}>
                        <td className="py-2 px-3 text-sub num-tabular whitespace-nowrap">
                          {formatDateTime(tr.created_at, userTz)}
                        </td>
                        <td className="py-2 px-3 font-medium text-main">
                          {tr.product_name}
                          {tr.product_sku ? (
                            <span className="text-[11px] text-sub ml-1 num-tabular">
                              ({tr.product_sku})
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 px-3 text-body">{tr.from_warehouse_name}</td>
                        <td className="py-2 px-3 text-body">{tr.to_warehouse_name}</td>
                        <td className="py-2 px-3 text-right font-semibold text-main num-tabular">
                          {Number(tr.quantity).toFixed(2).replace(/\.00$/, '')}
                        </td>
                        <td className="py-2 px-3 text-sub">{tr.transferred_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}

      <WarehouseManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        workspaceSlug={workspaceSlug}
        warehouses={allWarehouses}
        rights={rights}
        onChanged={async () => {
          setReloadTick((t) => t + 1)
          onAuditRecorded?.()
          onInventoryMutated?.()
        }}
        onSessionExpired={onSessionExpired}
      />

      <StockAdjustModal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        workspaceSlug={workspaceSlug}
        products={products}
        warehouses={allWarehouses}
        initialProductId={adjustTarget?.productId || ''}
        initialWarehouseId={adjustTarget?.warehouseId || ''}
        onSaved={async (msg) => {
          setActionNotice(msg || 'Stock level updated.')
          setReloadTick((t) => t + 1)
          onAuditRecorded?.()
          onInventoryMutated?.()
        }}
        onSessionExpired={onSessionExpired}
      />
    </section>
  )
}
