import { SUBSCRIPTION_INTERVALS, SUBSCRIPTION_STATUSES } from '../../service/commercialService.js'
import { DatePicker } from '../DateTimePicker.jsx'
import { Select } from '../Select.jsx'
import { RecordSharingControl } from '../crm/RecordSharingControl.jsx'

export function CustomerSubscriptionFields({
  idPrefix,
  form,
  onChange,
  options = {},
  inventoryEnabled = false,
  disabled = false,
  canManageSharing = true,
}) {
  const accountOptions = (options.accounts || []).map((a) => ({
    value: String(a.id),
    label: a.name,
  }))
  const productOptions = (options.products || []).map((p) => ({
    value: String(p.id),
    label: p.sku ? `${p.name} (${p.sku})` : p.name,
  }))
  const warehouseOptions = [
    { value: '', label: 'No warehouse' },
    ...(options.warehouses || []).map((w) => ({ value: String(w.id), label: w.name })),
  ]

  function suggestAmount(productId, quantity) {
    const product = (options.products || []).find((p) => String(p.id) === String(productId))
    const price = Number(product?.unit_price)
    const qty = Number(quantity)
    if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) return null
    return (price * qty).toFixed(2)
  }

  function handleProductChange(value) {
    const suggested = suggestAmount(value, form.quantity)
    onChange({ ...form, product_id: value, ...(suggested ? { amount: suggested } : {}) })
  }

  function handleQuantityChange(value) {
    const suggested = suggestAmount(form.product_id, value)
    onChange({ ...form, quantity: value, ...(suggested ? { amount: suggested } : {}) })
  }

  return (
    <div className="space-y-3.5 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-account`} className="block font-medium text-main">
            Account
          </label>
          <Select
            id={`${idPrefix}-account`}
            ariaLabel="Account"
            value={form.account_id}
            options={accountOptions}
            placeholder="Select Account"
            disabled={disabled}
            onChange={(value) => onChange({ ...form, account_id: value })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-product`} className="block font-medium text-main">
            Product
          </label>
          <Select
            id={`${idPrefix}-product`}
            ariaLabel="Product"
            value={form.product_id}
            options={productOptions}
            placeholder="Select Product"
            disabled={disabled}
            onChange={handleProductChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-quantity`} className="block font-medium text-main">
            Quantity
          </label>
          <input
            id={`${idPrefix}-quantity`}
            type="number"
            min="0.01"
            step="0.01"
            value={form.quantity}
            disabled={disabled}
            onChange={(e) => handleQuantityChange(e.target.value)}
            className="crm-input w-full px-3 py-2 num-tabular"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={`${idPrefix}-amount`} className="block font-medium text-main">
            Amount per interval (GHS)
          </label>
          <input
            id={`${idPrefix}-amount`}
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            disabled={disabled}
            onChange={(e) => onChange({ ...form, amount: e.target.value })}
            className="crm-input w-full px-3 py-2 num-tabular"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-interval`} className="block font-medium text-main">
            Interval
          </label>
          <Select
            id={`${idPrefix}-interval`}
            ariaLabel="Interval"
            value={form.interval}
            options={SUBSCRIPTION_INTERVALS}
            disabled={disabled}
            onChange={(value) => onChange({ ...form, interval: value })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-status`} className="block font-medium text-main">
            Status
          </label>
          <Select
            id={`${idPrefix}-status`}
            ariaLabel="Status"
            value={form.status}
            options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: s }))}
            disabled={disabled}
            onChange={(value) => onChange({ ...form, status: value })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-next`} className="block font-medium text-main">
            Next billing date
          </label>
          <DatePicker
            id={`${idPrefix}-next`}
            ariaLabel="Next billing date"
            value={form.next_billing_date}
            clearable={false}
            disabled={disabled}
            onChange={(value) => onChange({ ...form, next_billing_date: value })}
          />
        </div>
      </div>

      {inventoryEnabled ? (
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-warehouse`} className="block font-medium text-main">
            Fulfillment warehouse
          </label>
          <Select
            id={`${idPrefix}-warehouse`}
            ariaLabel="Fulfillment warehouse"
            value={form.warehouse_id}
            options={warehouseOptions}
            disabled={disabled}
            onChange={(value) => onChange({ ...form, warehouse_id: value })}
          />
          <p className="text-[11px] text-sub">
            Stock leaves this warehouse only when the Draft invoice is issued.
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-notes`} className="block font-medium text-main">
          Notes
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          rows={2}
          value={form.notes}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          className="crm-input w-full px-3 py-2"
        />
      </div>

      <RecordSharingControl
        idPrefix={`${idPrefix}-sharing`}
        visibility={form.visibility}
        sharedRoleId={form.shared_role_id}
        roles={options.roles || []}
        disabled={disabled}
        canManageSharing={canManageSharing}
        onChange={(next) => onChange({ ...form, ...next })}
      />
    </div>
  )
}
