import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import {
  HorizontalBarChart,
  SummaryChartCard,
} from '../components/crm/SummaryMiniCharts.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
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
}

export function TicketsPane({
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
    objectKey: 'ticket',
    permissions,
    initialInspectRequest,
    onInspectRequestConsumed,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

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
      setCreateError('Ticket title is required.')
      return
    }
    setCreateError('')
    setCreating(true)
    const res = await pane.createRecord({
      title: createForm.title.trim(),
      status: createForm.status,
      priority: createForm.priority,
      account_id: createForm.account_id ? Number(createForm.account_id) : null,
      contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
      assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
      description: createForm.description,
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
      setValidationError('Ticket title is required.')
      return
    }
    setValidationError('')
    const ok = await pane.saveInspectorRecord({
      title: formValues.title.trim(),
      status: formValues.status,
      priority: formValues.priority,
      account_id: formValues.account_id ? Number(formValues.account_id) : null,
      contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
      assignee_id: formValues.assignee_id ? Number(formValues.assignee_id) : null,
      description: formValues.description,
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
        ]}
        statsAddon={
          <SummaryChartCard title="Priority" subtitle="Tickets by urgency">
            <HorizontalBarChart items={priorityChartItems} emptyLabel="No tickets yet" />
          </SummaryChartCard>
        }
        toolbarCaption="Open a ticket to triage priority, status, assignee, linked records, or log activities."
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder={`Search tickets by title, account, ${contactLabel.toLowerCase()}, or description...`}
        filters={
          <>
            <div className="w-40">
              <Select
                id="ticket-status-filter"
                ariaLabel="Filter tickets by status"
                value={pane.filters.status || ''}
                onChange={(val) => pane.updateFilter('status', val)}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>
            <div className="w-40">
              <Select
                id="ticket-priority-filter"
                ariaLabel="Filter tickets by priority"
                value={pane.filters.priority || ''}
                onChange={(val) => pane.updateFilter('priority', val)}
                options={PRIORITY_FILTER_OPTIONS}
              />
            </div>
          </>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage="No tickets yet."
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'status', label: 'Status' },
          { key: 'priority', label: 'Priority' },
          { key: 'linked', label: `Account / ${contactLabel}` },
          { key: 'assignee', label: 'Assignee' },
          { key: 'action', label: 'Action', align: 'right' },
        ]}
        renderRow={(ticket) => {
          const linkParts = [ticket.account?.name, ticket.contact?.name].filter(Boolean)
          return (
            <tr
              key={ticket.id}
              className="crm-hover cursor-pointer"
              onClick={() => handleInspect(ticket.id)}
            >
              <td className="py-3 px-4 font-medium text-main">{ticket.title}</td>
              <td className="py-3 px-4">
                <span className={STATUS_BADGES[ticket.status] || 'badge badge-neutral'}>
                  {ticket.status}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={PRIORITY_BADGES[ticket.priority] || 'badge badge-neutral'}>
                  {ticket.priority}
                </span>
              </td>
              <td className="py-3 px-4 text-sub">
                {linkParts.length > 0 ? linkParts.join(' · ') : 'Unlinked'}
              </td>
              <td className="py-3 px-4 text-sub break-all">
                {ticket.assignee?.email || 'Unassigned'}
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
          <div>
            <label htmlFor="new-ticket-title" className="block font-medium text-body mb-1">
              Title
            </label>
            <input
              id="new-ticket-title"
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Sensor telemetry offline at Tema warehouse"
              disabled={creating}
              className="crm-input w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-ticket-status" className="block font-medium text-body mb-1">
                Status
              </label>
              <Select
                id="new-ticket-status"
                ariaLabel="Ticket status"
                value={createForm.status}
                onChange={(val) => setCreateForm((f) => ({ ...f, status: val }))}
                options={STATUS_FIELD_OPTIONS}
                disabled={creating}
              />
            </div>
            <div>
              <label htmlFor="new-ticket-priority" className="block font-medium text-body mb-1">
                Priority
              </label>
              <Select
                id="new-ticket-priority"
                ariaLabel="Ticket priority"
                value={createForm.priority}
                onChange={(val) => setCreateForm((f) => ({ ...f, priority: val }))}
                options={PRIORITY_FIELD_OPTIONS}
                disabled={creating}
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-ticket-assignee" className="block font-medium text-body mb-1">
              Assignee
            </label>
            <Select
              id="new-ticket-assignee"
              ariaLabel="Assignee"
              value={createForm.assignee_id}
              onChange={(val) => setCreateForm((f) => ({ ...f, assignee_id: val }))}
              options={assigneeFieldOptions}
              disabled={creating}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-ticket-account" className="block font-medium text-body mb-1">
                Account
              </label>
              <Select
                id="new-ticket-account"
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
              <label htmlFor="new-ticket-contact" className="block font-medium text-body mb-1">
                {contactLabel}
              </label>
              <Select
                id="new-ticket-contact"
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

          <div>
            <label htmlFor="new-ticket-desc" className="block font-medium text-body mb-1">
              Description
            </label>
            <textarea
              id="new-ticket-desc"
              rows={3}
              value={createForm.description}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, description: e.target.value }))
              }
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
        objectKey="ticket"
        objectLabel="Ticket"
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
        badgeText={active?.priority ? `${active.status} · ${active.priority}` : ''}
        badgeClassName={STATUS_BADGES[active?.status] || 'badge badge-neutral'}
      >
        <div>
          <label htmlFor="ticket-insp-title" className="block font-medium text-body mb-1">
            Title
          </label>
          <input
            id="ticket-insp-title"
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
            <label htmlFor="ticket-insp-status" className="block font-medium text-body mb-1">
              Status
            </label>
            <Select
              id="ticket-insp-status"
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
            <label htmlFor="ticket-insp-priority" className="block font-medium text-body mb-1">
              Priority
            </label>
            <Select
              id="ticket-insp-priority"
              ariaLabel="Priority"
              value={formValues.priority}
              onChange={(val) => {
                setValidationError('')
                setDraft({ ...formValues, priority: val })
              }}
              options={PRIORITY_FIELD_OPTIONS}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
        </div>

        <div>
          <label htmlFor="ticket-insp-assignee" className="block font-medium text-body mb-1">
            Assignee
          </label>
          <Select
            id="ticket-insp-assignee"
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
            <label htmlFor="ticket-insp-account" className="block font-medium text-body mb-1">
              Account
            </label>
            <Select
              id="ticket-insp-account"
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
            <label htmlFor="ticket-insp-contact" className="block font-medium text-body mb-1">
              {contactLabel}
            </label>
            <Select
              id="ticket-insp-contact"
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
          <label htmlFor="ticket-insp-desc" className="block font-medium text-body mb-1">
            Description
          </label>
          <textarea
            id="ticket-insp-desc"
            rows={4}
            value={formValues.description}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
            onChange={(e) => {
              setValidationError('')
              setDraft({ ...formValues, description: e.target.value })
            }}
            className="crm-input w-full px-3 py-2"
          />
        </div>
      </RecordInspectorDrawer>
    </>
  )
}
