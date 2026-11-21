import { useState } from 'react'
import {
  CONTRACT_STATUSES,
  createContractFromDeal,
} from '../../service/commercialService.js'
import {
  filterWritablePayload,
  isFieldHidden,
  isFieldReadOnly,
} from '../../service/crmService.js'
import { formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { DatePicker } from '../DateTimePicker.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { Select } from '../Select.jsx'
import { FieldLabel } from '../crm/FieldLabel.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'
import { RecordSharingControl } from '../crm/RecordSharingControl.jsx'
import { InvoiceLineItemsEditor } from '../invoicing/InvoiceLineItemsEditor.jsx'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return isoDate
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function buildInitialForm(sourceDeal) {
  const start = todayIso()
  const end = addDaysIso(start, 365)
  const renewal = addDaysIso(end, -30)
  if (!sourceDeal) {
    return {
      title: '',
      account_id: '',
      contact_id: '',
      status: 'Draft',
      value: '0.00',
      start_date: start,
      end_date: end,
      renewal_date: renewal,
      notes: '',
      visibility: 'workspace',
      shared_role_id: '',
    }
  }
  const dealLines = Array.isArray(sourceDeal.line_items) ? sourceDeal.line_items : []
  const dealLinesTotal = dealLines.reduce((sum, li) => sum + Number(li.line_total || 0), 0)
  const initialValue =
    Number(sourceDeal.amount || 0) > 0
      ? Number(sourceDeal.amount).toFixed(2)
      : dealLinesTotal.toFixed(2)

  return {
    title: sourceDeal.title || '',
    account_id: sourceDeal.account_id ? String(sourceDeal.account_id) : '',
    contact_id: sourceDeal.contact_id ? String(sourceDeal.contact_id) : '',
    status: 'Draft',
    value: initialValue,
    start_date: start,
    end_date: end,
    renewal_date: renewal,
    notes: sourceDeal.notes || (sourceDeal.title ? `Created from deal: ${sourceDeal.title}` : ''),
    visibility: sourceDeal.visibility || 'workspace',
    shared_role_id: sourceDeal.shared_role_id ? String(sourceDeal.shared_role_id) : '',
  }
}

export function ContractFormModal({
  open,
  onClose,
  workspace,
  workspaceSlug,
  fieldRights = {},
  optionsData = {},
  contactLabel = 'Contact',
  contactPlural = 'Contacts',
  sourceDeal = null,
  onSubmitCreate,
  onCreatedFromDeal,
  onSessionExpired,
}) {
  const enabledKeys = new Set(workspace?.enabled_object_keys || [])
  const productEnabled = enabledKeys.has('product')
  const lineItemEnabled = enabledKeys.has('line_item')
  const isDealPrefill = Boolean(sourceDeal?.id)

  const [form, setForm] = useState(() => buildInitialForm(sourceDeal))
  const [pickedAccount, setPickedAccount] = useState(() => sourceDeal?.account || null)
  const [pickedContact, setPickedContact] = useState(() => sourceDeal?.contact || null)
  const [draftLines, setDraftLines] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [prevSessionKey, setPrevSessionKey] = useState('')

  const sessionKey = open ? `${sourceDeal?.id || 'new'}` : ''
  if (open && sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey)
    setForm(buildInitialForm(sourceDeal))
    setPickedAccount(sourceDeal?.account || null)
    setPickedContact(sourceDeal?.contact || null)
    setDraftLines([])
    setError('')
  } else if (!open && prevSessionKey) {
    setPrevSessionKey('')
  }

  const hideTitle = isFieldHidden(fieldRights, 'title')
  const hideAccount = isFieldHidden(fieldRights, 'account')
  const hideContact = isFieldHidden(fieldRights, 'contact')
  const hideStatus = isFieldHidden(fieldRights, 'status')
  const hideValue = isFieldHidden(fieldRights, 'value')
  const hideStart = isFieldHidden(fieldRights, 'start_date')
  const hideEnd = isFieldHidden(fieldRights, 'end_date')
  const hideRenewal = isFieldHidden(fieldRights, 'renewal_date')
  const hideNotes = isFieldHidden(fieldRights, 'notes')

  const allContacts = optionsData.contacts || []
  const compatibleFallbackContacts = form.account_id
    ? allContacts.filter(
        (c) => !c.account_id || String(c.account_id) === String(form.account_id),
      )
    : allContacts

  const statusOptions = (optionsData.constants?.contract_statuses || CONTRACT_STATUSES).map(
    (s) => ({ value: s, label: s }),
  )

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

    if (!hideAccount && !form.account_id) {
      setError('Select an Account for this contract.')
      return
    }
    if (!hideContact && !form.contact_id) {
      setError(`Select a ${contactLabel} for this contract.`)
      return
    }
    if (!hideStart && !hideEnd && form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date cannot be earlier than start date.')
      return
    }

    const raw = {
      title: form.title.trim(),
      account_id: form.account_id ? Number(form.account_id) : null,
      contact_id: form.contact_id ? Number(form.contact_id) : null,
      status: form.status,
      value: form.value === '' ? '0.00' : form.value,
      start_date: form.start_date,
      end_date: form.end_date,
      renewal_date: form.renewal_date || null,
      notes: form.notes,
    }

    const payload = filterWritablePayload(raw, fieldRights, {
      account_id: 'account',
      contact_id: 'contact',
    })
    payload.visibility = form.visibility
    if (form.visibility === 'role' && form.shared_role_id) {
      payload.shared_role_id = Number(form.shared_role_id)
    }

    if (!isDealPrefill && lineItemEnabled && draftLines.length > 0) {
      payload.line_items = draftLines.map((li) => ({
        ...(li.product_id ? { product_id: Number(li.product_id) } : {}),
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
      }))
    }

    setSubmitting(true)
    try {
      if (isDealPrefill) {
        const { response, data } = await createContractFromDeal(
          workspaceSlug,
          sourceDeal.id,
          payload,
        )
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(data?.error || data?.detail || 'Could not create contract from deal.')
          return
        }
        onCreatedFromDeal?.(data)
        onClose()
        return
      }

      const res = await onSubmitCreate(payload)
      if (!res?.ok) {
        setError(res?.error || 'Could not create contract.')
        return
      }
      setForm(buildInitialForm(null))
      setPickedAccount(null)
      setPickedContact(null)
      setDraftLines([])
      onClose()
    } catch {
      setError('Network error while creating contract.')
    } finally {
      setSubmitting(false)
    }
  }

  const dealLines = Array.isArray(sourceDeal?.line_items) ? sourceDeal.line_items : []
  const dealLinesTotal = dealLines.reduce((sum, li) => sum + Number(li.line_total || 0), 0)
  const draftLinesTotal = draftLines.reduce((sum, li) => sum + Number(li.line_total || 0), 0)

  return (
    <Modal
      open={open}
      title={isDealPrefill ? 'Create Contract from Deal' : 'New Contract'}
      subtitle={
        isDealPrefill
          ? `Pre-filled from "${sourceDeal.title}". Review fields and dates before saving.`
          : `Links an Account and one ${contactLabel.toLowerCase()}. Typed GHS value stays independent of catalog lines.`
      }
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
            form="create-contract-form"
            variant="primary"
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-semibold"
          >
            {submitting ? 'Saving...' : 'Save Contract'}
          </Button>
        </>
      }
    >
      <form id="create-contract-form" onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <FeedbackNotice tone="danger" message={error} />

        {!hideTitle ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="new-ctr-title"
              label="Contract title"
              required
              readOnly={isFieldReadOnly(fieldRights, 'title')}
            />
            <input
              id="new-ctr-title"
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Tema warehouse annual supply"
              disabled={submitting || isFieldReadOnly(fieldRights, 'title')}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        {!hideAccount || !hideContact ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!hideAccount ? (
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="new-ctr-account"
                  label="Account"
                  required
                  readOnly={isFieldReadOnly(fieldRights, 'account')}
                />
                <RecordRelationPicker
                  id="new-ctr-account"
                  ariaLabel="Account"
                  workspaceSlug={workspaceSlug}
                  objectKey="account"
                  objectPluralLabel="Accounts"
                  value={form.account_id}
                  selectedRecord={pickedAccount}
                  fallbackOptions={optionsData.accounts || []}
                  allowEmpty={false}
                  emptyLabel="Select Account"
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
                  htmlFor="new-ctr-contact"
                  label={contactLabel}
                  required
                  readOnly={isFieldReadOnly(fieldRights, 'contact')}
                />
                <RecordRelationPicker
                  id="new-ctr-contact"
                  ariaLabel={contactLabel}
                  workspaceSlug={workspaceSlug}
                  objectKey="contact"
                  objectPluralLabel={contactPlural}
                  value={form.contact_id}
                  selectedRecord={pickedContact}
                  fallbackOptions={compatibleFallbackContacts}
                  queryParams={
                    form.account_id ? { compatible_account_id: form.account_id } : {}
                  }
                  allowEmpty={false}
                  emptyLabel={`Select ${contactLabel}`}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!hideValue ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-ctr-value"
                label="Typed value (GHS)"
                readOnly={isFieldReadOnly(fieldRights, 'value')}
              />
              <input
                id="new-ctr-value"
                type="number"
                min="0"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                disabled={submitting || isFieldReadOnly(fieldRights, 'value')}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          ) : null}
          {!hideStatus ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-ctr-status"
                label="Status"
                readOnly={isFieldReadOnly(fieldRights, 'status')}
              />
              <Select
                id="new-ctr-status"
                ariaLabel="Contract status"
                value={form.status}
                onChange={(val) => setForm((f) => ({ ...f, status: val }))}
                options={statusOptions}
                disabled={submitting || isFieldReadOnly(fieldRights, 'status')}
              />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!hideStart ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-ctr-start"
                label="Start date"
                required
                readOnly={isFieldReadOnly(fieldRights, 'start_date')}
              />
              <DatePicker
                id="new-ctr-start"
                ariaLabel="Start date"
                required
                value={form.start_date}
                onChange={(val) => setForm((f) => ({ ...f, start_date: val }))}
                disabled={submitting || isFieldReadOnly(fieldRights, 'start_date')}
              />
            </div>
          ) : null}
          {!hideEnd ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-ctr-end"
                label="End date"
                required
                readOnly={isFieldReadOnly(fieldRights, 'end_date')}
              />
              <DatePicker
                id="new-ctr-end"
                ariaLabel="End date"
                required
                value={form.end_date}
                onChange={(val) => setForm((f) => ({ ...f, end_date: val }))}
                disabled={submitting || isFieldReadOnly(fieldRights, 'end_date')}
              />
            </div>
          ) : null}
          {!hideRenewal ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-ctr-renewal"
                label="Renewal date"
                readOnly={isFieldReadOnly(fieldRights, 'renewal_date')}
              />
              <DatePicker
                id="new-ctr-renewal"
                ariaLabel="Renewal date"
                value={form.renewal_date}
                onChange={(val) => setForm((f) => ({ ...f, renewal_date: val }))}
                disabled={submitting || isFieldReadOnly(fieldRights, 'renewal_date')}
              />
            </div>
          ) : null}
        </div>

        {isDealPrefill && lineItemEnabled && dealLines.length > 0 ? (
          <div className="p-3 rounded-lg crm-subtle border crm-border space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-main">
                Deal line items to copy ({dealLines.length})
              </span>
              <span className="font-semibold text-main num-tabular">
                Lines total: {formatGhs(dealLinesTotal)}
              </span>
            </div>
            <ul className="space-y-1 text-[11px] text-sub">
              {dealLines.map((li) => (
                <li key={li.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {li.product_name || li.description} x{' '}
                    {Number(li.quantity).toFixed(2).replace(/\.00$/, '')}
                  </span>
                  <span className="num-tabular shrink-0">{formatGhs(li.line_total)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!isDealPrefill && lineItemEnabled ? (
          <div className="pt-2 border-t crm-border space-y-2">
            <InvoiceLineItemsEditor
              workspaceSlug={workspaceSlug}
              parentObjectKey="contract"
              parentId={null}
              title="Catalog Lines (Optional)"
              headerExtra={
                !hideValue && draftLines.length > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setForm((f) => ({ ...f, value: draftLinesTotal.toFixed(2) }))
                    }
                    className="px-2 py-0.5 text-[11px]"
                  >
                    Use lines total
                  </Button>
                ) : null
              }
              items={draftLines}
              onDraftItemsChange={setDraftLines}
              products={optionsData.products || []}
              productEnabled={productEnabled}
              lineItemEnabled={lineItemEnabled}
              canEdit={!submitting}
              onSessionExpired={onSessionExpired}
            />
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="new-ctr-notes"
              label="Notes"
              readOnly={isFieldReadOnly(fieldRights, 'notes')}
            />
            <textarea
              id="new-ctr-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={submitting || isFieldReadOnly(fieldRights, 'notes')}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        <RecordSharingControl
          idPrefix="new-ctr-sharing"
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
