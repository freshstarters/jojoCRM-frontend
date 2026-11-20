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
import {
  HorizontalBarChart,
  SummaryChartCard,
} from '../components/crm/SummaryMiniCharts.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  filterWritablePayload,
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'
import {
  VISIBILITY_FILTER_OPTIONS,
  buildAccountSelectOptions,
  buildAssigneeSelectOptions,
  buildContactSelectOptions,
  syncAccountAndContactPatch,
  syncContactAndAccountPatch,
} from '../utils/crmFormOptions.js'

const TICKET_STATUSES = ['New', 'Open', 'Pending', 'Resolved', 'Closed']
const TICKET_PRIORITIES = ['High', 'Normal', 'Low']

const STATUS_BADGES = {
  New: 'badge badge-info',
  Open: 'badge badge-warn',
  Pending: 'badge badge-neutral',
  Resolved: 'badge badge-success',
  Closed: 'badge badge-neutral',
}

const PRIORITY_BADGES = {
  High: 'badge badge-danger',
  Normal: 'badge badge-info',
  Low: 'badge badge-neutral',
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...TICKET_STATUSES.map((status) => ({ value: status, label: status })),
]

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All priorities' },
  ...TICKET_PRIORITIES.map((priority) => ({ value: priority, label: priority })),
]

const STATUS_FIELD_OPTIONS = TICKET_STATUSES.map((status) => ({
  value: status,
  label: status,
}))

const PRIORITY_FIELD_OPTIONS = TICKET_PRIORITIES.map((priority) => ({
  value: priority,
  label: priority,
}))

const EMPTY_FORM = {
  title: '',
  status: 'New',
  priority: 'Normal',
  account_id: '',
  contact_id: '',
  assignee_id: '',
  description: '',
  visibility: 'workspace',
  shared_role_id: '',
}

const TICKET_FIELD_MAP = {
  account_id: 'account',
  contact_id: 'contact',
  assignee_id: 'assignee',
}

