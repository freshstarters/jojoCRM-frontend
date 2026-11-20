export const CORE_OBJECT_KEYS = ['account', 'contact', 'activity', 'file', 'tag']

export const OBJECT_LABELS = {
  account: { label: 'Account', paneId: 'accounts' },
  contact: { label: 'Contact', paneId: 'contacts' },
  activity: { label: 'Activity', paneId: null },
  file: { label: 'File', paneId: null },
  tag: { label: 'Tag', paneId: null },
  lead: { label: 'Lead', paneId: 'leads' },
  deal: { label: 'Deal', paneId: 'deals' },
  product: { label: 'Product', paneId: 'products' },
  line_item: { label: 'Line item', paneId: null },
  invoice: { label: 'Invoice', paneId: 'invoicing', subtabId: 'invoices' },
  payment: { label: 'Payment', paneId: 'invoicing', subtabId: 'payments' },
  inventory: { label: 'Inventory', paneId: 'invoicing', subtabId: 'inventory' },
  campaign: { label: 'Campaign', paneId: 'campaigns' },
  contract: { label: 'Contract', paneId: 'contracts' },
  ticket: { label: 'Ticket', paneId: 'tickets' },
  customer_subscription: {
    label: 'Customer subscription',
    paneId: 'invoicing',
    subtabId: 'subscriptions',
  },
  job: { label: 'Job', paneId: 'jobs' },
  appointment: { label: 'Appointment', paneId: 'appointments' },
  supplier: { label: 'Supplier', paneId: 'suppliers' },
  purchase: { label: 'Purchase', paneId: 'purchases' },
  shipment: { label: 'Shipment', paneId: 'shipments' },
  vehicle: { label: 'Vehicle', paneId: 'vehicles' },
  property: { label: 'Property', paneId: 'properties' },
  booking: { label: 'Booking', paneId: 'bookings' },
  program: { label: 'Program', paneId: 'programs' },
  enrollment: { label: 'Enrollment', paneId: 'enrollments' },
  visit: { label: 'Visit', paneId: 'visits' },
  policy: { label: 'Policy', paneId: 'policies' },
  membership: { label: 'Membership', paneId: 'memberships' },
  asset: { label: 'Asset', paneId: 'assets' },
}

export function getActiveTableSummary(workspace) {
  const enabledList = Array.isArray(workspace?.enabled_object_keys)
    ? workspace.enabled_object_keys
    : CORE_OBJECT_KEYS
  const coreSet = new Set(CORE_OBJECT_KEYS)
  const contactLabel = workspace?.contact_label || 'Contact'

  const toEntry = (key) => {
    const meta = OBJECT_LABELS[key] || { label: key, paneId: null }
    return {
      key,
      label: key === 'contact' ? contactLabel : meta.label,
      paneId: meta.paneId || null,
      subtabId: meta.subtabId || '',
    }
  }

  return {
    coreTables: enabledList.filter((key) => coreSet.has(key)).map(toEntry),
    packTables: enabledList.filter((key) => !coreSet.has(key)).map(toEntry),
  }
}

export const BASE_SETTINGS_TABS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'packs', label: 'Packs' },
  { id: 'people', label: 'People' },
  { id: 'roles', label: 'Roles' },
  { id: 'security', label: 'Account & Security' },
]

export const SETTINGS_TABS = BASE_SETTINGS_TABS

export function getSettingsTabs(workspace) {
  const enabledList = Array.isArray(workspace?.enabled_object_keys)
    ? workspace.enabled_object_keys
    : []
  const hasDeal = enabledList.includes('deal')
  const hasInvoice = enabledList.includes('invoice')
  const tabs = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'packs', label: 'Packs' },
    { id: 'people', label: 'People' },
    { id: 'roles', label: 'Roles' },
  ]
  if (hasDeal) {
    tabs.push({ id: 'pipelines', label: 'Pipelines' })
  }
  if (hasInvoice) {
    tabs.push({ id: 'invoice-statuses', label: 'Invoice Statuses' })
  }
  tabs.push({ id: 'security', label: 'Account & Security' })
  return tabs
}

export const DEALS_SUBTABS = [
  { id: 'kanban', label: 'Board' },
  { id: 'list', label: 'Table' },
]

const INVOICING_OBJECT_KEYS = ['invoice', 'payment', 'inventory', 'customer_subscription']

