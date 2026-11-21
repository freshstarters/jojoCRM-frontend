import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { FieldLabel } from '../components/crm/FieldLabel.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import {
  RecordSharingControl,
  SharingBadge,
} from '../components/crm/RecordSharingControl.jsx'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import {
  HorizontalBarChart,
  SummaryChartCard,
} from '../components/crm/SummaryMiniCharts.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  filterWritablePayload,
  getObjectRights,
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'

const EMPTY_FORM = {
  name: '',
  city: '',
  phone: '',
  email: '',
  notes: '',
  visibility: 'workspace',
  shared_role_id: '',
}

export function AccountsPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenLinkedRecord,
  onCreatePolicy,
  onAuditRecorded,
  onSessionExpired,
}) {
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const canCreatePolicy = Boolean(
    onCreatePolicy &&
      Array.isArray(workspace?.enabled_object_keys) &&
      workspace.enabled_object_keys.includes('policy') &&
      getObjectRights(permissions, 'policy').canCreate,
  )

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'account',
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
  const hideCity = isFieldHidden(fr, 'city')
  const hidePhone = isFieldHidden(fr, 'phone')
  const hideEmail = isFieldHidden(fr, 'email')
  const hideNotes = isFieldHidden(fr, 'notes')
  const hideName = isFieldHidden(fr, 'name')

  const cityChartItems = useMemo(() => {
    const raw = pane.summary?.city_counts
    if (!Array.isArray(raw) || raw.length === 0) return []
    const items = raw.map((row) => ({
      label: row.city || 'No city',
      count: Number(row.count || 0),
    }))
    if (items.length <= 4) return items
    const topThree = items.slice(0, 3)
    const otherCount = items.slice(3).reduce((sum, item) => sum + item.count, 0)
    return [...topThree, { label: 'Other', count: otherCount }]
  }, [pane.summary?.city_counts])

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)

  const cityOptions = useMemo(() => {
    const cities = pane.summary?.cities || []
    return [
      { value: '', label: 'All cities' },
      ...cities.map((city) => ({ value: city, label: city })),
    ]
  }, [pane.summary?.cities])

  const active = pane.activeRecord
  const formValues = draft ?? {
    name: active?.name || '',
    city: active?.city || '',
    phone: active?.phone || '',
    email: active?.email || '',
    notes: active?.notes || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'name', label: 'Company' }]
    if (!hideCity) cols.push({ key: 'city', label: 'City' })
    if (!hidePhone) cols.push({ key: 'phone', label: 'Phone' })
    if (!hideEmail) cols.push({ key: 'email', label: 'Email' })
    cols.push({ key: 'contacts', label: contactPlural })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideCity, hidePhone, hideEmail, contactPlural])

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideName && !isFieldReadOnly(fr, 'name') && !createForm.name.trim()) {
      setCreateError('Company name is required.')
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this account with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        name: createForm.name.trim(),
        city: createForm.city.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim(),
        notes: createForm.notes,
      },
      fr,
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
        city: formValues.city.trim(),
        phone: formValues.phone.trim(),
        email: formValues.email.trim(),
        notes: formValues.notes,
      },
      fr,
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
        id="pane-accounts"
        title="Accounts"
        subtitle={`Companies and organizations in ${workspace?.name || 'this workspace'}.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Account"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Total accounts',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          ...(!hideCity
            ? [
                {
                  label: 'Cities covered',
                  value: (pane.summary?.cities || []).length,
                  caption: 'Distinct locations',
                },
              ]
            : []),
        ]}
        statsAddon={
          !hideCity ? (
            <SummaryChartCard title="Companies by city" subtitle="Filtered distribution">
              <HorizontalBarChart items={cityChartItems} emptyLabel="No city data yet" />
            </SummaryChartCard>
          ) : null
        }
        toolbarCaption={`Open a row to update details, inspect linked ${contactPlural.toLowerCase()}, or log activities.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search accounts..."
        filters={
          <>
            {!hideCity ? (
              <div className="w-40">
                <Select
                  id="account-city-filter"
                  ariaLabel="Filter accounts by city"
                  value={pane.filters.city || ''}
                  onChange={(val) => pane.updateFilter('city', val)}
                  options={cityOptions}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="account-visibility-filter"
                ariaLabel="Filter accounts by sharing"
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
        emptyMessage="No accounts yet."
        columns={columns}
        renderRow={(acc) => (
          <tr
            key={acc.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(acc.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              <div>{acc.name ?? acc.display_label}</div>
              {acc.source_lead?.record_code ? (
                <div className="text-[11px] text-sub font-normal num-tabular">
                  From {acc.source_lead.record_code}
                </div>
              ) : null}
            </td>
            {!hideCity ? (
              <td className="py-3 px-4 text-sub">{acc.city || 'Not set'}</td>
            ) : null}
            {!hidePhone ? (
              <td className="py-3 px-4 text-sub num-tabular">{acc.phone || 'Not set'}</td>
            ) : null}
            {!hideEmail ? (
              <td className="py-3 px-4 text-sub break-all">{acc.email || 'Not set'}</td>
            ) : null}
            <td className="py-3 px-4 num-tabular text-main">
              {acc.contacts_count ?? 0}
            </td>
            <td className="py-3 px-4">
              <SharingBadge record={acc} />
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(acc.id)}
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
        itemLabel="account"
        pluralLabel="accounts"
      />

      <Modal
        open={createOpen}
        title="Create New Account"
        subtitle="Add a company or organization to this workspace."
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
              form="create-account-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Account'}
            </Button>
          </>
        }
      >
        <form id="create-account-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          {!hideName ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-account-name" label="Company name" readOnly={isFieldReadOnly(fr, 'name')} />
              <input
                id="new-account-name"
                type="text"
                required={!isFieldReadOnly(fr, 'name')}
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Meridian Port Services"
                disabled={creating || isFieldReadOnly(fr, 'name')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}
          {!hideCity || !hidePhone ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideCity ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-account-city" label="City" readOnly={isFieldReadOnly(fr, 'city')} />
                  <input
                    id="new-account-city"
                    type="text"
                    value={createForm.city}
                    onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Accra"
                    disabled={creating || isFieldReadOnly(fr, 'city')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
              {!hidePhone ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-account-phone" label="Phone" readOnly={isFieldReadOnly(fr, 'phone')} />
                  <input
                    id="new-account-phone"
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+233 30 000 0000"
                    disabled={creating || isFieldReadOnly(fr, 'phone')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {!hideEmail ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-account-email" label="Email" readOnly={isFieldReadOnly(fr, 'email')} />
              <input
                id="new-account-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="ops@company.com.gh"
                disabled={creating || isFieldReadOnly(fr, 'email')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}
          {!hideNotes ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-account-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
              <textarea
                id="new-account-notes"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={creating || isFieldReadOnly(fr, 'notes')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}
          <RecordSharingControl
            idPrefix="new-account-sharing"
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
        objectKey="account"
        objectLabel="Account"
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
        badgeText={!hideCity ? active?.city || '' : ''}
        headerActions={
          canCreatePolicy && active ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onCreatePolicy({
                  account_id: active.id,
                  account: {
                    id: active.id,
                    name: active.name || active.display_label,
                    city: active.city || '',
                    email: active.email || '',
                  },
                })
              }
              className="px-2.5 py-1 text-[11px] font-medium"
            >
              New Policy
            </Button>
          ) : null
        }
      >
        {!hideName ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="acc-insp-name" label="Company name" readOnly={isFieldReadOnly(fr, 'name')} />
            <input
              id="acc-insp-name"
              type="text"
              value={formValues.name}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'name')}
              onChange={(e) => setDraft({ ...formValues, name: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
        {!hideCity || !hidePhone ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideCity ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="acc-insp-city" label="City" readOnly={isFieldReadOnly(fr, 'city')} />
                <input
                  id="acc-insp-city"
                  type="text"
                  value={formValues.city}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'city')}
                  onChange={(e) => setDraft({ ...formValues, city: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
            {!hidePhone ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="acc-insp-phone" label="Phone" readOnly={isFieldReadOnly(fr, 'phone')} />
                <input
                  id="acc-insp-phone"
                  type="text"
                  value={formValues.phone}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'phone')}
                  onChange={(e) => setDraft({ ...formValues, phone: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {!hideEmail ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="acc-insp-email" label="Email" readOnly={isFieldReadOnly(fr, 'email')} />
            <input
              id="acc-insp-email"
              type="email"
              value={formValues.email}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'email')}
              onChange={(e) => setDraft({ ...formValues, email: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="acc-insp-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
            <textarea
              id="acc-insp-notes"
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
