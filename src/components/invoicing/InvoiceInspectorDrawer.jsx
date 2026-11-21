import { useState } from 'react'
import {
  getInvoicePdfUrl,
  getStatusBadgeClass,
  issueInvoiceRecord,
  voidInvoiceRecord,
} from '../../service/commercialService.js'
import {
  filterWritablePayload,
  getObjectRights,
  isFieldHidden,
  isFieldReadOnly,
  updateCrmRecord,
} from '../../service/crmService.js'
import { formatDateOnly, formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { FieldLabel } from '../crm/FieldLabel.jsx'
import { RecordInspectorDrawer } from '../crm/RecordInspectorDrawer.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'
import { InvoiceLineItemsEditor } from './InvoiceLineItemsEditor.jsx'

export function InvoiceInspectorDrawer({
  open,
  onClose,
  workspace,
  workspaceSlug,
  user,
  permissions,
  pane,
  contactLabel = 'Contact',
  contactPlural = 'Contacts',
  onOpenPaymentModal,
  onOpenPdfPreview,
  onOpenWarehouses,
  onOpenLinkedRecord,
  onInvoiceMutated,
  onSessionExpired,
}) {
  const active = pane.activeRecord
  const fr = pane.fieldRights
  const enabledKeys = new Set(workspace?.enabled_object_keys || [])
  const productEnabled = enabledKeys.has('product')
  const lineItemEnabled = enabledKeys.has('line_item')
  const inventoryEnabled = enabledKeys.has('inventory')
  const paymentEnabled = enabledKeys.has('payment')
  const paymentRights = getObjectRights(permissions, 'payment')
  const lineRights = getObjectRights(permissions, 'line_item')

  const [draft, setDraft] = useState(null)
  const [pickedAccount, setPickedAccount] = useState(null)
  const [pickedContact, setPickedContact] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [prevActiveId, setPrevActiveId] = useState(null)

  if (active?.id && active.id !== prevActiveId) {
    setPrevActiveId(active.id)
    setDraft(null)
    setPickedAccount(null)
    setPickedContact(null)
    setActionError('')
    setActionSuccess('')
  }

  const hideNumber = isFieldHidden(fr, 'invoice_number')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideIssueDate = isFieldHidden(fr, 'issue_date')
  const hideDueDate = isFieldHidden(fr, 'due_date')
  const hideStatus = isFieldHidden(fr, 'status')
  const hideTotal = isFieldHidden(fr, 'total_amount')
  const hideNotes = isFieldHidden(fr, 'notes')

  const formValues = draft ?? {
    invoice_number: active?.invoice_number || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    issue_date: active?.issue_date || '',
    due_date: active?.due_date || '',
    notes: active?.notes || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const allContacts = pane.optionsData?.contacts || []
  const isDraft = active?.status_category === 'draft'
  const lines = Array.isArray(active?.line_items) ? active.line_items : []
  const payments = Array.isArray(active?.payments) ? active.payments : []

  function handleAccountContactChange(field, val, rec) {
    if (field === 'account_id') {
      setPickedAccount(rec || null)
      let nextContactId = formValues.contact_id
      if (val && formValues.contact_id) {
        const curCon =
          (pickedContact?.id === Number(formValues.contact_id) ? pickedContact : null) ||
          (active?.contact?.id === Number(formValues.contact_id) ? active.contact : null) ||
          allContacts.find((c) => String(c.id) === String(formValues.contact_id))
        if (curCon?.account_id && String(curCon.account_id) !== String(val)) {
          nextContactId = ''
          setPickedContact(null)
        }
      }
      setDraft({ ...formValues, account_id: val, contact_id: nextContactId })
      return
    }
    setPickedContact(rec || null)
    const nextAccId = rec?.account_id ? String(rec.account_id) : formValues.account_id
    if (rec?.account_id && rec?.account) {
      setPickedAccount(rec.account)
    }
    setDraft({ ...formValues, contact_id: val, account_id: nextAccId })
  }

  async function handleSave() {
    setActionError('')
    setActionSuccess('')
    const raw = {
      ...(isDraft ? { invoice_number: formValues.invoice_number } : {}),
      account_id: formValues.account_id ? Number(formValues.account_id) : null,
      contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
      issue_date: formValues.issue_date,
      due_date: formValues.due_date,
      notes: formValues.notes,
    }
    const payload = filterWritablePayload(raw, fr, {
      account_id: 'account',
      contact_id: 'contact',
    })
    if (active?.can_manage_sharing) {
      payload.visibility = formValues.visibility
      payload.shared_role_id =
        formValues.visibility === 'role' && formValues.shared_role_id
          ? Number(formValues.shared_role_id)
          : null
    }
    const res = await pane.saveActiveRecord(payload)
    if (res.ok) {
      setDraft(null)
      onInvoiceMutated?.()
    }
  }

  async function handleIssue() {
    if (!workspaceSlug || !active?.id) return
    setActionBusy(true)
    setActionError('')
    setActionSuccess('')
    try {
      const { response, data } = await issueInvoiceRecord(workspaceSlug, active.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not issue invoice.')
        return
      }
      setActionSuccess(data?.message || 'Invoice issued.')
      await pane.refreshActiveRecord()
      onInvoiceMutated?.()
    } catch {
      setActionError('Network error while issuing invoice.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleVoid() {
    if (!workspaceSlug || !active?.id) return
    setActionBusy(true)
    setActionError('')
    setActionSuccess('')
    try {
      const { response, data } = await voidInvoiceRecord(workspaceSlug, active.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not void invoice.')
        return
      }
      setActionSuccess(data?.message || 'Invoice voided.')
      await pane.refreshActiveRecord()
      onInvoiceMutated?.()
    } catch {
      setActionError('Network error while voiding invoice.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleReversePayment(payment) {
    if (!workspaceSlug || !payment?.id) return
    setActionBusy(true)
    setActionError('')
    setActionSuccess('')
    try {
      const { response, data } = await updateCrmRecord(
        workspaceSlug,
        'payment',
        payment.id,
        { status: 'Reversed' },
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not reverse payment.')
        return
      }
      setActionSuccess('Payment reversed and invoice balance updated.')
      await pane.refreshActiveRecord()
      onInvoiceMutated?.()
    } catch {
      setActionError('Network error while reversing payment.')
    } finally {
      setActionBusy(false)
    }
  }

  function handleDirectDownloadPdf() {
    if (!workspaceSlug || !active?.id) return
    const url = getInvoicePdfUrl(workspaceSlug, active.id, { disposition: 'attachment' })
    const link = document.createElement('a')
    link.href = url
    link.download = `${active.invoice_number || `invoice-${active.id}`}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const headerActions = active ? (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onOpenPdfPreview?.(active)}
        className="px-2.5 py-1 text-xs"
      >
        Preview PDF
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={handleDirectDownloadPdf}
        className="px-2.5 py-1 text-xs"
      >
        Download PDF
      </Button>
      {pane.rights.canUpdate && active.can_issue ? (
        <Button
          type="button"
          variant="primary"
          disabled={actionBusy}
          onClick={handleIssue}
          className="px-2.5 py-1 text-xs font-medium"
        >
          {actionBusy ? 'Working...' : 'Issue Invoice'}
        </Button>
      ) : null}
      {paymentEnabled && paymentRights.canCreate && active.can_record_payment ? (
        <Button
          type="button"
          variant="primary"
          disabled={actionBusy}
          onClick={() => onOpenPaymentModal?.(active)}
          className="px-2.5 py-1 text-xs font-medium"
        >
          Record Payment
        </Button>
      ) : null}
      {pane.rights.canUpdate && active.can_void ? (
        <Button
          type="button"
          variant="secondary"
          disabled={actionBusy}
          onClick={handleVoid}
          className="px-2.5 py-1 text-xs text-rose-600"
        >
          Void
        </Button>
      ) : null}
    </>
  ) : null

  return (
    <RecordInspectorDrawer
      open={open}
      onClose={() => {
        setDraft(null)
        onClose()
      }}
      objectKey="invoice"
      objectLabel="Invoice"
      contactLabel={contactLabel}
      contactPluralLabel={contactPlural}
      assignees={pane.optionsData?.assignees || []}
      roles={pane.optionsData?.roles || []}
      workspaceSlug={workspaceSlug}
      userTimezone={user?.timezone || 'Africa/Accra'}
      permissions={permissions}
      record={active}
      loading={pane.inspectorLoading}
      saving={pane.savingInspector}
      deleting={pane.deletingInspector}
      error={actionError || pane.inspectorError}
      notice={actionSuccess || pane.actionNotice}
      canUpdate={pane.rights.canUpdate}
      canDelete={pane.rights.canDelete}
      sharingValue={{
        visibility: formValues.visibility,
        shared_role_id: formValues.shared_role_id,
      }}
      onSharingChange={(next) => setDraft({ ...formValues, ...next })}
      onSave={handleSave}
      onDelete={async () => {
        const res = await pane.deleteActiveRecord()
        if (res.ok) {
          setDraft(null)
          onInvoiceMutated?.()
        }
        return res
      }}
      onActivityChanged={pane.refreshActiveRecord}
      auditRefreshKey={pane.recordAuditRevision}
      onOpenLinkedRecord={onOpenLinkedRecord}
      onSessionExpired={onSessionExpired}
      badgeText={!hideStatus ? active?.status || '' : ''}
      badgeClassName={getStatusBadgeClass(active?.status_tone, active?.status)}
      headerActions={headerActions}
    >
      {active?.is_overdue ? (
        <FeedbackNotice
          tone="warn"
          message={`Overdue: due date (${formatDateOnly(active.due_date)}) has passed with ${formatGhs(active.balance_due)} remaining.`}
        />
      ) : null}

      {!hideTotal && active ? (
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg crm-subtle border crm-border">
          <div>
            <div className="text-[11px] text-sub">Total</div>
            <div className="text-sm font-semibold text-main num-tabular">
              {formatGhs(active.total_amount)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-sub">Paid</div>
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 num-tabular">
              {formatGhs(active.amount_paid)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-sub">Balance Due</div>
            <div className="text-sm font-bold text-main num-tabular">
              {formatGhs(active.balance_due)}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {!hideNumber ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="inv-insp-number"
              label="Invoice #"
              readOnly={!isDraft || isFieldReadOnly(fr, 'invoice_number')}
            />
            <input
              id="inv-insp-number"
              type="text"
              value={formValues.invoice_number}
              disabled={
                !isDraft ||
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'invoice_number')
              }
              onChange={(e) =>
                setDraft({ ...formValues, invoice_number: e.target.value })
              }
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
        {!hideIssueDate ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="inv-insp-issue"
              label="Issue date"
              readOnly={isFieldReadOnly(fr, 'issue_date')}
            />
            <input
              id="inv-insp-issue"
              type="date"
              value={formValues.issue_date}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'issue_date')
              }
              onChange={(e) =>
                setDraft({ ...formValues, issue_date: e.target.value })
              }
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
        {!hideDueDate ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="inv-insp-due"
              label="Due date"
              readOnly={isFieldReadOnly(fr, 'due_date')}
            />
            <input
              id="inv-insp-due"
              type="date"
              value={formValues.due_date}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'due_date')
              }
              onChange={(e) =>
                setDraft({ ...formValues, due_date: e.target.value })
              }
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
      </div>

      {!hideAccount || !hideContact ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!hideAccount ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="inv-insp-account"
                label="Account"
                readOnly={isFieldReadOnly(fr, 'account')}
              />
              <RecordRelationPicker
                id="inv-insp-account"
                ariaLabel="Account"
                workspaceSlug={workspaceSlug}
                objectKey="account"
                objectPluralLabel="Accounts"
                value={formValues.account_id}
                selectedRecord={pickedAccount || active?.account || null}
                fallbackOptions={pane.optionsData?.accounts || []}
                emptyLabel="No Account"
                searchPlaceholder="Search Accounts..."
                getOptionMeta={(acc) => acc.city || acc.email || ''}
                onChange={(val, rec) =>
                  handleAccountContactChange('account_id', val, rec)
                }
                disabled={
                  !pane.rights.canUpdate ||
                  pane.savingInspector ||
                  isFieldReadOnly(fr, 'account')
                }
                onSessionExpired={onSessionExpired}
              />
            </div>
          ) : null}
          {!hideContact ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="inv-insp-contact"
                label={contactLabel}
                readOnly={isFieldReadOnly(fr, 'contact')}
              />
              <RecordRelationPicker
                id="inv-insp-contact"
                ariaLabel={contactLabel}
                workspaceSlug={workspaceSlug}
                objectKey="contact"
                objectPluralLabel={contactPlural}
                value={formValues.contact_id}
                selectedRecord={pickedContact || active?.contact || null}
                fallbackOptions={allContacts}
                queryParams={
                  formValues.account_id
                    ? { compatible_account_id: formValues.account_id }
                    : {}
                }
                emptyLabel={`No ${contactLabel}`}
                searchPlaceholder={`Search ${contactPlural}...`}
                getOptionLabel={(con) => {
                  const accName = con.account?.name || con.account_name
                  return accName
                    ? `${con.name || con.display_label} (${accName})`
                    : con.name || con.display_label
                }}
                getOptionMeta={(con) => con.email || con.phone || ''}
                onChange={(val, rec) =>
                  handleAccountContactChange('contact_id', val, rec)
                }
                disabled={
                  !pane.rights.canUpdate ||
                  pane.savingInspector ||
                  isFieldReadOnly(fr, 'contact')
                }
                onSessionExpired={onSessionExpired}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!hideNotes ? (
        <div className="space-y-1">
          <FieldLabel
            htmlFor="inv-insp-notes"
            label="Notes"
            readOnly={isFieldReadOnly(fr, 'notes')}
          />
          <textarea
            id="inv-insp-notes"
            rows={2}
            value={formValues.notes}
            disabled={
              !pane.rights.canUpdate ||
              pane.savingInspector ||
              isFieldReadOnly(fr, 'notes')
            }
            onChange={(e) => setDraft({ ...formValues, notes: e.target.value })}
            className="crm-input w-full px-3 py-2"
          />
        </div>
      ) : null}

      {isDraft &&
      inventoryEnabled &&
      lines.some((li) => li.product_id && !li.warehouse_id) ? (
        <FeedbackNotice
          tone="warn"
          message="Select a warehouse on every product line item before issuing this invoice."
        />
      ) : null}

      {lineItemEnabled && active?.line_items_readable ? (
        <div className="pt-3 border-t crm-border">
          <InvoiceLineItemsEditor
            workspaceSlug={workspaceSlug}
            parentObjectKey="invoice"
            parentId={active.id}
            items={lines}
            products={pane.optionsData?.products || []}
            warehouses={pane.optionsData?.warehouses || []}
            inventoryEnabled={inventoryEnabled}
            onOpenWarehouses={() => {
              onClose?.()
              onOpenWarehouses?.()
            }}
            productEnabled={productEnabled}
            lineItemEnabled={lineItemEnabled}
            canEdit={
              pane.rights.canUpdate &&
              (lineRights.canCreate || lineRights.canUpdate || lineRights.canDelete)
            }
            locked={!isDraft}
            lockMessage={
              !isDraft
                ? `Line items are locked because this invoice is ${active.status}.`
                : ''
            }
            onChanged={async () => {
              await pane.refreshActiveRecord()
              onInvoiceMutated?.()
            }}
            onSessionExpired={onSessionExpired}
          />
        </div>
      ) : null}

      {paymentEnabled && active?.payments_readable ? (
        <div className="pt-3 border-t crm-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-sub">
              Recorded Payments
            </h4>
            {paymentRights.canCreate && active.can_record_payment ? (
              <Button
                type="button"
                variant="secondary"
                disabled={actionBusy}
                onClick={() => onOpenPaymentModal?.(active)}
                className="px-2.5 py-1 text-xs"
              >
                Add Payment
              </Button>
            ) : null}
          </div>
          {payments.length === 0 ? (
            <p className="text-xs text-sub">No payments recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {payments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-2.5 rounded-lg crm-subtle border crm-border flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-main num-tabular">
                      {formatGhs(pay.amount)} · {pay.method}
                    </div>
                    <div className="text-[11px] text-sub">
                      {formatDateOnly(pay.payment_date)}
                      {pay.reference ? ` · Ref: ${pay.reference}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        pay.status === 'Recorded'
                          ? 'badge badge-success'
                          : pay.status === 'Reversed'
                            ? 'badge badge-danger'
                            : 'badge badge-warn'
                      }
                    >
                      {pay.status}
                    </span>
                    {pay.status === 'Recorded' && paymentRights.canUpdate ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actionBusy}
                        onClick={() => handleReversePayment(pay)}
                        className="px-2 py-1 text-[11px] text-rose-600"
                      >
                        Reverse
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </RecordInspectorDrawer>
  )
}
