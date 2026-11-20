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
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  filterWritablePayload,
  getObjectRights,
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'
import {
  VISIBILITY_FILTER_OPTIONS,
  buildAssigneeSelectOptions,
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
  visibility: 'workspace',
  shared_role_id: '',
}

const APPOINTMENT_FIELD_MAP = {
  assignee_id: 'assignee',
  contact_id: 'contact',
}

export function AppointmentsPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenLinkedRecord,
  onRecordVisit,
  onAuditRecorded,
  onSessionExpired,
}) {
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const userTimezone = user?.timezone || 'Africa/Accra'
  const canRecordVisit = Boolean(
    onRecordVisit &&
      Array.isArray(workspace?.enabled_object_keys) &&
      workspace.enabled_object_keys.includes('visit') &&
      getObjectRights(permissions, 'visit').canCreate,
  )

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'appointment',
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
  const hideTitle = isFieldHidden(fr, 'title')
  const hideScheduledAt = isFieldHidden(fr, 'scheduled_at')
  const hideStatus = isFieldHidden(fr, 'status')
  const hideAssignee = isFieldHidden(fr, 'assignee')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideNotes = isFieldHidden(fr, 'notes')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)
  const [validationError, setValidationError] = useState('')

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
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'title', label: 'Title' }]
    if (!hideScheduledAt) cols.push({ key: 'time', label: 'Time' })
    if (!hideStatus) cols.push({ key: 'status', label: 'Status' })
    if (!hideContact) cols.push({ key: 'contact', label: contactLabel })
    if (!hideAssignee) cols.push({ key: 'assignee', label: 'Assignee' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideScheduledAt, hideStatus, hideContact, hideAssignee, contactLabel])

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideTitle && !isFieldReadOnly(fr, 'title') && !createForm.title.trim()) {
      setCreateError('Appointment title is required.')
      return
    }
    if (!hideScheduledAt && !isFieldReadOnly(fr, 'scheduled_at') && !createForm.scheduled_at) {
      setCreateError('Appointment time is required.')
      return
    }
    if (!hideContact && !isFieldReadOnly(fr, 'contact') && !createForm.contact_id) {
      setCreateError(`${contactLabel} is required.`)
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this appointment with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        title: createForm.title.trim(),
        scheduled_at: createForm.scheduled_at,
        status: createForm.status,
        assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
        contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
        notes: createForm.notes,
      },
      fr,
      APPOINTMENT_FIELD_MAP,
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
    if (!hideTitle && !isFieldReadOnly(fr, 'title') && !formValues.title.trim()) {
      setValidationError('Appointment title is required.')
      return
    }
    if (!hideScheduledAt && !isFieldReadOnly(fr, 'scheduled_at') && !formValues.scheduled_at) {
      setValidationError('Appointment time is required.')
      return
    }
    if (!hideContact && !isFieldReadOnly(fr, 'contact') && !formValues.contact_id) {
      setValidationError(`${contactLabel} is required.`)
      return
    }
    setValidationError('')
    const fieldPayload = filterWritablePayload(
      {
        title: formValues.title.trim(),
        scheduled_at: formValues.scheduled_at,
        status: formValues.status,
        assignee_id: formValues.assignee_id ? Number(formValues.assignee_id) : null,
        contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
        notes: formValues.notes,
      },
      fr,
      APPOINTMENT_FIELD_MAP,
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
          ...(!hideStatus
            ? [
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
              ]
            : []),
        ]}
        toolbarCaption={`Open an appointment to edit time (${userTimezone}), status, assignee, linked ${contactLabel.toLowerCase()}, or log activities.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder={`Search appointments by title, ${contactLabel.toLowerCase()}, or assignee...`}
        filters={
          <>
            {!hideStatus ? (
              <div className="w-40">
                <Select
                  id="appointment-status-filter"
                  ariaLabel="Filter appointments by status"
                  value={pane.filters.status || ''}
                  onChange={(val) => pane.updateFilter('status', val)}
                  options={STATUS_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            {!hideAssignee ? (
              <div className="w-52">
                <Select
                  id="appointment-assignee-filter"
                  ariaLabel="Filter appointments by assignee"
                  value={pane.filters.assignee_id || ''}
                  onChange={(val) => pane.updateFilter('assignee_id', val)}
                  options={assigneeFilterOptions}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="appointment-visibility-filter"
                ariaLabel="Filter appointments by sharing"
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
        emptyMessage="No appointments yet."
        columns={columns}
        renderRow={(apt) => (
          <tr
            key={apt.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(apt.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              {apt.title ?? apt.display_label}
            </td>
            {!hideScheduledAt ? (
              <td className="py-3 px-4 text-sub num-tabular">
                {formatDateTime(apt.scheduled_at, userTimezone)}
              </td>
            ) : null}
            {!hideStatus ? (
              <td className="py-3 px-4">
                <span className={STATUS_BADGES[apt.status] || 'badge badge-neutral'}>
                  {apt.status}
                </span>
              </td>
            ) : null}
            {!hideContact ? (
              <td className="py-3 px-4 text-sub">{apt.contact?.name || 'Not linked'}</td>
            ) : null}
            {!hideAssignee ? (
              <td className="py-3 px-4 text-sub break-all">
                {apt.assignee?.email || 'Unassigned'}
              </td>
            ) : null}
            <td className="py-3 px-4">
              <SharingBadge record={apt} />
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
          {!hideTitle ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-apt-title" label="Appointment title" readOnly={isFieldReadOnly(fr, 'title')} />
              <input
                id="new-apt-title"
                type="text"
                required={!isFieldReadOnly(fr, 'title')}
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Initial site walkthrough"
                disabled={creating || isFieldReadOnly(fr, 'title')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideScheduledAt || !hideStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideScheduledAt ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-apt-time" label={`Time (${userTimezone})`} readOnly={isFieldReadOnly(fr, 'scheduled_at')} />
                  <input
                    id="new-apt-time"
                    type="datetime-local"
                    required={!isFieldReadOnly(fr, 'scheduled_at')}
                    value={createForm.scheduled_at}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, scheduled_at: e.target.value }))
                    }
                    disabled={creating || isFieldReadOnly(fr, 'scheduled_at')}
                    className="crm-input w-full px-3 py-2 num-tabular"
                  />
                </div>
              ) : null}
              {!hideStatus ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-apt-status" label="Status" readOnly={isFieldReadOnly(fr, 'status')} />
                  <Select
                    id="new-apt-status"
                    ariaLabel="Appointment status"
                    value={createForm.status}
                    onChange={(val) => setCreateForm((f) => ({ ...f, status: val }))}
                    options={STATUS_FIELD_OPTIONS}
                    disabled={creating || isFieldReadOnly(fr, 'status')}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideContact || !hideAssignee ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideContact ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-apt-contact" label={`${contactLabel} (required)`} readOnly={isFieldReadOnly(fr, 'contact')} />
                  <RecordRelationPicker
                    id="new-apt-contact"
                    ariaLabel={contactLabel}
                    workspaceSlug={workspace?.slug}
                    objectKey="contact"
                    objectPluralLabel={contactPlural}
                    value={createForm.contact_id}
                    fallbackOptions={pane.optionsData.contacts || []}
                    allowEmpty={false}
                    placeholder={`Select ${contactLabel}...`}
                    searchPlaceholder={`Search ${contactPlural}...`}
                    getOptionLabel={(con) => {
                      const accName = con.account?.name || con.account_name
                      return accName ? `${con.name || con.display_label} (${accName})` : con.name || con.display_label
                    }}
                    getOptionMeta={(con) => con.email || con.phone || ''}
                    onChange={(val) => setCreateForm((f) => ({ ...f, contact_id: val }))}
                    disabled={creating || isFieldReadOnly(fr, 'contact')}
                    onSessionExpired={onSessionExpired}
                  />
                </div>
              ) : null}
              {!hideAssignee ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-apt-assignee" label="Assignee" readOnly={isFieldReadOnly(fr, 'assignee')} />
                  <Select
                    id="new-apt-assignee"
                    ariaLabel="Assignee"
                    value={createForm.assignee_id}
                    onChange={(val) => setCreateForm((f) => ({ ...f, assignee_id: val }))}
                    options={assigneeFieldOptions}
                    disabled={creating || isFieldReadOnly(fr, 'assignee')}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideNotes ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-apt-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
              <textarea
                id="new-apt-notes"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={creating || isFieldReadOnly(fr, 'notes')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          <RecordSharingControl
            idPrefix="new-apt-sharing"
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
          setValidationError('')
          pane.closeInspector()
        }}
        objectKey="appointment"
        objectLabel="Appointment"
        contactLabel={contactLabel}
        contactPluralLabel={contactPlural}
        assignees={pane.optionsData?.assignees || []}
        roles={pane.optionsData?.roles || []}
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
        badgeText={!hideStatus ? active?.status || '' : ''}
        badgeClassName={STATUS_BADGES[active?.status] || 'badge badge-neutral'}
        headerActions={
          canRecordVisit && active?.contact_id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onRecordVisit({
                  contact_id: active.contact_id,
                  contact: active.contact || null,
                  date: active.scheduled_at || '',
                  assignee_id: active.assignee_id || '',
                })
              }
              className="px-2.5 py-1 text-[11px] font-medium"
            >
              Record Visit
            </Button>
          ) : null
        }
      >
        {!hideTitle ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="apt-insp-title" label="Appointment title" readOnly={isFieldReadOnly(fr, 'title')} />
            <input
              id="apt-insp-title"
              type="text"
              value={formValues.title}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'title')}
              onChange={(e) => {
                setValidationError('')
                setDraft({ ...formValues, title: e.target.value })
              }}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        {!hideScheduledAt || !hideStatus ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideScheduledAt ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="apt-insp-time" label={`Time (${userTimezone})`} readOnly={isFieldReadOnly(fr, 'scheduled_at')} />
                <input
                  id="apt-insp-time"
                  type="datetime-local"
                  value={formValues.scheduled_at}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'scheduled_at')}
                  onChange={(e) => {
                    setValidationError('')
                    setDraft({ ...formValues, scheduled_at: e.target.value })
                  }}
                  className="crm-input w-full px-3 py-2 num-tabular"
                />
              </div>
            ) : null}
            {!hideStatus ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="apt-insp-status" label="Status" readOnly={isFieldReadOnly(fr, 'status')} />
                <Select
                  id="apt-insp-status"
                  ariaLabel="Status"
                  value={formValues.status}
                  onChange={(val) => {
                    setValidationError('')
                    setDraft({ ...formValues, status: val })
                  }}
                  options={STATUS_FIELD_OPTIONS}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'status')}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideContact || !hideAssignee ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideContact ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="apt-insp-contact" label={`${contactLabel} (required)`} readOnly={isFieldReadOnly(fr, 'contact')} />
                <RecordRelationPicker
                  id="apt-insp-contact"
                  ariaLabel={contactLabel}
                  workspaceSlug={workspace?.slug}
                  objectKey="contact"
                  objectPluralLabel={contactPlural}
                  value={formValues.contact_id}
                  selectedRecord={active?.contact || null}
                  fallbackOptions={pane.optionsData.contacts || []}
                  allowEmpty={false}
                  placeholder={`Select ${contactLabel}...`}
                  searchPlaceholder={`Search ${contactPlural}...`}
                  getOptionLabel={(con) => {
                    const accName = con.account?.name || con.account_name
                    return accName ? `${con.name || con.display_label} (${accName})` : con.name || con.display_label
                  }}
                  getOptionMeta={(con) => con.email || con.phone || ''}
                  onChange={(val) => {
                    setValidationError('')
                    setDraft({ ...formValues, contact_id: val })
                  }}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'contact')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
            {!hideAssignee ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="apt-insp-assignee" label="Assignee" readOnly={isFieldReadOnly(fr, 'assignee')} />
                <Select
                  id="apt-insp-assignee"
                  ariaLabel="Assignee"
                  value={formValues.assignee_id}
                  onChange={(val) => {
                    setValidationError('')
                    setDraft({ ...formValues, assignee_id: val })
                  }}
                  options={assigneeFieldOptions}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'assignee')}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="apt-insp-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
            <textarea
              id="apt-insp-notes"
              rows={3}
              value={formValues.notes}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'notes')}
              onChange={(e) => {
                setValidationError('')
                setDraft({ ...formValues, notes: e.target.value })
              }}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
      </RecordInspectorDrawer>
    </>
  )
}
