import { apiDelete, apiGet, apiPatch, apiPost } from '../utils/api.js'

export function getObjectRights(permissions, objectKey) {
  if (permissions?.is_owner) {
    return {
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    }
  }
  const entry = permissions?.object_rights?.[objectKey]
  if (!entry) {
    return {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    }
  }
  return {
    canCreate: Boolean(entry.create),
    canRead: Boolean(entry.read),
    canUpdate: Boolean(entry.update),
    canDelete: Boolean(entry.delete),
  }
}

export function fetchDashboardSummary(slug) {
  return apiGet(`/api/v1/workspaces/${encodeURIComponent(slug)}/dashboard/`)
}

export function fetchCrmOptions(slug) {
  return apiGet(`/api/v1/workspaces/${encodeURIComponent(slug)}/crm/options/`)
}

export function listCrmRecords(slug, objectKey, params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  const basePath = `/api/v1/workspaces/${encodeURIComponent(slug)}/records/${encodeURIComponent(objectKey)}/`
  return apiGet(qs ? `${basePath}?${qs}` : basePath)
}

export function getCrmRecord(slug, objectKey, recordId) {
  return apiGet(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/${encodeURIComponent(objectKey)}/${recordId}/`,
  )
}

export function createCrmRecord(slug, objectKey, payload) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/${encodeURIComponent(objectKey)}/`,
    payload,
  )
}

export function updateCrmRecord(slug, objectKey, recordId, payload) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/${encodeURIComponent(objectKey)}/${recordId}/`,
    payload,
  )
}

export function deleteCrmRecord(slug, objectKey, recordId) {
  return apiDelete(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/${encodeURIComponent(objectKey)}/${recordId}/`,
  )
}

export function createRecordActivity(slug, objectKey, recordId, payload) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/${encodeURIComponent(objectKey)}/${recordId}/activities/`,
    payload,
  )
}

export function updateWorkspaceRole(slug, roleId, payload) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/roles/${roleId}/`,
    payload,
  )
}
