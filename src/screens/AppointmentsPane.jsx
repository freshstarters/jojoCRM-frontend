import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  buildAssigneeSelectOptions,
  buildContactSelectOptions,
} from '../utils/crmFormOptions.js'
import { formatDateTime, toDateTimeLocalValue } from '../utils/formatters.js'

const APPOINTMENT_STATUSES = [
  'Scheduled',
  'Confirmed',
  'Completed',
  'Cancelled',
  'No-show',
]

const STATUS_BADGES = {
  Scheduled: 'badge badge-info',
  Confirmed: 'badge badge-success',
  Completed: 'badge badge-neutral',
  Cancelled: 'badge badge-danger',
  'No-show': 'badge badge-warn',
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...APPOINTMENT_STATUSES.map((status) => ({ value: status, label: status })),
]

const STATUS_FIELD_OPTIONS = APPOINTMENT_STATUSES.map((status) => ({
  value: status,
  label: status,
}))

const EMPTY_FORM = {
  title: '',
  scheduled_at: '',
  status: 'Scheduled',
  assignee_id: '',
  contact_id: '',
  notes: '',
}

export function AppointmentsPane({
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
  const userTimezone = user?.timezone || 'Africa/Accra'

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'appointment',
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
  const [validationError, setValidationError] = useState('')

  const contactOptions = useMemo(
    () =>
      buildContactSelectOptions(
        pane.optionsData.contacts || [],
        '',
        `Select ${contactLabel}...`,
      ),
    [pane.optionsData.contacts, contactLabel],
  )

  const assigneeFilterOptions = useMemo(
    () => buildAssigneeSelectOptions(pane.optionsData.assignees || [], 'All assignees'),
    [pane.optionsData.assignees],
  )

  const assigneeFieldOptions = useMemo(
    () => buildAssigneeSelectOptions(pane.optionsData.assignees || [], 'Unassigned'),
    [pane.optionsData.assignees],
  )

  const active = pane.activeRecord
  const formValues = draft ?? {
    title: active?.title || '',
    scheduled_at: active?.scheduled_at
      ? toDateTimeLocalValue(active.scheduled_at, userTimezone)
      : '',
    status: active?.status || 'Scheduled',
    assignee_id: active?.assignee_id ? String(active.assignee_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    notes: active?.notes || '',
  }

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!createForm.title.trim()) {
      setCreateError('Appointment title is required.')
      return
    }
    if (!createForm.scheduled_at) {
      setCreateError('Appointment time is required.')
      return
    }
    if (!createForm.contact_id) {
      setCreateError(`${contactLabel} is required.`)
      return
    }
    setCreateError('')
    setCreating(true)
    const res = await pane.createRecord({
      title: createForm.title.trim(),
      scheduled_at: createForm.scheduled_at,
      status: createForm.status,
      assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
      contact_id: Number(createForm.contact_id),
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
    if (!formValues.title.trim()) {
      setValidationError('Appointment title is required.')
      return
    }
    if (!formValues.scheduled_at) {
      setValidationError('Appointment time is required.')
      return
    }
    if (!formValues.contact_id) {
      setValidationError(`${contactLabel} is required.`)
      return
    }
    setValidationError('')
    const ok = await pane.saveInspectorRecord({
      title: formValues.title.trim(),
      scheduled_at: formValues.scheduled_at,
      status: formValues.status,
      assignee_id: formValues.assignee_id ? Number(formValues.assignee_id) : null,
      contact_id: Number(formValues.contact_id),
      notes: formValues.notes,
    })
    if (ok) {
      setDraft(null)
    }
  }

  function handleInspect(recordId) {
    setDraft(null)
    setValidationError('')
    pane.openInspector(recordId)
  }

  return (
    <>
      <CrmListPage
        id="pane-appointments"
        title="Appointments"
        subtitle={`Scheduled sessions with a ${contactLabel} in ${workspace?.name || 'this workspace'}.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Appointment"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Visible appointments',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          {
            label: 'Upcoming',
            value: pane.summary?.upcoming_count ?? 0,
            caption: 'Scheduled or confirmed',
          },
          {
            label: 'Completed',
            value: pane.summary?.completed_count ?? 0,
            caption: 'Finished sessions',
          },
        ]}
        toolbarCaption={`Open an appointment to edit time (${userTimezone}), status, assignee, linked ${contactLabel.toLowerCase()}, or log activities.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder={`Search appointments by title, ${contactLabel.toLowerCase()}, or assignee...`}
        filters={
          <>
            <div className="w-40">
              <Select
                id="appointment-status-filter"
                ariaLabel="Filter appointments by status"
                value={pane.filters.status || ''}
                onChange={(val) => pane.updateFilter('status', val)}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>
            <div className="w-52">
              <Select
                id="appointment-assignee-filter"
                ariaLabel="Filter appointments by assignee"
                value={pane.filters.assignee_id || ''}
                onChange={(val) => pane.updateFilter('assignee_id', val)}
                options={assigneeFilterOptions}
              />
            </div>
          </>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage="No appointments yet."
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'time', label: 'Time' },
          { key: 'status', label: 'Status' },
          { key: 'contact', label: contactLabel },
          { key: 'assignee', label: 'Assignee' },
          { key: 'action', label: 'Action', align: 'right' },
        ]}
        renderRow={(apt) => (
          <tr
            key={apt.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(apt.id)}
          >
            <td className="py-3 px-4 font-medium text-main">{apt.title}</td>
            <td className="py-3 px-4 text-sub num-tabular">
              {formatDateTime(apt.scheduled_at, userTimezone)}
            </td>
            <td className="py-3 px-4">
              <span className={STATUS_BADGES[apt.status] || 'badge badge-neutral'}>
                {apt.status}
              </span>
            </td>
            <td className="py-3 px-4 text-sub">{apt.contact?.name || 'Not linked'}</td>
            <td className="py-3 px-4 text-sub break-all">
              {apt.assignee?.email || 'Unassigned'}
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(apt.id)}
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
        itemLabel="appointment"
        pluralLabel="appointments"
      />

      <Modal
        open={createOpen}
        title="Schedule Appointment"
        subtitle={`Book an appointment linked to a ${contactLabel} (${userTimezone}).`}
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
              form="create-appointment-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Appointment'}
            </Button>
          </>
        }
      >
        <form
          id="create-appointment-form"
          onSubmit={handleCreateSubmit}
          className="space-y-3 text-xs"
        >
          <FeedbackNotice tone="danger" message={createError} />
          <div>
            <label htmlFor="new-apt-title" className="block font-medium text-body mb-1">
              Appointment title
            </label>
            <input
              id="new-apt-title"
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Initial site walkthrough"
              disabled={creating}
              className="crm-input w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-apt-time" className="block font-medium text-body mb-1">
                Time ({userTimezone})
              </label>
              <input
                id="new-apt-time"
                type="datetime-local"
                required
                value={createForm.scheduled_at}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, scheduled_at: e.target.value }))
                }
                disabled={creating}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
            <div>
              <label htmlFor="new-apt-status" className="block font-medium text-body mb-1">
                Status
              </label>
              <Select
                id="new-apt-status"
                ariaLabel="Appointment status"
                value={createForm.status}
                onChange={(val) => setCreateForm((f) => ({ ...f, status: val }))}
                options={STATUS_FIELD_OPTIONS}
                disabled={creating}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-apt-contact" className="block font-medium text-body mb-1">
                {contactLabel} (required)
              </label>
              <Select
                id="new-apt-contact"
                ariaLabel={contactLabel}
                value={createForm.contact_id}
                onChange={(val) => setCreateForm((f) => ({ ...f, contact_id: val }))}
                options={contactOptions}
                disabled={creating}
              />
            </div>
            <div>
              <label htmlFor="new-apt-assignee" className="block font-medium text-body mb-1">
                Assignee
              </label>
              <Select
                id="new-apt-assignee"
                ariaLabel="Assignee"
                value={createForm.assignee_id}
                onChange={(val) => setCreateForm((f) => ({ ...f, assignee_id: val }))}
                options={assigneeFieldOptions}
                disabled={creating}
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-apt-notes" className="block font-medium text-body mb-1">
              Notes
            </label>
            <textarea
              id="new-apt-notes"
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
          setValidationError('')
          pane.closeInspector()
        }}
        objectKey="appointment"
        objectLabel="Appointment"
        contactLabel={contactLabel}
        contactPluralLabel={contactPlural}
        assignees={pane.optionsData?.assignees || []}
        workspaceSlug={workspace?.slug}
        userTimezone={userTimezone}
        permissions={permissions}
        record={active}
        loading={pane.inspectorLoading}
        saving={pane.savingInspector}
        deleting={pane.deletingInspector}
        error={validationError || pane.inspectorError}
        notice={pane.actionNotice}
        canUpdate={pane.rights.canUpdate}
        canDelete={pane.rights.canDelete}
        onSave={handleSaveInspector}
        onDelete={pane.deleteActiveRecord}
        onActivityChanged={pane.refreshActiveRecord}
        onOpenLinkedRecord={onOpenLinkedRecord}
        onSessionExpired={onSessionExpired}
        badgeText={active?.status || ''}
        badgeClassName={STATUS_BADGES[active?.status] || 'badge badge-neutral'}
      >
        <div>
          <label htmlFor="apt-insp-title" className="block font-medium text-body mb-1">
            Appointment title
          </label>
          <input
            id="apt-insp-title"
            type="text"
            value={formValues.title}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
            onChange={(e) => {
              setValidationError('')
              setDraft({ ...formValues, title: e.target.value })
            }}
            className="crm-input w-full px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="apt-insp-time" className="block font-medium text-body mb-1">
              Time ({userTimezone})
            </label>
            <input
              id="apt-insp-time"
              type="datetime-local"
              value={formValues.scheduled_at}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => {
                setValidationError('')
                setDraft({ ...formValues, scheduled_at: e.target.value })
              }}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
          <div>
            <label htmlFor="apt-insp-status" className="block font-medium text-body mb-1">
              Status
            </label>
            <Select
              id="apt-insp-status"
              ariaLabel="Status"
              value={formValues.status}
              onChange={(val) => {
                setValidationError('')
                setDraft({ ...formValues, status: val })
              }}
              options={STATUS_FIELD_OPTIONS}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="apt-insp-contact" className="block font-medium text-body mb-1">
              {contactLabel} (required)
            </label>
            <Select
              id="apt-insp-contact"
              ariaLabel={contactLabel}
              value={formValues.contact_id}
              onChange={(val) => {
                setValidationError('')
                setDraft({ ...formValues, contact_id: val })
              }}
              options={contactOptions}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
          <div>
            <label htmlFor="apt-insp-assignee" className="block font-medium text-body mb-1">
              Assignee
            </label>
            <Select
              id="apt-insp-assignee"
              ariaLabel="Assignee"
              value={formValues.assignee_id}
              onChange={(val) => {
                setValidationError('')
                setDraft({ ...formValues, assignee_id: val })
              }}
              options={assigneeFieldOptions}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
        </div>

        <div>
          <label htmlFor="apt-insp-notes" className="block font-medium text-body mb-1">
            Notes
          </label>
          <textarea
            id="apt-insp-notes"
            rows={3}
            value={formValues.notes}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
            onChange={(e) => {
              setValidationError('')
              setDraft({ ...formValues, notes: e.target.value })
            }}
            className="crm-input w-full px-3 py-2"
          />
        </div>
      </RecordInspectorDrawer>
    </>
  )
}
