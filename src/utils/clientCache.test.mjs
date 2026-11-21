import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import {
  apiGet,
  apiPatch,
  apiPost,
  fetchAuthSession,
  fetchBusinessTypesCatalog,
  fetchWorkspaceDetail,
} from './api.js'
import {
  fetchCrmOptions,
  fetchDashboardSummary,
  fetchWorkspacePacks,
  fetchWorkspacePipeline,
} from '../service/crmService.js'
import {
  clearWorkspaceClientCaches,
  resetAllClientCachesForTests,
  setActiveWorkspaceScope,
} from './clientCache.js'

class FakeBroadcastChannel {
  static instances = new Set()

  constructor(name) {
    this.name = name
    this.listeners = new Set()
    FakeBroadcastChannel.instances.add(this)
  }

  addEventListener(type, fn) {
    if (type === 'message') this.listeners.add(fn)
  }

  removeEventListener(type, fn) {
    if (type === 'message') this.listeners.delete(fn)
  }

  postMessage(data) {
    for (const peer of FakeBroadcastChannel.instances) {
      if (peer === this || peer.name !== this.name) continue
      for (const listener of peer.listeners) {
        listener({ data })
      }
    }
  }

  close() {
    FakeBroadcastChannel.instances.delete(this)
  }
}

function makeJsonResponse(data, { status = 200, headers = {} } = {}) {
  const headerMap = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  )
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headerMap.get(String(name).toLowerCase()) ?? null,
    },
    async json() {
      return data
    },
  }
}

beforeEach(() => {
  FakeBroadcastChannel.instances.clear()
  globalThis.BroadcastChannel = FakeBroadcastChannel
  globalThis.document = { cookie: 'csrftoken=test-csrf-token' }
  resetAllClientCachesForTests()
})

afterEach(() => {
  resetAllClientCachesForTests()
  delete globalThis.fetch
  delete globalThis.BroadcastChannel
  delete globalThis.document
})

