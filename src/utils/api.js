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
    notifyPermissionsVersion(headerPermVersion)
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

export function apiDelete(path, payload = undefined) {
  return requestJson(path, {
    method: 'DELETE',
    ...(payload !== undefined ? { payload } : {}),
    includeCsrf: true,
  })
}

let inflightSessionRequest = null
let inflightCatalogRequest = null
let cachedCatalogResponse = null

export function fetchAuthSession() {
  if (!inflightSessionRequest) {
    inflightSessionRequest = apiGet('/api/v1/auth/session/').finally(() => {
      inflightSessionRequest = null
    })
  }
  return inflightSessionRequest
}

export function fetchBusinessTypesCatalog() {
  if (cachedCatalogResponse?.response?.ok) {
    return Promise.resolve(cachedCatalogResponse)
  }
  if (!inflightCatalogRequest) {
    inflightCatalogRequest = apiGet('/api/v1/catalog/business-types/')
      .then((result) => {
        if (result?.response?.ok && Array.isArray(result?.data?.business_types)) {
          cachedCatalogResponse = result
        }
        return result
      })
      .finally(() => {
        inflightCatalogRequest = null
      })
  }
  return inflightCatalogRequest
}
