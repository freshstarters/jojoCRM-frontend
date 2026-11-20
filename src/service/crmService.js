import { apiDelete, apiGet, apiPatch, apiPost } from '../utils/api.js'

const STAGE_TONE_BADGES = {
  neutral: 'badge badge-neutral',
  info: 'badge badge-info',
  indigo: 'badge badge-indigo',
  violet: 'badge badge-violet',
  teal: 'badge badge-teal',
  success: 'badge badge-success',
  warn: 'badge badge-warn',
  orange: 'badge badge-orange',
  danger: 'badge badge-danger',
  pink: 'badge badge-pink',
}

const STAGE_TONE_COLORS = {
  neutral: '#64748b',
  info: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  teal: '#14b8a6',
  success: '#10b981',
  warn: '#f59e0b',
  orange: '#f97316',
  danger: '#f43f5e',
  pink: '#ec4899',
}

const STARTER_STAGE_TONE_FALLBACK = {
  new: 'neutral',
  qualified: 'info',
  proposal: 'warn',
  won: 'success',
  lost: 'danger',
}

export function resolveStageTone(tone, stageName = '') {
  if (tone && STAGE_TONE_BADGES[tone]) {
    return tone
  }
  const normalized = String(stageName || '').trim().toLowerCase()
  return STARTER_STAGE_TONE_FALLBACK[normalized] || 'neutral'
}

export function getStageBadgeClass(tone, stageName = '') {
  const resolved = resolveStageTone(tone, stageName)
  return STAGE_TONE_BADGES[resolved] || 'badge badge-neutral'
}

export function getStageColor(tone, stageName = '') {
  const resolved = resolveStageTone(tone, stageName)
  return STAGE_TONE_COLORS[resolved] || '#3b82f6'
}

export function canUserManageSalesSettings(permissions) {
  if (!permissions) return false
  if (permissions.can_manage_sales_settings !== undefined) {
    return Boolean(permissions.can_manage_sales_settings)
  }
  return Boolean(
    permissions.is_owner ||
      permissions.switches?.theme_and_layouts ||
      permissions.switches?.users_and_roles,
  )
}

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

export function getFieldRights(permissions, objectKey) {
  if (permissions?.is_owner) {
    return {}
  }
  return permissions?.field_rights?.[objectKey] || {}
}

export function getFieldLevel(fieldRights, fieldKey) {
  return fieldRights?.[fieldKey] || 'editable'
}

export function isFieldHidden(fieldRights, fieldKey) {
  return getFieldLevel(fieldRights, fieldKey) === 'hidden'
}

export function isFieldReadOnly(fieldRights, fieldKey) {
  return getFieldLevel(fieldRights, fieldKey) === 'read_only'
}

export function isFieldEditable(fieldRights, fieldKey) {
  return getFieldLevel(fieldRights, fieldKey) === 'editable'
}

export function filterWritablePayload(rawPayload, fieldRights, payloadToFieldMap = {}) {
  const filtered = {}
  for (const [payloadKey, value] of Object.entries(rawPayload || {})) {
    const fieldKey = payloadToFieldMap[payloadKey] || payloadKey
    if (isFieldEditable(fieldRights, fieldKey)) {
      filtered[payloadKey] = value
    }
  }
  return filtered
}

export function canUserConvertLead(permissions, workspace) {
  const enabledKeys = workspace?.enabled_object_keys || []
  const conversionEnabled =
    enabledKeys.includes('lead') &&
    enabledKeys.includes('deal') &&
    enabledKeys.includes('account') &&
    enabledKeys.includes('contact')
  if (!conversionEnabled) {
    return { conversionEnabled: false, canConvert: false }
  }
  const leadRights = getObjectRights(permissions, 'lead')
  const dealRights = getObjectRights(permissions, 'deal')
  const accountRights = getObjectRights(permissions, 'account')
  const contactRights = getObjectRights(permissions, 'contact')
  const canConvert = Boolean(
    leadRights.canRead &&
      leadRights.canUpdate &&
      dealRights.canCreate &&
      (accountRights.canCreate || accountRights.canRead) &&
      (contactRights.canCreate || contactRights.canRead),
  )
  return { conversionEnabled: true, canConvert }
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

export function fetchLeadConversionPreview(slug, leadId) {
  return apiGet(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/lead/${leadId}/conversion-preview/`,
  )
}

export function convertLeadRecord(slug, leadId, payload = {}) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/records/lead/${leadId}/convert/`,
    payload,
  )
}

export function updateWorkspaceRole(slug, roleId, payload) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/roles/${roleId}/`,
    payload,
  )
}

export function cloneWorkspaceRole(slug, payload) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/roles/`,
    payload,
  )
}

export function deleteWorkspaceRole(slug, roleId) {
  return apiDelete(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/roles/${roleId}/`,
  )
}

export function updateWorkspaceMemberRole(slug, memberId, roleId) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/members/${memberId}/`,
    { role_id: Number(roleId) },
  )
}

export function setAccountInitialPassword(newPassword) {
  return apiPost('/api/v1/account/password/set/', {
    new_password: newPassword,
  })
}

export function renamePasskeyCredential(passkeyId, name) {
  return apiPatch(`/api/v1/auth/passkey/${passkeyId}/`, { name })
}

export function fetchWorkspacePipeline(slug) {
  return apiGet(`/api/v1/workspaces/${encodeURIComponent(slug)}/pipelines/`)
}

export function updateWorkspacePipeline(slug, payload) {
  return apiPatch(`/api/v1/workspaces/${encodeURIComponent(slug)}/pipelines/`, payload)
}

export function createPipelineStage(slug, payload) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/pipelines/stages/`,
    payload,
  )
}

export function updatePipelineStage(slug, stageId, payload) {
  return apiPatch(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/pipelines/stages/${stageId}/`,
    payload,
  )
}

export function reorderPipelineStages(slug, stageIds) {
  return apiPost(
    `/api/v1/workspaces/${encodeURIComponent(slug)}/pipelines/stages/reorder/`,
    { stage_ids: stageIds },
  )
}

export function removePipelineStage(slug, stageId, moveToStageId = null) {
  const path = `/api/v1/workspaces/${encodeURIComponent(slug)}/pipelines/stages/${stageId}/`
  return moveToStageId
    ? apiDelete(path, { move_to_stage_id: Number(moveToStageId) })
    : apiDelete(path)
}

export function fetchDealsBoard(slug, params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  const basePath = `/api/v1/workspaces/${encodeURIComponent(slug)}/deals/board/`
  return apiGet(qs ? `${basePath}?${qs}` : basePath)
}
