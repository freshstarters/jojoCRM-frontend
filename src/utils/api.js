import {
  clearWorkspaceClientCaches,
  deduplicateSessionRequest,
  deduplicateWorkspaceDetailRequest,
  getCachedStaticCatalog,
  invalidateClientCachesForMutation,
  syncClientPermissionsVersion,
} from './clientCache.js'

export function getCookie(name) {
  const cookieString = document.cookie || ''
  const parts = cookieString.split(';')
  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1))
    }
  }
  return ''
}

export async function ensureCsrfToken() {
  let csrfToken = getCookie('csrftoken')
  if (!csrfToken) {
    await fetch('/api/v1/csrf/', { credentials: 'same-origin' })
    csrfToken = getCookie('csrftoken')
  }
  return csrfToken
}

const permissionsVersionListeners = new Set()

export function subscribePermissionsVersion(listener) {
  if (typeof listener !== 'function') return () => {}
  permissionsVersionListeners.add(listener)
  return () => {
    permissionsVersionListeners.delete(listener)
  }
}

function notifyPermissionsVersion(version) {
  if (!version) return
  for (const listener of permissionsVersionListeners) {
    try {
      listener(version)
    } catch {
      // Ignore listener errors so API calls always complete cleanly.
    }
  }
}

async function requestJson(path, { method = 'GET', payload, includeCsrf = false } = {}) {
  const headers = {}
  if (includeCsrf) {
    const csrfToken = await ensureCsrfToken()
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken
    }
  }
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  })
  const headerPermVersion = response.headers?.get?.('X-Permissions-Version')
  if (headerPermVersion) {
    syncClientPermissionsVersion(headerPermVersion, { broadcast: true })
    notifyPermissionsVersion(headerPermVersion)
  }
  if (response.status === 401) {
    clearWorkspaceClientCaches({ broadcast: false })
  } else if (response.ok && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    invalidateClientCachesForMutation(path, method)
  }
  const data = await response.json().catch(() => ({}))
  return { response, data }
}

export function apiGet(path) {
  return requestJson(path, { method: 'GET' })
}

export function apiPost(path, payload = {}) {
  return requestJson(path, { method: 'POST', payload, includeCsrf: true })
}

export function apiPatch(path, payload = {}) {
  return requestJson(path, { method: 'PATCH', payload, includeCsrf: true })
}

export function apiPut(path, payload = {}) {
  return requestJson(path, { method: 'PUT', payload, includeCsrf: true })
}

export function apiDelete(path, payload = undefined) {
  return requestJson(path, {
    method: 'DELETE',
    ...(payload !== undefined ? { payload } : {}),
    includeCsrf: true,
  })
}

export function fetchAuthSession() {
  return deduplicateSessionRequest(() => apiGet('/api/v1/auth/session/'))
}

export function fetchBusinessTypesCatalog() {
  return getCachedStaticCatalog(() => apiGet('/api/v1/catalog/business-types/'))
}

export function fetchWorkspaceDetail(slug) {
  return deduplicateWorkspaceDetailRequest(slug, () =>
    apiGet(`/api/v1/workspaces/${encodeURIComponent(slug)}/`),
  )
}