export function TicketsPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
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
    objectKey: 'ticket',
    permissions,
    permissionsRevision,
    initialInspectRequest,
    onInspectRequestConsumed,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const fr = pane.fieldRights
  const hideTitle = isFieldHidden(fr, 'title')
  const hideStatus = isFieldHidden(fr, 'status')
  const hidePriority = isFieldHidden(fr, 'priority')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideAssignee = isFieldHidden(fr, 'assignee')
  const hideDescription = isFieldHidden(fr, 'description')

  const priorityChartItems = useMemo(() => {
    const counts = pane.summary?.priority_counts
    if (!counts) return []
    const order = [
      { label: 'Urgent', color: '#f43f5e' },
      { label: 'High', color: '#f59e0b' },
      { label: 'Normal', color: '#3b82f6' },
      { label: 'Low', color: '#64748b' },
    ]
    const total = order.reduce((sum, entry) => sum + Number(counts[entry.label] || 0), 0)
    if (total === 0) return []
    return order.map((entry) => ({
      label: entry.label,
      count: Number(counts[entry.label] || 0),
      color: entry.color,
    }))
  }, [pane.summary?.priority_counts])

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
    status: active?.status || 'New',
    priority: active?.priority || 'Normal',
    account_id: active?.account_id ? String(active.account_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    assignee_id: active?.assignee_id ? String(active.assignee_id) : '',
    description: active?.description || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
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

  const columns = useMemo(() => {
    const cols = [{ key: 'title', label: 'Title' }]
    if (!hideStatus) cols.push({ key: 'status', label: 'Status' })
    if (!hidePriority) cols.push({ key: 'priority', label: 'Priority' })
    if (!hideAccount || !hideContact) {
      cols.push({ key: 'linked', label: `Account / ${contactLabel}` })
    }
    if (!hideAssignee) cols.push({ key: 'assignee', label: 'Assignee' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideStatus, hidePriority, hideAccount, hideContact, hideAssignee, contactLabel])

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideTitle && !isFieldReadOnly(fr, 'title') && !createForm.title.trim()) {
      setCreateError('Ticket title is required.')
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this ticket with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        title: createForm.title.trim(),
        status: createForm.status,
        priority: createForm.priority,
        account_id: createForm.account_id ? Number(createForm.account_id) : null,
        contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
        assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
        description: createForm.description,
      },
      fr,
      TICKET_FIELD_MAP,
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
      setValidationError('Ticket title is required.')
      return
    }
    setValidationError('')
    const fieldPayload = filterWritablePayload(
      {
        title: formValues.title.trim(),
        status: formValues.status,
        priority: formValues.priority,
        account_id: formValues.account_id ? Number(formValues.account_id) : null,
        contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
        assignee_id: formValues.assignee_id ? Number(formValues.assignee_id) : null,
        description: formValues.description,
      },
      fr,
      TICKET_FIELD_MAP,
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
        id="pane-tickets"
        title="Support Tickets"
        subtitle={`Customer support cases and service issues in ${workspace?.name || 'this workspace'}.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Ticket"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Visible tickets',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          ...(!hideStatus
            ? [
                {
                  label: 'Open tickets',
                  value: pane.summary?.open_count ?? 0,
                  caption: 'New, open, or pending',
                },
                {
                  label: 'Resolved / closed',
                  value: pane.summary?.resolved_count ?? 0,
                  caption: 'Completed cases',
                },
              ]
            : []),
        ]}
        statsAddon={
          !hidePriority ? (
            <SummaryChartCard title="Priority" subtitle="Tickets by urgency">
              <HorizontalBarChart items={priorityChartItems} emptyLabel="No tickets yet" />
            </SummaryChartCard>
          ) : null
        }
        toolbarCaption="Open a ticket to triage priority, status, assignee, linked records, or log activities."
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder={`Search tickets by title, account, ${contactLabel.toLowerCase()}, or description...`}
        filters={
          <>
            {!hideStatus ? (
              <div className="w-40">
                <Select
                  id="ticket-status-filter"
                  ariaLabel="Filter tickets by status"
                  value={pane.filters.status || ''}
                  onChange={(val) => pane.updateFilter('status', val)}
                  options={STATUS_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            {!hidePriority ? (
              <div className="w-40">
                <Select
                  id="ticket-priority-filter"
                  ariaLabel="Filter tickets by priority"
                  value={pane.filters.priority || ''}
                  onChange={(val) => pane.updateFilter('priority', val)}
                  options={PRIORITY_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="ticket-visibility-filter"
                ariaLabel="Filter tickets by sharing"
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
        emptyMessage="No tickets yet."
        columns={columns}
        renderRow={(ticket) => {
          const linkParts = [ticket.account?.name, ticket.contact?.name].filter(Boolean)
          return (
            <tr
              key={ticket.id}
              className="crm-hover cursor-pointer"
              onClick={() => handleInspect(ticket.id)}
            >
              <td className="py-3 px-4 font-medium text-main">
                {ticket.title ?? ticket.display_label}
              </td>
              {!hideStatus ? (
                <td className="py-3 px-4">
                  <span className={STATUS_BADGES[ticket.status] || 'badge badge-neutral'}>
                    {ticket.status}
                  </span>
                </td>
              ) : null}
              {!hidePriority ? (
                <td className="py-3 px-4">
                  <span className={PRIORITY_BADGES[ticket.priority] || 'badge badge-neutral'}>
                    {ticket.priority}
                  </span>
                </td>
              ) : null}
              {!hideAccount || !hideContact ? (
                <td className="py-3 px-4 text-sub">
                  {linkParts.length > 0 ? linkParts.join(' · ') : 'Unlinked'}
                </td>
              ) : null}
              {!hideAssignee ? (
                <td className="py-3 px-4 text-sub break-all">
                  {ticket.assignee?.email || 'Unassigned'}
                </td>
              ) : null}
              <td className="py-3 px-4">
                <SharingBadge record={ticket} />
              </td>
              <td
                className="py-3 px-4 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleInspect(ticket.id)}
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
        itemLabel="ticket"
        pluralLabel="tickets"
      />

      <Modal
        open={createOpen}
        title="Create Support Ticket"
        subtitle="Log a customer issue or internal support case."
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
              form="create-ticket-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Ticket'}
            </Button>
          </>
        }
      >
        <form id="create-ticket-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          {!hideTitle ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-ticket-title" label="Title" readOnly={isFieldReadOnly(fr, 'title')} />
              <input
                id="new-ticket-title"
                type="text"
                required={!isFieldReadOnly(fr, 'title')}
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Sensor telemetry offline at Tema warehouse"
                disabled={creating || isFieldReadOnly(fr, 'title')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideStatus || !hidePriority ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideStatus ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-ticket-status" label="Status" readOnly={isFieldReadOnly(fr, 'status')} />
                  <Select
                    id="new-ticket-status"
                    ariaLabel="Ticket status"
                    value={createForm.status}
                    onChange={(val) => setCreateForm((f) => ({ ...f, status: val }))}
                    options={STATUS_FIELD_OPTIONS}
                    disabled={creating || isFieldReadOnly(fr, 'status')}
                  />
                </div>
              ) : null}
              {!hidePriority ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-ticket-priority" label="Priority" readOnly={isFieldReadOnly(fr, 'priority')} />
                  <Select
                    id="new-ticket-priority"
                    ariaLabel="Ticket priority"
                    value={createForm.priority}
                    onChange={(val) => setCreateForm((f) => ({ ...f, priority: val }))}
                    options={PRIORITY_FIELD_OPTIONS}
                    disabled={creating || isFieldReadOnly(fr, 'priority')}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideAssignee ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-ticket-assignee" label="Assignee" readOnly={isFieldReadOnly(fr, 'assignee')} />
              <Select
                id="new-ticket-assignee"
                ariaLabel="Assignee"
                value={createForm.assignee_id}
                onChange={(val) => setCreateForm((f) => ({ ...f, assignee_id: val }))}
                options={assigneeFieldOptions}
                disabled={creating || isFieldReadOnly(fr, 'assignee')}
              />
            </div>
          ) : null}

          {!hideAccount || !hideContact ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideAccount ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-ticket-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
                  <Select
                    id="new-ticket-account"
                    ariaLabel="Account"
                    value={createForm.account_id}
                    onChange={(val) =>
                      setCreateForm((f) => syncAccountAndContactPatch(f, val, allContacts))
                    }
                    options={accountOptions}
                    disabled={creating || isFieldReadOnly(fr, 'account')}
                  />
                </div>
              ) : null}
              {!hideContact ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-ticket-contact" label={contactLabel} readOnly={isFieldReadOnly(fr, 'contact')} />
                  <Select
                    id="new-ticket-contact"
                    ariaLabel={contactLabel}
                    value={createForm.contact_id}
                    onChange={(val) =>
                      setCreateForm((f) => syncContactAndAccountPatch(f, val, allContacts))
                    }
                    options={createContactOptions}
                    disabled={creating || isFieldReadOnly(fr, 'contact')}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideDescription ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-ticket-desc" label="Description" readOnly={isFieldReadOnly(fr, 'description')} />
              <textarea
                id="new-ticket-desc"
                rows={3}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, description: e.target.value }))
                }
                disabled={creating || isFieldReadOnly(fr, 'description')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          <RecordSharingControl
            idPrefix="new-ticket-sharing"
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
        objectKey="ticket"
        objectLabel="Ticket"
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
        onOpenLinkedRecord={onOpenLinkedRecord}
        onSessionExpired={onSessionExpired}
        badgeText={
          !hideStatus || !hidePriority
            ? [!hideStatus ? active?.status : '', !hidePriority ? active?.priority : '']
                .filter(Boolean)
                .join(' · ')
            : ''
        }
        badgeClassName={STATUS_BADGES[active?.status] || 'badge badge-neutral'}
      >
        {!hideTitle ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="ticket-insp-title" label="Title" readOnly={isFieldReadOnly(fr, 'title')} />
            <input
              id="ticket-insp-title"
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

        {!hideStatus || !hidePriority ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideStatus ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="ticket-insp-status" label="Status" readOnly={isFieldReadOnly(fr, 'status')} />
                <Select
                  id="ticket-insp-status"
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
            {!hidePriority ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="ticket-insp-priority" label="Priority" readOnly={isFieldReadOnly(fr, 'priority')} />
                <Select
                  id="ticket-insp-priority"
                  ariaLabel="Priority"
                  value={formValues.priority}
                  onChange={(val) => {
                    setValidationError('')
                    setDraft({ ...formValues, priority: val })
                  }}
                  options={PRIORITY_FIELD_OPTIONS}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'priority')}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideAssignee ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="ticket-insp-assignee" label="Assignee" readOnly={isFieldReadOnly(fr, 'assignee')} />
            <Select
              id="ticket-insp-assignee"
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
                <FieldLabel htmlFor="ticket-insp-account" label="Account" readOnly={isFieldReadOnly(fr, 'account')} />
                <Select
                  id="ticket-insp-account"
                  ariaLabel="Account"
                  value={formValues.account_id}
                  onChange={(val) => {
                    setValidationError('')
                    setDraft(syncAccountAndContactPatch(formValues, val, allContacts))
                  }}
                  options={accountOptions}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'account')}
                />
              </div>
            ) : null}
            {!hideContact ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="ticket-insp-contact" label={contactLabel} readOnly={isFieldReadOnly(fr, 'contact')} />
                <Select
                  id="ticket-insp-contact"
                  ariaLabel={contactLabel}
                  value={formValues.contact_id}
                  onChange={(val) => {
                    setValidationError('')
                    setDraft(syncContactAndAccountPatch(formValues, val, allContacts))
                  }}
                  options={inspectorContactOptions}
                  disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'contact')}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideDescription ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="ticket-insp-desc" label="Description" readOnly={isFieldReadOnly(fr, 'description')} />
            <textarea
              id="ticket-insp-desc"
              rows={4}
              value={formValues.description}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'description')}
              onChange={(e) => {
                setValidationError('')
                setDraft({ ...formValues, description: e.target.value })
              }}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}
      </RecordInspectorDrawer>
    </>
  )
}