function getInvoicingLabel(enabledKeys) {
  const hasInvoice = enabledKeys.has('invoice')
  const hasInventory = enabledKeys.has('inventory')
  const hasPayment = enabledKeys.has('payment')
  const hasSubscription = enabledKeys.has('customer_subscription')

  if (hasInvoice && hasInventory) return 'Invoicing & Stock'
  if (hasInvoice) return 'Invoices'
  if (hasInventory) return 'Inventory'
  if (hasSubscription) return 'Subscriptions'
  if (hasPayment) return 'Payments'
  return 'Invoicing & Stock'
}

function getInvoicingSubtabs(enabledKeys) {
  const tabs = []
  if (enabledKeys.has('invoice')) tabs.push({ id: 'invoices', label: 'Invoices' })
  if (enabledKeys.has('payment')) tabs.push({ id: 'payments', label: 'Payments' })
  if (enabledKeys.has('inventory')) tabs.push({ id: 'inventory', label: 'Inventory' })
  if (enabledKeys.has('customer_subscription')) {
    tabs.push({ id: 'subscriptions', label: 'Subscriptions' })
  }
  return tabs
}

export function buildSidebarGroups(workspace) {
  const enabledList = Array.isArray(workspace?.enabled_object_keys)
    ? workspace.enabled_object_keys
    : ['account', 'contact', 'activity', 'file', 'tag']
  const enabledKeys = new Set(enabledList)
  const contactPluralLabel = workspace?.contact_plural_label || 'Contacts'
  const invoicingSubtabs = getInvoicingSubtabs(enabledKeys)

  const groups = [
    {
      title: 'Core Workspace',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          objectKeys: [],
          enabled: true,
          subtabs: [],
        },
        {
          id: 'deals',
          label: 'Deals & Pipeline',
          objectKeys: ['deal'],
          enabled: enabledKeys.has('deal'),
          subtabs: DEALS_SUBTABS,
        },
        {
          id: 'invoicing',
          label: getInvoicingLabel(enabledKeys),
          objectKeys: INVOICING_OBJECT_KEYS,
          enabled: INVOICING_OBJECT_KEYS.some((key) => enabledKeys.has(key)),
          subtabs: invoicingSubtabs,
        },
      ],
    },
    {
      title: 'CRM Records',
      items: [
        { id: 'accounts', label: 'Accounts', objectKeys: ['account'], enabled: true, subtabs: [] },
        {
          id: 'contacts',
          label: contactPluralLabel,
          objectKeys: ['contact'],
          enabled: true,
          subtabs: [],
        },
        { id: 'leads', label: 'Leads', objectKeys: ['lead'], enabled: enabledKeys.has('lead'), subtabs: [] },
        {
          id: 'contracts',
          label: 'Contracts',
          objectKeys: ['contract'],
          enabled: enabledKeys.has('contract'),
          subtabs: [],
        },
        {
          id: 'products',
          label: 'Products',
          objectKeys: ['product'],
          enabled: enabledKeys.has('product'),
          subtabs: [],
        },
        {
          id: 'policies',
          label: 'Policies',
          objectKeys: ['policy'],
          enabled: enabledKeys.has('policy'),
          subtabs: [],
        },
        {
          id: 'memberships',
          label: 'Memberships',
          objectKeys: ['membership'],
          enabled: enabledKeys.has('membership'),
          subtabs: [],
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          id: 'tickets',
          label: 'Support Tickets',
          objectKeys: ['ticket'],
          enabled: enabledKeys.has('ticket'),
          subtabs: [],
        },
        { id: 'jobs', label: 'Jobs', objectKeys: ['job'], enabled: enabledKeys.has('job'), subtabs: [] },
        {
          id: 'appointments',
          label: 'Appointments',
          objectKeys: ['appointment'],
          enabled: enabledKeys.has('appointment'),
          subtabs: [],
        },
        {
          id: 'visits',
          label: 'Visits',
          objectKeys: ['visit'],
          enabled: enabledKeys.has('visit'),
          subtabs: [],
        },
        {
          id: 'bookings',
          label: 'Bookings',
          objectKeys: ['booking'],
          enabled: enabledKeys.has('booking'),
          subtabs: [],
        },
        {
          id: 'programs',
          label: 'Programs',
          objectKeys: ['program'],
          enabled: enabledKeys.has('program'),
          subtabs: [],
        },
        {
          id: 'enrollments',
          label: 'Enrollments',
          objectKeys: ['enrollment'],
          enabled: enabledKeys.has('enrollment'),
          subtabs: [],
        },
        {
          id: 'properties',
          label: 'Properties',
          objectKeys: ['property'],
          enabled: enabledKeys.has('property'),
          subtabs: [],
        },
        {
          id: 'vehicles',
          label: 'Vehicles',
          objectKeys: ['vehicle'],
          enabled: enabledKeys.has('vehicle'),
          subtabs: [],
        },
        {
          id: 'assets',
          label: 'Assets',
          objectKeys: ['asset'],
          enabled: enabledKeys.has('asset'),
          subtabs: [],
        },
      ],
    },
    {
      title: 'Supply',
      items: [
        {
          id: 'suppliers',
          label: 'Suppliers',
          objectKeys: ['supplier'],
          enabled: enabledKeys.has('supplier'),
          subtabs: [],
        },
        {
          id: 'purchases',
          label: 'Purchases',
          objectKeys: ['purchase'],
          enabled: enabledKeys.has('purchase'),
          subtabs: [],
        },
        {
          id: 'shipments',
          label: 'Shipments',
          objectKeys: ['shipment'],
          enabled: enabledKeys.has('shipment'),
          subtabs: [],
        },
      ],
    },
    {
      title: 'Platform',
      items: [
        {
          id: 'campaigns',
          label: 'Campaigns',
          objectKeys: ['campaign'],
          enabled: enabledKeys.has('campaign'),
          subtabs: [],
        },
        { id: 'automations', label: 'Automations', objectKeys: [], enabled: true, subtabs: [] },
        { id: 'custom-tables', label: 'Custom Tables', objectKeys: [], enabled: true, subtabs: [] },
        {
          id: 'settings',
          label: 'Settings',
          objectKeys: [],
          enabled: true,
          subtabs: getSettingsTabs(workspace),
        },
      ],
    },
  ]

  return groups.map((group) => ({
    ...group,
    visibleItems: group.items.filter((item) => item.enabled),
  }))
}

