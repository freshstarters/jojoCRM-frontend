import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import {
  MiniDonutChart,
  SummaryChartCard,
} from '../components/crm/SummaryMiniCharts.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'

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
}

export function ContactsPane({
  workspace,
  user,
  permissions,
  initialInspectRequest = null,
  onInspectRequestConsumed,
  onOpenLinkedRecord,
  onAuditRecorded,
  onSessionExpired,
}) {
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'contact',
    permissions,
    initialInspectRequest,
    onInspectRequestConsumed,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const smsConsentedCount = Number(pane.summary?.sms_consented_count ?? 0)
  const smsNonConsentedCount = Math.max(0, Number(pane.totalCount || 0) - smsConsentedCount)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)

  const accountFilterOptions = useMemo(
    () => [
      { value: '', label: 'All accounts' },
      ...(pane.optionsData.accounts || []).map((acc) => ({
        value: String(acc.id),
        label: acc.name,
      })),
    ],
    [pane.optionsData.accounts],
  )

  const accountSelectOptions = useMemo(
    () => [
      { value: '', label: 'Standalone (no Account)' },
      ...(pane.optionsData.accounts || []).map((acc) => ({
        value: String(acc.id),
        label: acc.name,
      })),
    ],
    [pane.optionsData.accounts],
  )

  const active = pane.activeRecord
  const formValues = draft ?? {
    name: active?.name || '',
    title: active?.title || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    phone: active?.phone || '',
    email: active?.email || '',
    sms_consent: active?.sms_consent ? 'on' : 'off',
    notes: active?.notes || '',
  }

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!createForm.name.trim()) {
      setCreateError(`${contactLabel} name is required.`)
      return
    }
    setCreateError('')
    setCreating(true)
    const res = await pane.createRecord({
      name: createForm.name.trim(),
      title: createForm.title.trim(),
      account_id: createForm.account_id ? Number(createForm.account_id) : null,
      phone: createForm.phone.trim(),
      email: createForm.email.trim(),
      sms_consent: createForm.sms_consent === 'on',
      notes: createForm.notes,
    })
    setCreating(false)
    if (!res.ok) {
      if (res.error) setCreateError(res.error)
      return
    }
    setCreateOpen(false)
  }

  async function handleSaveInspector() {
    const ok = await pane.saveInspectorRecord({
      name: formValues.name.trim(),
      title: formValues.title.trim(),
      account_id: formValues.account_id ? Number(formValues.account_id) : null,
      phone: formValues.phone.trim(),
      email: formValues.email.trim(),
      sms_consent: formValues.sms_consent === 'on',
      notes: formValues.notes,
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
          {
            label: 'SMS consent on',
            value: pane.summary?.sms_consented_count ?? 0,
            caption: 'Opted-in preference flag',
          },
        ]}
        statsAddon={
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
        }
        toolbarCaption={`Open a ${contactLabel.toLowerCase()} to edit details, inspect linked records, or log activities.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder={`Search ${contactPlural.toLowerCase()}...`}
        filters={
          <>
            <div className="w-44">
              <Select
                id="contact-account-filter"
                ariaLabel={`Filter ${contactPlural.toLowerCase()} by account`}
                value={pane.filters.account_id || ''}
                onChange={(val) => pane.updateFilter('account_id', val)}
                options={accountFilterOptions}
              />
            </div>
            <div className="w-40">
              <Select
                id="contact-consent-filter"
                ariaLabel="Filter by SMS consent"
                value={pane.filters.sms_consent || ''}
                onChange={(val) => pane.updateFilter('sms_consent', val)}
                options={CONSENT_FILTER_OPTIONS}
              />
            </div>
          </>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage={`No ${contactPlural.toLowerCase()} yet.`}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'account', label: 'Account' },
          { key: 'title', label: 'Title' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'consent', label: 'SMS consent' },
          { key: 'action', label: 'Action', align: 'right' },
        ]}
        renderRow={(con) => (
          <tr
            key={con.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(con.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              <div>{con.name}</div>
              {con.source_lead?.record_code ? (
                <div className="text-[11px] text-sub font-normal num-tabular">
                  From {con.source_lead.record_code}
                </div>
              ) : null}
            </td>
            <td className="py-3 px-4 text-sub">
              {con.account?.name || 'Standalone'}
            </td>
            <td className="py-3 px-4 text-sub">{con.title || 'Not set'}</td>
            <td className="py-3 px-4 text-sub break-all">{con.email || 'Not set'}</td>
            <td className="py-3 px-4 text-sub num-tabular">{con.phone || 'Not set'}</td>
            <td className="py-3 px-4">
              <span
                className={`badge ${
                  con.sms_consent ? 'badge-success' : 'badge-neutral'
                }`}
              >
                {con.sms_consent ? 'On' : 'Off'}
              </span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-contact-name" className="block font-medium text-body mb-1">
                Name
              </label>
              <input
                id="new-contact-name"
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kofi Boateng"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="new-contact-title" className="block font-medium text-body mb-1">
                Title / Role
              </label>
              <input
                id="new-contact-title"
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Procurement Lead"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-contact-account" className="block font-medium text-body mb-1">
              Account
            </label>
            <Select
              id="new-contact-account"
              ariaLabel="Account"
              value={createForm.account_id}
              onChange={(val) => setCreateForm((f) => ({ ...f, account_id: val }))}
              options={accountSelectOptions}
              disabled={creating}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-contact-phone" className="block font-medium text-body mb-1">
                Phone
              </label>
              <input
                id="new-contact-phone"
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+233 24 000 0000"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="new-contact-email" className="block font-medium text-body mb-1">
                Email
              </label>
              <input
                id="new-contact-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="person@company.com.gh"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-contact-consent" className="block font-medium text-body mb-1">
              SMS consent
            </label>
            <Select
              id="new-contact-consent"
              ariaLabel="SMS consent"
              value={createForm.sms_consent}
              onChange={(val) => setCreateForm((f) => ({ ...f, sms_consent: val }))}
              options={CONSENT_FIELD_OPTIONS}
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="new-contact-notes" className="block font-medium text-body mb-1">
              Notes
            </label>
            <textarea
              id="new-contact-notes"
              rows={2}
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={creating}
              className="crm-input w-full px-3 py-2"
            />
          </div>
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
        onSave={handleSaveInspector}
        onDelete={pane.deleteActiveRecord}
        onActivityChanged={pane.refreshActiveRecord}
        onOpenLinkedRecord={onOpenLinkedRecord}
        onSessionExpired={onSessionExpired}
        badgeText={active?.account?.name || 'Standalone'}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="con-insp-name" className="block font-medium text-body mb-1">
              Name
            </label>
            <input
              id="con-insp-name"
              type="text"
              value={formValues.name}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, name: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="con-insp-title" className="block font-medium text-body mb-1">
              Title
            </label>
            <input
              id="con-insp-title"
              type="text"
              value={formValues.title}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, title: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="con-insp-account" className="block font-medium text-body mb-1">
            Account
          </label>
          <Select
            id="con-insp-account"
            ariaLabel="Account"
            value={formValues.account_id}
            onChange={(val) => setDraft({ ...formValues, account_id: val })}
            options={accountSelectOptions}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="con-insp-phone" className="block font-medium text-body mb-1">
              Phone
            </label>
            <input
              id="con-insp-phone"
              type="text"
              value={formValues.phone}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, phone: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="con-insp-email" className="block font-medium text-body mb-1">
              Email
            </label>
            <input
              id="con-insp-email"
              type="email"
              value={formValues.email}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, email: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="con-insp-consent" className="block font-medium text-body mb-1">
            SMS consent
          </label>
          <Select
            id="con-insp-consent"
            ariaLabel="SMS consent"
            value={formValues.sms_consent}
            onChange={(val) => setDraft({ ...formValues, sms_consent: val })}
            options={CONSENT_FIELD_OPTIONS}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
          />
        </div>

        <div>
          <label htmlFor="con-insp-notes" className="block font-medium text-body mb-1">
            Notes
          </label>
          <textarea
            id="con-insp-notes"
            rows={3}
            value={formValues.notes}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
            onChange={(e) => setDraft({ ...formValues, notes: e.target.value })}
            className="crm-input w-full px-3 py-2"
          />
        </div>
      </RecordInspectorDrawer>
    </>
  )
}
