import { useState } from 'react'
import { createCrmRecord } from '../../service/crmService.js'
import { formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { Select } from '../Select.jsx'

const DEFAULT_METHODS = [
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'MTN Mobile Money', label: 'MTN Mobile Money' },
  { value: 'Telecel Cash', label: 'Telecel Cash' },
  { value: 'AirtelTigo Money', label: 'AirtelTigo Money' },
  { value: 'Cash (GHS)', label: 'Cash (GHS)' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Other', label: 'Other' },
]

export function RecordPaymentModal({
  open,
  onClose,
  workspaceSlug,
  invoice,
  paymentMethods = [],
  onPaymentRecorded,
  onSessionExpired,
}) {
  const remaining = invoice ? Number(invoice.balance_due ?? 0) : 0
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Bank Transfer')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [prevInvoiceId, setPrevInvoiceId] = useState(null)

  if (open && invoice && invoice.id !== prevInvoiceId) {
    setPrevInvoiceId(invoice.id)
    setAmount(remaining > 0 ? remaining.toFixed(2) : '')
    setMethod('Bank Transfer')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setReference('')
    setNotes('')
    setError('')
  } else if (!open && prevInvoiceId !== null) {
    setPrevInvoiceId(null)
  }

  const methodOptions =
    Array.isArray(paymentMethods) && paymentMethods.length > 0
      ? paymentMethods.map((m) => ({ value: m, label: m }))
      : DEFAULT_METHODS

  async function handleSubmit(event) {
    event.preventDefault()
    if (!invoice || !workspaceSlug) return
    setError('')
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Payment amount must be greater than zero.')
      return
    }
    if (parsedAmount > remaining + 0.0001) {
      setError(
        `Payment of ${formatGhs(parsedAmount)} exceeds the remaining unpaid balance of ${formatGhs(remaining)}.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const { response, data } = await createCrmRecord(workspaceSlug, 'payment', {
        invoice_id: invoice.id,
        amount: parsedAmount.toFixed(2),
        payment_date: paymentDate,
        method,
        status: 'Recorded',
        reference: reference.trim(),
        notes: notes.trim(),
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || data?.detail || 'Could not record payment.')
        return
      }
      await onPaymentRecorded?.(data)
      onClose()
    } catch {
      setError('Network error while recording payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Record Customer Payment"
      subtitle="Log a bank transfer, mobile money, cash, or cheque payment against this invoice."
      maxWidthClass="max-w-md"
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
            className="px-4 py-1.5 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="record-payment-form"
            variant="primary"
            disabled={submitting}
            className="px-4 py-1.5 text-xs font-semibold"
          >
            {submitting ? 'Saving...' : 'Save Payment'}
          </Button>
        </>
      }
    >
      <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <FeedbackNotice tone="danger" message={error} />

        {invoice ? (
          <div className="p-3.5 rounded-lg crm-subtle space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-main">{invoice.invoice_number}</span>
              <span className="text-sub">{invoice.account?.name || 'No Account'}</span>
            </div>
            <div className="flex items-center justify-between text-sub">
              <span>Invoice total:</span>
              <span className="num-tabular font-medium text-main">
                {formatGhs(invoice.total_amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sub">
              <span>Already paid:</span>
              <span className="num-tabular font-medium text-emerald-600 dark:text-emerald-400">
                {formatGhs(invoice.amount_paid)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t crm-border">
              <span className="font-medium text-main">Remaining balance:</span>
              <span className="num-tabular font-bold text-main">
                {formatGhs(invoice.balance_due)}
              </span>
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="paymentAmountInput" className="block font-medium text-body mb-1">
            Payment Amount (GHS)
          </label>
          <input
            id="paymentAmountInput"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            className="crm-input w-full px-3 py-2 text-xs num-tabular"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="paymentMethodSelect" className="block font-medium text-body mb-1">
              Payment Method
            </label>
            <Select
              id="paymentMethodSelect"
              ariaLabel="Payment method"
              value={method}
              onChange={setMethod}
              options={methodOptions}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="paymentDateInput" className="block font-medium text-body mb-1">
              Payment Date
            </label>
            <input
              id="paymentDateInput"
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              disabled={submitting}
              className="crm-input w-full px-2.5 py-2 text-xs"
            />
          </div>
        </div>

        <div>
          <label htmlFor="paymentReferenceInput" className="block font-medium text-body mb-1">
            Reference (optional)
          </label>
          <input
            id="paymentReferenceInput"
            type="text"
            maxLength={120}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. MOMO-TXN-9021 or bank ref"
            disabled={submitting}
            className="crm-input w-full px-3 py-2 text-xs"
          />
        </div>

        <div>
          <label htmlFor="paymentNotesInput" className="block font-medium text-body mb-1">
            Notes (optional)
          </label>
          <textarea
            id="paymentNotesInput"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            className="crm-input w-full px-3 py-2 text-xs"
          />
        </div>
      </form>
    </Modal>
  )
}
