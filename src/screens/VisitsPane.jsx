import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { DateTimePicker } from '../components/DateTimePicker.jsx'
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
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'
import {
  VISIBILITY_FILTER_OPTIONS,
  buildAssigneeSelectOptions,
} from '../utils/crmFormOptions.js'
import { formatDateTime, toDateTimeLocalValue } from '../utils/formatters.js'

const FOLLOW_UP_FILTER_OPTIONS = [
  { value: '', label: 'All follow-ups' },
  { value: 'yes', label: 'With follow-up' },
  { value: 'no', label: 'Without follow-up' },
]

const VISIT_FIELD_MAP = {
  assignee_id: 'assignee',
  contact_id: 'contact',
}

function buildInitialCreateForm(userTimezone, prefill = null) {
  const defaultDate = prefill?.date
    ? toDateTimeLocalValue(prefill.date, userTimezone)
    : toDateTimeLocalValue(new Date().toISOString(), userTimezone)
  return {
    contact_id: prefill?.contact_id ? String(prefill.contact_id) : '',
    date: defaultDate,
    reason: prefill?.reason || '',
    notes: '',
    follow_up: '',
    assignee_id: prefill?.assignee_id ? String(prefill.assignee_id) : '',
    visibility: 'workspace',
    shared_role_id: '',
  }
}

