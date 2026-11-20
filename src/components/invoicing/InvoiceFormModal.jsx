import { useState } from 'react'
import { filterWritablePayload, isFieldHidden, isFieldReadOnly } from '../../service/crmService.js'
import { formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { FieldLabel } from '../crm/FieldLabel.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'
import { RecordSharingControl } from '../crm/RecordSharingControl.jsx'
import { InvoiceLineItemsEditor } from './InvoiceLineItemsEditor.jsx'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return isoDate
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export function InvoiceFormModal({
  open,
  onClose,
  workspace,
  workspaceSlug,
  fieldRights = {},
  optionsData = {},
  contactLabel = 'Contact',
  contactPlural = 'Contacts',
  onSubmitCreate,
  onSessionExpired,
}) {
  const enabledKeys = new Set(workspace?.enabled_object_keys || [])
  const productEnabled = enabledKeys.has('product')
  const lineItemEnabled = enabledKeys.has('line_item')

  const defaultIssue = todayIso()
  const [form, setForm] = useState({
    invoice_number: '',
    account_id: '',
    contact_id: '',
    issue_date: defaultIssue,
    due_date: addDaysIso(defaultIssue, 14),
    total_amount: '0.00',
    notes: '',
    visibility: 'workspace',
    shared_role_id: '',
  })
  const [pickedAccount, setPickedAccount] = useState(null)
  const [pickedContact, setPickedContact] = useState(null)
  const [draftLines, setDraftLines] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const hideNumber = isFieldHidden(fieldRights, 'invoice_number')
  const hideAccount = isFieldHidden(fieldRights, 'account')
  const hideContact = isFieldHidden(fieldRights, 'contact')
  const hideIssueDate = isFieldHidden(fieldRights, 'issue_date')
  const hideDueDate = isFieldHidden(fieldRights, 'due_date')
  const hideTotal = isFieldHidden(fieldRights, 'total_amount')
  const hideNotes = isFieldHidden(fieldRights, 'notes')

  const allContacts = optionsData.contacts || []

  function handleAccountOrContactChange(field, val, rec) {
    if (field === 'account_id') {
      setPickedAccount(rec || null)
      let nextContactId = form.contact_id
      if (val && form.contact_id) {
        const currentCon =
          (pickedContact?.id === Number(form.contact_id) ? pickedContact : null) ||
          allContacts.find((c) => String(c.id) === String(form.contact_id))
        if (currentCon?.account_id && String(currentCon.account_id) !== String(val)) {
          nextContactId = ''
          setPickedContact(null)
        }
      }
      setForm((f) => ({ ...f, account_id: val, contact_id: nextContactId }))
      return
    }
    setPickedContact(rec || null)
    const nextAccId = rec?.account_id ? String(rec.account_id) : form.account_id
    if (rec?.account_id && rec?.account) {
      setPickedAccount(rec.account)
    }
    setForm((f) => ({ ...f, contact_id: val, account_id: nextAccId }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const raw = {
      ...(form.invoice_number.trim() ? { invoice_number: form.invoice_number.trim() } : {}),
      account_id: form.account_id ? Number(form.account_id) : null,
      contact_id: form.contact_id ? Number(form.contact_id) : null,
      issue_date: form.issue_date,
      due_date: form.due_date,
      notes: form.notes,
      ...(!lineItemEnabled && form.total_amount ? { total_amount: form.total_amount } : {}),
    }

    const payload = filterWritablePayload(raw, fieldRights, {
      account_id: 'account',
      contact_id: 'contact',
    })
    if (lineItemEnabled && draftLines.length > 0) {
      payload.line_items = draftLines.map((li) => ({
        ...(li.product_id ? { product_id: Number(li.product_id) } : {}),
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
      }))
    }
    payload.visibility = form.visibility
    if (form.visibility === 'role' && form.shared_role_id) {
      payload.shared_role_id = Number(form.shared_role_id)
    }

    setSubmitting(true)
    const res = await onSubmitCreate(payload)
    setSubmitting(false)
    if (!res?.ok) {
      setError(res?.error || 'Could not create invoice.')
      return
    }
    const freshIssue = todayIso()
    setForm({
      invoice_number: '',
      account_id: '',
      contact_id: '',
      issue_date: freshIssue,
      due_date: addDaysIso(freshIssue, 14),
      total_amount: '0.00',
      notes: '',
      visibility: 'workspace',
      shared_role_id: '',
    })
    setPickedAccount(null)
    setPickedContact(null)
    setDraftLines([])
    onClose()
  }

  const linesTotal = draftLines.reduce((sum, li) => sum + Number(li.line_total || 0), 0)

  return (
    <Modal
      open={open}
      title="New Commercial Invoice"
      subtitle="Create a Draft invoice in GHS. Issue it when ready."
      maxWidthClass="max-w-2xl"
      onClose={() => {
        if (!submitting) onClose()
      }}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={onClose}
            className="px-3 py-1.5 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-invoice-form"
            variant="primary"
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-semibold"
          >
            {submitting ? 'Creating...' : 'Create Draft Invoice'}
          </Button>
        </>
      }
    >
      <form id="create-invoice-form" onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <FeedbackNotice tone="danger" message={error} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!hideNumber ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-inv-number"
                label="Invoice #"
                readOnly={isFieldReadOnly(fieldRights, 'invoice_number')}
              />
              <input
                id="new-inv-number"
                type="text"
                value={form.invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                placeholder="Auto (INV-YYYY-0001)"
                disabled={submitting || isFieldReadOnly(fieldRights, 'invoice_number')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}
          {!hideIssueDate ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-inv-issue"
                label="Issue date"
                required
                readOnly={isFieldReadOnly(fieldRights, 'issue_date')}
              />
              <input
                id="new-inv-issue"
                type="date"
                required
                value={form.issue_date}
                onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                disabled={submitting || isFieldReadOnly(fieldRights, 'issue_date')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}
          {!hideDueDate ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-inv-due"
                label="Due date"
                required
                readOnly={isFieldReadOnly(fieldRights, 'due_date')}
              />
              <input
                id="new-inv-due"
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                disabled={submitting || isFieldReadOnly(fieldRights, 'due_date')}
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
                  htmlFor="new-inv-account"
                  label="Customer Account"
                  readOnly={isFieldReadOnly(fieldRights, 'account')}
                />
                <RecordRelationPicker
                  id="new-inv-account"
                  ariaLabel="Customer Account"
                  workspaceSlug={workspaceSlug}
                  objectKey="account"
                  objectPluralLabel="Accounts"
                  value={form.account_id}
                  selectedRecord={pickedAccount}
                  fallbackOptions={optionsData.accounts || []}
                  emptyLabel="No Account"
                  searchPlaceholder="Search Accounts..."
                  getOptionMeta={(acc) => acc.city || acc.email || ''}
                  onChange={(val, rec) => handleAccountOrContactChange('account_id', val, rec)}
                  disabled={submitting || isFieldReadOnly(fieldRights, 'account')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
            {!hideContact ? (
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="new-inv-contact"
                  label={contactLabel}
                  readOnly={isFieldReadOnly(fieldRights, 'contact')}
                />
                <RecordRelationPicker
                  id="new-inv-contact"
                  ariaLabel={contactLabel}
                  workspaceSlug={workspaceSlug}
                  objectKey="contact"
                  objectPluralLabel={contactPlural}
                  value={form.contact_id}
                  selectedRecord={pickedContact}
                  fallbackOptions={allContacts}
                  queryParams={
                    form.account_id ? { compatible_account_id: form.account_id } : {}
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
                  onChange={(val, rec) => handleAccountOrContactChange('contact_id', val, rec)}
                  disabled={submitting || isFieldReadOnly(fieldRights, 'contact')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {lineItemEnabled ? (
          <InvoiceLineItemsEditor
            workspaceSlug={workspaceSlug}
            parentObjectKey="invoice"
            parentId={null}
            items={draftLines}
            onDraftItemsChange={setDraftLines}
            products={optionsData.products || []}
            productEnabled={productEnabled}
            lineItemEnabled={lineItemEnabled}
            canEdit={!submitting}
            onSessionExpired={onSessionExpired}
          />
        ) : !hideTotal ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="new-inv-total"
              label="Total (GHS)"
              readOnly={isFieldReadOnly(fieldRights, 'total_amount')}
            />
            <input
              id="new-inv-total"
              type="number"
              min="0"
              step="0.01"
              value={form.total_amount}
              onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
              disabled={submitting || isFieldReadOnly(fieldRights, 'total_amount')}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
        ) : null}

        {lineItemEnabled && !hideTotal ? (
          <div className="p-2.5 rounded-lg crm-subtle flex items-center justify-between text-xs">
            <span className="text-sub">Draft Invoice Total</span>
            <span className="font-semibold text-main num-tabular">{formatGhs(linesTotal)}</span>
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="new-inv-notes"
              label="Notes"
              readOnly={isFieldReadOnly(fieldRights, 'notes')}
            />
            <textarea
              id="new-inv-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={submitting || isFieldReadOnly(fieldRights, 'notes')}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        <RecordSharingControl
          idPrefix="new-inv-sharing"
          visibility={form.visibility}
          sharedRoleId={form.shared_role_id}
          roles={optionsData.roles || []}
          disabled={submitting}
          onChange={(next) => setForm((f) => ({ ...f, ...next }))}
        />
      </form>
    </Modal>
  )
}