test('deduplicates concurrent session, catalog, workspace, and options fetches', async () => {
  let calls = { session: 0, catalog: 0, ws: 0, options: 0 }
  globalThis.fetch = async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    if (url === '/api/v1/auth/session/') {
      calls.session += 1
      return makeJsonResponse({ authenticated: true, workspace: { slug: 'kora' } })
    }
    if (url === '/api/v1/catalog/business-types/') {
      calls.catalog += 1
      return makeJsonResponse({ business_types: [{ key: 'general_services' }] })
    }
    if (url === '/api/v1/workspaces/kora/') {
      calls.ws += 1
      return makeJsonResponse({ workspace: { slug: 'kora' }, permissions_version: 'v1' })
    }
    if (url === '/api/v1/workspaces/kora/crm/options/') {
      calls.options += 1
      return makeJsonResponse({ accounts: [{ id: 1, name: 'Accra Co' }] })
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  const [s1, s2] = await Promise.all([fetchAuthSession(), fetchAuthSession()])
  assert.equal(calls.session, 1)
  assert.equal(s1.data.workspace.slug, 'kora')
  assert.equal(s2.data.workspace.slug, 'kora')

  const [c1, c2] = await Promise.all([
    fetchBusinessTypesCatalog(),
    fetchBusinessTypesCatalog(),
  ])
  assert.equal(calls.catalog, 1)
  assert.equal(c1.data.business_types.length, 1)
  assert.equal(c2.data.business_types.length, 1)
  // Cached static catalog serves subsequent reads without fetch
  await fetchBusinessTypesCatalog()
  assert.equal(calls.catalog, 1)

  const [w1, w2] = await Promise.all([
    fetchWorkspaceDetail('kora'),
    fetchWorkspaceDetail('kora'),
  ])
  assert.equal(calls.ws, 1)
  assert.equal(w1.data.permissions_version, 'v1')
  assert.equal(w2.data.permissions_version, 'v1')

  const [o1, o2] = await Promise.all([
    fetchCrmOptions('kora'),
    fetchCrmOptions('kora'),
  ])
  assert.equal(calls.options, 1)
  assert.equal(o1.data.accounts[0].name, 'Accra Co')
  assert.equal(o2.data.accounts[0].name, 'Accra Co')
})

test('caches workspace lookups across pane navigation and invalidates on mutations and force refresh', async () => {
  let counts = { dashboard: 0, options: 0, packs: 0, pipelines: 0 }
  let accountNames = ['Initial Account']

  globalThis.fetch = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase()
    if (url === '/api/v1/workspaces/kora/dashboard/' && method === 'GET') {
      counts.dashboard += 1
      return makeJsonResponse({ total_records: accountNames.length })
    }
    if (url === '/api/v1/workspaces/kora/crm/options/' && method === 'GET') {
      counts.options += 1
      return makeJsonResponse({ accounts: accountNames.map((name, i) => ({ id: i + 1, name })) })
    }
    if (url === '/api/v1/workspaces/kora/packs/' && method === 'GET') {
      counts.packs += 1
      return makeJsonResponse({ active_table_count: 17 })
    }
    if (url === '/api/v1/workspaces/kora/pipelines/' && method === 'GET') {
      counts.pipelines += 1
      return makeJsonResponse({ stages: [{ id: 1, name: 'New' }] })
    }
    if (url === '/api/v1/workspaces/kora/records/deal/' && method === 'POST') {
      return makeJsonResponse({ record: { id: 99 } }, { status: 201 })
    }
    if (url === '/api/v1/workspaces/kora/records/account/' && method === 'POST') {
      accountNames = ['Initial Account', 'New Account']
      return makeJsonResponse({ record: { id: 2, name: 'New Account' } }, { status: 201 })
    }
    throw new Error(`Unexpected ${method} ${url}`)
  }

  // Initial loads
  await fetchDashboardSummary('kora')
  await fetchCrmOptions('kora')
  await fetchWorkspacePacks('kora')
  await fetchWorkspacePipeline('kora')
  assert.deepEqual(counts, { dashboard: 1, options: 1, packs: 1, pipelines: 1 })

  // Repeat reads hit in-memory cache
  await fetchDashboardSummary('kora')
  await fetchCrmOptions('kora')
  await fetchWorkspacePacks('kora')
  await fetchWorkspacePipeline('kora')
  assert.deepEqual(counts, { dashboard: 1, options: 1, packs: 1, pipelines: 1 })

  // Creating a Deal invalidates dashboard and packs, keeping options & pipelines warm
  await apiPost('/api/v1/workspaces/kora/records/deal/', { title: 'Deal 1' })
  await fetchDashboardSummary('kora')
  await fetchWorkspacePacks('kora')
  await fetchCrmOptions('kora')
  assert.deepEqual(counts, { dashboard: 2, options: 1, packs: 2, pipelines: 1 })

  // Creating an Account invalidates options as well
  await apiPost('/api/v1/workspaces/kora/records/account/', { name: 'New Account' })
  const refreshedOptions = await fetchCrmOptions('kora')
  assert.equal(counts.options, 2)
  assert.equal(refreshedOptions.data.accounts.length, 2)

  // Explicit force refresh bypasses cache
  await fetchDashboardSummary('kora', { force: true })
  assert.equal(counts.dashboard, 3)
})

