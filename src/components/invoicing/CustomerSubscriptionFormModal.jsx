import { useState } from 'react'
import {
  buildSubscriptionForm,
  buildSubscriptionPayload,
  createCustomerSubscription,
} from '../../service/commercialService.js'
import { Button } from '../Button.jsx'
import { Checkbox } from '../Checkbox.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { CustomerSubscriptionFields } from './CustomerSubscriptionFields.jsx'

export function CustomerSubscriptionFormModal({
  open,
  onClose,
  workspaceSlug,
  options = {},
  inventoryEnabled = false,
  canCreateInvoice = false,
  onCreated,
  onSessionExpired,
}) {
  const defaultWarehouseId = (options.warehouses || []).find((w) => w.is_default)?.id
  const [form, setForm] = useState(() =>
    buildSubscriptionForm(null, {
      warehouse_id: defaultWarehouseId ? String(defaultWarehouseId) : '',
    }),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [wasOpen, setWasOpen] = useState(false)

  if (open && !wasOpen) {
    setWasOpen(true)
    setForm(
      buildSubscriptionForm(null, {
        warehouse_id: defaultWarehouseId ? String(defaultWarehouseId) : '',
      }),
    )
    setError('')
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.account_id || !form.product_id) {
      setError('Select an Account and a Product.')
      return
    }
    setSubmitting(true)
    try {
      const { response, data } = await createCustomerSubscription(
        workspaceSlug,
        buildSubscriptionPayload(form, { includeFirstInvoice: canCreateInvoice }),
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || data?.detail || 'Could not create the subscription.')
        return
      }
      onCreated?.(data)
    } catch {
      setError('Network error while creating the subscription.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="New Customer Subscription"
      subtitle="Recurring billing to your own customer in GHS. Each interval creates a Draft invoice."
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
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-subscription-form"
            variant="primary"
            disabled={submitting}
            className="font-semibold"
          >
            {submitting ? 'Saving...' : 'Save Subscription'}
          </Button>
        </>
      }
    >
      <form id="create-subscription-form" onSubmit={handleSubmit} className="space-y-3.5">
        <FeedbackNotice tone="danger" message={error} />
        <CustomerSubscriptionFields
          idPrefix="new-sub"
          form={form}
          onChange={setForm}
          options={options}
          inventoryEnabled={inventoryEnabled}
          disabled={submitting}
        />
        {canCreateInvoice && form.status === 'Active' ? (
          <Checkbox
            id="new-sub-first-invoice"
            checked={form.generate_first_invoice}
            disabled={submitting}
            onChange={(e) => setForm({ ...form, generate_first_invoice: e.target.checked })}
            label="Generate first Draft invoice now"
          />
        ) : null}
      </form>
    </Modal>
  )
}
