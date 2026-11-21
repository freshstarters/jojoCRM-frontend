import { useState } from 'react'
import {
  SUBSCRIPTION_FIELD_RIGHT_MAP,
  buildSubscriptionForm,
  buildSubscriptionPayload,
  deleteCustomerSubscription,
  generateSubscriptionDraftInvoice,
  getSubscriptionStatusBadgeClass,
  updateCustomerSubscription,
} from '../../service/commercialService.js'
import { filterWritablePayload, isFieldHidden } from '../../service/crmService.js'
import { formatDateOnly, formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { RecordInspectorDrawer } from '../crm/RecordInspectorDrawer.jsx'
import { CustomerSubscriptionFields } from './CustomerSubscriptionFields.jsx'

export function CustomerSubscriptionInspectorDrawer({
  record,
  workspace,
  workspaceSlug,
  options = {},
  fieldRights = {},
  inventoryEnabled = false,
  appPermissions = null,
  permissions = {},
  onClose,
  onChanged,
  onOpenInvoice,
  onOpenLinkedRecord,
  onSessionExpired,
}) {
  const [form, setForm] = useState(() => buildSubscriptionForm(record))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState(record ? `${record.id}:${record.updated_at}` : '')

  const recordKey = record ? `${record.id}:${record.updated_at}` : ''
  if (recordKey !== loadedKey) {
    setLoadedKey(recordKey)
    setForm(buildSubscriptionForm(record))
    setError('')
    setSuccess('')
  }

  if (!record) return null

  const canUpdate = Boolean(permissions.can_update)
  const canDelete = Boolean(permissions.can_delete)
  const hideAmount = isFieldHidden(fieldRights, 'amount')
  const hideInterval = isFieldHidden(fieldRights, 'interval')
  const hideNextBilling = isFieldHidden(fieldRights, 'next_billing_date')
  const hideStatus = isFieldHidden(fieldRights, 'status')

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const rawPayload = buildSubscriptionPayload(form)
      const payload = filterWritablePayload(rawPayload, fieldRights, SUBSCRIPTION_FIELD_RIGHT_MAP)
      const { response, data } = await updateCustomerSubscription(workspaceSlug, record.id, payload)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || data?.detail || 'Could not save subscription changes.')
        return
      }
      setSuccess(data?.message || 'Saved.')
      setAuditRefreshKey((k) => k + 1)
      onChanged?.({ record: data?.record, message: data?.message })
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    setSuccess('')
    try {
      const { response, data } = await deleteCustomerSubscription(workspaceSlug, record.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return { ok: false }
        }
        setError(data?.error || data?.detail || 'Could not delete the subscription.')
        return { ok: false }
      }
      onChanged?.({ deleted: true, message: data?.message })
      return { ok: true }
    } catch {
      setError('Network error. Try again.')
      return { ok: false }
    } finally {
      setDeleting(false)
    }
  }

  async function handleGenerateInvoice() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const { response, data } = await generateSubscriptionDraftInvoice(workspaceSlug, record.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || data?.detail || 'Could not generate the Draft invoice.')
        return
      }
      setSuccess(data?.message || 'Draft invoice generated.')
      setAuditRefreshKey((k) => k + 1)
      onChanged?.({ record: data?.record, message: data?.message })
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordInspectorDrawer
      open
      onClose={onClose}
      objectKey="customer_subscription"
      objectLabel="Customer Subscription"
      contactLabel={workspace?.contact_label || 'Contact'}
      contactPluralLabel={workspace?.contact_plural_label || 'Contacts'}
      workspaceSlug={workspaceSlug}
      assignees={options.members || []}
      roles={options.roles || []}
      permissions={appPermissions}
      record={record}
      saving={saving}
      deleting={deleting}
      error={error}
      notice={success}
      canUpdate={canUpdate}
      canDelete={canDelete}
      sharingValue={{
        visibility: form.visibility,
        shared_role_id: form.shared_role_id,
      }}
      onSharingChange={(next) => setForm({ ...form, ...next })}
      onSave={handleSave}
      onDelete={handleDelete}
      onActivityChanged={() => onChanged?.({ refreshDetailId: record.id })}
      auditRefreshKey={auditRefreshKey}
      onOpenLinkedRecord={onOpenLinkedRecord}
      onSessionExpired={onSessionExpired}
      badgeText={!hideStatus ? record.status : ''}
      badgeClassName={!hideStatus ? getSubscriptionStatusBadgeClass(record.status) : 'badge badge-neutral'}
      subtitle={
        [record.record_code || record.code, record.account_name, record.product_name]
          .filter(Boolean)
          .join(' · ')
      }
    >
      <div className="crm-subtle rounded-lg p-3 text-xs space-y-1">
        {!hideAmount || !hideInterval ? (
          <div className="flex justify-between gap-2">
            <span className="text-sub">Billed</span>
            <span className="font-semibold text-main num-tabular">
              {!hideAmount ? formatGhs(record.amount) : '—'}
              {!hideInterval && record.interval ? ` / ${record.interval}` : ''}
            </span>
          </div>
        ) : null}
        {!hideNextBilling ? (
          <div className="flex justify-between gap-2">
            <span className="text-sub">Next billing</span>
            <span className="text-main num-tabular">{formatDateOnly(record.next_billing_date)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <span className="text-sub">Last billed</span>
          <span className="text-main num-tabular">
            {record.last_billed_date ? formatDateOnly(record.last_billed_date) : 'Not yet'}
          </span>
        </div>
      </div>

      {record.status === 'Active' && permissions.can_create_invoice ? (
        <Button
          type="button"
          variant="secondary"
          disabled={saving || deleting}
          onClick={handleGenerateInvoice}
        >
          Generate Draft Invoice
        </Button>
      ) : null}

      <CustomerSubscriptionFields
        idPrefix="insp-sub"
        workspaceSlug={workspaceSlug}
        form={form}
        onChange={setForm}
        options={options}
        fieldRights={fieldRights}
        selectedAccount={record.account}
        selectedProduct={record.product}
        inventoryEnabled={inventoryEnabled}
        disabled={saving || deleting || !canUpdate}
        showSharing={false}
        onSessionExpired={onSessionExpired}
      />

      <div className="pt-3 border-t crm-border space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-sub">
          Generated invoices
        </h4>
        {(record.invoices || []).length === 0 ? (
          <div className="crm-subtle px-3.5 py-3 text-xs text-sub">No invoices generated yet.</div>
        ) : (
          <ul className="space-y-1.5">
            {record.invoices.map((inv) => (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => onOpenInvoice?.(inv.id)}
                  className="w-full crm-subtle rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2 text-left"
                >
                  <span className="font-medium text-main num-tabular">{inv.invoice_number}</span>
                  <span className="text-sub num-tabular">{formatGhs(inv.total_amount)}</span>
                  <span className="badge badge-neutral">{inv.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RecordInspectorDrawer>
  )
}
