import { useState } from 'react'
import { POLICY_STATUSES } from '../../service/commercialService.js'
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

function addDaysIso(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return isoDate
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function buildInitialForm(prefill = null) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    product_id: '',
    product_name: '',
    account_id: prefill?.account_id ? String(prefill.account_id) : '',
    contact_id: prefill?.contact_id ? String(prefill.contact_id) : '',
    premium: '',
    status: 'Active',
    renewal_date: addDaysIso(today, 365),
    notes: '',
    visibility: 'workspace',
    shared_role_id: '',
  }
}

export function PolicyFormModal({
  open,
  onClose,
  workspace,
  workspaceSlug,
  fieldRights = {},
  optionsData = {},
  contactLabel = 'Contact',
  contactPlural = 'Contacts',
  prefill = null,
  onSubmitCreate,
  onSessionExpired,
}) {
  const enabledKeys = new Set(workspace?.enabled_object_keys || [])
  const productEnabled = enabledKeys.has('product')

  const [form, setForm] = useState(() => buildInitialForm(prefill))
  const [pickedProduct, setPickedProduct] = useState(null)
  const [pickedAccount, setPickedAccount] = useState(() => prefill?.account || null)
  const [pickedContact, setPickedContact] = useState(() => prefill?.contact || null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [prevSessionKey, setPrevSessionKey] = useState('')

  const sessionKey = open
    ? `${prefill?.account_id || ''}:${prefill?.contact_id || ''}:new`
    : ''
  if (open && sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey)
    setForm(buildInitialForm(prefill))
    setPickedProduct(null)
    setPickedAccount(prefill?.account || null)
    setPickedContact(prefill?.contact || null)
    setError('')
  } else if (!open && prevSessionKey) {
    setPrevSessionKey('')
  }

  const hideProduct = isFieldHidden(fieldRights, 'product')
  const hideAccount = isFieldHidden(fieldRights, 'account')
  const hideContact = isFieldHidden(fieldRights, 'contact')
  const hidePremium = isFieldHidden(fieldRights, 'premium')
  const hideStatus = isFieldHidden(fieldRights, 'status')
  const hideRenewal = isFieldHidden(fieldRights, 'renewal_date')
  const hideNotes = isFieldHidden(fieldRights, 'notes')

  const allContacts = optionsData.contacts || []
  const compatibleFallbackContacts = form.account_id
    ? allContacts.filter(
        (c) => !c.account_id || String(c.account_id) === String(form.account_id),
      )
    : allContacts

  const statusOptions = (optionsData.constants?.policy_statuses || POLICY_STATUSES).map(
    (s) => ({ value: s, label: s }),
  )

  function handleProductSelect(val, rec) {
    setPickedProduct(rec || null)
    setForm((f) => ({
      ...f,
      product_id: val,
      product_name: rec ? rec.name || '' : f.product_name,
      premium:
        rec && (!f.premium || f.premium === '') && rec.unit_price !== undefined
          ? Number(rec.unit_price).toFixed(2)
          : f.premium,
    }))
  }

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

    if (!hideProduct && !form.product_id && !form.product_name.trim()) {
      setError('Select or enter a finance product.')
      return
    }
    if (!hideAccount && !hideContact && !form.account_id && !form.contact_id) {
      setError(`Link this policy to an Account or ${contactLabel}.`)
      return
    }
    if (!hidePremium && form.premium === '') {
      setError('Premium (GHS) is required.')
      return
    }
    if (!hideRenewal && !form.renewal_date) {
      setError('Renewal date is required.')
      return
    }

    const raw = {
      product_id: form.product_id ? Number(form.product_id) : null,
      product_name: form.product_name.trim(),
      account_id: form.account_id ? Number(form.account_id) : null,
      contact_id: form.contact_id ? Number(form.contact_id) : null,
      premium: form.premium,
      status: form.status,
      renewal_date: form.renewal_date,
      notes: form.notes,
    }

    const payload = filterWritablePayload(raw, fieldRights, {
      product_id: 'product',
      product_name: 'product',
      account_id: 'account',
      contact_id: 'contact',
    })
    payload.visibility = form.visibility
    if (form.visibility === 'role' && form.shared_role_id) {
      payload.shared_role_id = Number(form.shared_role_id)
    }

    setSubmitting(true)
    try {
      const res = await onSubmitCreate(payload)
      if (!res?.ok) {
        setError(res?.error || 'Could not create policy.')
        return
      }
      setForm(buildInitialForm(null))
      setPickedProduct(null)
      setPickedAccount(null)
      setPickedContact(null)
      onClose()
    } catch {
      setError('Network error while creating policy.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="New Policy"
      subtitle={`Record a finance product, premium, status, and renewal linked to an Account or ${contactLabel.toLowerCase()}.`}
      maxWidthClass="max-w-xl"
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
            form="policy-create-form"
            variant="primary"
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-semibold"
          >
            {submitting ? 'Saving...' : 'Save Policy'}
          </Button>
        </>
      }
    >
      <form id="policy-create-form" onSubmit={handleSubmit} className="space-y-3 text-xs">
        <FeedbackNotice tone="danger" message={error} />

        {!hideProduct ? (
          <div className="space-y-2">
            {productEnabled ? (
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="new-policy-product-picker"
                  label="Catalog Product (optional)"
                  readOnly={isFieldReadOnly(fieldRights, 'product')}
                />
                <RecordRelationPicker
                  id="new-policy-product-picker"
                  ariaLabel="Catalog Product"
                  workspaceSlug={workspaceSlug}
                  objectKey="product"
                  objectPluralLabel="Products"
                  value={form.product_id}
                  selectedRecord={pickedProduct}
                  fallbackOptions={optionsData.products || []}
                  allowEmpty
                  emptyLabel="Custom finance product"
                  searchPlaceholder="Search Products..."
                  getOptionMeta={(p) =>
                    [p.sku, p.unit_price !== undefined ? formatGhs(p.unit_price) : '']
                      .filter(Boolean)
                      .join(' · ')
                  }
                  onChange={handleProductSelect}
                  disabled={submitting || isFieldReadOnly(fieldRights, 'product')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-policy-product-name"
                label="Finance product name"
                readOnly={isFieldReadOnly(fieldRights, 'product')}
              />
              <input
                id="new-policy-product-name"
                type="text"
                required={!isFieldReadOnly(fieldRights, 'product') && !form.product_id}
                value={form.product_name}
                onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                placeholder="e.g. SME Advisory Retainer or Motor Comprehensive"
                disabled={submitting || isFieldReadOnly(fieldRights, 'product')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          </div>
        ) : null}

        {!hideAccount || !hideContact ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!hideAccount ? (
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="new-policy-account"
                  label="Account"
                  readOnly={isFieldReadOnly(fieldRights, 'account')}
                />
                <RecordRelationPicker
                  id="new-policy-account"
                  ariaLabel="Account"
                  workspaceSlug={workspaceSlug}
                  objectKey="account"
                  objectPluralLabel="Accounts"
                  value={form.account_id}
                  selectedRecord={pickedAccount}
                  fallbackOptions={optionsData.accounts || []}
                  allowEmpty
                  emptyLabel="Optional Account"
                  searchPlaceholder="Search Accounts..."
                  getOptionMeta={(acc) => acc.city || acc.email || ''}
                  onChange={(val, rec) =>
                    handleAccountOrContactChange('account_id', val, rec)
                  }
                  disabled={submitting || isFieldReadOnly(fieldRights, 'account')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}

            {!hideContact ? (
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="new-policy-contact"
                  label={contactLabel}
                  readOnly={isFieldReadOnly(fieldRights, 'contact')}
                />
                <RecordRelationPicker
                  id="new-policy-contact"
                  ariaLabel={contactLabel}
                  workspaceSlug={workspaceSlug}
                  objectKey="contact"
                  objectPluralLabel={contactPlural}
                  value={form.contact_id}
                  selectedRecord={pickedContact}
                  fallbackOptions={compatibleFallbackContacts}
                  queryParams={
                    form.account_id ? { compatible_account_id: form.account_id } : undefined
                  }
                  allowEmpty
                  emptyLabel={`Optional ${contactLabel}`}
                  searchPlaceholder={`Search ${contactPlural}...`}
                  getOptionMeta={(c) => c.email || c.phone || ''}
                  onChange={(val, rec) =>
                    handleAccountOrContactChange('contact_id', val, rec)
                  }
                  disabled={submitting || isFieldReadOnly(fieldRights, 'contact')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!hidePremium ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-policy-premium"
                label="Premium (GHS)"
                readOnly={isFieldReadOnly(fieldRights, 'premium')}
              />
              <input
                id="new-policy-premium"
                type="number"
                step="0.01"
                min="0"
                required={!isFieldReadOnly(fieldRights, 'premium')}
                value={form.premium}
                onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
                placeholder="0.00"
                disabled={submitting || isFieldReadOnly(fieldRights, 'premium')}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          ) : null}

          {!hideStatus ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-policy-status"
                label="Status"
                readOnly={isFieldReadOnly(fieldRights, 'status')}
              />
              <Select
                id="new-policy-status"
                ariaLabel="Policy status"
                value={form.status}
                onChange={(val) => setForm((f) => ({ ...f, status: val }))}
                options={statusOptions}
                disabled={submitting || isFieldReadOnly(fieldRights, 'status')}
              />
            </div>
          ) : null}

          {!hideRenewal ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-policy-renewal"
                label="Renewal date"
                readOnly={isFieldReadOnly(fieldRights, 'renewal_date')}
              />
              <DatePicker
                id="new-policy-renewal"
                ariaLabel="Renewal date"
                value={form.renewal_date}
                onChange={(val) => setForm((f) => ({ ...f, renewal_date: val }))}
                disabled={submitting || isFieldReadOnly(fieldRights, 'renewal_date')}
              />
            </div>
          ) : null}
        </div>

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="new-policy-notes"
              label="Notes"
              readOnly={isFieldReadOnly(fieldRights, 'notes')}
            />
            <textarea
              id="new-policy-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional coverage summary or renewal notes (no bank account or KYC details)..."
              disabled={submitting || isFieldReadOnly(fieldRights, 'notes')}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        <RecordSharingControl
          idPrefix="new-policy-sharing"
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
