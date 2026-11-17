import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { Subtabs } from '../components/Subtabs.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { PipelineStageDistribution } from '../components/crm/PipelineStageDistribution.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import { DEALS_SUBTABS } from '../utils/catalog.js'
import { formatDateOnly, formatGhs } from '../utils/formatters.js'

const STARTER_STAGES = ['New', 'Qualified', 'Proposal', 'Won', 'Lost']

const STAGE_BADGES = {
  New: 'badge badge-info',
  Qualified: 'badge badge-info',
  Proposal: 'badge badge-warn',
  Won: 'badge badge-success',
  Lost: 'badge badge-danger',
}

const STAGE_FILTER_OPTIONS = [
  { value: '', label: 'All stages' },
  ...STARTER_STAGES.map((stage) => ({ value: stage, label: stage })),
]

const STAGE_FIELD_OPTIONS = STARTER_STAGES.map((stage) => ({
  value: stage,
  label: stage,
}))

const EMPTY_FORM = {
  title: '',
  account_id: '',
  contact_id: '',
  amount: '0.00',
  stage: 'New',
  target_close_date: '',
  win_probability: '',
  notes: '',
}

export function DealsPane({
  workspace,
  user,
  permissions,
  activeSubtab = 'list',
  onSubtabChange,
  initialInspectRequest = null,
  onInspectRequestConsumed,
  onOpenLinkedRecord,
  onAuditRecorded,
  onSessionExpired,
}) {
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const viewMode = activeSubtab === 'kanban' ? 'kanban' : 'list'

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'deal',
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

  const accountOptions = useMemo(
    () => [
      { value: '', label: 'No Account' },
      ...(pane.optionsData.accounts || []).map((acc) => ({
        value: String(acc.id),
        label: acc.name,
      })),
    ],
    [pane.optionsData.accounts],
  )

  const allContacts = useMemo(
    () => pane.optionsData.contacts || [],
    [pane.optionsData.contacts],
  )

  function getFilteredContactOptions(selectedAccountId) {
    const filtered = selectedAccountId
      ? allContacts.filter(
          (con) => !con.account_id || String(con.account_id) === selectedAccountId,
        )
      : allContacts
    return [
      { value: '', label: `No ${contactLabel}` },
      ...filtered.map((con) => ({
        value: String(con.id),
        label: con.account_name ? `${con.name} (${con.account_name})` : con.name,
      })),
    ]
  }

  function applyAccountContactChange(currentForm, field, nextVal) {
    if (field === 'account_id') {
      let nextContactId = currentForm.contact_id
      if (nextVal && nextContactId) {
        const chosen = allContacts.find((c) => String(c.id) === nextContactId)
        if (chosen?.account_id && String(chosen.account_id) !== nextVal) {
          nextContactId = ''
        }
      }
      return { ...currentForm, account_id: nextVal, contact_id: nextContactId }
    }
    if (field === 'contact_id') {
      let nextAccountId = currentForm.account_id
      if (nextVal && !nextAccountId) {
        const chosen = allContacts.find((c) => String(c.id) === nextVal)
        if (chosen?.account_id) {
          nextAccountId = String(chosen.account_id)
        }
      }
      return { ...currentForm, account_id: nextAccountId, contact_id: nextVal }
    }
    return currentForm
  }

  const active = pane.activeRecord
  const formValues = draft ?? {
    title: active?.title || '',
    account_id: active?.account_id ? String(active.account_id) : '',
    contact_id: active?.contact_id ? String(active.contact_id) : '',
    amount: active?.amount ?? '0.00',
    stage: active?.stage || 'New',
    target_close_date: active?.target_close_date || '',
    win_probability:
      active?.win_probability !== null && active?.win_probability !== undefined
        ? String(active.win_probability)
        : '',
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
      setCreateError('Deal title is required.')
      return
    }
    setCreateError('')
    setCreating(true)
    const res = await pane.createRecord({
      title: createForm.title.trim(),
      account_id: createForm.account_id ? Number(createForm.account_id) : null,
      contact_id: createForm.contact_id ? Number(createForm.contact_id) : null,
      amount: createForm.amount || '0.00',
      stage: createForm.stage || 'New',
      target_close_date: createForm.target_close_date || null,
      win_probability: createForm.win_probability === '' ? null : Number(createForm.win_probability),
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
      title: formValues.title.trim(),
      account_id: formValues.account_id ? Number(formValues.account_id) : null,
      contact_id: formValues.contact_id ? Number(formValues.contact_id) : null,
      amount: formValues.amount || '0.00',
      stage: formValues.stage,
      target_close_date: formValues.target_close_date || null,
      win_probability: formValues.win_probability === '' ? null : Number(formValues.win_probability),
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

  const stageCounts = pane.summary?.stage_counts || {}
  const dealsByStage = useMemo(() => {
    const grouped = {}
    for (const stage of STARTER_STAGES) {
      grouped[stage] = []
    }
    for (const deal of pane.records) {
      const bucket = grouped[deal.stage] ? deal.stage : 'New'
      grouped[bucket].push(deal)
    }
    return grouped
  }, [pane.records])

  const boardPreview =
    viewMode === 'kanban' ? (
      <div className="space-y-3">
        <Card variant="subtle" className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-sub">
            Stage-grouped preview across the starter pipeline. Click any card to inspect or edit stage details.
            {pane.totalPages > 1
              ? ` Showing page ${pane.page} of ${pane.totalPages} (${pane.records.length} of ${pane.totalCount} matching deals).`
              : ''}
          </span>
          <span className="badge badge-neutral">Board preview</span>
        </Card>
        {pane.loading && pane.records.length === 0 ? (
          <Card className="p-5">
            <p className="text-xs text-sub">Loading pipeline board...</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
            {STARTER_STAGES.map((stage) => {
              const items = dealsByStage[stage] || []
              return (
                <Card key={stage} className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b crm-border">
                    <span className="text-xs font-semibold text-main">{stage}</span>
                    <span className="badge badge-neutral num-tabular">
                      {stageCounts[stage] ?? items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-[11px] text-sub py-2">No deals in {stage}.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((deal) => (
                        <button
                          key={deal.id}
                          type="button"
                          onClick={() => handleInspect(deal.id)}
                          className="w-full text-left crm-subtle crm-hover p-3 space-y-1.5 transition-colors"
                        >
                          <div className="text-xs font-semibold text-main truncate">
                            {deal.title}
                          </div>
                          <div className="text-[11px] text-sub truncate">
                            {deal.account?.name || deal.contact?.name || 'Unlinked'}
                          </div>
                          <div className="text-xs font-bold text-main num-tabular">
                            {formatGhs(deal.amount)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    ) : null

  return (
    <>
      <CrmListPage
        id="pane-deals"
        title="Deals & Pipeline"
        subtitle="Manage opportunities across New, Qualified, Proposal, Won, and Lost stages."
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Deal"
        onCreateClick={openCreateModal}
        headerActions={
          <Subtabs
            tabs={DEALS_SUBTABS}
            activeId={viewMode}
            onChange={(nextTab) => onSubtabChange?.(nextTab)}
            ariaLabel="Deals views"
          />
        }
        stats={[
          {
            label: 'Visible deals',
            value: pane.totalCount,
            caption: 'Opportunities in this view',
          },
          {
            label: 'Pipeline value',
            value: formatGhs(pane.summary?.total_amount || 0),
            caption: 'Total GHS across filtered deals',
          },
        ]}
        extraContent={<PipelineStageDistribution summary={pane.summary} />}
        toolbarCaption="Open a deal to update details, change stage, or log activities."
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search deals..."
        filters={
          <div className="w-40">
            <Select
              id="deal-stage-filter"
              ariaLabel="Filter deals by stage"
              value={pane.filters.stage || ''}
              onChange={(val) => pane.updateFilter('stage', val)}
              options={STAGE_FILTER_OPTIONS}
            />
          </div>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage="No deals yet."
        hideTable={viewMode === 'kanban'}
        keepToolbarWhenTableHidden
        customTableContent={boardPreview}
        columns={[
          { key: 'title', label: 'Deal Name' },
          { key: 'account', label: `Account & ${contactLabel}` },
          { key: 'stage', label: 'Stage' },
          { key: 'amount', label: 'Value (GHS)' },
          { key: 'close', label: 'Target Close' },
          { key: 'action', label: 'Action', align: 'right' },
        ]}
        renderRow={(deal) => (
          <tr
            key={deal.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(deal.id)}
          >
            <td className="py-3 px-4 font-medium text-main">{deal.title}</td>
            <td className="py-3 px-4 text-sub">
              {[deal.account?.name, deal.contact?.name].filter(Boolean).join(' · ') || 'Unlinked'}
            </td>
            <td className="py-3 px-4">
              <span className={STAGE_BADGES[deal.stage] || 'badge badge-neutral'}>
                {deal.stage}
              </span>
            </td>
            <td className="py-3 px-4 font-semibold text-main num-tabular">
              {formatGhs(deal.amount)}
            </td>
            <td className="py-3 px-4 text-sub num-tabular">
              {deal.target_close_date ? formatDateOnly(deal.target_close_date) : 'Not set'}
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(deal.id)}
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
        itemLabel="deal"
        pluralLabel="deals"
      />

      <Modal
        open={createOpen}
        title="Create New Deal"
        subtitle="Add a sales opportunity to the starter pipeline."
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
              form="create-deal-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Deal'}
            </Button>
          </>
        }
      >
        <form id="create-deal-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          <div>
            <label htmlFor="new-deal-title" className="block font-medium text-body mb-1">
              Deal title
            </label>
            <input
              id="new-deal-title"
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Tema Refinery Pump Replacement"
              disabled={creating}
              className="crm-input w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-deal-account" className="block font-medium text-body mb-1">
                Account
              </label>
              <Select
                id="new-deal-account"
                ariaLabel="Account"
                value={createForm.account_id}
                onChange={(val) =>
                  setCreateForm((f) => applyAccountContactChange(f, 'account_id', val))
                }
                options={accountOptions}
                disabled={creating}
              />
            </div>
            <div>
              <label htmlFor="new-deal-contact" className="block font-medium text-body mb-1">
                {contactLabel}
              </label>
              <Select
                id="new-deal-contact"
                ariaLabel={contactLabel}
                value={createForm.contact_id}
                onChange={(val) =>
                  setCreateForm((f) => applyAccountContactChange(f, 'contact_id', val))
                }
                options={getFilteredContactOptions(createForm.account_id)}
                disabled={creating}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-deal-amount" className="block font-medium text-body mb-1">
                Amount (GHS)
              </label>
              <input
                id="new-deal-amount"
                type="number"
                min="0"
                step="0.01"
                value={createForm.amount}
                onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
                disabled={creating}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
            <div>
              <label htmlFor="new-deal-stage" className="block font-medium text-body mb-1">
                Stage
              </label>
              <Select
                id="new-deal-stage"
                ariaLabel="Stage"
                value={createForm.stage}
                onChange={(val) => setCreateForm((f) => ({ ...f, stage: val }))}
                options={STAGE_FIELD_OPTIONS}
                disabled={creating}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-deal-close" className="block font-medium text-body mb-1">
                Target close date
              </label>
              <input
                id="new-deal-close"
                type="date"
                value={createForm.target_close_date}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, target_close_date: e.target.value }))
                }
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="new-deal-prob" className="block font-medium text-body mb-1">
                Win probability (%)
              </label>
              <input
                id="new-deal-prob"
                type="number"
                min="0"
                max="100"
                value={createForm.win_probability}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, win_probability: e.target.value }))
                }
                placeholder="0 - 100"
                disabled={creating}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-deal-notes" className="block font-medium text-body mb-1">
              Notes
            </label>
            <textarea
              id="new-deal-notes"
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
        objectKey="deal"
        objectLabel="Deal"
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
        badgeText={active?.stage || ''}
        badgeClassName={STAGE_BADGES[active?.stage] || 'badge badge-neutral'}
      >
        <div>
          <label htmlFor="deal-insp-title" className="block font-medium text-body mb-1">
            Deal title
          </label>
          <input
            id="deal-insp-title"
            type="text"
            value={formValues.title}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
            onChange={(e) => setDraft({ ...formValues, title: e.target.value })}
            className="crm-input w-full px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deal-insp-account" className="block font-medium text-body mb-1">
              Account
            </label>
            <Select
              id="deal-insp-account"
              ariaLabel="Account"
              value={formValues.account_id}
              onChange={(val) =>
                setDraft(applyAccountContactChange(formValues, 'account_id', val))
              }
              options={accountOptions}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
          <div>
            <label htmlFor="deal-insp-contact" className="block font-medium text-body mb-1">
              {contactLabel}
            </label>
            <Select
              id="deal-insp-contact"
              ariaLabel={contactLabel}
              value={formValues.contact_id}
              onChange={(val) =>
                setDraft(applyAccountContactChange(formValues, 'contact_id', val))
              }
              options={getFilteredContactOptions(formValues.account_id)}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deal-insp-amount" className="block font-medium text-body mb-1">
              Amount (GHS)
            </label>
            <input
              id="deal-insp-amount"
              type="number"
              min="0"
              step="0.01"
              value={formValues.amount}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, amount: e.target.value })}
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
          <div>
            <label htmlFor="deal-insp-stage" className="block font-medium text-body mb-1">
              Stage
            </label>
            <Select
              id="deal-insp-stage"
              ariaLabel="Stage"
              value={formValues.stage}
              onChange={(val) => setDraft({ ...formValues, stage: val })}
              options={STAGE_FIELD_OPTIONS}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deal-insp-close" className="block font-medium text-body mb-1">
              Target close date
            </label>
            <input
              id="deal-insp-close"
              type="date"
              value={formValues.target_close_date}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) =>
                setDraft({ ...formValues, target_close_date: e.target.value })
              }
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="deal-insp-prob" className="block font-medium text-body mb-1">
              Win probability (%)
            </label>
            <input
              id="deal-insp-prob"
              type="number"
              min="0"
              max="100"
              value={formValues.win_probability}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) =>
                setDraft({ ...formValues, win_probability: e.target.value })
              }
              className="crm-input w-full px-3 py-2 num-tabular"
            />
          </div>
        </div>

        <div>
          <label htmlFor="deal-insp-notes" className="block font-medium text-body mb-1">
            Notes
          </label>
          <textarea
            id="deal-insp-notes"
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
