import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  buildAccountSelectOptions,
  buildAssigneeSelectOptions,
  buildContactSelectOptions,
  syncAccountAndContactPatch,
  syncContactAndAccountPatch,
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
}

export function JobsPane({
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
    objectKey: 'job',
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

  const allContacts = useMemo(
    () => pane.optionsData.contacts || [],
    [pane.optionsData.contacts],
  )

  const accountOptions = useMemo(
    () => buildAccountSelectOptions(pane.optionsData.accounts || [], 'No Account'),
    [pane.optionsData.accounts],
  )

  const assigneeFilterOptions = useMemo(
    () => buildAssigneeSelectOptions(pane.optionsData.assignees || [], 'All assignees'),
    [pane.optionsData.assignees],
  )

  const assigneeFieldOptions = useMemo(
    () => buildAssigneeSelectOptions(pane.optionsData.assignees || [], 'Unassigned'),
    [pane.optionsData.assignees],
  )

  const createContactOptions = useMemo(
    () =>
      buildContactSelectOptions(
        allContacts,
        createForm.account_id,
        `No ${contactLabel}`,
      ),
    [allContacts, createForm.account_id, contactLabel],
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
  }

  const inspectorContactOptions = useMemo(
    () =>
      buildContactSelectOptions(
        allContacts,
        formValues.account_id,
        `No ${contactLabel}`,
      ),
    [allContacts, formValues.account_id, contactLabel],
  )

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!createForm.title.trim()) {
      setCreateError('Job title is required.')
      return
    }
    if (!createForm.account_id && !createForm.contact_id) {
      setCreateError(`Link at least an Account or a ${contactLabel}.`)
      return
    }
    setCreateError('')
    setCreating(true)
    const res = await pane.createRecord({
      title: createForm.title.trim(),
      status: createForm.status,
      assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
      due_date: createForm.due_date || null,
      account_id: createForm.account_id ? Number(createForm.account_id) : null,
      contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
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
      setValidationError('Job title is required.')
      return
    }
    if (!formValues.account_id && !formValues.contact_id) {
      setValidationError(`Link at least an Account or a ${contactLabel}.`)
      return
    }
    setValidationError('')
    const ok = await pane.saveInspectorRecord({
      title: formValues.title.trim(),
      status: formValues.status,
      assignee_id: formValues.assignee_id ? Number(formValues.assignee_id) : null,
      due_date: formValues.due_date || null,
      account_id: formValues.account_id ? Number(formValues.account_id) : null,
      contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
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
        ]}
        toolbarCaption="Open a job to update status, assignee, due date, linked record, or log activities."
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search jobs by title, account, or assignee..."
        filters={
          <>
            <div className="w-40">
              <Select
                id="job-status-filter"
                ariaLabel="Filter jobs by status"
                value={pane.filters.status || ''}
                onChange={(val) => pane.updateFilter('status', val)}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>
            <div className="w-52">
              <Select
                id="job-assignee-filter"
                ariaLabel="Filter jobs by assignee"
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
        emptyMessage="No jobs yet."
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'status', label: 'Status' },
          { key: 'assignee', label: 'Assignee' },
          { key: 'due_date', label: 'Due date' },
          { key: 'linked', label: 'Linked To' },
          { key: 'action', label: 'Action', align: 'right' },
        ]}
        renderRow={(job) => {
          const linkParts = [job.account?.name, job.contact?.name].filter(Boolean)
          return (
            <tr
              key={job.id}
              className="crm-hover cursor-pointer"
              onClick={() => handleInspect(job.id)}
            >
              <td className="py-3 px-4 font-medium text-main">{job.title}</td>
              <td className="py-3 px-4">
                <span className={STATUS_BADGES[job.status] || 'badge badge-neutral'}>
                  {job.status}
                </span>
              </td>
              <td className="py-3 px-4 text-sub break-all">
                {job.assignee?.email || 'Unassigned'}
              </td>
              <td className="py-3 px-4 text-sub num-tabular">
                {formatDateOnly(job.due_date)}
              </td>
              <td className="py-3 px-4 text-sub">
                {linkParts.length > 0 ? linkParts.join(' · ') : 'Unlinked'}
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
          <div>
            <label htmlFor="new-job-title" className="block font-medium text-body mb-1">
              Job title
            </label>
            <input
              id="new-job-title"
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Monthly chiller preventative check"
              disabled={creating}
              className="crm-input w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-job-status" className="block font-medium text-body mb-1">
                Status
              </label>
              <Select
                id="new-job-status"
                ariaLabel="Job status"
                value={createForm.status}
                onChange={(val) => setCreateForm((f) => ({ ...f, status: val }))}
                options={STATUS_FIELD_OPTIONS}
                disabled={creating}
              />
            </div>
            <div>
              <label htmlFor="new-job-due" className="block font-medium text-body mb-1">
                Due date
              </label>
              <input
                id="new-job-due"
                type="date"
                value={createForm.due_date}
                onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
                disabled={creating}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-job-assignee" className="block font-medium text-body mb-1">
              Assignee
            </label>
            <Select
              id="new-job-assignee"
              ariaLabel="Assignee"
              value={createForm.assignee_id}
              onChange={(val) => setCreateForm((f) => ({ ...f, assignee_id: val }))}
              options={assigneeFieldOptions}
              disabled={creating}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-job-account" className="block font-medium text-body mb-1">
                Account
              </label>
              <Select
                id="new-job-account"
                ariaLabel="Account"
                value={createForm.account_id}
                onChange={(val) =>
                  setCreateForm((f) => syncAccountAndContactPatch(f, val, allContacts))
                }
                options={accountOptions}
                disabled={creating}
              />
            </div>
            <div>
              <label htmlFor="new-job-contact" className="block font-medium text-body mb-1">
                {contactLabel}
              </label>
              <Select
                id="new-job-contact"
                ariaLabel={contactLabel}
                value={createForm.contact_id}
                onChange={(val) =>
                  setCreateForm((f) => syncContactAndAccountPatch(f, val, allContacts))
                }
                options={createContactOptions}
                disabled={creating}
              />
            </div>
          </div>

          <p className="text-[11px] text-sub">
            Select at least an Account or a {contactLabel}. Choosing a {contactLabel} with an Account fills in the Account automatically.
          </p>

          <div>
            <label htmlFor="new-job-notes" className="block font-medium text-body mb-1">
              Notes
            </label>
            <textarea
              id="new-job-notes"
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
        objectKey="job"
        objectLabel="Job"
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
          <label htmlFor="job-insp-title" className="block font-medium text-body mb-1">
            Job title
          </label>
          <input
            id="job-insp-title"
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
            <label htmlFor="job-insp-status" className="block font-medium text-body mb-1">
              Status
            </label>
            <Select
              id="job-insp-status"
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
          <div>
            <label htmlFor="job-insp-due" className="block font-medium text-body mb-1">
              Due date
            </label>
            <input
              id="job-insp-due"
              type="date"
              value={formValues.due_date}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => {
                setValidationError('')
                setDraft({ ...formValues, due_date: e.target.value })
              }}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
        </div>

        <div>
          <label htmlFor="job-insp-assignee" className="block font-medium text-body mb-1">
            Assignee
          </label>
          <Select
            id="job-insp-assignee"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="job-insp-account" className="block font-medium text-body mb-1">
              Account
            </label>
            <Select
              id="job-insp-account"
              ariaLabel="Account"
              value={formValues.account_id}
              onChange={(val) => {
                setValidationError('')
                setDraft(syncAccountAndContactPatch(formValues, val, allContacts))
              }}
              options={accountOptions}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
          <div>
            <label htmlFor="job-insp-contact" className="block font-medium text-body mb-1">
              {contactLabel}
            </label>
            <Select
              id="job-insp-contact"
              ariaLabel={contactLabel}
              value={formValues.contact_id}
              onChange={(val) => {
                setValidationError('')
                setDraft(syncContactAndAccountPatch(formValues, val, allContacts))
              }}
              options={inspectorContactOptions}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
        </div>

        <div>
          <label htmlFor="job-insp-notes" className="block font-medium text-body mb-1">
            Notes
          </label>
          <textarea
            id="job-insp-notes"
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
