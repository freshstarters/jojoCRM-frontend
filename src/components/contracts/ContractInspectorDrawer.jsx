import { useState } from 'react'
import {
  CONTRACT_STATUSES,
  getContractStatusBadgeClass,
} from '../../service/commercialService.js'
import {
  filterWritablePayload,
  getObjectRights,
  isFieldHidden,
  isFieldReadOnly,
} from '../../service/crmService.js'
import { formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { DatePicker } from '../DateTimePicker.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Select } from '../Select.jsx'
import { FieldLabel } from '../crm/FieldLabel.jsx'
import { RecordInspectorDrawer } from '../crm/RecordInspectorDrawer.jsx'
import { RecordRelationPicker } from '../crm/RecordRelationPicker.jsx'
import { InvoiceLineItemsEditor } from '../invoicing/InvoiceLineItemsEditor.jsx'

export function ContractInspectorDrawer({
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
  onContractMutated,
  onSessionExpired,
}) {
  const active = pane.activeRecord
  const fr = pane.fieldRights
  const enabledKeys = new Set(workspace?.enabled_object_keys || [])
  const productEnabled = enabledKeys.has('product')
  const lineItemEnabled = enabledKeys.has('line_item')
  const lineRights = getObjectRights(permissions, 'line_item')

  const [draft, setDraft] = useState(null)
  const [pickedAccount, setPickedAccount] = useState(null)
  const [pickedContact, setPickedContact] = useState(null)
  const [syncHint, setSyncHint] = useState('')
  const [prevActiveId, setPrevActiveId] = useState(null)

  if (active?.id && active.id !== prevActiveId) {
    setPrevActiveId(active.id)
    setDraft(null)
    setPickedAccount(null)
    setPickedContact(null)
    setSyncHint('')
  }

  const hideTitle = isFieldHidden(fr, 'title')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideStatus = isFieldHidden(fr, 'status')
  const hideValue = isFieldHidden(fr, 'value')
  const hideStart = isFieldHidden(fr, 'start_date')
  const hideEnd = isFieldHidden(fr, 'end_date')
  const hideRenewal = isFieldHidden(fr, 'renewal_date')
  const hideNotes = isFieldHidden(fr, 'notes')

  const formValues = draft ?? {
    title: active?.title || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    status: active?.status || 'Draft',
    value: active?.value ?? '0.00',
    start_date: active?.start_date || '',
    end_date: active?.end_date || '',
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

  const statusOptions = (pane.optionsData?.constants?.contract_statuses || CONTRACT_STATUSES).map(
    (s) => ({ value: s, label: s }),
  )

  const lines = Array.isArray(active?.line_items) ? active.line_items : []
  const linesSum = lines.reduce((sum, li) => sum + Number(li.line_total || 0), 0)

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
    setSyncHint('')
    const raw = {
      title: formValues.title,
      account_id: formValues.account_id ? Number(formValues.account_id) : null,
      contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
      status: formValues.status,
      value: formValues.value === '' ? '0.00' : formValues.value,
      start_date: formValues.start_date,
      end_date: formValues.end_date,
      renewal_date: formValues.renewal_date || null,
      notes: formValues.notes,
    }
    const payload = filterWritablePayload(raw, fr, {
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
      onContractMutated?.()
    }
  }

  function handleSyncValueFromLines() {
    const nextVal = linesSum.toFixed(2)
    setDraft({ ...formValues, value: nextVal })
    setSyncHint(
      `Copied catalog line total (${formatGhs(nextVal)}) into Value (GHS). Click Save Changes to persist.`,
    )
  }

  return (
    <RecordInspectorDrawer
      open={open}
      onClose={() => {
        setDraft(null)
        setSyncHint('')
        onClose()
      }}
      objectKey="contract"
      objectLabel="Contract"
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
      notice={syncHint || pane.actionNotice}
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
          onContractMutated?.()
        }
        return res
      }}
      onActivityChanged={pane.refreshActiveRecord}
      auditRefreshKey={pane.recordAuditRevision}
      onOpenLinkedRecord={onOpenLinkedRecord}
      onSessionExpired={onSessionExpired}
      badgeText={!hideStatus ? active?.status || '' : ''}
      badgeClassName={getContractStatusBadgeClass(active?.status)}
    >
      {!hideTitle ? (
        <div className="space-y-1">
          <FieldLabel
            htmlFor="ctr-insp-title"
            label="Title"
            readOnly={isFieldReadOnly(fr, 'title')}
          />
          <input
            id="ctr-insp-title"
            type="text"
            value={formValues.title}
            disabled={
              !pane.rights.canUpdate ||
              pane.savingInspector ||
              isFieldReadOnly(fr, 'title')
            }
            onChange={(e) => setDraft({ ...formValues, title: e.target.value })}
            className="crm-input w-full px-3 py-2"
          />
        </div>
      ) : null}

      {!hideAccount || !hideContact ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!hideAccount ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="ctr-insp-account"
                label="Account"
                readOnly={isFieldReadOnly(fr, 'account')}
              />
              <RecordRelationPicker
                id="ctr-insp-account"
                ariaLabel="Account"
                workspaceSlug={workspaceSlug}
                objectKey="account"
                objectPluralLabel="Accounts"
                value={formValues.account_id}
                selectedRecord={pickedAccount || active?.account || null}
                fallbackOptions={pane.optionsData?.accounts || []}
                allowEmpty={false}
                emptyLabel="Select Account"
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
                htmlFor="ctr-insp-contact"
                label={contactLabel}
                readOnly={isFieldReadOnly(fr, 'contact')}
              />
              <RecordRelationPicker
                id="ctr-insp-contact"
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
                    : {}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!hideValue ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="ctr-insp-value"
              label="Typed value (GHS)"
              readOnly={isFieldReadOnly(fr, 'value')}
            />
            <input
              id="ctr-insp-value"
              type="number"
              min="0"
              step="0.01"
              value={formValues.value}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'value')
              }
              onChange={(e) => {
                setSyncHint('')
                setDraft({ ...formValues, value: e.target.value })
              }}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
        ) : null}
        {!hideStatus ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="ctr-insp-status"
              label="Status"
              readOnly={isFieldReadOnly(fr, 'status')}
            />
            <Select
              id="ctr-insp-status"
              ariaLabel="Contract status"
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {!hideStart ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="ctr-insp-start"
              label="Start date"
              readOnly={isFieldReadOnly(fr, 'start_date')}
            />
            <DatePicker
              id="ctr-insp-start"
              ariaLabel="Start date"
              required={!isFieldReadOnly(fr, 'start_date')}
              value={formValues.start_date}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'start_date')
              }
              onChange={(val) => setDraft({ ...formValues, start_date: val })}
            />
          </div>
        ) : null}
        {!hideEnd ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="ctr-insp-end"
              label="End date"
              readOnly={isFieldReadOnly(fr, 'end_date')}
            />
            <DatePicker
              id="ctr-insp-end"
              ariaLabel="End date"
              required={!isFieldReadOnly(fr, 'end_date')}
              value={formValues.end_date}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'end_date')
              }
              onChange={(val) => setDraft({ ...formValues, end_date: val })}
            />
          </div>
        ) : null}
        {!hideRenewal ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="ctr-insp-renewal"
              label="Renewal date"
              readOnly={isFieldReadOnly(fr, 'renewal_date')}
            />
            <DatePicker
              id="ctr-insp-renewal"
              ariaLabel="Renewal date"
              value={formValues.renewal_date}
              disabled={
                !pane.rights.canUpdate ||
                pane.savingInspector ||
                isFieldReadOnly(fr, 'renewal_date')
              }
              onChange={(val) => setDraft({ ...formValues, renewal_date: val })}
            />
          </div>
        ) : null}
      </div>

      {!hideNotes ? (
        <div className="space-y-1">
          <FieldLabel
            htmlFor="ctr-insp-notes"
            label="Notes"
            readOnly={isFieldReadOnly(fr, 'notes')}
          />
          <textarea
            id="ctr-insp-notes"
            rows={2}
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

      {lineItemEnabled && active?.line_items_readable ? (
        <div className="pt-3 border-t crm-border space-y-2">
          <FeedbackNotice
            tone="info"
            message="Catalog line totals are informational. Adding or removing a line leaves the typed GHS value unchanged."
          />
          <InvoiceLineItemsEditor
            workspaceSlug={workspaceSlug}
            parentObjectKey="contract"
            parentId={active.id}
            title="Catalog Lines"
            headerExtra={
              !hideValue &&
              pane.rights.canUpdate &&
              !isFieldReadOnly(fr, 'value') &&
              lines.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pane.savingInspector}
                  onClick={handleSyncValueFromLines}
                  className="px-2.5 py-1 text-[11px]"
                >
                  Sync from lines
                </Button>
              ) : null
            }
            items={lines}
            products={pane.optionsData?.products || []}
            productEnabled={productEnabled}
            lineItemEnabled={lineItemEnabled}
            canEdit={
              pane.rights.canUpdate &&
              (lineRights.canCreate || lineRights.canUpdate || lineRights.canDelete)
            }
            onChanged={async () => {
              await pane.refreshActiveRecord()
              onContractMutated?.()
            }}
            onSessionExpired={onSessionExpired}
          />
        </div>
      ) : null}
    </RecordInspectorDrawer>
  )
}
