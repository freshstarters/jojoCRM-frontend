import { SUBSCRIPTION_INTERVALS, SUBSCRIPTION_STATUSES } from '../../service/commercialService.js'
import { isFieldHidden, isFieldReadOnly } from '../../service/crmService.js'
import { DatePicker } from '../DateTimePicker.jsx'
import { Select } from '../Select.jsx'
import { FieldLabel } from '../crm/FieldLabel.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'
import { RecordSharingControl } from '../crm/RecordSharingControl.jsx'

export function CustomerSubscriptionFields({
  idPrefix,
  workspaceSlug,
  form,
  onChange,
  options = {},
  fieldRights = {},
  selectedAccount = null,
  selectedProduct = null,
  inventoryEnabled = false,
  disabled = false,
  canManageSharing = true,
  showSharing = true,
  onSessionExpired,
}) {
  const hideAccount = isFieldHidden(fieldRights, 'account')
  const hideProduct = isFieldHidden(fieldRights, 'product')
  const hideQuantity = isFieldHidden(fieldRights, 'quantity')
  const hideAmount = isFieldHidden(fieldRights, 'amount')
  const hideInterval = isFieldHidden(fieldRights, 'interval')
  const hideStatus = isFieldHidden(fieldRights, 'status')
  const hideNextBilling = isFieldHidden(fieldRights, 'next_billing_date')
  const hideWarehouse = isFieldHidden(fieldRights, 'warehouse')
  const hideNotes = isFieldHidden(fieldRights, 'notes')

  const roAccount = isFieldReadOnly(fieldRights, 'account')
  const roProduct = isFieldReadOnly(fieldRights, 'product')
  const roQuantity = isFieldReadOnly(fieldRights, 'quantity')
  const roAmount = isFieldReadOnly(fieldRights, 'amount')
  const roInterval = isFieldReadOnly(fieldRights, 'interval')
  const roStatus = isFieldReadOnly(fieldRights, 'status')
  const roNextBilling = isFieldReadOnly(fieldRights, 'next_billing_date')
  const roWarehouse = isFieldReadOnly(fieldRights, 'warehouse')
  const roNotes = isFieldReadOnly(fieldRights, 'notes')

  const warehouseOptions = [
    { value: '', label: 'No warehouse' },
    ...(options.warehouses || []).map((w) => ({ value: String(w.id), label: w.name })),
  ]

  function suggestAmount(productId, quantity, pickedProduct = null) {
    if (hideAmount || roAmount) return null
    const product =
      pickedProduct ||
      (options.products || []).find((p) => String(p.id) === String(productId))
    const price = Number(product?.unit_price)
    const qty = Number(quantity)
    if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) return null
    return (price * qty).toFixed(2)
  }

  function handleProductChange(value, rec) {
    const suggested = suggestAmount(value, form.quantity, rec)
    onChange({ ...form, product_id: value, ...(suggested ? { amount: suggested } : {}) })
  }

  function handleQuantityChange(value) {
    const suggested = suggestAmount(form.product_id, value)
    onChange({ ...form, quantity: value, ...(suggested ? { amount: suggested } : {}) })
  }

  return (
    <div className="space-y-3.5 text-xs">
      {!hideAccount || !hideProduct ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!hideAccount ? (
            <div className="space-y-1">
              <FieldLabel htmlFor={`${idPrefix}-account`} label="Account" readOnly={roAccount} />
              <RecordRelationPicker
                id={`${idPrefix}-account`}
                ariaLabel="Account"
                workspaceSlug={workspaceSlug}
                objectKey="account"
                objectPluralLabel="accounts"
                value={form.account_id}
                selectedRecord={selectedAccount}
                fallbackOptions={options.accounts || []}
                allowEmpty={false}
                placeholder="Select Account"
                searchPlaceholder="Search accounts..."
                disabled={disabled || roAccount}
                onChange={(value) => onChange({ ...form, account_id: value })}
                onSessionExpired={onSessionExpired}
              />
            </div>
          ) : null}
          {!hideProduct ? (
            <div className="space-y-1">
              <FieldLabel htmlFor={`${idPrefix}-product`} label="Product" readOnly={roProduct} />
              <RecordRelationPicker
                id={`${idPrefix}-product`}
                ariaLabel="Product"
                workspaceSlug={workspaceSlug}
                objectKey="product"
                objectPluralLabel="products"
                value={form.product_id}
                selectedRecord={selectedProduct}
                fallbackOptions={options.products || []}
                allowEmpty={false}
                placeholder="Select Product"
                searchPlaceholder="Search products..."
                getOptionLabel={(p) => (p?.sku ? `${p.name} (${p.sku})` : p?.name || '')}
                disabled={disabled || roProduct}
                onChange={handleProductChange}
                onSessionExpired={onSessionExpired}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!hideQuantity || !hideAmount ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!hideQuantity ? (
            <div className="space-y-1">
              <FieldLabel htmlFor={`${idPrefix}-quantity`} label="Quantity" readOnly={roQuantity} />
              <input
                id={`${idPrefix}-quantity`}
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                disabled={disabled || roQuantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          ) : null}
          {!hideAmount ? (
            <div className="space-y-1 sm:col-span-2">
              <FieldLabel
                htmlFor={`${idPrefix}-amount`}
                label="Amount per interval (GHS)"
                readOnly={roAmount}
              />
              <input
                id={`${idPrefix}-amount`}
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                disabled={disabled || roAmount}
                onChange={(e) => onChange({ ...form, amount: e.target.value })}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!hideInterval || !hideStatus || !hideNextBilling ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!hideInterval ? (
            <div className="space-y-1">
              <FieldLabel htmlFor={`${idPrefix}-interval`} label="Interval" readOnly={roInterval} />
              <Select
                id={`${idPrefix}-interval`}
                ariaLabel="Interval"
                value={form.interval}
                options={SUBSCRIPTION_INTERVALS}
                disabled={disabled || roInterval}
                onChange={(value) => onChange({ ...form, interval: value })}
              />
            </div>
          ) : null}
          {!hideStatus ? (
            <div className="space-y-1">
              <FieldLabel htmlFor={`${idPrefix}-status`} label="Status" readOnly={roStatus} />
              <Select
                id={`${idPrefix}-status`}
                ariaLabel="Status"
                value={form.status}
                options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: s }))}
                disabled={disabled || roStatus}
                onChange={(value) => onChange({ ...form, status: value })}
              />
            </div>
          ) : null}
          {!hideNextBilling ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor={`${idPrefix}-next`}
                label="Next billing date"
                readOnly={roNextBilling}
              />
              <DatePicker
                id={`${idPrefix}-next`}
                ariaLabel="Next billing date"
                value={form.next_billing_date}
                clearable={false}
                disabled={disabled || roNextBilling}
                onChange={(value) => onChange({ ...form, next_billing_date: value })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {inventoryEnabled && !hideWarehouse ? (
        <div className="space-y-1">
          <FieldLabel
            htmlFor={`${idPrefix}-warehouse`}
            label="Fulfillment warehouse"
            readOnly={roWarehouse}
          />
          <Select
            id={`${idPrefix}-warehouse`}
            ariaLabel="Fulfillment warehouse"
            value={form.warehouse_id}
            options={warehouseOptions}
            disabled={disabled || roWarehouse}
            onChange={(value) => onChange({ ...form, warehouse_id: value })}
          />
          <p className="text-[11px] text-sub">
            Stock leaves this warehouse only when the Draft invoice is issued.
          </p>
        </div>
      ) : null}

      {!hideNotes ? (
        <div className="space-y-1">
          <FieldLabel htmlFor={`${idPrefix}-notes`} label="Notes" readOnly={roNotes} />
          <textarea
            id={`${idPrefix}-notes`}
            rows={2}
            value={form.notes}
            disabled={disabled || roNotes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            className="crm-input w-full px-3 py-2"
          />
        </div>
      ) : null}

      {showSharing ? (
        <RecordSharingControl
          idPrefix={`${idPrefix}-sharing`}
          visibility={form.visibility}
          sharedRoleId={form.shared_role_id}
          roles={options.roles || []}
          disabled={disabled}
          canManageSharing={canManageSharing}
          onChange={(next) => onChange({ ...form, ...next })}
        />
      ) : null}
    </div>
  )
}
