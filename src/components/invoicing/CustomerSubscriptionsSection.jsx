import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SUBSCRIPTION_INTERVALS,
  generateSubscriptionDraftInvoice,
  getCustomerSubscription,
  getSubscriptionIntervalColor,
  getSubscriptionIntervalLabel,
  getSubscriptionStatusBadgeClass,
  listCustomerSubscriptions,
  runDueSubscriptionIntervals,
} from '../../service/commercialService.js'
import { fetchCrmOptions, isFieldHidden } from '../../service/crmService.js'
import { formatDateOnly, formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { Card } from '../Card.jsx'
import { Select } from '../Select.jsx'
import { CrmListPage } from '../crm/CrmListPage.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'
import { CustomerSubscriptionFormModal } from './CustomerSubscriptionFormModal.jsx'
import { CustomerSubscriptionInspectorDrawer } from './CustomerSubscriptionInspectorDrawer.jsx'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Paused', label: 'Paused' },
  { value: 'Cancelled', label: 'Cancelled' },
]

const INTERVAL_FILTERS = [{ value: '', label: 'All intervals' }, ...SUBSCRIPTION_INTERVALS]

export function CustomerSubscriptionsSection({
  workspace,
  workspaceSlug,
  permissions: appPermissions = null,
  roleName = 'Staff',
  subtabsBar = null,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenInvoice,
  onOpenLinkedRecord,
  onAuditRecorded,
  onSessionExpired,
}) {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [options, setOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [intervalFilter, setIntervalFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [revision, setRevision] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [runBusy, setRunBusy] = useState(false)
  const [selected, setSelected] = useState(null)
  const [lastGeneratedInvoice, setLastGeneratedInvoice] = useState(null)

  const inventoryEnabled = Boolean(workspace?.enabled_object_keys?.includes('inventory'))
  const fieldRights = permissions.field_rights || {}
  const hideAccount = isFieldHidden(fieldRights, 'account')
  const hideProduct = isFieldHidden(fieldRights, 'product')
  const hideQuantity = isFieldHidden(fieldRights, 'quantity')
  const hideWarehouse = isFieldHidden(fieldRights, 'warehouse')
  const hideAmount = isFieldHidden(fieldRights, 'amount')
  const hideInterval = isFieldHidden(fieldRights, 'interval')
  const hideStatus = isFieldHidden(fieldRights, 'status')
  const hideNextBilling = isFieldHidden(fieldRights, 'next_billing_date')
  const canRead =
    permissions?.can_read !== false &&
    (Boolean(appPermissions?.is_owner) ||
      (appPermissions?.objects?.customer_subscription?.read ?? true))

  const reload = useCallback(() => setRevision((n) => n + 1), [])

  useEffect(() => {
    if (!workspaceSlug) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { response, data } = await listCustomerSubscriptions(workspaceSlug, {
          q: search.trim(),
          status: statusFilter,
          interval: intervalFilter,
          account_id: accountFilter,
        })
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(data?.error || data?.detail || 'Could not load customer subscriptions.')
          setRows([])
          return
        }
        setError('')
        setRows(data.results || [])
        setSummary(data.summary || null)
        setPermissions(data.permissions || {})
      } catch {
        if (!cancelled) setError('Network error while loading customer subscriptions.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [workspaceSlug, search, statusFilter, intervalFilter, accountFilter, revision, onSessionExpired])

  useEffect(() => {
    if (!workspaceSlug) return
    let cancelled = false
    fetchCrmOptions(workspaceSlug, { force: revision > 0 })
      .then(({ response, data }) => {
        if (!cancelled && response.ok) setOptions(data || {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [workspaceSlug, revision])

  const openInspector = useCallback(
    async (id, { syncUrl = true } = {}) => {
      if (!workspaceSlug || !id) return
      setError('')
      try {
        const { response, data } = await getCustomerSubscription(workspaceSlug, id)
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(data?.error || data?.detail || 'Could not open the subscription.')
          return
        }
        setSelected(data.record)
        if (syncUrl) onInspectRecord?.(id)
      } catch {
        setError('Network error while opening the subscription.')
      }
    },
    [workspaceSlug, onInspectRecord, onSessionExpired],
  )

  useEffect(() => {
    if (!workspaceSlug || !urlInspectRecordId) return undefined
    const targetId = Number(urlInspectRecordId)
    if (!Number.isFinite(targetId) || targetId < 1 || selected?.id === targetId) {
      return undefined
    }
    let cancelled = false
    getCustomerSubscription(workspaceSlug, targetId)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(data?.error || data?.detail || 'Could not open the subscription.')
          return
        }
        setSelected(data.record)
      })
      .catch(() => {
        if (!cancelled) setError('Network error while opening the subscription.')
      })
    return () => {
      cancelled = true
    }
  }, [workspaceSlug, urlInspectRecordId, selected?.id, onSessionExpired])

  async function handleGenerate(row) {
    setBusyId(row.id)
    setError('')
    setNotice('')
    setLastGeneratedInvoice(null)
    try {
      const { response, data } = await generateSubscriptionDraftInvoice(workspaceSlug, row.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || data?.detail || 'Could not generate the Draft invoice.')
        return
      }
      setNotice(data?.message || 'Draft invoice generated.')
      if (data?.invoice?.id) {
        setLastGeneratedInvoice(data.invoice)
      }
      onAuditRecorded?.()
      reload()
    } catch {
      setError('Network error while generating the Draft invoice.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRunDue() {
    setRunBusy(true)
    setError('')
    setNotice('')
    try {
      const { response, data } = await runDueSubscriptionIntervals(workspaceSlug)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || data?.detail || 'Could not run due intervals.')
        return
      }
      setNotice(data?.message || 'Due intervals processed.')
      onAuditRecorded?.()
      reload()
    } catch {
      setError('Network error while running due intervals.')
    } finally {
      setRunBusy(false)
    }
  }

  const intervalMix = useMemo(() => {
    const counts = summary?.interval_counts || {}
    const total = SUBSCRIPTION_INTERVALS.reduce((sum, item) => sum + Number(counts[item.value] || 0), 0)
    return SUBSCRIPTION_INTERVALS.map((item) => ({
      ...item,
      count: Number(counts[item.value] || 0),
      pct: total > 0 ? (Number(counts[item.value] || 0) / total) * 100 : 0,
      color: getSubscriptionIntervalColor(item.value),
    }))
  }, [summary])

  const columns = useMemo(() => {
    const cols = [{ key: 'subscription', label: 'Subscription' }]
    if (!hideAccount) cols.push({ key: 'account', label: 'Account' })
    if (!hideProduct) cols.push({ key: 'product', label: 'Product' })
    if (!hideNextBilling) cols.push({ key: 'next', label: 'Next billing' })
    if (!hideAmount) cols.push({ key: 'amount', label: 'Amount (GHS)' })
    if (!hideStatus) cols.push({ key: 'status', label: 'Status' })
    cols.push({ key: 'action', label: 'Actions', align: 'right' })
    return cols
  }, [hideAccount, hideProduct, hideNextBilling, hideAmount, hideStatus])

  const stats = useMemo(() => {
    const items = [
      {
        label: 'Agreements',
        value: summary?.total_count ?? 0,
        caption: 'Recurring customer plans',
      },
    ]
    if (!hideStatus && !hideAmount) {
      items.push({
        label: 'Active recurring amount',
        value: formatGhs(summary?.active_amount ?? 0),
        caption: 'Per interval, Active plans',
      })
    }
    if (!hideStatus && !hideNextBilling) {
      items.push({
        label: 'Due now',
        value: summary?.due_count ?? 0,
        caption: 'Active and due to bill',
      })
    }
    return items
  }, [summary, hideStatus, hideAmount, hideNextBilling])

  const totalIntervals = intervalMix.reduce((sum, item) => sum + item.count, 0)

  return (
    <>
      <CrmListPage
        id="pane-invoicing"
        title="Customer Subscriptions"
        subtitle="Recurring billing to your own customers. Each interval creates a Draft invoice; stock moves only when it is issued."
        roleName={roleName}
        canRead={canRead}
        canCreate={Boolean(permissions.can_create)}
        createLabel="New Subscription"
        onCreateClick={() => setCreateOpen(true)}
        headerActions={
          <>
            {subtabsBar}
            {permissions.can_update && permissions.can_create_invoice ? (
              <Button
                type="button"
                variant="secondary"
                disabled={runBusy}
                onClick={handleRunDue}
              >
                {runBusy ? 'Running...' : 'Run Due Intervals'}
              </Button>
            ) : null}
          </>
        }
        stats={stats}
        statsAddon={
          !hideStatus && !hideInterval ? (
            <Card className="px-4 py-3 flex-1 min-w-[16rem] max-w-lg min-h-[6.75rem]">
              <h3 className="text-xs font-semibold text-main leading-tight">Billing interval</h3>
              <p className="text-[11px] text-sub mt-0.5">Active plans by interval</p>
              <div className="mt-3 h-2 rounded-full overflow-hidden flex crm-subtle">
                {intervalMix.map((item) =>
                  item.pct > 0 ? (
                    <div
                      key={item.value}
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                      data-tooltip={`${item.label}: ${item.count}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                {intervalMix.map((item) => (
                  <span key={item.value} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sub">{item.label}:</span>
                    <span className="font-semibold text-main num-tabular">{item.count}</span>
                  </span>
                ))}
                {totalIntervals === 0 ? <span className="text-sub">No Active plans.</span> : null}
              </div>
            </Card>
          ) : null
        }
        extraContent={
          notice ? (
            <div className="flex flex-wrap items-center justify-between gap-2 badge-success rounded-lg px-3.5 py-2.5 text-xs">
              <span>{notice}</span>
              {lastGeneratedInvoice?.id ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenInvoice?.(lastGeneratedInvoice.id)}
                  className="px-2.5 py-1 text-[11px]"
                >
                  Open {lastGeneratedInvoice.invoice_number}
                </Button>
              ) : null}
            </div>
          ) : null
        }
        toolbarCaption="Customer Account, Product, interval and next billing date."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search subscriptions..."
        filters={
          <>
            {!hideAccount ? (
              <div className="w-52">
                <RecordRelationPicker
                  ariaLabel="Filter by account"
                  workspaceSlug={workspaceSlug}
                  objectKey="account"
                  objectPluralLabel="accounts"
                  value={accountFilter}
                  fallbackOptions={options.accounts || []}
                  allowEmpty
                  emptyLabel="All accounts"
                  placeholder="All accounts"
                  searchPlaceholder="Search accounts..."
                  onChange={(val) => setAccountFilter(val)}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
            {!hideStatus ? (
              <Select
                ariaLabel="Filter by status"
                value={statusFilter}
                options={STATUS_FILTERS}
                onChange={setStatusFilter}
                className="w-36"
              />
            ) : null}
            {!hideInterval ? (
              <Select
                ariaLabel="Filter by interval"
                value={intervalFilter}
                options={INTERVAL_FILTERS}
                onChange={setIntervalFilter}
                className="w-36"
              />
            ) : null}
          </>
        }
        loading={loading}
        error={error}
        records={rows}
        totalCount={rows.length}
        emptyMessage="No customer subscriptions yet."
        itemLabel="subscription"
        pluralLabel="subscriptions"
        columns={columns}
        renderRow={(row) => (
          <tr
            key={row.id}
            onClick={() => openInspector(row.id)}
            className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
          >
            <td className="py-2.5 px-4">
              <div className="font-medium text-main num-tabular">{row.code}</div>
              {!hideInterval ? (
                <div className="text-[11px] text-sub">{getSubscriptionIntervalLabel(row.interval)}</div>
              ) : null}
            </td>
            {!hideAccount ? (
              <td className="py-2.5 px-4 text-body">{row.account_name || '-'}</td>
            ) : null}
            {!hideProduct ? (
              <td className="py-2.5 px-4 text-body">
                {row.product_name || '-'}
                {!hideQuantity || !hideWarehouse ? (
                  <div className="text-[11px] text-sub num-tabular">
                    {!hideQuantity ? `Qty ${Number(row.quantity)}` : ''}
                    {!hideWarehouse && row.warehouse_name
                      ? `${!hideQuantity ? ' - ' : ''}${row.warehouse_name}`
                      : ''}
                  </div>
                ) : null}
              </td>
            ) : null}
            {!hideNextBilling ? (
              <td className="py-2.5 px-4 text-sub num-tabular">
                {formatDateOnly(row.next_billing_date)}
              </td>
            ) : null}
            {!hideAmount ? (
              <td className="py-2.5 px-4 font-semibold text-main num-tabular">
                {formatGhs(row.amount)}
              </td>
            ) : null}
            {!hideStatus ? (
              <td className="py-2.5 px-4">
                <span className={getSubscriptionStatusBadgeClass(row.status)}>{row.status}</span>
              </td>
            ) : null}
            <td className="py-2.5 px-4 text-right">
              {row.status === 'Active' && permissions.can_create_invoice ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyId === row.id}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleGenerate(row)
                  }}
                >
                  {busyId === row.id ? 'Generating...' : 'Generate Draft Invoice'}
                </Button>
              ) : null}
            </td>
          </tr>
        )}
      />

      <CustomerSubscriptionFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspaceSlug}
        options={options}
        fieldRights={fieldRights}
        inventoryEnabled={inventoryEnabled}
        canCreateInvoice={Boolean(permissions.can_create_invoice)}
        onCreated={(data) => {
          setCreateOpen(false)
          setNotice(data?.message || 'Customer subscription created.')
          setLastGeneratedInvoice(data?.generated_invoice || null)
          onAuditRecorded?.()
          reload()
        }}
        onSessionExpired={onSessionExpired}
      />

      {selected ? (
        <CustomerSubscriptionInspectorDrawer
          record={selected}
          workspace={workspace}
          workspaceSlug={workspaceSlug}
          options={options}
          fieldRights={fieldRights}
          inventoryEnabled={inventoryEnabled}
          appPermissions={appPermissions}
          permissions={permissions}
          onClose={() => {
            setSelected(null)
            onCloseInspect?.()
          }}
          onOpenInvoice={(invoiceId) => {
            setSelected(null)
            onOpenInvoice?.(invoiceId)
          }}
          onOpenLinkedRecord={onOpenLinkedRecord}
          onChanged={(result) => {
            if (result?.message) setNotice(result.message)
            if (result?.refreshDetailId) {
              openInspector(result.refreshDetailId, { syncUrl: false })
              return
            }
            onAuditRecorded?.()
            if (result?.deleted) {
              setSelected(null)
              onCloseInspect?.()
            } else if (result?.record) {
              setSelected(result.record)
            }
            reload()
          }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </>
  )
}
