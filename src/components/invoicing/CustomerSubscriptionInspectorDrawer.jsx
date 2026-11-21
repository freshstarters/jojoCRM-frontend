import { useState } from 'react'
import {
  buildSubscriptionForm,
  buildSubscriptionPayload,
  deleteCustomerSubscription,
  generateSubscriptionDraftInvoice,
  getSubscriptionStatusBadgeClass,
  updateCustomerSubscription,
} from '../../service/commercialService.js'
import { formatDateOnly, formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { Drawer } from '../Drawer.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { CustomerSubscriptionFields } from './CustomerSubscriptionFields.jsx'

export function CustomerSubscriptionInspectorDrawer({
  record,
  workspaceSlug,
  options = {},
  inventoryEnabled = false,
  permissions = {},
  onClose,
  onChanged,
  onOpenInvoice,
  onSessionExpired,
}) {
  const [form, setForm] = useState(() => buildSubscriptionForm(record))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loadedKey, setLoadedKey] = useState(record ? `${record.id}:${record.updated_at}` : '')

  const recordKey = record ? `${record.id}:${record.updated_at}` : ''
  if (recordKey !== loadedKey) {
    setLoadedKey(recordKey)
    setForm(buildSubscriptionForm(record))
    setConfirmDelete(false)
  }

  if (!record) return null

  async function run(action, onOk) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const { response, data } = await action()
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || data?.detail || 'Request failed.')
        setConfirmDelete(false)
        return
      }
      onOk(data)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const canUpdate = Boolean(permissions.can_update)

  return (
    <Drawer
      open
      onClose={onClose}
      title={record.code}
      subtitle={`${record.account_name || 'No account'} - ${record.product_name || 'No product'}`}
      headerActions={<span className={getSubscriptionStatusBadgeClass(record.status)}>{record.status}</span>}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {permissions.can_delete ? (
              confirmDelete ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => deleteCustomerSubscription(workspaceSlug, record.id),
                        (data) => onChanged?.({ deleted: true, message: data?.message }),
                      )
                    }
                  >
                    Confirm delete
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !canUpdate}
              onClick={() =>
                run(
                  () => updateCustomerSubscription(workspaceSlug, record.id, buildSubscriptionPayload(form)),
                  (data) => {
                    setSuccess(data?.message || 'Saved.')
                    onChanged?.({ record: data?.record, message: data?.message })
                  },
                )
              }
            >
              {busy ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <FeedbackNotice tone="danger" message={error} />
        <FeedbackNotice tone="success" message={success} />

        <div className="crm-subtle rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between gap-2">
            <span className="text-sub">Billed</span>
            <span className="font-semibold text-main num-tabular">
              {formatGhs(record.amount)} / {record.interval}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-sub">Next billing</span>
            <span className="text-main num-tabular">{formatDateOnly(record.next_billing_date)}</span>
          </div>
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
            disabled={busy}
            onClick={() =>
              run(
                () => generateSubscriptionDraftInvoice(workspaceSlug, record.id),
                (data) => {
                  setSuccess(data?.message || 'Draft invoice generated.')
                  onChanged?.({ record: data?.record, message: data?.message })
                },
              )
            }
          >
            Generate Draft Invoice
          </Button>
        ) : null}

        <CustomerSubscriptionFields
          idPrefix="insp-sub"
          form={form}
          onChange={setForm}
          options={options}
          inventoryEnabled={inventoryEnabled}
          disabled={busy || !canUpdate}
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
      </div>
    </Drawer>
  )
}