export function resolvePaneState(paneId, subtabId, workspace) {
  const normalizedPane = (paneId || 'dashboard').toLowerCase()
  const normalizedSubtab = (subtabId || '').toLowerCase()
  const groups = buildSidebarGroups(workspace)
  const allItems = groups.flatMap((group) => group.items)

  const aliasPane =
    normalizedPane === 'stock'
      ? 'invoicing'
      : normalizedPane === 'inspections'
        ? 'custom-tables'
        : normalizedPane

  const matchedItem = allItems.find((item) => item.id === aliasPane) || null
  if (!matchedItem) {
    return {
      status: 'unknown',
      paneId: aliasPane,
      item: null,
      subtab: '',
    }
  }

  if (!matchedItem.enabled) {
    return {
      status: 'disabled',
      paneId: matchedItem.id,
      item: matchedItem,
      subtab: '',
    }
  }

  const subtabs = matchedItem.subtabs || []
  let resolvedSubtab = ''
  if (subtabs.length > 0) {
    const matchedSubtab = subtabs.find((tab) => tab.id === normalizedSubtab)
    resolvedSubtab = matchedSubtab ? matchedSubtab.id : subtabs[0].id
  }

  return {
    status: 'active',
    paneId: matchedItem.id,
    item: matchedItem,
    subtab: resolvedSubtab,
  }
}

export const INSPECTABLE_OBJECT_PANES = {
  account: 'accounts',
  accounts: 'accounts',
  contact: 'contacts',
  contacts: 'contacts',
  lead: 'leads',
  leads: 'leads',
  deal: 'deals',
  deals: 'deals',
  product: 'products',
  products: 'products',
  invoice: 'invoicing',
  invoices: 'invoicing',
  payment: 'invoicing',
  payments: 'invoicing',
  job: 'jobs',
  jobs: 'jobs',
  appointment: 'appointments',
  appointments: 'appointments',
  visit: 'visits',
  visits: 'visits',
  ticket: 'tickets',
  tickets: 'tickets',
}

export function buildWorkspacePath(slug, paneId = 'dashboard', subtabId = '', options = {}) {
  if (!slug) return '/'
  const cleanPane = (paneId || 'dashboard').toLowerCase()
  const cleanSubtab = (subtabId || '').toLowerCase()
  let path = `/${encodeURIComponent(slug)}`
  if (cleanPane !== 'dashboard') {
    path = cleanSubtab
      ? `/${encodeURIComponent(slug)}/${encodeURIComponent(cleanPane)}/${encodeURIComponent(cleanSubtab)}`
      : `/${encodeURIComponent(slug)}/${encodeURIComponent(cleanPane)}`
  }
  const inspectVal = options?.inspect
  if (inspectVal !== undefined && inspectVal !== null && String(inspectVal).trim() !== '') {
    const params = new URLSearchParams()
    params.set('inspect', String(inspectVal).trim())
    return `${path}?${params.toString()}`
  }
  return path
}
