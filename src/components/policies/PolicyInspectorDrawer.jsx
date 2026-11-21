import { useState } from 'react'
import {
  POLICY_STATUSES,
  getPolicyStatusBadgeClass,
} from '../../service/commercialService.js'
import {
  filterWritablePayload,
  isFieldHidden,
  isFieldReadOnly,
} from '../../service/crmService.js'
import { formatGhs } from '../../utils/formatters.js'
import { DatePicker } from '../DateTimePicker.jsx'
import { Select } from '../Select.jsx'
import { FieldLabel } from '../crm/FieldLabel.jsx'
import { RecordInspectorDrawer } from '../crm/RecordInspectorDrawer.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'

export function PolicyInspectorDrawer({
  open,
  onClose,
  workspace,
  workspaceSlug,
  user,
  permissions,
  pane,
  contactLabel = 'Contact',
  contactPlural = 'Contacts',
  onOpenLinkedRecord,
  onPolicyMutated,
  onSessionExpired,
}) {
  const active = pane.activeRecord
  const fr = pane.fieldRights
  const enabledKeys = new Set(workspace?.enabled_object_keys || [])
  const productEnabled = enabledKeys.has('product')

  const [draft, setDraft] = useState(null)
  const [pickedProduct, setPickedProduct] = useState(null)
  const [pickedAccount, setPickedAccount] = useState(null)
  const [pickedContact, setPickedContact] = useState(null)
  const [prevActiveId, setPrevActiveId] = useState(null)

  if (active?.id && active.id !== prevActiveId) {
    setPrevActiveId(active.id)
    setDraft(null)
    setPickedProduct(null)
    setPickedAccount(null)
    setPickedContact(null)
  }

  const hideProduct = isFieldHidden(fr, 'product')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hidePremium = isFieldHidden(fr, 'premium')
  const hideStatus = isFieldHidden(fr, 'status')
  const hideRenewal = isFieldHidden(fr, 'renewal_date')
  const hideNotes = isFieldHidden(fr, 'notes')

  const formValues = draft ?? {
    product_id: active?.product_id ? String(active.product_id) : '',
    product_name: active?.product_name || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    premium: active?.premium ?? '0.00',
    status: active?.status || 'Active',
    renewal_date: active?.renewal_date || '',
    notes: active?.notes || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const allContacts = pane.optionsData?.contacts || []
  const compatibleFallbackContacts = formValues.account_id
    ? allContacts.filter(
        (c) => !c.account_id || String(c.account_id) === String(formValues.account_id),
      )
    : allContacts

  const statusOptions = (pane.optionsData?.constants?.policy_statuses || POLICY_STATUSES).map(
    (s) => ({ value: s, label: s }),
  )

  function handleProductSelect(val, rec) {
    setPickedProduct(rec || null)
    setDraft({
      ...formValues,
      product_id: val,
      product_name: rec ? rec.name || '' : formValues.product_name,
    })
  }

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
    const raw = {
      product_id: formValues.product_id ? Number(formValues.product_id) : null,
      product_name: formValues.product_name,
      account_id: formValues.account_id ? Number(formValues.account_id) : null,
      contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
      premium: formValues.premium,
      status: formValues.status,
      renewal_date: formValues.renewal_date,
      notes: formValues.notes,
    }
    const payload = filterWritablePayload(raw, fr, {
      product_id: 'product',
      product_name: 'product',
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
      onPolicyMutated?.()
    }
  }

  return (
    <RecordInspectorDrawer
      open={open}
      onClose={() => {
        setDraft(null)
        onClose()
      }}
      objectKey="policy"
      objectLabel="Policy"
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
      error={pane.inspectorError}
      notice={pane.actionNotice}
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
          onPolicyMutated?.()
        }
        return res
      }}
      onActivityChanged={pane.refreshActiveRecord}
      auditRefreshKey={pane.recordAuditRevision}
      onOpenLinkedRecord={onOpenLinkedRecord}
      onSessionExpired={onSessionExpired}
      badgeText={!hideStatus ? active?.status || '' : ''}
      badgeClassName={getPolicyStatusBadgeClass(active?.status)}
    >
      {!hideProduct ? (
        <div className="space-y-2">
          {productEnabled ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="pol-insp-product"
                label="Catalog Product"
                readOnly={isFieldReadOnly(fr, 'product')}
              />
              <RecordRelationPicker
                id="pol-insp-product"
                ariaLabel="Catalog Product"
                workspaceSlug={workspaceSlug}
                objectKey="product"
                objectPluralLabel="Products"
                value={formValues.product_id}
                selectedRecord={pickedProduct || active?.product || null}
                fallbackOptions={pane.optionsData?.products || []}
                allowEmpty
                emptyLabel="Custom finance product"
                searchPlaceholder="Search Products..."
                getOptionMeta={(p) =>
                  [p.sku, p.unit_price !== undefined ? formatGhs(p.unit_price) : '']
                    .filter(Boolean)
                    .join(' · ')
                }
                onChange={handleProductSelect}
                disabled={
                  !pane.rights.canUpdate ||
                  pane.savingInspector ||
                  isFieldReadOnly(fr, 'product')
                }
                onSessionExpired={onSessionExpired}
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <FieldLabel
              htmlFor="pol-insp-product-name"
              label="Finance product name"
              readOnly={isFieldReadOnly(fr, 'product')}
            />
            <input
              id="pol-insp-product-name"
              type="text"
              value={formValues.product_name}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'product')
              }
              onChange={(e) => setDraft({ ...formValues, product_name: e.target.value })}
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
                htmlFor="pol-insp-account"
                label="Account"
                readOnly={isFieldReadOnly(fr, 'account')}
              />
              <RecordRelationPicker
                id="pol-insp-account"
                ariaLabel="Account"
                workspaceSlug={workspaceSlug}
                objectKey="account"
                objectPluralLabel="Accounts"
                value={formValues.account_id}
                selectedRecord={pickedAccount || active?.account || null}
                fallbackOptions={pane.optionsData?.accounts || []}
                allowEmpty
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
                htmlFor="pol-insp-contact"
                label={contactLabel}
                readOnly={isFieldReadOnly(fr, 'contact')}
              />
              <RecordRelationPicker
                id="pol-insp-contact"
                ariaLabel={contactLabel}
                workspaceSlug={workspaceSlug}
                objectKey="contact"
                objectPluralLabel={contactPlural}
                value={formValues.contact_id}
                selectedRecord={pickedContact || active?.contact || null}
                fallbackOptions={compatibleFallbackContacts}
                queryParams={
                  formValues.account_id
                    ? { compatible_account_id: formValues.account_id }
                    : undefined
                }
                allowEmpty
                emptyLabel={`No ${contactLabel}`}
                searchPlaceholder={`Search ${contactPlural}...`}
                getOptionMeta={(c) => c.email || c.phone || ''}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {!hidePremium ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="pol-insp-premium"
              label="Premium (GHS)"
              readOnly={isFieldReadOnly(fr, 'premium')}
            />
            <input
              id="pol-insp-premium"
              type="number"
              step="0.01"
              min="0"
              value={formValues.premium}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'premium')
              }
              onChange={(e) => setDraft({ ...formValues, premium: e.target.value })}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
        ) : null}

        {!hideStatus ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="pol-insp-status"
              label="Status"
              readOnly={isFieldReadOnly(fr, 'status')}
            />
            <Select
              id="pol-insp-status"
              ariaLabel="Policy status"
              value={formValues.status}
              onChange={(val) => setDraft({ ...formValues, status: val })}
              options={statusOptions}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'status')
              }
            />
          </div>
        ) : null}

        {!hideRenewal ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="pol-insp-renewal"
              label="Renewal date"
              readOnly={isFieldReadOnly(fr, 'renewal_date')}
            />
            <DatePicker
              id="pol-insp-renewal"
              ariaLabel="Renewal date"
              value={formValues.renewal_date}
              onChange={(val) => setDraft({ ...formValues, renewal_date: val })}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'renewal_date')
              }
            />
          </div>
        ) : null}
      </div>

      {!hideNotes ? (
        <div className="space-y-1">
          <FieldLabel
            htmlFor="pol-insp-notes"
            label="Notes"
            readOnly={isFieldReadOnly(fr, 'notes')}
          />
          <textarea
            id="pol-insp-notes"
            rows={3}
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
    </RecordInspectorDrawer>
  )
}
