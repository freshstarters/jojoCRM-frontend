import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { FieldLabel } from '../components/crm/FieldLabel.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import { RecordRelationPicker } from '../components/crm/RecordRelationPicker.jsx'
import {
  RecordSharingControl,
  SharingBadge,
} from '../components/crm/RecordSharingControl.jsx'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import {
  MiniDonutChart,
  SummaryChartCard,
} from '../components/crm/SummaryMiniCharts.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  filterWritablePayload,
  getObjectRights,
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'

const CONSENT_FILTER_OPTIONS = [
  { value: '', label: 'All consent' },
  { value: 'on', label: 'SMS consent on' },
  { value: 'off', label: 'SMS consent off' },
]

const CONSENT_FIELD_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

const EMPTY_FORM = {
  name: '',
  title: '',
  account_id: '',
  phone: '',
  email: '',
  sms_consent: 'off',
  notes: '',
  visibility: 'workspace',
  shared_role_id: '',
}

const CONTACT_FIELD_MAP = { account_id: 'account' }

export function ContactsPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenLinkedRecord,
  onRecordVisit,
  onCreatePolicy,
  onAuditRecorded,
  onSessionExpired,
}) {
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const canRecordVisit = Boolean(
    onRecordVisit &&
      Array.isArray(workspace?.enabled_object_keys) &&
      workspace.enabled_object_keys.includes('visit') &&
      getObjectRights(permissions, 'visit').canCreate,
  )
  const canCreatePolicy = Boolean(
    onCreatePolicy &&
      Array.isArray(workspace?.enabled_object_keys) &&
      workspace.enabled_object_keys.includes('policy') &&
      getObjectRights(permissions, 'policy').canCreate,
  )

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'contact',
    permissions,
    permissionsRevision,
    urlInspectRecordId,
    onInspectRecord,
    onCloseInspect,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const fr = pane.fieldRights
  const hideName = isFieldHidden(fr, 'name')
  const hideTitle = isFieldHidden(fr, 'title')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideEmail = isFieldHidden(fr, 'email')
  const hidePhone = isFieldHidden(fr, 'phone')
  const hideConsent = isFieldHidden(fr, 'sms_consent')
  const hideNotes = isFieldHidden(fr, 'notes')

  const smsConsentedCount = Number(pane.summary?.sms_consented_count ?? 0)
  const smsNonConsentedCount = Math.max(0, Number(pane.totalCount || 0) - smsConsentedCount)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)

  const active = pane.activeRecord
  const formValues = draft ?? {
    name: active?.name || '',
    title: active?.title || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    phone: active?.phone || '',
    email: active?.email || '',
    sms_consent: active?.sms_consent ? 'on' : 'off',
    notes: active?.notes || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'name', label: 'Name' }]
    if (!hideAccount) cols.push({ key: 'account', label: 'Account' })
    if (!hideTitle) cols.push({ key: 'title', label: 'Title' })
    if (!hideEmail) cols.push({ key: 'email', label: 'Email' })
    if (!hidePhone) cols.push({ key: 'phone', label: 'Phone' })
    if (!hideConsent) cols.push({ key: 'consent', label: 'SMS consent' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideAccount, hideTitle, hideEmail, hidePhone, hideConsent])

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideName && !isFieldReadOnly(fr, 'name') && !createForm.name.trim()) {
      setCreateError(`${contactLabel} name is required.`)
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this record with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        name: createForm.name.trim(),
        title: createForm.title.trim(),
        account_id: createForm.account_id ? Number(createForm.account_id) : null,
        phone: createForm.phone.trim(),
        email: createForm.email.trim(),
        sms_consent: createForm.sms_consent === 'on',
        notes: createForm.notes,
      },
      fr,
      CONTACT_FIELD_MAP,
    )
    const res = await pane.createRecord({
      ...fieldPayload,
      visibility: createForm.visibility,
      ...(createForm.visibility === 'role'
        ? { shared_role_id: Number(createForm.shared_role_id) }
        : {}),
    })
    setCreating(false)
    if (!res.ok) {
      if (res.error) setCreateError(res.error)
      return
    }
    setCreateOpen(false)
  }

  async function handleSaveInspector() {
    const fieldPayload = filterWritablePayload(
      {
        name: formValues.name.trim(),
        title: formValues.title.trim(),
        account_id: formValues.account_id ? Number(formValues.account_id) : null,
        phone: formValues.phone.trim(),
        email: formValues.email.trim(),
        sms_consent: formValues.sms_consent === 'on',
        notes: formValues.notes,
      },
      fr,
      CONTACT_FIELD_MAP,
    )
    const sharingPayload = active?.can_manage_sharing
      ? {
          visibility: formValues.visibility,
          shared_role_id:
            formValues.visibility === 'role' && formValues.shared_role_id
              ? Number(formValues.shared_role_id)
              : null,
        }
      : {}
    const ok = await pane.saveInspectorRecord({
      ...fieldPayload,
      ...sharingPayload,
    })
    if (ok) {
      setDraft(null)
    }
  }

  function handleInspect(recordId) {
    setDraft(null)
    pane.openInspector(recordId)
  }

  return (
    <>
      <CrmListPage
        id="pane-contacts"
        title={contactPlural}
        subtitle={`People in ${workspace?.name || 'this workspace'}. A ${contactLabel.toLowerCase()} can sit on an Account or remain standalone.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel={`New ${contactLabel}`}
        onCreateClick={openCreateModal}
        stats={[
          {
            label: `Visible ${contactPlural.toLowerCase()}`,
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          ...(!hideConsent
            ? [
                {
                  label: 'SMS consent on',
                  value: pane.summary?.sms_consented_count ?? 0,
                  caption: 'Opted-in preference flag',
                },
              ]
            : []),
        ]}
        statsAddon={
          !hideConsent ? (
            <SummaryChartCard title="SMS consent" subtitle="Marketing opt-in status">
              <MiniDonutChart
                items={[
                  { label: 'Opted in', count: smsConsentedCount, color: '#10b981' },
                  { label: 'Not opted', count: smsNonConsentedCount, color: '#64748b' },
                ]}
                centerValue={pane.totalCount}
                centerLabel="total"
                emptyLabel={`No ${contactPlural.toLowerCase()} yet`}
              />
            </SummaryChartCard>
          ) : null
        }
        toolbarCaption={`Open a ${contactLabel.toLowerCase()} to edit details, inspect linked records, or log activities.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder={`Search ${contactPlural.toLowerCase()}...`}
        filters={
          <>
            {!hideAccount ? (
              <div className="w-48">
                <RecordRelationPicker
                  id="contact-account-filter"
                  ariaLabel={`Filter ${contactPlural.toLowerCase()} by account`}
                  workspaceSlug={workspace?.slug}
                  objectKey="account"
                  objectPluralLabel="Accounts"
                  value={pane.filters.account_id || ''}
                  fallbackOptions={pane.optionsData.accounts || []}
                  emptyLabel="All accounts"
                  searchPlaceholder="Search Accounts..."
                  getOptionMeta={(acc) => acc.city || acc.email || ''}
                  onChange={(val) => pane.updateFilter('account_id', val)}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
            {!hideConsent ? (
              <div className="w-40">
                <Select
                  id="contact-consent-filter"
                  ariaLabel="Filter by SMS consent"
                  value={pane.filters.sms_consent || ''}
                  onChange={(val) => pane.updateFilter('sms_consent', val)}
                  options={CONSENT_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="contact-visibility-filter"
                ariaLabel={`Filter ${contactPlural.toLowerCase()} by sharing`}
                value={pane.filters.visibility || ''}
                onChange={(val) => pane.updateFilter('visibility', val)}
                options={VISIBILITY_FILTER_OPTIONS}
              />
            </div>
          </>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage={`No ${contactPlural.toLowerCase()} yet.`}
        columns={columns}
        renderRow={(con) => (
          <tr
            key={con.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(con.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              <div>{con.name ?? con.display_label}</div>
              {con.source_lead?.record_code ? (
                <div className="text-[11px] text-sub font-normal num-tabular">
                  From {con.source_lead.record_code}
                </div>
              ) : null}
            </td>
            {!hideAccount ? (
              <td className="py-3 px-4 text-sub">
                {con.account?.name || 'Standalone'}
              </td>
            ) : null}
            {!hideTitle ? (
              <td className="py-3 px-4 text-sub">{con.title || 'Not set'}</td>
            ) : null}
            {!hideEmail ? (
              <td className="py-3 px-4 text-sub break-all">{con.email || 'Not set'}</td>
            ) : null}
            {!hidePhone ? (
              <td className="py-3 px-4 text-sub num-tabular">{con.phone || 'Not set'}</td>
            ) : null}
            {!hideConsent ? (
              <td className="py-3 px-4">
                <span
                  className={`badge ${
                    con.sms_consent ? 'badge-success' : 'badge-neutral'
                  }`}
                >
                  {con.sms_consent ? 'On' : 'Off'}
                </span>
              </td>
            ) : null}
            <td className="py-3 px-4">
              <SharingBadge record={con} />
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(con.id)}
                className="px-2.5 py-1 text-xs"
              >
                Inspect
              </Button>
            </td>
          </tr>
        )}
        page={pane.page}
        totalPages={pane.totalPages}
        totalCount={pane.totalCount}
        hasPrevious={pane.hasPrevious}
        hasNext={pane.hasNext}
        onPageChange={pane.setPage}
        itemLabel={contactLabel.toLowerCase()}
        pluralLabel={contactPlural.toLowerCase()}
      />

      <Modal
        open={createOpen}
        title={`Create New ${contactLabel}`}
        subtitle={`Add a ${contactLabel.toLowerCase()}. Linking an Account is optional.`}
        onClose={() => {
          if (!creating) setCreateOpen(false)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-contact-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : `Save ${contactLabel}`}
            </Button>
          </>
        }
      >
        <form id="create-contact-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          {!hideName || !hideTitle ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideName ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-contact-name" label="Name" readOnly={isFieldReadOnly(fr, 'name')} />
                  <input
                    id="new-contact-name"
                    type="text"
                    required={!isFieldReadOnly(fr, 'name')}
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Kofi Boateng"
                    disabled={creating || isFieldReadOnly(fr, 'name')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
              {!hideTitle ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-contact-title" label="Title / Role" readOnly={isFieldReadOnly(fr, 'title')} />
                  <input
                    id="new-contact-title"
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Procurement Lead"
                    disabled={creating || isFieldReadOnly(fr, 'title')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideAccount ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-contact-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
              <RecordRelationPicker
                id="new-contact-account"
                ariaLabel="Account"
                workspaceSlug={workspace?.slug}
                objectKey="account"
                objectPluralLabel="Accounts"
                value={createForm.account_id}
                fallbackOptions={pane.optionsData.accounts || []}
                emptyLabel="Standalone (no Account)"
                searchPlaceholder="Search Accounts..."
                getOptionMeta={(acc) => acc.city || acc.email || ''}
                onChange={(val) => setCreateForm((f) => ({ ...f, account_id: val }))}
                disabled={creating || isFieldReadOnly(fr, 'account')}
                onSessionExpired={onSessionExpired}
              />
            </div>
          ) : null}

          {!hidePhone || !hideEmail ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hidePhone ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-contact-phone" label="Phone" readOnly={isFieldReadOnly(fr, 'phone')} />
                  <input
                    id="new-contact-phone"
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+233 24 000 0000"
                    disabled={creating || isFieldReadOnly(fr, 'phone')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
              {!hideEmail ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-contact-email" label="Email" readOnly={isFieldReadOnly(fr, 'email')} />
                  <input
                    id="new-contact-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="person@company.com.gh"
                    disabled={creating || isFieldReadOnly(fr, 'email')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideConsent ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-contact-consent" label="SMS consent" readOnly={isFieldReadOnly(fr, 'sms_consent')} />
              <Select
                id="new-contact-consent"
                ariaLabel="SMS consent"
                value={createForm.sms_consent}
                onChange={(val) => setCreateForm((f) => ({ ...f, sms_consent: val }))}
                options={CONSENT_FIELD_OPTIONS}
                disabled={creating || isFieldReadOnly(fr, 'sms_consent')}
              />
            </div>
          ) : null}

          {!hideNotes ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-contact-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
              <textarea
                id="new-contact-notes"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={creating || isFieldReadOnly(fr, 'notes')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          <RecordSharingControl
            idPrefix="new-contact-sharing"
            visibility={createForm.visibility}
            sharedRoleId={createForm.shared_role_id}
            roles={pane.optionsData?.roles || []}
            disabled={creating}
            onChange={(next) => setCreateForm((f) => ({ ...f, ...next }))}
          />
        </form>
      </Modal>

      <RecordInspectorDrawer
        open={pane.inspectorOpen}
        onClose={() => {
          setDraft(null)
          pane.closeInspector()
        }}
        objectKey="contact"
        objectLabel={contactLabel}
        contactLabel={contactLabel}
        contactPluralLabel={contactPlural}
        assignees={pane.optionsData?.assignees || []}
        roles={pane.optionsData?.roles || []}
        workspaceSlug={workspace?.slug}
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
        onSave={handleSaveInspector}
        onDelete={pane.deleteActiveRecord}
        onActivityChanged={pane.refreshActiveRecord}
        auditRefreshKey={pane.recordAuditRevision}
        onOpenLinkedRecord={onOpenLinkedRecord}
        onSessionExpired={onSessionExpired}
        badgeText={!hideAccount ? active?.account?.name || 'Standalone' : ''}
        headerActions={
          (canRecordVisit || canCreatePolicy) && active ? (
            <div className="flex items-center gap-1.5">
              {canRecordVisit ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    onRecordVisit({
                      contact_id: active.id,
                      contact: {
                        id: active.id,
                        name: active.name || active.display_label,
                        email: active.email || '',
                        phone: active.phone || '',
                        account: active.account || null,
                      },
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-medium"
                >
                  Record Visit
                </Button>
              ) : null}
              {canCreatePolicy ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    onCreatePolicy({
                      account_id: active.account_id || '',
                      account: active.account || null,
                      contact_id: active.id,
                      contact: {
                        id: active.id,
                        name: active.name || active.display_label,
                        email: active.email || '',
                        phone: active.phone || '',
                        account_id: active.account_id || null,
                        account: active.account || null,
                      },
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-medium"
                >
                  New Policy
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {!hideName || !hideTitle ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideName ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="con-insp-name" label="Name" readOnly={isFieldReadOnly(fr, 'name')} />
                <input
                  id="con-insp-name"
                  type="text"
                  value={formValues.name}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'name')}
                  onChange={(e) => setDraft({ ...formValues, name: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
            {!hideTitle ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="con-insp-title" label="Title" readOnly={isFieldReadOnly(fr, 'title')} />
                <input
                  id="con-insp-title"
                  type="text"
                  value={formValues.title}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'title')}
                  onChange={(e) => setDraft({ ...formValues, title: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideAccount ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="con-insp-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
            <RecordRelationPicker
              id="con-insp-account"
              ariaLabel="Account"
              workspaceSlug={workspace?.slug}
              objectKey="account"
              objectPluralLabel="Accounts"
              value={formValues.account_id}
              selectedRecord={active?.account || null}
              fallbackOptions={pane.optionsData.accounts || []}
              emptyLabel="Standalone (no Account)"
              searchPlaceholder="Search Accounts..."
              getOptionMeta={(acc) => acc.city || acc.email || ''}
              onChange={(val) => setDraft({ ...formValues, account_id: val })}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'account')}
              onSessionExpired={onSessionExpired}
            />
          </div>
        ) : null}

        {!hidePhone || !hideEmail ? (
          <div className="grid grid-cols-2 gap-3">
            {!hidePhone ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="con-insp-phone" label="Phone" readOnly={isFieldReadOnly(fr, 'phone')} />
                <input
                  id="con-insp-phone"
                  type="text"
                  value={formValues.phone}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'phone')}
                  onChange={(e) => setDraft({ ...formValues, phone: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
            {!hideEmail ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="con-insp-email" label="Email" readOnly={isFieldReadOnly(fr, 'email')} />
                <input
                  id="con-insp-email"
                  type="email"
                  value={formValues.email}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'email')}
                  onChange={(e) => setDraft({ ...formValues, email: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideConsent ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="con-insp-consent" label="SMS consent" readOnly={isFieldReadOnly(fr, 'sms_consent')} />
            <Select
              id="con-insp-consent"
              ariaLabel="SMS consent"
              value={formValues.sms_consent}
              onChange={(val) => setDraft({ ...formValues, sms_consent: val })}
              options={CONSENT_FIELD_OPTIONS}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'sms_consent')}
            />
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="con-insp-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
            <textarea
              id="con-insp-notes"
              rows={3}
              value={formValues.notes}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'notes')}
              onChange={(e) => setDraft({ ...formValues, notes: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
      </RecordInspectorDrawer>
    </>
  )
}
