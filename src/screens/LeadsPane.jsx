import { useState } from 'react'
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

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Open and converted' },
  { value: 'open', label: 'Open only' },
  { value: 'converted', label: 'Converted only' },
]

const CONSENT_FIELD_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

const EMPTY_FORM = {
  name: '',
  company: '',
  phone: '',
  email: '',
  sms_consent: 'off',
  notes: '',
}

export function LeadsPane({
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
    objectKey: 'lead',
    permissions,
    initialInspectRequest,
    onInspectRequestConsumed,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)

  const active = pane.activeRecord
  const formValues = draft ?? {
    name: active?.name || '',
    company: active?.company || '',
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
      setCreateError('Lead name is required.')
      return
    }
    setCreateError('')
    setCreating(true)
    const res = await pane.createRecord({
      name: createForm.name.trim(),
      company: createForm.company.trim(),
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
      company: formValues.company.trim(),
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
        id="pane-leads"
        title="Leads"
        subtitle="Prospects kept separate from Accounts and Contacts until conversion."
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Lead"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Visible leads',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          {
            label: 'Open leads',
            value: pane.summary?.open_count ?? 0,
            caption: 'Not yet converted',
          },
        ]}
        statsAddon={
          <SummaryChartCard title="Open and converted" subtitle="Filtered lead split">
            <MiniDonutChart
              items={[
                {
                  label: 'Open',
                  count: pane.summary?.open_count ?? 0,
                  color: '#3b82f6',
                },
                {
                  label: 'Converted',
                  count: pane.summary?.converted_count ?? 0,
                  color: '#10b981',
                },
              ]}
              centerValue={pane.totalCount}
              centerLabel="total"
              emptyLabel="No leads yet"
            />
          </SummaryChartCard>
        }
        toolbarCaption="Open a row to edit lead details or log notes, tasks, calls, and meetings."
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search leads..."
        filters={
          <div className="w-44">
            <Select
              id="lead-status-filter"
              ariaLabel="Filter leads by status"
              value={pane.filters.status || ''}
              onChange={(val) => pane.updateFilter('status', val)}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage="No leads yet."
        columns={[
          { key: 'name', label: 'Person' },
          { key: 'company', label: 'Company' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'consent', label: 'SMS consent' },
          { key: 'status', label: 'Status' },
          { key: 'action', label: 'Action', align: 'right' },
        ]}
        renderRow={(lead) => (
          <tr
            key={lead.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(lead.id)}
          >
            <td className="py-3 px-4 font-medium text-main">{lead.name}</td>
            <td className="py-3 px-4 text-sub">{lead.company || 'Not set'}</td>
            <td className="py-3 px-4 text-sub break-all">{lead.email || 'Not set'}</td>
            <td className="py-3 px-4 text-sub num-tabular">{lead.phone || 'Not set'}</td>
            <td className="py-3 px-4">
              <span
                className={`badge ${
                  lead.sms_consent ? 'badge-success' : 'badge-neutral'
                }`}
              >
                {lead.sms_consent ? 'On' : 'Off'}
              </span>
            </td>
            <td className="py-3 px-4">
              <span
                className={`badge ${
                  lead.status === 'converted' ? 'badge-success' : 'badge-info'
                }`}
              >
                {lead.status === 'converted' ? 'Converted' : 'Open'}
              </span>
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(lead.id)}
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
        itemLabel="lead"
        pluralLabel="leads"
      />

      <Modal
        open={createOpen}
        title="Create New Lead"
        subtitle="Leads remain separate until conversion."
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
              form="create-lead-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Lead'}
            </Button>
          </>
        }
      >
        <form id="create-lead-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-lead-name" className="block font-medium text-body mb-1">
                Name
              </label>
              <input
                id="new-lead-name"
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Akua Mensah"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="new-lead-company" className="block font-medium text-body mb-1">
                Company
              </label>
              <input
                id="new-lead-company"
                type="text"
                value={createForm.company}
                onChange={(e) => setCreateForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="e.g. Ghana Water Company"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-lead-phone" className="block font-medium text-body mb-1">
                Phone
              </label>
              <input
                id="new-lead-phone"
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+233 24 000 0000"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="new-lead-email" className="block font-medium text-body mb-1">
                Email
              </label>
              <input
                id="new-lead-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@company.com.gh"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-lead-consent" className="block font-medium text-body mb-1">
              SMS consent
            </label>
            <Select
              id="new-lead-consent"
              ariaLabel="SMS consent"
              value={createForm.sms_consent}
              onChange={(val) => setCreateForm((f) => ({ ...f, sms_consent: val }))}
              options={CONSENT_FIELD_OPTIONS}
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="new-lead-notes" className="block font-medium text-body mb-1">
              Notes
            </label>
            <textarea
              id="new-lead-notes"
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
        objectKey="lead"
        objectLabel="Lead"
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
        badgeText={active?.status === 'converted' ? 'Converted' : 'Open'}
        badgeClassName={`badge ${
          active?.status === 'converted' ? 'badge-success' : 'badge-info'
        }`}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lead-insp-name" className="block font-medium text-body mb-1">
              Name
            </label>
            <input
              id="lead-insp-name"
              type="text"
              value={formValues.name}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, name: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="lead-insp-company" className="block font-medium text-body mb-1">
              Company
            </label>
            <input
              id="lead-insp-company"
              type="text"
              value={formValues.company}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, company: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lead-insp-phone" className="block font-medium text-body mb-1">
              Phone
            </label>
            <input
              id="lead-insp-phone"
              type="text"
              value={formValues.phone}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, phone: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="lead-insp-email" className="block font-medium text-body mb-1">
              Email
            </label>
            <input
              id="lead-insp-email"
              type="email"
              value={formValues.email}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, email: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="lead-insp-consent" className="block font-medium text-body mb-1">
            SMS consent
          </label>
          <Select
            id="lead-insp-consent"
            ariaLabel="SMS consent"
            value={formValues.sms_consent}
            onChange={(val) => setDraft({ ...formValues, sms_consent: val })}
            options={CONSENT_FIELD_OPTIONS}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
          />
        </div>

        <div>
          <label htmlFor="lead-insp-notes" className="block font-medium text-body mb-1">
            Notes
          </label>
          <textarea
            id="lead-insp-notes"
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