test('clears client caches on workspace switch, logout, 401, permissions update, and cross-tab broadcast', async () => {
  let optionsCallsA = 0
  let optionsCallsB = 0
  let permVer = 'perm-v1'

  globalThis.fetch = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase()
    if (url === '/api/v1/workspaces/ws-a/crm/options/') {
      optionsCallsA += 1
      return makeJsonResponse(
        { accounts: [{ id: 1, name: `Alpha-${optionsCallsA}` }] },
        { headers: { 'X-Permissions-Version': permVer } },
      )
    }
    if (url === '/api/v1/workspaces/ws-b/crm/options/') {
      optionsCallsB += 1
      return makeJsonResponse({ accounts: [{ id: 2, name: 'Beta' }] })
    }
    if (url === '/api/v1/workspaces/ws-a/ping/') {
      return makeJsonResponse(
        { ok: true },
        { headers: { 'X-Permissions-Version': permVer } },
      )
    }
    if (url === '/api/v1/logout/' && method === 'POST') {
      return makeJsonResponse({ ok: true })
    }
    if (url === '/api/v1/workspaces/ws-a/unauthorized/') {
      return makeJsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }
    if (url === '/api/v1/workspaces/ws-a/roles/1/' && method === 'PATCH') {
      return makeJsonResponse({ ok: true })
    }
    throw new Error(`Unexpected ${method} ${url}`)
  }

  // Warm ws-a cache
  const a1 = await fetchCrmOptions('ws-a')
  assert.equal(a1.data.accounts[0].name, 'Alpha-1')
  assert.equal(optionsCallsA, 1)

  // Switching to ws-b clears ws-a cache; switching back must re-fetch ws-a
  const b1 = await fetchCrmOptions('ws-b')
  assert.equal(b1.data.accounts[0].name, 'Beta')
  assert.equal(optionsCallsB, 1)

  const a2 = await fetchCrmOptions('ws-a')
  assert.equal(a2.data.accounts[0].name, 'Alpha-2')
  assert.equal(optionsCallsA, 2)

  // Permissions version bump invalidates ws-a cache automatically
  permVer = 'perm-v2'
  await apiGet('/api/v1/workspaces/ws-a/ping/')
  const a3 = await fetchCrmOptions('ws-a')
  assert.equal(a3.data.accounts[0].name, 'Alpha-3')
  assert.equal(optionsCallsA, 3)

  // Logout clears cache
  await apiPost('/api/v1/logout/')
  const a4 = await fetchCrmOptions('ws-a')
  assert.equal(a4.data.accounts[0].name, 'Alpha-4')
  assert.equal(optionsCallsA, 4)

  // 401 response clears cache
  await apiGet('/api/v1/workspaces/ws-a/unauthorized/')
  const a5 = await fetchCrmOptions('ws-a')
  assert.equal(a5.data.accounts[0].name, 'Alpha-5')
  assert.equal(optionsCallsA, 5)

  // Cross-tab BroadcastChannel invalidation and clear
  const remoteTab = new FakeBroadcastChannel('jojocrm-cache-sync')
  remoteTab.postMessage({ type: 'invalidate', slug: 'ws-a', domains: ['options'], senderId: 'tab-2' })
  const a6 = await fetchCrmOptions('ws-a')
  assert.equal(a6.data.accounts[0].name, 'Alpha-6')
  assert.equal(optionsCallsA, 6)

  remoteTab.postMessage({ type: 'clear', senderId: 'tab-2' })
  const a7 = await fetchCrmOptions('ws-a')
  assert.equal(a7.data.accounts[0].name, 'Alpha-7')
  assert.equal(optionsCallsA, 7)

  // Explicit scope change + helper
  setActiveWorkspaceScope('ws-b')
  clearWorkspaceClientCaches()
})

test('invalidates dashboard, packs, options, and invoiceStatuses on customer-subscriptions mutations', async () => {
  let dashboardCalls = 0
  let optionsCalls = 0
  globalThis.fetch = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase()
    if (url === '/api/v1/workspaces/ws-sub/dashboard/') {
      dashboardCalls += 1
      return makeJsonResponse({ total_records: dashboardCalls })
    }
    if (url === '/api/v1/workspaces/ws-sub/crm/options/') {
      optionsCalls += 1
      return makeJsonResponse({ accounts: [{ id: optionsCalls, name: `Acc-${optionsCalls}` }] })
    }
    if (url === '/api/v1/workspaces/ws-sub/customer-subscriptions/' && method === 'POST') {
      return makeJsonResponse({ record: { id: 1 } }, { status: 201 })
    }
    throw new Error(`Unexpected ${method} ${url}`)
  }

  await fetchDashboardSummary('ws-sub')
  await fetchCrmOptions('ws-sub')
  assert.equal(dashboardCalls, 1)
  assert.equal(optionsCalls, 1)

  await apiPost('/api/v1/workspaces/ws-sub/customer-subscriptions/', { account_id: 1 })
  await fetchDashboardSummary('ws-sub')
  await fetchCrmOptions('ws-sub')
  assert.equal(dashboardCalls, 2)
  assert.equal(optionsCalls, 2)
})

test('prevents delayed in-flight response from old workspace polluting cache after switch', async () => {
  let resolveSlowFetch
  let callCount = 0
  globalThis.fetch = async (url) => {
    if (url === '/api/v1/workspaces/ws-old/crm/options/') {
      callCount += 1
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveSlowFetch = resolve
        })
      }
      return makeJsonResponse({ accounts: [{ id: 9, name: 'Fresh Old' }] })
    }
    if (url === '/api/v1/workspaces/ws-new/crm/options/') {
      return makeJsonResponse({ accounts: [{ id: 2, name: 'New Ws' }] })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const slowPromise = fetchCrmOptions('ws-old')
  await fetchCrmOptions('ws-new')
  resolveSlowFetch(makeJsonResponse({ accounts: [{ id: 1, name: 'Stale Old' }] }))
  await slowPromise

  // Switching back to ws-old must NOT serve the stale response from the superseded flight
  const freshOld = await fetchCrmOptions('ws-old')
  assert.equal(freshOld.data.accounts[0].name, 'Fresh Old')
  assert.equal(callCount, 2)
})
