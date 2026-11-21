import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../utils/api.js'

export function fetchWorkspaceWarehouses(slug, { includeInactive = true } = {}) {
  const qs = includeInactive ? '' : '?include_inactive=false'
  return apiGet(`/api/v1/workspaces/${encodeURIComponent(slug)}/warehouses/${qs}`)
}

export function createWorkspaceWarehouse(slug, payload) {
  return apiPost(`/api/v1/workspaces/${encodeURIComponent(slug)}/warehouses/`, payload)
}

export function updateWorkspaceWarehouse(slug, warehouseId, payload) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/warehouses/${warehouseId}/`,
    payload,
  )
}

export function deleteWorkspaceWarehouse(slug, warehouseId) {
  return apiDelete(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/warehouses/${warehouseId}/`,
  )
}

export function fetchWorkspaceInventoryOverview(
  slug,
  { warehouseId = '', q = '', lowStockOnly = false, includeInactive = false } = {},
) {
  const params = new URLSearchParams()
  if (warehouseId && warehouseId !== 'ALL') {
    params.set('warehouse_id', String(warehouseId))
  }
  if (q && q.trim()) {
    params.set('q', q.trim())
  }
  if (lowStockOnly) {
    params.set('low_stock_only', 'true')
  }
  if (includeInactive) {
    params.set('include_inactive', 'true')
  }
  const qs = params.toString()
  return apiGet(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/inventory/${qs ? `?${qs}` : ''}`,
  )
}

export function upsertInventoryStock(slug, payload) {
  return apiPut(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/inventory/stock/`,
    payload,
  )
}

export function fetchStockTransfers(
  slug,
  { page = 1, pageSize = 20, productId = '', warehouseId = '' } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (productId) params.set('product_id', String(productId))
  if (warehouseId && warehouseId !== 'ALL') params.set('warehouse_id', String(warehouseId))
  return apiGet(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/inventory/transfers/?${params.toString()}`,
  )
}

export function createStockTransfer(slug, payload) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/inventory/transfers/`,
    payload,
  )
}
