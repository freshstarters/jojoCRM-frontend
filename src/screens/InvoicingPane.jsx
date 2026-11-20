import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Select } from '../components/Select.jsx'
import { Subtabs } from '../components/Subtabs.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { InvoiceFormModal } from '../components/invoicing/InvoiceFormModal.jsx'
import { InvoiceInspectorDrawer } from '../components/invoicing/InvoiceInspectorDrawer.jsx'
import { InvoicePdfPreviewModal } from '../components/invoicing/InvoicePdfPreviewModal.jsx'
import { RecordPaymentModal } from '../components/invoicing/RecordPaymentModal.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import { getStatusBadgeClass, getStatusColor } from '../service/commercialService.js'
import {
  canUserManageSalesSettings,
  getCrmRecord,
  getObjectRights,
  isFieldHidden,
  updateCrmRecord,
} from '../service/crmService.js'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import { formatDateOnly, formatGhs } from '../utils/formatters.js'

const PAYMENT_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Recorded', label: 'Recorded' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Reversed', label: 'Reversed' },
]

export function InvoicingPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  subtabs = [],
  activeSubtab = 'invoices',
  onSubtabChange,
  onOpenInvoiceStatusSettings,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenLinkedRecord,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const canManageSales = canUserManageSalesSettings(permissions)

  const currentTab = activeSubtab || subtabs[0]?.id || 'invoices'

  const invoicePane = useCrmRecordsPane({
    workspaceSlug,
    objectKey: 'invoice',
    permissions,
    permissionsRevision,
    enabled: currentTab === 'invoices',
    urlInspectRecordId: currentTab === 'invoices' ? urlInspectRecordId : null,
    onInspectRecord,
    onCloseInspect,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const paymentPane = useCrmRecordsPane({
    workspaceSlug,
    objectKey: 'payment',
    permissions,
    permissionsRevision,
    enabled: currentTab === 'payments',
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const invFr = invoicePane.fieldRights
  const hideInvNumber = isFieldHidden(invFr, 'invoice_number')
  const hideInvAccount = isFieldHidden(invFr, 'account')
  const hideInvContact = isFieldHidden(invFr, 'contact')
  const hideInvIssueDate = isFieldHidden(invFr, 'issue_date')
  const hideInvDueDate = isFieldHidden(invFr, 'due_date')
  const hideInvStatus = isFieldHidden(invFr, 'status')
  const hideInvTotal = isFieldHidden(invFr, 'total_amount')

  const payFr = paymentPane.fieldRights
  const hidePayInvoice = isFieldHidden(payFr, 'invoice')
  const hidePayAmount = isFieldHidden(payFr, 'amount')
  const hidePayDate = isFieldHidden(payFr, 'payment_date')
  const hidePayMethod = isFieldHidden(payFr, 'method')
  const hidePayStatus = isFieldHidden(payFr, 'status')
  const hidePayRef = isFieldHidden(payFr, 'reference')

  const [createOpen, setCreateOpen] = useState(false)
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null)
  const [pdfPreviewInvoice, setPdfPreviewInvoice] = useState(null)
  const [loadingPdfId, setLoadingPdfId] = useState(null)
  const [paymentActionError, setPaymentActionError] = useState('')
  const [reversingId, setReversingId] = useState(null)

  const paymentRights = getObjectRights(permissions, 'payment')
  const configuredStatuses = useMemo(
    () =>
      invoicePane.summary?.statuses ||
      invoicePane.optionsData?.constants?.invoice_statuses ||
      [],
    [invoicePane.summary?.statuses, invoicePane.optionsData?.constants?.invoice_statuses],
  )

  const invoiceStatusFilterOptions = useMemo(
    () => [
      { value: '', label: 'All Statuses' },
      ...configuredStatuses.map((s) => ({ value: s.name, label: s.name })),
    ],
    [configuredStatuses],
  )

  const paymentMethodFilterOptions = useMemo(() => {
    const methods = paymentPane.optionsData?.constants?.payment_methods || []
    return [
      { value: '', label: 'All methods' },
      ...methods.map((m) => ({ value: m, label: m })),
    ]
  }, [paymentPane.optionsData?.constants?.payment_methods])

  const statusMixSegments = useMemo(() => {
    if (hideInvStatus || hideInvTotal) return []
    const amounts = invoicePane.summary?.status_amounts || {}
    const counts = invoicePane.summary?.status_counts || {}
    const total = configuredStatuses.reduce(
      (sum, s) => sum + Number(amounts[s.name] || 0),
      0,
    )
    return configuredStatuses.map((s) => {
      const val = Number(amounts[s.name] || 0)
      const cnt = Number(counts[s.name] || 0)
      const pct = total > 0 ? (val / total) * 100 : 0
      return {
        ...s,
        amount: val,
        count: cnt,
        pct,
        color: getStatusColor(s.tone, s.name),
      }
    })
  }, [
    configuredStatuses,
    invoicePane.summary?.status_amounts,
    invoicePane.summary?.status_counts,
    hideInvStatus,
    hideInvTotal,
  ])

  const invoiceColumns = useMemo(() => {
    const cols = [{ key: 'invoice_number', label: 'Invoice #' }]
    if (!hideInvAccount || !hideInvContact) cols.push({ key: 'customer', label: 'Customer' })
    if (!hideInvIssueDate || !hideInvDueDate) cols.push({ key: 'dates', label: 'Issue / Due' })
    cols.push({ key: 'lines', label: 'Lines' })
    if (!hideInvTotal) {
      cols.push({ key: 'total', label: 'Total (GHS)' })
      cols.push({ key: 'paid', label: 'Paid / Balance' })
    }
    if (!hideInvStatus) cols.push({ key: 'status', label: 'Status' })
    cols.push({ key: 'action', label: 'Actions', align: 'right' })
    return cols
  }, [
    hideInvAccount,
    hideInvContact,
    hideInvIssueDate,
    hideInvDueDate,
    hideInvTotal,
    hideInvStatus,
  ])

  const paymentColumns = useMemo(() => {
    const cols = []
    if (!hidePayDate) cols.push({ key: 'date', label: 'Date' })
    if (!hidePayInvoice) cols.push({ key: 'invoice', label: 'Invoice #' })
    if (!hidePayMethod) cols.push({ key: 'method', label: 'Method' })
    if (!hidePayRef) cols.push({ key: 'reference', label: 'Reference' })
    if (!hidePayAmount) cols.push({ key: 'amount', label: 'Amount (GHS)' })
    if (!hidePayStatus) cols.push({ key: 'status', label: 'Status' })
    cols.push({ key: 'action', label: 'Actions', align: 'right' })
    return cols
  }, [hidePayDate, hidePayInvoice, hidePayMethod, hidePayRef, hidePayAmount, hidePayStatus])

  async function handleOpenPdfPreviewForRow(row) {
    if (!workspaceSlug || !row?.id) return
    if (Array.isArray(row.line_items)) {
      setPdfPreviewInvoice(row)
      return
    }
    setLoadingPdfId(row.id)
    try {
      const { response, data } = await getCrmRecord(workspaceSlug, 'invoice', row.id)
      if (response.ok && data?.record) {
        setPdfPreviewInvoice(data.record)
      } else {
        setPdfPreviewInvoice(row)
      }
    } catch {
      setPdfPreviewInvoice(row)
    } finally {
      setLoadingPdfId(null)
    }
  }

  async function handleReversePaymentFromList(pay) {
    if (!workspaceSlug || !pay?.id) return
    setPaymentActionError('')
    setReversingId(pay.id)
    try {
      const { response, data } = await updateCrmRecord(workspaceSlug, 'payment', pay.id, {
        status: 'Reversed',
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setPaymentActionError(data?.error || data?.detail || 'Could not reverse payment.')
        return
      }
      onAuditRecorded?.()
      paymentPane.reload()
      invoicePane.reload()
    } catch {
      setPaymentActionError('Network error while reversing payment.')
    } finally {
      setReversingId(null)
    }
  }

  const subtabsBar =
    subtabs.length > 0 ? (
      <Subtabs
        tabs={subtabs}
        activeId={currentTab}
        onChange={(nextTab) => onSubtabChange?.(nextTab)}
        ariaLabel="Invoicing sections"
      />
    ) : null

  if (currentTab === 'inventory' || currentTab === 'subscriptions') {
    const isInventory = currentTab === 'inventory'
    return (
      <section id="pane-invoicing" className="space-y-5 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b crm-border">
          <div>
            <h1 className="text-xl font-semibold text-main tracking-tight">
              {isInventory ? 'Warehouses & Inventory' : 'Customer Subscriptions'}
            </h1>
            <p className="text-xs text-sub mt-0.5">
              {isInventory
                ? 'Multi-warehouse stock levels and transfers arrive in S3.2.'
                : 'Recurring customer billing agreements arrive in S3.4.'}
            </p>
          </div>
          {subtabsBar}
        </div>

        <Card variant="subtle" className="p-5 space-y-2 max-w-3xl">
          <div className="text-xs font-semibold text-main">
            {isInventory ? 'S3.2 Warehouses (Upcoming)' : 'S3.4 Customer Subscriptions (Upcoming)'}
          </div>
          <p className="text-xs text-sub">
            {isInventory
              ? 'Use the Invoices and Payments tabs to create Draft invoices, issue commercial PDFs, and record GHS payments. Warehouse stock deductions and transfers are part of S3.2.'
              : 'Use the Invoices and Payments tabs for commercial billing in GHS. Automated recurring Draft invoice generation is part of S3.4.'}
          </p>
        </Card>
      </section>
    )
  }

  if (currentTab === 'payments') {
    return (
      <CrmListPage
        id="pane-invoicing"
        title="Customer Payments"
        subtitle="Payments recorded against commercial invoices in GHS (no card processing)."
        roleName={roleName}
        canRead={paymentPane.rights.canRead}
        headerActions={subtabsBar}
        stats={[
          {
            label: 'Total Collected',
            value:
              paymentPane.summary?.total_collected !== null &&
              paymentPane.summary?.total_collected !== undefined
                ? formatGhs(paymentPane.summary.total_collected)
                : '-',
            sublabel: 'Recorded payments in filter',
          },
          {
            label: 'Recorded',
            value: paymentPane.summary?.recorded_count ?? 0,
            sublabel: `${paymentPane.summary?.reversed_count ?? 0} reversed`,
          },
        ]}
        extraContent={
          paymentActionError ? (
            <FeedbackNotice tone="danger" message={paymentActionError} />
          ) : null
        }
        toolbarCaption="Payments are recorded on issued invoices and automatically update invoice balances."
        searchValue={paymentPane.search}
        onSearchChange={paymentPane.updateSearch}
        searchPlaceholder="Search invoice # or ref..."
        filters={
          <>
            {!hidePayStatus ? (
              <div className="w-36">
                <Select
                  ariaLabel="Filter by payment status"
                  value={paymentPane.filters.status || ''}
                  onChange={(val) => paymentPane.updateFilter('status', val)}
                  options={PAYMENT_STATUS_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            {!hidePayMethod ? (
              <div className="w-44">
                <Select
                  ariaLabel="Filter by payment method"
                  value={paymentPane.filters.method || ''}
                  onChange={(val) => paymentPane.updateFilter('method', val)}
                  options={paymentMethodFilterOptions}
                />
              </div>
            ) : null}
          </>
        }
        loading={paymentPane.loading}
        error={paymentPane.loadError}
        records={paymentPane.records}
        emptyMessage="No payments recorded yet."
        columns={paymentColumns}
        page={paymentPane.page}
        totalPages={paymentPane.totalPages}
        totalCount={paymentPane.totalCount}
        hasPrevious={paymentPane.hasPrevious}
        hasNext={paymentPane.hasNext}
        onPageChange={paymentPane.setPage}
        itemLabel="payment"
        pluralLabel="payments"
        renderRow={(row) => (
          <tr
            key={row.id}
            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
          >
            {!hidePayDate ? (
              <td className="py-2.5 px-3 text-body num-tabular">
                {formatDateOnly(row.payment_date)}
              </td>
            ) : null}
            {!hidePayInvoice ? (
              <td className="py-2.5 px-3">
                {row.invoice ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSubtabChange?.('invoices')
                      onInspectRecord?.(row.invoice.id, {
                        paneId: 'invoicing',
                        subtabId: 'invoices',
                      })
                    }}
                    className="font-medium text-main hover:underline text-left"
                  >
                    {row.invoice.invoice_number}
                  </button>
                ) : (
                  <span className="text-sub">-</span>
                )}
                {row.invoice?.account_name ? (
                  <div className="text-[11px] text-sub">{row.invoice.account_name}</div>
                ) : null}
              </td>
            ) : null}
            {!hidePayMethod ? (
              <td className="py-2.5 px-3 text-body">{row.method}</td>
            ) : null}
            {!hidePayRef ? (
              <td className="py-2.5 px-3 text-sub num-tabular">{row.reference || '-'}</td>
            ) : null}
            {!hidePayAmount ? (
              <td className="py-2.5 px-3 font-semibold text-main num-tabular">
                {formatGhs(row.amount)}
              </td>
            ) : null}
            {!hidePayStatus ? (
              <td className="py-2.5 px-3">
                <span
                  className={
                    row.status === 'Recorded'
                      ? 'badge badge-success'
                      : row.status === 'Reversed'
                        ? 'badge badge-danger'
                        : 'badge badge-warn'
                  }
                >
                  {row.status}
                </span>
              </td>
            ) : null}
            <td className="py-2.5 px-3 text-right whitespace-nowrap">
              <div className="inline-flex items-center gap-1.5">
                {row.invoice ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onSubtabChange?.('invoices')
                      onInspectRecord?.(row.invoice.id, {
                        paneId: 'invoicing',
                        subtabId: 'invoices',
                      })
                    }}
                    className="px-2.5 py-1 text-xs"
                  >
                    Invoice
                  </Button>
                ) : null}
                {row.status === 'Recorded' && paymentPane.rights.canUpdate ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={reversingId === row.id}
                    onClick={() => handleReversePaymentFromList(row)}
                    className="px-2.5 py-1 text-xs text-rose-600"
                  >
                    {reversingId === row.id ? 'Reversing...' : 'Reverse'}
                  </Button>
                ) : null}
              </div>
            </td>
          </tr>
        )}
      />
    )
  }

  return (
    <>
      <CrmListPage
        id="pane-invoicing"
        title="Commercial Invoicing"
        subtitle="Create and issue GHS invoices, download commercial PDFs, and record customer payments."
        roleName={roleName}
        canRead={invoicePane.rights.canRead}
        canCreate={invoicePane.rights.canCreate}
        createLabel="New Invoice"
        onCreateClick={() => setCreateOpen(true)}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {subtabsBar}
            {canManageSales && onOpenInvoiceStatusSettings ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onOpenInvoiceStatusSettings}
                className="px-3 py-1.5 text-xs"
              >
                Manage Statuses
              </Button>
            ) : null}
          </div>
        }
        stats={[
          {
            label: 'Invoices',
            value: invoicePane.totalCount,
            sublabel: `${invoicePane.summary?.overdue_count ?? 0} overdue`,
          },
          {
            label: 'Total Invoiced',
            value:
              invoicePane.summary?.total_invoiced !== null &&
              invoicePane.summary?.total_invoiced !== undefined
                ? formatGhs(invoicePane.summary.total_invoiced)
                : '-',
            sublabel: 'GHS across filtered invoices',
          },
          {
            label: 'Collected',
            value:
              invoicePane.summary?.total_collected !== null &&
              invoicePane.summary?.total_collected !== undefined
                ? formatGhs(invoicePane.summary.total_collected)
                : '-',
            sublabel: 'Recorded payments',
          },
          {
            label: 'Outstanding',
            value:
              invoicePane.summary?.total_outstanding !== null &&
              invoicePane.summary?.total_outstanding !== undefined
                ? formatGhs(invoicePane.summary.total_outstanding)
                : '-',
            sublabel: 'Remaining unpaid balance',
          },
        ]}
        extraContent={
          statusMixSegments.length > 0 ? (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-main">
                    Invoice Status &amp; Receivables Mix
                  </h3>
                  <p className="text-[11px] text-sub">
                    Distribution of GHS billing across workspace invoice statuses
                  </p>
                </div>
                <span className="text-xs font-bold text-main num-tabular">
                  {formatGhs(invoicePane.summary?.total_invoiced || 0)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex crm-subtle">
                {statusMixSegments.map((seg) =>
                  seg.pct > 0 ? (
                    <div
                      key={seg.id}
                      style={{
                        width: `${Math.max(2, seg.pct)}%`,
                        backgroundColor: seg.color,
                      }}
                      title={`${seg.name}: ${formatGhs(seg.amount)} (${seg.count})`}
                    />
                  ) : null,
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
                {statusMixSegments.map((seg) => (
                  <div key={seg.id} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-sub truncate">{seg.name}:</span>
                    <span className="font-semibold text-main num-tabular">
                      {seg.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null
        }
        toolbarCaption="Line items lock once an invoice leaves Draft. Payments never charge a card."
        searchValue={invoicePane.search}
        onSearchChange={invoicePane.updateSearch}
        searchPlaceholder="Search invoice # or customer..."
        filters={
          <>
            {!hideInvStatus ? (
              <div className="w-40">
                <Select
                  ariaLabel="Filter by invoice status"
                  value={invoicePane.filters.status || ''}
                  onChange={(val) => invoicePane.updateFilter('status', val)}
                  options={invoiceStatusFilterOptions}
                />
              </div>
            ) : null}
            <div className="w-36">
              <Select
                ariaLabel="Filter by visibility"
                value={invoicePane.filters.visibility || ''}
                onChange={(val) => invoicePane.updateFilter('visibility', val)}
                options={VISIBILITY_FILTER_OPTIONS}
              />
            </div>
          </>
        }
        loading={invoicePane.loading}
        error={invoicePane.loadError}
        records={invoicePane.records}
        emptyMessage="No invoices yet."
        columns={invoiceColumns}
        page={invoicePane.page}
        totalPages={invoicePane.totalPages}
        totalCount={invoicePane.totalCount}
        hasPrevious={invoicePane.hasPrevious}
        hasNext={invoicePane.hasNext}
        onPageChange={invoicePane.setPage}
        itemLabel="invoice"
        pluralLabel="invoices"
        renderRow={(row) => {
          const canPayRow =
            paymentRights.canCreate &&
            ['issued', 'partially_paid'].includes(row.status_category) &&
            Number(row.balance_due || 0) > 0
          return (
            <tr
              key={row.id}
              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition cursor-pointer"
              onClick={() => invoicePane.openInspector(row.id)}
            >
              <td className="py-2.5 px-3">
                <div className="font-semibold text-main num-tabular">
                  {hideInvNumber ? row.record_code : row.display_label}
                </div>
                {row.is_overdue ? (
                  <span className="badge badge-danger text-[10px] mt-0.5">Overdue</span>
                ) : null}
              </td>
              {!hideInvAccount || !hideInvContact ? (
                <td className="py-2.5 px-3">
                  <div className="font-medium text-main">
                    {row.account?.name || row.contact?.name || '-'}
                  </div>
                  {row.account?.name && row.contact?.name ? (
                    <div className="text-[11px] text-sub">{row.contact.name}</div>
                  ) : null}
                </td>
              ) : null}
              {!hideInvIssueDate || !hideInvDueDate ? (
                <td className="py-2.5 px-3 text-body num-tabular">
                  {!hideInvIssueDate ? (
                    <div>Issued: {formatDateOnly(row.issue_date)}</div>
                  ) : null}
                  {!hideInvDueDate ? (
                    <div className="text-[11px] text-sub">
                      Due: {formatDateOnly(row.due_date)}
                    </div>
                  ) : null}
                </td>
              ) : null}
              <td className="py-2.5 px-3 text-sub num-tabular">
                {row.line_items_count ?? 0}
              </td>
              {!hideInvTotal ? (
                <>
                  <td className="py-2.5 px-3 font-semibold text-main num-tabular">
                    {formatGhs(row.total_amount)}
                  </td>
                  <td className="py-2.5 px-3 num-tabular">
                    <div className="text-emerald-600 dark:text-emerald-400">
                      {formatGhs(row.amount_paid)}
                    </div>
                    <div className="text-[11px] text-sub">
                      Bal: {formatGhs(row.balance_due)}
                    </div>
                  </td>
                </>
              ) : null}
              {!hideInvStatus ? (
                <td className="py-2.5 px-3">
                  <span className={getStatusBadgeClass(row.status_tone, row.status)}>
                    {row.status}
                  </span>
                </td>
              ) : null}
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                <div className="inline-flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loadingPdfId === row.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenPdfPreviewForRow(row)
                    }}
                    className="px-2.5 py-1 text-xs"
                  >
                    {loadingPdfId === row.id ? '...' : 'PDF'}
                  </Button>
                  {canPayRow ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPaymentModalInvoice(row)
                      }}
                      className="px-2.5 py-1 text-xs"
                    >
                      Pay
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      invoicePane.openInspector(row.id)
                    }}
                    className="px-2.5 py-1 text-xs"
                  >
                    Inspect
                  </Button>
                </div>
              </td>
            </tr>
          )
        }}
      />

      <InvoiceFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspace={workspace}
        workspaceSlug={workspaceSlug}
        fieldRights={invFr}
        optionsData={invoicePane.optionsData}
        contactLabel={contactLabel}
        contactPlural={contactPlural}
        onSubmitCreate={async (payload) => {
          const res = await invoicePane.createRecord(payload)
          if (res.ok && res.data?.record?.id) {
            invoicePane.openInspector(res.data.record.id)
          }
          return res
        }}
        onSessionExpired={onSessionExpired}
      />

      <InvoiceInspectorDrawer
        open={invoicePane.inspectorOpen}
        onClose={invoicePane.closeInspector}
        workspace={workspace}
        workspaceSlug={workspaceSlug}
        user={user}
        permissions={permissions}
        pane={invoicePane}
        contactLabel={contactLabel}
        contactPlural={contactPlural}
        onOpenPaymentModal={(inv) => setPaymentModalInvoice(inv)}
        onOpenPdfPreview={(inv) => setPdfPreviewInvoice(inv)}
        onOpenLinkedRecord={onOpenLinkedRecord}
        onInvoiceMutated={() => {
          onAuditRecorded?.()
          invoicePane.reload()
          paymentPane.reload()
        }}
        onSessionExpired={onSessionExpired}
      />

      <RecordPaymentModal
        open={Boolean(paymentModalInvoice)}
        onClose={() => setPaymentModalInvoice(null)}
        workspaceSlug={workspaceSlug}
        invoice={paymentModalInvoice}
        paymentMethods={invoicePane.optionsData?.constants?.payment_methods || []}
        onPaymentRecorded={async () => {
          onAuditRecorded?.()
          invoicePane.reload()
          paymentPane.reload()
          if (invoicePane.inspectorOpen) {
            await invoicePane.refreshActiveRecord()
          }
        }}
        onSessionExpired={onSessionExpired}
      />

      <InvoicePdfPreviewModal
        open={Boolean(pdfPreviewInvoice)}
        onClose={() => setPdfPreviewInvoice(null)}
        workspace={workspace}
        workspaceSlug={workspaceSlug}
        invoice={pdfPreviewInvoice}
      />
    </>
  )
}
