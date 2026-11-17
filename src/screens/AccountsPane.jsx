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

const EMPTY_FORM = {
  name: '',
  city: '',
  phone: '',
  email: '',
  notes: '',
}

export function AccountsPane({
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
    objectKey: 'account',
    permissions,
    initialInspectRequest,
    onInspectRequestConsumed,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const cityChartItems = useMemo(() => {
    const raw = pane.summary?.city_counts
    if (!Array.isArray(raw) || raw.length === 0) return []
    const items = raw.map((row) => ({
      label: row.city || 'No city',
      count: Number(row.count || 0),
    }))
    if (items.length <= 4) return items
    const topThree = items.slice(0, 3)
    const otherCount = items.slice(3).reduce((sum, item) => sum + item.count, 0)
    return [...topThree, { label: 'Other', count: otherCount }]
  }, [pane.summary?.city_counts])

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)

  const cityOptions = useMemo(() => {
    const cities = pane.summary?.cities || []
    return [
      { value: '', label: 'All cities' },
      ...cities.map((city) => ({ value: city, label: city })),
    ]
  }, [pane.summary?.cities])

  const active = pane.activeRecord
  const formValues = draft ?? {
    name: active?.name || '',
    city: active?.city || '',
    phone: active?.phone || '',
    email: active?.email || '',
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
      setCreateError('Company name is required.')
      return
    }
    setCreateError('')
    setCreating(true)
    const res = await pane.createRecord({
      name: createForm.name.trim(),
      city: createForm.city.trim(),
      phone: createForm.phone.trim(),
      email: createForm.email.trim(),
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
      city: formValues.city.trim(),
      phone: formValues.phone.trim(),
      email: formValues.email.trim(),
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
        id="pane-accounts"
        title="Accounts"
        subtitle={`Companies and organizations in ${workspace?.name || 'this workspace'}.`}
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Account"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Total accounts',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          {
            label: 'Cities covered',
            value: (pane.summary?.cities || []).length,
            caption: 'Distinct locations',
          },
        ]}
        statsAddon={
          <SummaryChartCard title="Companies by city" subtitle="Filtered distribution">
            <HorizontalBarChart items={cityChartItems} emptyLabel="No city data yet" />
          </SummaryChartCard>
        }
        toolbarCaption={`Open a row to update details, inspect linked ${contactPlural.toLowerCase()}, or log activities.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search accounts..."
        filters={
          <div className="w-40">
            <Select
              id="account-city-filter"
              ariaLabel="Filter accounts by city"
              value={pane.filters.city || ''}
              onChange={(val) => pane.updateFilter('city', val)}
              options={cityOptions}
            />
          </div>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage="No accounts yet."
        columns={[
          { key: 'name', label: 'Company' },
          { key: 'city', label: 'City' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'contacts', label: contactPlural },
          { key: 'action', label: 'Action', align: 'right' },
        ]}
        renderRow={(acc) => (
          <tr
            key={acc.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(acc.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              <div>{acc.name}</div>
              {acc.source_lead?.record_code ? (
                <div className="text-[11px] text-sub font-normal num-tabular">
                  From {acc.source_lead.record_code}
                </div>
              ) : null}
            </td>
            <td className="py-3 px-4 text-sub">{acc.city || 'Not set'}</td>
            <td className="py-3 px-4 text-sub num-tabular">{acc.phone || 'Not set'}</td>
            <td className="py-3 px-4 text-sub break-all">{acc.email || 'Not set'}</td>
            <td className="py-3 px-4 num-tabular text-main">
              {acc.contacts_count ?? 0}
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleInspect(acc.id)}
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
        itemLabel="account"
        pluralLabel="accounts"
      />

      <Modal
        open={createOpen}
        title="Create New Account"
        subtitle="Add a company or organization to this workspace."
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
              form="create-account-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Saving...' : 'Save Account'}
            </Button>
          </>
        }
      >
        <form id="create-account-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />
          <div>
            <label htmlFor="new-account-name" className="block font-medium text-body mb-1">
              Company name
            </label>
            <input
              id="new-account-name"
              type="text"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Meridian Port Services"
              disabled={creating}
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-account-city" className="block font-medium text-body mb-1">
                City
              </label>
              <input
                id="new-account-city"
                type="text"
                value={createForm.city}
                onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Accra"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="new-account-phone" className="block font-medium text-body mb-1">
                Phone
              </label>
              <input
                id="new-account-phone"
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+233 30 000 0000"
                disabled={creating}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label htmlFor="new-account-email" className="block font-medium text-body mb-1">
              Email
            </label>
            <input
              id="new-account-email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="ops@company.com.gh"
              disabled={creating}
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="new-account-notes" className="block font-medium text-body mb-1">
              Notes
            </label>
            <textarea
              id="new-account-notes"
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
        objectKey="account"
        objectLabel="Account"
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
        badgeText={active?.city || ''}
      >
        <div>
          <label htmlFor="acc-insp-name" className="block font-medium text-body mb-1">
            Company name
          </label>
          <input
            id="acc-insp-name"
            type="text"
            value={formValues.name}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
            onChange={(e) => setDraft({ ...formValues, name: e.target.value })}
            className="crm-input w-full px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="acc-insp-city" className="block font-medium text-body mb-1">
              City
            </label>
            <input
              id="acc-insp-city"
              type="text"
              value={formValues.city}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, city: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="acc-insp-phone" className="block font-medium text-body mb-1">
              Phone
            </label>
            <input
              id="acc-insp-phone"
              type="text"
              value={formValues.phone}
              disabled={!pane.rights.canUpdate || pane.savingInspector}
              onChange={(e) => setDraft({ ...formValues, phone: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label htmlFor="acc-insp-email" className="block font-medium text-body mb-1">
            Email
          </label>
          <input
            id="acc-insp-email"
            type="email"
            value={formValues.email}
            disabled={!pane.rights.canUpdate || pane.savingInspector}
            onChange={(e) => setDraft({ ...formValues, email: e.target.value })}
            className="crm-input w-full px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="acc-insp-notes" className="block font-medium text-body mb-1">
            Notes
          </label>
          <textarea
            id="acc-insp-notes"
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
