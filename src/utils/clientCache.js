const CACHE_CHANNEL_NAME = 'jojocrm-cache-sync'

export const WORKSPACE_CACHE_TTLS = {
  dashboard: 15_000,
  options: 30_000,
  packs: 30_000,
  pipelines: 30_000,
  invoiceStatuses: 30_000,
}

const ALL_LOOKUP_DOMAINS = ['dashboard', 'options', 'packs', 'pipelines', 'invoiceStatuses']

const tabInstanceId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

let activeWorkspaceSlug = ''
let sessionGeneration = 1
let workspaceGeneration = 1
let lastObservedPermissionsVersion = ''

let inflightSessionPromise = null
let inflightCatalogPromise = null
let cachedStaticCatalog = null

const inflightWorkspaceDetail = new Map()
const inflightWorkspaceLookups = new Map()
const workspaceLookupCache = new Map()
const domainGenerations = new Map()

let syncChannel = null

function clonePayload(data) {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data)
    } catch {
      return data
    }
  }
  return data
}

function getDomainGeneration(slug, domain) {
  return domainGenerations.get(`${slug}:${domain}`) || 1
}

function bumpDomainGeneration(slug, domain) {
  const key = `${slug}:${domain}`
  domainGenerations.set(key, (domainGenerations.get(key) || 1) + 1)
}

function ensureSyncChannel() {
  if (syncChannel !== null) {
    return syncChannel
  }
  if (typeof BroadcastChannel !== 'function') {
    syncChannel = undefined
    return undefined
  }
  try {
    const channel = new BroadcastChannel(CACHE_CHANNEL_NAME)
    channel.addEventListener('message', (event) => {
      const msg = event?.data
      if (!msg || typeof msg !== 'object' || msg.senderId === tabInstanceId) {
        return
      }
      if (msg.type === 'clear') {
        clearWorkspaceClientCaches({ broadcast: false })
      } else if (msg.type === 'invalidate' && msg.slug) {
        invalidateWorkspaceClientCache(
          msg.slug,
          Array.isArray(msg.domains) ? msg.domains : ALL_LOOKUP_DOMAINS,
          { broadcast: false },
        )
      } else if (msg.type === 'permissions_version' && msg.version) {
        syncClientPermissionsVersion(msg.version, { broadcast: false })
      }
    })
    syncChannel = channel
    return syncChannel
  } catch {
    syncChannel = undefined
    return undefined
  }
}

function postSyncMessage(message) {
  const channel = ensureSyncChannel()
  if (!channel) return
  try {
    channel.postMessage({ ...message, senderId: tabInstanceId })
  } catch {
    // Ignore closed/unsupported BroadcastChannel errors
  }
}

export function setActiveWorkspaceScope(nextSlug) {
  const normalized = String(nextSlug || '').trim()
  if (normalized === activeWorkspaceSlug) {
    return
  }
  activeWorkspaceSlug = normalized
  workspaceGeneration += 1
  lastObservedPermissionsVersion = ''
  workspaceLookupCache.clear()
  inflightWorkspaceLookups.clear()
  inflightWorkspaceDetail.clear()
}

export function clearWorkspaceClientCaches({ broadcast = false } = {}) {
  sessionGeneration += 1
  workspaceGeneration += 1
  activeWorkspaceSlug = ''
  lastObservedPermissionsVersion = ''
  inflightSessionPromise = null
  inflightWorkspaceDetail.clear()
  inflightWorkspaceLookups.clear()
  workspaceLookupCache.clear()
  domainGenerations.clear()
  if (broadcast) {
    postSyncMessage({ type: 'clear' })
  }
}

export function invalidateWorkspaceClientCache(
  slug,
  domains = ALL_LOOKUP_DOMAINS,
  { broadcast = false } = {},
) {
  const normalizedSlug = String(slug || '').trim()
  if (!normalizedSlug) return
  const targetDomains = Array.isArray(domains) && domains.length > 0 ? domains : ALL_LOOKUP_DOMAINS

  for (const domain of targetDomains) {
    const cacheKey = `${normalizedSlug}:${domain}`
    workspaceLookupCache.delete(cacheKey)
    inflightWorkspaceLookups.delete(cacheKey)
    bumpDomainGeneration(normalizedSlug, domain)
  }

  if (broadcast) {
    postSyncMessage({
      type: 'invalidate',
      slug: normalizedSlug,
      domains: targetDomains,
    })
  }
}

