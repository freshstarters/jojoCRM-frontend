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
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'
import {
  VISIBILITY_FILTER_OPTIONS,
  buildAssigneeSelectOptions,
} from '../utils/crmFormOptions.js'
import { formatDateOnly } from '../utils/formatters.js'

const JOB_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled']

const STATUS_BADGES = {
  Pending: 'badge badge-info',
  'In Progress': 'badge badge-warn',
  Completed: 'badge badge-success',
  Cancelled: 'badge badge-neutral',
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...JOB_STATUSES.map((status) => ({ value: status, label: status })),
]

const STATUS_FIELD_OPTIONS = JOB_STATUSES.map((status) => ({
  value: status,
  label: status,
}))

const EMPTY_FORM = {
  title: '',
  status: 'Pending',
  assignee_id: '',
  due_date: '',
  account_id: '',
  contact_id: '',
  notes: '',
  visibility: 'workspace',
  shared_role_id: '',
}

const JOB_FIELD_MAP = {
  assignee_id: 'assignee',
  account_id: 'account',
  contact_id: 'contact',
}

export function JobsPane({
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
}) {
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'job',
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
  const hideStatus = isFieldHidden(fr, 'status')
  const hideAssignee = isFieldHidden(fr, 'assignee')
  const hideDueDate = isFieldHidden(fr, 'due_date')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideNotes = isFieldHidden(fr, 'notes')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)
  const [validationError, setValidationError] = useState('')

  const [pickedAccountsById, setPickedAccountsById] = useState({})
  const [pickedContactsById, setPickedContactsById] = useState({})

  const allContacts = useMemo(
    () => pane.optionsData.contacts || [],
    [pane.optionsData.contacts],
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
    status: active?.status || 'Pending',
    assignee_id: active?.assignee_id ? String(active.assignee_id) : '',
    due_date: active?.due_date || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    notes: active?.notes || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  function applyAccountChange(currentForm, nextAccountId, pickedAccount = null) {
    if (pickedAccount?.id) {
      setPickedAccountsById((prev) => ({ ...prev, [String(pickedAccount.id)]: pickedAccount }))
    }
    const chosenContact =
      pickedContactsById[currentForm.contact_id] ||
      (active?.contact && String(active.contact.id) === currentForm.contact_id ? active.contact : null) ||
      allContacts.find((c) => String(c.id) === currentForm.contact_id)
    if (
      chosenContact?.account_id &&
      nextAccountId &&
      String(chosenContact.account_id) !== nextAccountId
    ) {
      return { ...currentForm, account_id: nextAccountId, contact_id: '' }
    }
    return { ...currentForm, account_id: nextAccountId }
  }

  function applyContactChange(currentForm, nextContactId, pickedContact = null) {
    if (pickedContact?.id) {
      setPickedContactsById((prev) => ({ ...prev, [String(pickedContact.id)]: pickedContact }))
    }
    const chosen =
      pickedContact ||
      pickedContactsById[nextContactId] ||
      allContacts.find((c) => String(c.id) === nextContactId)
    if (chosen?.account_id) {
      const linkedAccount =
        chosen.account ||
        (chosen.account_name ? { id: chosen.account_id, name: chosen.account_name } : null)
      if (linkedAccount?.id) {
        setPickedAccountsById((prev) => ({ ...prev, [String(linkedAccount.id)]: linkedAccount }))
      }
      return {
        ...currentForm,
        contact_id: nextContactId,
        account_id: String(chosen.account_id),
      }
    }
    return { ...currentForm, contact_id: nextContactId }
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'title', label: 'Title' }]
    if (!hideStatus) cols.push({ key: 'status', label: 'Status' })
    if (!hideAssignee) cols.push({ key: 'assignee', label: 'Assignee' })
    if (!hideDueDate) cols.push({ key: 'due_date', label: 'Due date' })
    if (!hideAccount || !hideContact) cols.push({ key: 'linked', label: 'Linked To' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideStatus, hideAssignee, hideDueDate, hideAccount, hideContact])

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideTitle && !isFieldReadOnly(fr, 'title') && !createForm.title.trim()) {
      setCreateError('Job title is required.')
      return
    }
    if (
      (!hideAccount && !hideContact) &&
      !createForm.account_id &&
      !createForm.contact_id
    ) {
      setCreateError(`Link at least an Account or a ${contactLabel}.`)
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this job with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        title: createForm.title.trim(),
        status: createForm.status,
        assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
        due_date: createForm.due_date || null,
        account_id: createForm.account_id ? Number(createForm.account_id) : null,
        contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
        notes: createForm.notes,
      },
      fr,
      JOB_FIELD_MAP,
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
      setValidationError('Job title is required.')
      return
    }
    if (
      (!hideAccount && !hideContact) &&
      !formValues.account_id &&
      !formValues.contact_id
    ) {
      setValidationError(`Link at least an Account or a ${contactLabel}.`)
      return
    }
    setValidationError('')
    const fieldPayload = filterWritablePayload(
      {
        title: formValues.title.trim(),
        status: formValues.status,
        assignee_id: formValues.assignee_id ? Number(formValues.assignee_id) : null,
        due_date: formValues.due_date || null,
        account_id: formValues.account_id ? Number(formValues.account_id) : null,
        contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
        notes: formValues.notes,
      },
      fr,
      JOB_FIELD_MAP,
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
        id="pane-jobs"
        title="Jobs"
        subtitle={`Service delivery and field work for ${workspace?.name || 'this workspace'}. Each Job links to an Account or ${contactLabel}.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Job"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Visible jobs',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          ...(!hideStatus
            ? [
                {
                  label: 'Open jobs',
                  value: pane.summary?.open_count ?? 0,
                  caption: 'Pending or in progress',
                },
                {
                  label: 'Completed',
                  value: pane.summary?.completed_count ?? 0,
                  caption: 'Finished deliverables',
                },
              ]
            : []),
        ]}
        toolbarCaption="Open a job to update status, assignee, due date, linked record, or log activities."
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search jobs by title, account, or assignee..."
        filters={
          <>
            {!hideStatus ? (
              <div className="w-40">
                <Select
                  id="job-status-filter"
                  ariaLabel="Filter jobs by status"
                  value={pane.filters.status || ''}
                  onChange={(val) => pane.updateFilter('status', val)}
                  options={STATUS_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            {!hideAssignee ? (
              <div className="w-52">
                <Select
                  id="job-assignee-filter"
                  ariaLabel="Filter jobs by assignee"
                  value={pane.filters.assignee_id || ''}
                  onChange={(val) => pane.updateFilter('assignee_id', val)}
                  options={assigneeFilterOptions}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="job-visibility-filter"
                ariaLabel="Filter jobs by sharing"
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
        emptyMessage="No jobs yet."
        columns={columns}
        renderRow={(job) => {
          const linkParts = [job.account?.name, job.contact?.name].filter(Boolean)
          return (
            <tr
              key={job.id}
              className="crm-hover cursor-pointer"
              onClick={() => handleInspect(job.id)}
            >
              <td className="py-3 px-4 font-medium text-main">
                {job.title ?? job.display_label}
              </td>
              {!hideStatus ? (
                <td className="py-3 px-4">
                  <span className={STATUS_BADGES[job.status] || 'badge badge-neutral'}>
                    {job.status}
                  </span>
                </td>
              ) : null}
              {!hideAssignee ? (
                <td className="py-3 px-4 text-sub break-all">
                  {job.assignee?.email || 'Unassigned'}
                </td>
              ) : null}
              {!hideDueDate ? (
                <td className="py-3 px-4 text-sub num-tabular">
                  {formatDateOnly(job.due_date)}
                </td>
              ) : null}
              {!hideAccount || !hideContact ? (
                <td className="py-3 px-4 text-sub">
                  {linkParts.length > 0 ? linkParts.join(' · ') : 'Unlinked'}
                </td>
              ) : null}
              <td className="py-3 px-4">
                <SharingBadge record={job} />
              </td>
              <td
                className="py-3 px-4 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleInspect(job.id)}
                  className="px-2.5 py-1 text-xs"
                >
                  Inspect
                </Button>
              </td>
            </tr>
          )
        }}
        page={pane.page}
        totalPages={pane.totalPages}
        totalCount={pane.totalCount}
        hasPrevious={pane.hasPrevious}
        hasNext={pane.hasNext}
        onPageChange={pane.setPage}
        itemLabel="job"
        pluralLabel="jobs"
      />

      <Modal
        open={createOpen}
        title="Create New Job"
        subtitle={`Create a service job linked to an Account or ${contactLabel}.`}
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
              form="create-job-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Job'}
            </Button>
          </>
        }
      >
        <form id="create-job-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          {!hideTitle ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-job-title" label="Job title" readOnly={isFieldReadOnly(fr, 'title')} />
              <input
                id="new-job-title"
                type="text"
                required={!isFieldReadOnly(fr, 'title')}
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Monthly chiller preventative check"
                disabled={creating || isFieldReadOnly(fr, 'title')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideStatus || !hideDueDate ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideStatus ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-job-status" label="Status" readOnly={isFieldReadOnly(fr, 'status')} />
                  <Select
                    id="new-job-status"
                    ariaLabel="Job status"
                    value={createForm.status}
                    onChange={(val) => setCreateForm((f) => ({ ...f, status: val }))}
                    options={STATUS_FIELD_OPTIONS}
                    disabled={creating || isFieldReadOnly(fr, 'status')}
                  />
                </div>
              ) : null}
              {!hideDueDate ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-job-due" label="Due date" readOnly={isFieldReadOnly(fr, 'due_date')} />
                  <input
                    id="new-job-due"
                    type="date"
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
                    disabled={creating || isFieldReadOnly(fr, 'due_date')}
                    className="crm-input w-full px-3 py-2 num-tabular"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideAssignee ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-job-assignee" label="Assignee" readOnly={isFieldReadOnly(fr, 'assignee')} />
              <Select
                id="new-job-assignee"
                ariaLabel="Assignee"
                value={createForm.assignee_id}
                onChange={(val) => setCreateForm((f) => ({ ...f, assignee_id: val }))}
                options={assigneeFieldOptions}
                disabled={creating || isFieldReadOnly(fr, 'assignee')}
              />
            </div>
          ) : null}

          {!hideAccount || !hideContact ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!hideAccount ? (
                  <div className="space-y-1">
                    <FieldLabel htmlFor="new-job-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
                    <RecordRelationPicker
                      id="new-job-account"
                      ariaLabel="Account"
                      workspaceSlug={workspace?.slug}
                      objectKey="account"
                      objectPluralLabel="Accounts"
                      value={createForm.account_id}
                      selectedRecord={pickedAccountsById[createForm.account_id] || null}
                      fallbackOptions={pane.optionsData.accounts || []}
                      emptyLabel="No Account"
                      searchPlaceholder="Search Accounts..."
                      getOptionMeta={(acc) => acc.city || acc.email || ''}
                      onChange={(val, rec) =>
                        setCreateForm((f) => applyAccountChange(f, val, rec))
                      }
                      disabled={creating || isFieldReadOnly(fr, 'account')}
                      onSessionExpired={onSessionExpired}
                    />
                  </div>
                ) : null}
                {!hideContact ? (
                  <div className="space-y-1">
                    <FieldLabel htmlFor="new-job-contact" label={contactLabel} readOnly={isFieldReadOnly(fr, 'contact')} />
                    <RecordRelationPicker
                      id="new-job-contact"
                      ariaLabel={contactLabel}
                      workspaceSlug={workspace?.slug}
                      objectKey="contact"
                      objectPluralLabel={contactPlural}
                      value={createForm.contact_id}
                      selectedRecord={pickedContactsById[createForm.contact_id] || null}
                      fallbackOptions={allContacts}
                      queryParams={
                        createForm.account_id
                          ? { compatible_account_id: createForm.account_id }
                          : {}
                      }
                      emptyLabel={`No ${contactLabel}`}
                      searchPlaceholder={`Search ${contactPlural}...`}
                      getOptionLabel={(con) => {
                        const accName = con.account?.name || con.account_name
                        return accName ? `${con.name || con.display_label} (${accName})` : con.name || con.display_label
                      }}
                      getOptionMeta={(con) => con.email || con.phone || ''}
                      onChange={(val, rec) =>
                        setCreateForm((f) => applyContactChange(f, val, rec))
                      }
                      disabled={creating || isFieldReadOnly(fr, 'contact')}
                      onSessionExpired={onSessionExpired}
                    />
                  </div>
                ) : null}
              </div>

              <p className="text-[11px] text-sub">
                Select at least an Account or a {contactLabel}. Choosing a {contactLabel} with an Account fills in the Account automatically.
              </p>
            </>
          ) : null}

          {!hideNotes ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-job-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
              <textarea
                id="new-job-notes"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={creating || isFieldReadOnly(fr, 'notes')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          <RecordSharingControl
            idPrefix="new-job-sharing"
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
        objectKey="job"
        objectLabel="Job"
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
      >
        {!hideTitle ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="job-insp-title" label="Job title" readOnly={isFieldReadOnly(fr, 'title')} />
            <input
              id="job-insp-title"
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

        {!hideStatus || !hideDueDate ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideStatus ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="job-insp-status" label="Status" readOnly={isFieldReadOnly(fr, 'status')} />
                <Select
                  id="job-insp-status"
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
            {!hideDueDate ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="job-insp-due" label="Due date" readOnly={isFieldReadOnly(fr, 'due_date')} />
                <input
                  id="job-insp-due"
                  type="date"
                  value={formValues.due_date}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'due_date')}
                  onChange={(e) => {
                    setValidationError('')
                    setDraft({ ...formValues, due_date: e.target.value })
                  }}
                  className="crm-input w-full px-3 py-2 num-tabular"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideAssignee ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="job-insp-assignee" label="Assignee" readOnly={isFieldReadOnly(fr, 'assignee')} />
            <Select
              id="job-insp-assignee"
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

        {!hideAccount || !hideContact ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideAccount ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="job-insp-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
                <RecordRelationPicker
                  id="job-insp-account"
                  ariaLabel="Account"
                  workspaceSlug={workspace?.slug}
                  objectKey="account"
                  objectPluralLabel="Accounts"
                  value={formValues.account_id}
                  selectedRecord={
                    pickedAccountsById[formValues.account_id] || active?.account || null
                  }
                  fallbackOptions={pane.optionsData.accounts || []}
                  emptyLabel="No Account"
                  searchPlaceholder="Search Accounts..."
                  getOptionMeta={(acc) => acc.city || acc.email || ''}
                  onChange={(val, rec) => {
                    setValidationError('')
                    setDraft(applyAccountChange(formValues, val, rec))
                  }}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'account')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
            {!hideContact ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="job-insp-contact" label={contactLabel} readOnly={isFieldReadOnly(fr, 'contact')} />
                <RecordRelationPicker
                  id="job-insp-contact"
                  ariaLabel={contactLabel}
                  workspaceSlug={workspace?.slug}
                  objectKey="contact"
                  objectPluralLabel={contactPlural}
                  value={formValues.contact_id}
                  selectedRecord={
                    pickedContactsById[formValues.contact_id] || active?.contact || null
                  }
                  fallbackOptions={allContacts}
                  queryParams={
                    formValues.account_id
                      ? { compatible_account_id: formValues.account_id }
                      : {}
                  }
                  emptyLabel={`No ${contactLabel}`}
                  searchPlaceholder={`Search ${contactPlural}...`}
                  getOptionLabel={(con) => {
                    const accName = con.account?.name || con.account_name
                    return accName ? `${con.name || con.display_label} (${accName})` : con.name || con.display_label
                  }}
                  getOptionMeta={(con) => con.email || con.phone || ''}
                  onChange={(val, rec) => {
                    setValidationError('')
                    setDraft(applyContactChange(formValues, val, rec))
                  }}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'contact')}
                  onSessionExpired={onSessionExpired}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="job-insp-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
            <textarea
              id="job-insp-notes"
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