export function VisitsPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenLinkedRecord,
  onAuditRecorded,
  onSessionExpired,
  prefillCreate = null,
  onClearPrefillCreate,
}) {
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const userTimezone = user?.timezone || 'Africa/Accra'

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'visit',
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
  const hideDate = isFieldHidden(fr, 'date')
  const hideReason = isFieldHidden(fr, 'reason')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideAssignee = isFieldHidden(fr, 'assignee')
  const hideNotes = isFieldHidden(fr, 'notes')
  const hideFollowUp = isFieldHidden(fr, 'follow_up')

  const [createOpen, setCreateOpen] = useState(() =>
    Boolean(prefillCreate && pane.rights.canCreate),
  )
  const [createForm, setCreateForm] = useState(() =>
    buildInitialCreateForm(userTimezone, prefillCreate),
  )
  const [createSelectedContact, setCreateSelectedContact] = useState(
    () => prefillCreate?.contact || null,
  )
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
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    date: active?.date ? toDateTimeLocalValue(active.date, userTimezone) : '',
    reason: active?.reason || '',
    notes: active?.notes || '',
    follow_up: active?.follow_up || '',
    assignee_id: active?.assignee_id ? String(active.assignee_id) : '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'reason', label: 'Reason' }]
    if (!hideDate) cols.push({ key: 'date', label: 'Visit date' })
    if (!hideContact) cols.push({ key: 'contact', label: contactLabel })
    if (!hideFollowUp) cols.push({ key: 'follow_up', label: 'Follow-up' })
    if (!hideAssignee) cols.push({ key: 'assignee', label: 'Assignee' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideDate, hideContact, hideFollowUp, hideAssignee, contactLabel])

  function openCreateModal() {
    setCreateForm(buildInitialCreateForm(userTimezone))
    setCreateSelectedContact(null)
    setCreateError('')
    setCreateOpen(true)
  }

  function closeCreateModal() {
    if (creating) return
    setCreateOpen(false)
    setCreateSelectedContact(null)
    onClearPrefillCreate?.()
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideContact && !isFieldReadOnly(fr, 'contact') && !createForm.contact_id) {
      setCreateError(`${contactLabel} is required.`)
      return
    }
    if (!hideDate && !isFieldReadOnly(fr, 'date') && !createForm.date) {
      setCreateError('Visit date is required.')
      return
    }
    if (!hideReason && !isFieldReadOnly(fr, 'reason') && !createForm.reason.trim()) {
      setCreateError('Visit reason is required.')
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this visit with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
        date: createForm.date,
        reason: createForm.reason.trim(),
        notes: createForm.notes,
        follow_up: createForm.follow_up,
        assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
      },
      fr,
      VISIT_FIELD_MAP,
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
    setCreateSelectedContact(null)
    onClearPrefillCreate?.()
  }

  async function handleSaveInspector() {
    if (!hideContact && !isFieldReadOnly(fr, 'contact') && !formValues.contact_id) {
      setValidationError(`${contactLabel} is required.`)
      return
    }
    if (!hideDate && !isFieldReadOnly(fr, 'date') && !formValues.date) {
      setValidationError('Visit date is required.')
      return
    }
    if (!hideReason && !isFieldReadOnly(fr, 'reason') && !formValues.reason.trim()) {
      setValidationError('Visit reason is required.')
      return
    }
    setValidationError('')
    const fieldPayload = filterWritablePayload(
      {
        contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
        date: formValues.date,
        reason: formValues.reason.trim(),
        notes: formValues.notes,
        follow_up: formValues.follow_up,
        assignee_id: formValues.assignee_id ? Number(formValues.assignee_id) : null,
      },
      fr,
      VISIT_FIELD_MAP,
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
        id="pane-visits"
        title="Visits"
        subtitle={`Record a ${contactLabel.toLowerCase()} visit with date, reason, notes, and follow-up in ${workspace?.name || 'this workspace'}.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Visit"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Visible visits',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          ...(!hideFollowUp
            ? [
                {
                  label: 'With follow-up',
                  value: pane.summary?.with_follow_up_count ?? 0,
                  caption: 'Follow-up noted',
                },
              ]
            : []),
        ]}
        toolbarCaption={`Open a visit to review or update visit date (${userTimezone}), reason, notes, follow-up, or linked ${contactLabel.toLowerCase()}.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder={`Search visits by reason, notes, follow-up, or ${contactLabel.toLowerCase()}...`}
        filters={
          <>
            {!hideContact ? (
              <div className="w-48">
                <RecordRelationPicker
                  id="visit-contact-filter"
                  ariaLabel={`Filter visits by ${contactLabel.toLowerCase()}`}
                  workspaceSlug={workspace?.slug}
                  objectKey="contact"
                  objectPluralLabel={contactPlural}
                  value={pane.filters.contact_id || ''}
                  fallbackOptions={pane.optionsData.contacts || []}
                  emptyLabel={`All ${contactPlural.toLowerCase()}`}
                  searchPlaceholder={`Search ${contactPlural}...`}
                  getOptionMeta={(con) => con.email || con.phone || ''}
                  onChange={(val) => pane.updateFilter('contact_id', val)}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
            {!hideFollowUp ? (
              <div className="w-40">
                <Select
                  id="visit-followup-filter"
                  ariaLabel="Filter visits by follow-up"
                  value={pane.filters.has_follow_up || ''}
                  onChange={(val) => pane.updateFilter('has_follow_up', val)}
                  options={FOLLOW_UP_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            {!hideAssignee ? (
              <div className="w-52">
                <Select
                  id="visit-assignee-filter"
                  ariaLabel="Filter visits by assignee"
                  value={pane.filters.assignee_id || ''}
                  onChange={(val) => pane.updateFilter('assignee_id', val)}
                  options={assigneeFilterOptions}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="visit-visibility-filter"
                ariaLabel="Filter visits by sharing"
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
        emptyMessage="No visits yet."
        columns={columns}
        renderRow={(visit) => (
          <tr
            key={visit.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(visit.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              {visit.reason ?? visit.display_label}
            </td>
            {!hideDate ? (
              <td className="py-3 px-4 text-sub num-tabular">
                {formatDateTime(visit.date, userTimezone)}
              </td>
            ) : null}
            {!hideContact ? (
              <td className="py-3 px-4 text-sub">{visit.contact?.name || 'Not linked'}</td>
            ) : null}
            {!hideFollowUp ? (
              <td className="py-3 px-4 text-sub max-w-[16rem] truncate">
                {visit.follow_up ? visit.follow_up : 'None'}
              </td>
            ) : null}
            {!hideAssignee ? (
              <td className="py-3 px-4 text-sub break-all">
                {visit.assignee?.email || 'Unassigned'}
              </td>
            ) : null}
            <td className="py-3 px-4">
              <SharingBadge record={visit} />
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(visit.id)}
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
        itemLabel="visit"
        pluralLabel="visits"
      />

      <Modal
        open={createOpen}
        title="Record Visit"
        subtitle={`Save a visit against a ${contactLabel} with date (${userTimezone}), reason, notes, and follow-up.`}
        onClose={closeCreateModal}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={creating}
              onClick={closeCreateModal}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-visit-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Visit'}
            </Button>
          </>
        }
      >
        <form
          id="create-visit-form"
          onSubmit={handleCreateSubmit}
          className="space-y-3 text-xs"
        >
          <FeedbackNotice tone="danger" message={createError} />

          {!hideContact || !hideDate ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideContact ? (
                <div className="space-y-1">
                  <FieldLabel
                    htmlFor="new-visit-contact"
                    label={`${contactLabel} (required)`}
                    readOnly={isFieldReadOnly(fr, 'contact')}
                  />
                  <RecordRelationPicker
                    id="new-visit-contact"
                    ariaLabel={contactLabel}
                    workspaceSlug={workspace?.slug}
                    objectKey="contact"
                    objectPluralLabel={contactPlural}
                    value={createForm.contact_id}
                    selectedRecord={createSelectedContact}
                    fallbackOptions={pane.optionsData.contacts || []}
                    allowEmpty={false}
                    placeholder={`Select ${contactLabel}...`}
                    searchPlaceholder={`Search ${contactPlural}...`}
                    getOptionLabel={(con) => {
                      const accName = con.account?.name || con.account_name
                      return accName
                        ? `${con.name || con.display_label} (${accName})`
                        : con.name || con.display_label
                    }}
                    getOptionMeta={(con) => con.email || con.phone || ''}
                    onChange={(val) => {
                      setCreateSelectedContact(null)
                      setCreateForm((f) => ({ ...f, contact_id: val }))
                    }}
                    disabled={creating || isFieldReadOnly(fr, 'contact')}
                    onSessionExpired={onSessionExpired}
                  />
                </div>
              ) : null}

              {!hideDate ? (
                <div className="space-y-1">
                  <FieldLabel
                    htmlFor="new-visit-date"
                    label={`Visit date (${userTimezone})`}
                    readOnly={isFieldReadOnly(fr, 'date')}
                  />
                  <DateTimePicker
                    id="new-visit-date"
                    ariaLabel={`Visit date (${userTimezone})`}
                    required={!isFieldReadOnly(fr, 'date')}
                    value={createForm.date}
                    onChange={(val) => setCreateForm((f) => ({ ...f, date: val }))}
                    disabled={creating || isFieldReadOnly(fr, 'date')}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideReason ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-visit-reason"
                label="Reason"
                readOnly={isFieldReadOnly(fr, 'reason')}
              />
              <input
                id="new-visit-reason"
                type="text"
                required={!isFieldReadOnly(fr, 'reason')}
                value={createForm.reason}
                onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Routine wellness checkup"
                disabled={creating || isFieldReadOnly(fr, 'reason')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideNotes ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-visit-notes"
                label="Notes"
                readOnly={isFieldReadOnly(fr, 'notes')}
              />
              <textarea
                id="new-visit-notes"
                rows={3}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Summary of the visit discussion..."
                disabled={creating || isFieldReadOnly(fr, 'notes')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideFollowUp ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-visit-followup"
                label="Follow-up"
                readOnly={isFieldReadOnly(fr, 'follow_up')}
              />
              <textarea
                id="new-visit-followup"
                rows={2}
                value={createForm.follow_up}
                onChange={(e) => setCreateForm((f) => ({ ...f, follow_up: e.target.value }))}
                placeholder="e.g. Schedule check-in call in 2 weeks"
                disabled={creating || isFieldReadOnly(fr, 'follow_up')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideAssignee ? (
            <div className="space-y-1">
              <FieldLabel
                htmlFor="new-visit-assignee"
                label="Assignee"
                readOnly={isFieldReadOnly(fr, 'assignee')}
              />
              <Select
                id="new-visit-assignee"
                ariaLabel="Assignee"
                value={createForm.assignee_id}
                onChange={(val) => setCreateForm((f) => ({ ...f, assignee_id: val }))}
                options={assigneeFieldOptions}
                disabled={creating || isFieldReadOnly(fr, 'assignee')}
              />
            </div>
          ) : null}

          <RecordSharingControl
            idPrefix="new-visit-sharing"
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
        objectKey="visit"
        objectLabel="Visit"
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
        badgeText={!hideFollowUp && active?.follow_up ? 'Follow-up noted' : ''}
        badgeClassName="badge badge-info"
      >
        {!hideContact || !hideDate ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!hideContact ? (
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="visit-insp-contact"
                  label={`${contactLabel} (required)`}
                  readOnly={isFieldReadOnly(fr, 'contact')}
                />
                <RecordRelationPicker
                  id="visit-insp-contact"
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
                    return accName
                      ? `${con.name || con.display_label} (${accName})`
                      : con.name || con.display_label
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

            {!hideDate ? (
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="visit-insp-date"
                  label={`Visit date (${userTimezone})`}
                  readOnly={isFieldReadOnly(fr, 'date')}
                />
                <DateTimePicker
                  id="visit-insp-date"
                  ariaLabel={`Visit date (${userTimezone})`}
                  required={!isFieldReadOnly(fr, 'date')}
                  value={formValues.date}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'date')}
                  onChange={(val) => {
                    setValidationError('')
                    setDraft({ ...formValues, date: val })
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideReason ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="visit-insp-reason"
              label="Reason"
              readOnly={isFieldReadOnly(fr, 'reason')}
            />
            <input
              id="visit-insp-reason"
              type="text"
              value={formValues.reason}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'reason')}
              onChange={(e) => {
                setValidationError('')
                setDraft({ ...formValues, reason: e.target.value })
              }}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="visit-insp-notes"
              label="Notes"
              readOnly={isFieldReadOnly(fr, 'notes')}
            />
            <textarea
              id="visit-insp-notes"
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

        {!hideFollowUp ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="visit-insp-followup"
              label="Follow-up"
              readOnly={isFieldReadOnly(fr, 'follow_up')}
            />
            <textarea
              id="visit-insp-followup"
              rows={2}
              value={formValues.follow_up}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'follow_up')}
              onChange={(e) => {
                setValidationError('')
                setDraft({ ...formValues, follow_up: e.target.value })
              }}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        {!hideAssignee ? (
          <div className="space-y-1">
            <FieldLabel
              htmlFor="visit-insp-assignee"
              label="Assignee"
              readOnly={isFieldReadOnly(fr, 'assignee')}
            />
            <Select
              id="visit-insp-assignee"
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
      </RecordInspectorDrawer>
    </>
  )
}