export function syncClientPermissionsVersion(version, { broadcast = false } = {}) {
  const cleanVersion = String(version || '').trim()
  if (!cleanVersion) return
  if (lastObservedPermissionsVersion && cleanVersion !== lastObservedPermissionsVersion) {
    if (activeWorkspaceSlug) {
      invalidateWorkspaceClientCache(activeWorkspaceSlug, ALL_LOOKUP_DOMAINS, {
        broadcast,
      })
    }
    if (broadcast) {
      postSyncMessage({ type: 'permissions_version', version: cleanVersion })
    }
  }
  lastObservedPermissionsVersion = cleanVersion
}

export function invalidateClientCachesForMutation(path, method) {
  const cleanMethod = String(method || '').toUpperCase()
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(cleanMethod)) {
    return
  }
  const cleanPath = String(path || '').split('?')[0]
  if (cleanPath === '/api/v1/logout/' || cleanPath === '/api/v1/logout') {
    clearWorkspaceClientCaches({ broadcast: true })
    return
  }

  const match = cleanPath.match(/^\/api\/v1\/workspaces\/([^/]+)(\/.*)?$/)
  if (!match) {
    return
  }

  let slug = match[1]
  try {
    slug = decodeURIComponent(match[1])
  } catch {
    // Keep raw segment if malformed
  }
  const subPath = match[2] || '/'

  let domains = ALL_LOOKUP_DOMAINS
  if (subPath.startsWith('/records/')) {
    const isLookupTarget =
      subPath.startsWith('/records/account') ||
      subPath.startsWith('/records/contact') ||
      subPath.startsWith('/records/product') ||
      subPath.includes('/convert')
    const isInvoiceRelated =
      subPath.startsWith('/records/invoice') ||
      subPath.startsWith('/records/payment') ||
      subPath.includes('/create-invoice')
    if (isLookupTarget) {
      domains = ['dashboard', 'packs', 'options']
    } else if (isInvoiceRelated) {
      domains = ['dashboard', 'packs', 'invoiceStatuses']
    } else {
      domains = ['dashboard', 'packs']
    }
  } else if (subPath.startsWith('/packs/') || subPath.startsWith('/tables/')) {
    domains = ['packs', 'options', 'dashboard', 'pipelines', 'invoiceStatuses']
  } else if (
    subPath.startsWith('/roles/') ||
    subPath.startsWith('/members/') ||
    subPath.startsWith('/invites/')
  ) {
    domains = ['options', 'dashboard', 'packs', 'pipelines', 'invoiceStatuses']
  } else if (subPath.startsWith('/pipelines/')) {
    domains = ['pipelines', 'options', 'dashboard']
  } else if (subPath.startsWith('/invoice-statuses/')) {
    domains = ['invoiceStatuses', 'options', 'dashboard']
  } else if (subPath.startsWith('/warehouses/')) {
    domains = ['options', 'packs', 'dashboard']
  } else if (subPath.startsWith('/inventory/')) {
    domains = ['packs', 'dashboard']
  } else if (subPath.startsWith('/customer-subscriptions/')) {
    domains = ['dashboard', 'packs', 'options', 'invoiceStatuses']
  } else if (subPath === '/' || subPath === '') {
    domains = ['options', 'packs', 'dashboard']
  }

  invalidateWorkspaceClientCache(slug, domains, { broadcast: true })
}

export function deduplicateSessionRequest(fetcher) {
  if (!inflightSessionPromise) {
    const startGen = sessionGeneration
    inflightSessionPromise = Promise.resolve()
      .then(() => fetcher())
      .finally(() => {
        if (startGen === sessionGeneration) {
          inflightSessionPromise = null
        }
      })
  }
  return inflightSessionPromise
}

