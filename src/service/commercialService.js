import { apiDelete, apiGet, apiPatch, apiPost } from '../utils/api.js'
import { fetchWorkspaceLookupCached } from '../utils/clientCache.js'
import { getStageBadgeClass, getStageColor } from './crmService.js'

export const getStatusBadgeClass = getStageBadgeClass
export const getStatusColor = getStageColor

export const INVOICE_STATUS_CATEGORY_LABELS = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  void: 'Void',
}

export function fetchWorkspaceInvoiceStatuses(slug, { force = false } = {}) {
  return fetchWorkspaceLookupCached(
    slug,
    'invoiceStatuses',
    () => apiGet(`/api/v1/workspaces/${encodeURIComponent(slug)}/invoice-statuses/`),
    { force },
  )
}

export function createInvoiceStatus(slug, payload) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/invoice-statuses/`,
    payload,
  )
}

export function updateInvoiceStatus(slug, statusId, payload) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/invoice-statuses/${statusId}/`,
    payload,
  )
}

export function reorderInvoiceStatuses(slug, statusIds) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/invoice-statuses/reorder/`,
    { status_ids: statusIds },
  )
}

export function removeInvoiceStatus(slug, statusId, replacementStatusId = null) {
  const path = `/api/v1/workspaces/${encodeURIComponent(slug)}/invoice-statuses/${statusId}/`
  return replacementStatusId
    ? apiDelete(path, { replacement_status_id: Number(replacementStatusId) })
    : apiDelete(path)
}

export function issueInvoiceRecord(slug, invoiceId) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/invoice/${invoiceId}/issue/`,
    {},
  )
}

export function voidInvoiceRecord(slug, invoiceId) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/invoice/${invoiceId}/void/`,
    {},
  )
}

export function getInvoicePdfUrl(slug, invoiceId, { disposition = 'attachment' } = {}) {
  const qs = disposition === 'inline' ? '?disposition=inline' : ''
  return `/api/v1/workspaces/${encodeURIComponent(slug)}/records/invoice/${invoiceId}/pdf/${qs}`
}

export function createDraftInvoiceFromDeal(slug, dealId, payload = {}) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/deal/${dealId}/create-invoice/`,
    payload,
  )
}

export function createJobFromDeal(slug, dealId, payload = {}) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/deal/${dealId}/create-job/`,
    payload,
  )
}

export const CONTRACT_STATUSES = ['Draft', 'Active', 'Expired', 'Terminated']

export function getContractStatusBadgeClass(status) {
  switch (status) {
    case 'Active':
      return 'badge badge-success'
    case 'Expired':
      return 'badge badge-warn'
    case 'Terminated':
      return 'badge badge-danger'
    default:
      return 'badge badge-neutral'
  }
}

export function getContractStatusColor(status) {
  switch (status) {
    case 'Active':
      return '#10b981'
    case 'Expired':
      return '#f59e0b'
    case 'Terminated':
      return '#ef4444'
    default:
      return '#64748b'
  }
}

export function createContractFromDeal(slug, dealId, payload = {}) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/deal/${dealId}/create-contract/`,
    payload,
  )
}

export const SUBSCRIPTION_INTERVALS = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

export const SUBSCRIPTION_STATUSES = ['Active', 'Paused', 'Cancelled']

export function getSubscriptionIntervalLabel(interval) {
  return SUBSCRIPTION_INTERVALS.find((item) => item.value === interval)?.label || interval
}

export function getSubscriptionStatusBadgeClass(status) {
  switch (status) {
    case 'Active':
      return 'badge badge-success'
    case 'Paused':
      return 'badge badge-warn'
    case 'Cancelled':
      return 'badge badge-danger'
    default:
      return 'badge badge-neutral'
  }
}

export function getSubscriptionIntervalColor(interval) {
  switch (interval) {
    case 'week':
      return '#14b8a6'
    case 'year':
      return '#6366f1'
    default:
      return '#3b82f6'
  }
}

function subscriptionsBase(slug) {
  return `/api/v1/workspaces/${encodeURIComponent(slug)}/customer-subscriptions/`
}

export function listCustomerSubscriptions(slug, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value))
  })
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet(`${subscriptionsBase(slug)}${suffix}`)
}

export function getCustomerSubscription(slug, subscriptionId) {
  return apiGet(`${subscriptionsBase(slug)}${subscriptionId}/`)
}

export function createCustomerSubscription(slug, payload) {
  return apiPost(subscriptionsBase(slug), payload)
}

export function updateCustomerSubscription(slug, subscriptionId, payload) {
  return apiPatch(`${subscriptionsBase(slug)}${subscriptionId}/`, payload)
}

export function deleteCustomerSubscription(slug, subscriptionId) {
  return apiDelete(`${subscriptionsBase(slug)}${subscriptionId}/`)
}

export function generateSubscriptionDraftInvoice(slug, subscriptionId, payload = {}) {
  return apiPost(`${subscriptionsBase(slug)}${subscriptionId}/generate-invoice/`, payload)
}

export function runDueSubscriptionIntervals(slug, payload = {}) {
  return apiPost(`${subscriptionsBase(slug)}run-due/`, payload)
}

export function setInvoiceLineWarehouse(slug, invoiceId, lineId, warehouseId) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/invoice/${invoiceId}/lines/${lineId}/warehouse/`,
    { warehouse_id: Number(warehouseId) },
  )
}

export function buildSubscriptionForm(record = null, defaults = {}) {
  if (!record) {
    return {
      account_id: '',
      product_id: '',
      quantity: '1',
      amount: '',
      interval: 'month',
      status: 'Active',
      next_billing_date: new Date().toISOString().slice(0, 10),
      warehouse_id: defaults.warehouse_id || '',
      notes: '',
      visibility: 'workspace',
      shared_role_id: '',
      generate_first_invoice: false,
    }
  }
  return {
    account_id: record.account_id ? String(record.account_id) : '',
    product_id: record.product_id ? String(record.product_id) : '',
    quantity: String(Number(record.quantity || 1)),
    amount: String(record.amount ?? ''),
    interval: record.interval || 'month',
    status: record.status || 'Active',
    next_billing_date: record.next_billing_date || '',
    warehouse_id: record.warehouse_id ? String(record.warehouse_id) : '',
    notes: record.notes || '',
    visibility: record.visibility || 'workspace',
    shared_role_id: record.shared_role_id ? String(record.shared_role_id) : '',
    generate_first_invoice: false,
  }
}

export function buildSubscriptionPayload(form, { includeFirstInvoice = false } = {}) {
  const payload = {
    account_id: form.account_id ? Number(form.account_id) : null,
    product_id: form.product_id ? Number(form.product_id) : null,
    quantity: form.quantity,
    interval: form.interval,
    status: form.status,
    next_billing_date: form.next_billing_date,
    notes: form.notes,
    visibility: form.visibility,
    shared_role_id:
      form.visibility === 'role' && form.shared_role_id ? Number(form.shared_role_id) : null,
  }
  if (form.amount !== '') payload.amount = form.amount
  if (form.warehouse_id !== undefined) {
    payload.warehouse_id = form.warehouse_id ? Number(form.warehouse_id) : null
  }
  if (includeFirstInvoice && form.generate_first_invoice) payload.generate_first_invoice = true
  return payload
}
