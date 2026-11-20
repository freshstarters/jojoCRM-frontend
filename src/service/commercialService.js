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