export function getCachedStaticCatalog(fetcher) {
  if (cachedStaticCatalog?.response?.ok) {
    return Promise.resolve({
      response: cachedStaticCatalog.response,
      data: clonePayload(cachedStaticCatalog.data),
    })
  }
  if (!inflightCatalogPromise) {
    inflightCatalogPromise = Promise.resolve()
      .then(() => fetcher())
      .then((result) => {
        if (result?.response?.ok && Array.isArray(result?.data?.business_types)) {
          cachedStaticCatalog = result
        }
        return {
          response: result.response,
          data: clonePayload(result.data),
        }
      })
      .finally(() => {
        inflightCatalogPromise = null
      })
  }
  return inflightCatalogPromise
}

export function deduplicateWorkspaceDetailRequest(slug, fetcher) {
  const normalizedSlug = String(slug || '').trim()
  if (!normalizedSlug) {
    return fetcher()
  }
  setActiveWorkspaceScope(normalizedSlug)

  const existing = inflightWorkspaceDetail.get(normalizedSlug)
  if (existing) {
    return existing
  }

  const startSessionGen = sessionGeneration
  const startWorkspaceGen = workspaceGeneration
  const promise = Promise.resolve()
    .then(() => fetcher())
    .finally(() => {
      if (
        startSessionGen === sessionGeneration &&
        startWorkspaceGen === workspaceGeneration &&
        inflightWorkspaceDetail.get(normalizedSlug) === promise
      ) {
        inflightWorkspaceDetail.delete(normalizedSlug)
      }
    })

  inflightWorkspaceDetail.set(normalizedSlug, promise)
  return promise
}

export function fetchWorkspaceLookupCached(
  slug,
  domain,
  fetcher,
  { force = false, ttlMs } = {},
) {
  const normalizedSlug = String(slug || '').trim()
  if (!normalizedSlug) {
    return fetcher()
  }
  setActiveWorkspaceScope(normalizedSlug)

  const cacheKey = `${normalizedSlug}:${domain}`
  const effectiveTtl = ttlMs ?? WORKSPACE_CACHE_TTLS[domain] ?? 15_000
  const now = Date.now()

  if (!force) {
    const cached = workspaceLookupCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return Promise.resolve({
        response: cached.response,
        data: clonePayload(cached.data),
      })
    }
    const inflight = inflightWorkspaceLookups.get(cacheKey)
    if (inflight) {
      return inflight.then((result) => ({
        response: result.response,
        data: clonePayload(result.data),
      }))
    }
  } else {
    workspaceLookupCache.delete(cacheKey)
    inflightWorkspaceLookups.delete(cacheKey)
    bumpDomainGeneration(normalizedSlug, domain)
  }

  const startSessionGen = sessionGeneration
  const startWorkspaceGen = workspaceGeneration
  const startDomainGen = getDomainGeneration(normalizedSlug, domain)

  const promise = Promise.resolve()
    .then(() => fetcher())
    .then((result) => {
      const stillCurrent =
        startSessionGen === sessionGeneration &&
        startWorkspaceGen === workspaceGeneration &&
        startDomainGen === getDomainGeneration(normalizedSlug, domain) &&
        activeWorkspaceSlug === normalizedSlug

      if (stillCurrent && result?.response?.ok && result.data !== undefined) {
        workspaceLookupCache.set(cacheKey, {
          response: result.response,
          data: clonePayload(result.data),
          expiresAt: Date.now() + effectiveTtl,
        })
      }
      return {
        response: result.response,
        data: clonePayload(result.data),
      }
    })
    .finally(() => {
      if (inflightWorkspaceLookups.get(cacheKey) === promise) {
        inflightWorkspaceLookups.delete(cacheKey)
      }
    })

  inflightWorkspaceLookups.set(cacheKey, promise)
  return promise
}

export function resetAllClientCachesForTests() {
  cachedStaticCatalog = null
  inflightCatalogPromise = null
  clearWorkspaceClientCaches({ broadcast: false })
  if (syncChannel && typeof syncChannel.close === 'function') {
    try {
      syncChannel.close()
    } catch {
      // Ignore close error
    }
  }
  syncChannel = null
}
