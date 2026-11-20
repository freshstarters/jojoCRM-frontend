import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { ConversionResultBanner } from '../components/crm/ConversionResultBanner.jsx'
import { ConvertLeadModal } from '../components/crm/ConvertLeadModal.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { FieldLabel } from '../components/crm/FieldLabel.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import {
  RecordSharingControl,
  SharingBadge,
} from '../components/crm/RecordSharingControl.jsx'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import {
  MiniDonutChart,
  SummaryChartCard,
} from '../components/crm/SummaryMiniCharts.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  canUserConvertLead,
  filterWritablePayload,
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'

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
  visibility: 'workspace',
  shared_role_id: '',
}

export function LeadsPane({
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
  const { conversionEnabled, canConvert } = canUserConvertLead(permissions, workspace)

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'lead',
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
  const hideName = isFieldHidden(fr, 'name')
  const hideCompany = isFieldHidden(fr, 'company')
  const hideEmail = isFieldHidden(fr, 'email')
  const hidePhone = isFieldHidden(fr, 'phone')
  const hideConsent = isFieldHidden(fr, 'sms_consent')
  const hideStatus = isFieldHidden(fr, 'status')
  const hideNotes = isFieldHidden(fr, 'notes')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [convertTargetLead, setConvertTargetLead] = useState(null)
  const [conversionResult, setConversionResult] = useState(null)

  const active = pane.activeRecord
  const isActiveConverted = active?.status === 'converted'
  const identityLocked =
    !pane.rights.canUpdate || pane.savingInspector || isActiveConverted
  const formValues = draft ?? {
    name: active?.name || '',
    company: active?.company || '',
    phone: active?.phone || '',
    email: active?.email || '',
    sms_consent: active?.sms_consent ? 'on' : 'off',
    notes: active?.notes || '',
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'name', label: 'Person' }]
    if (!hideCompany) cols.push({ key: 'company', label: 'Company' })
    if (!hideEmail) cols.push({ key: 'email', label: 'Email' })
    if (!hidePhone) cols.push({ key: 'phone', label: 'Phone' })
    if (!hideConsent) cols.push({ key: 'consent', label: 'SMS consent' })
    if (!hideStatus) cols.push({ key: 'status', label: 'Status' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideCompany, hideEmail, hidePhone, hideConsent, hideStatus])

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!hideName && !isFieldReadOnly(fr, 'name') && !createForm.name.trim()) {
      setCreateError('Lead name is required.')
      return
    }
    if (createForm.visibility === 'role' && !createForm.shared_role_id) {
      setCreateError('Select a role to share this lead with.')
      return
    }
    setCreateError('')
    setCreating(true)
    const fieldPayload = filterWritablePayload(
      {
        name: createForm.name.trim(),
        company: createForm.company.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim(),
        sms_consent: createForm.sms_consent === 'on',
        notes: createForm.notes,
      },
      fr,
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
    const rawFields = isActiveConverted
      ? {
          sms_consent: formValues.sms_consent === 'on',
          notes: formValues.notes,
        }
      : {
          name: formValues.name.trim(),
          company: formValues.company.trim(),
          phone: formValues.phone.trim(),
          email: formValues.email.trim(),
          sms_consent: formValues.sms_consent === 'on',
          notes: formValues.notes,
        }
    const fieldPayload = filterWritablePayload(rawFields, fr)
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
    pane.openInspector(recordId)
  }

  function openConvertModal(lead = null) {
    setConvertTargetLead(lead)
    setConvertModalOpen(true)
  }

  async function handleLeadConverted(data) {
    setConversionResult(data)
    onAuditRecorded?.()
    if (pane.inspectorOpen && pane.activeRecord?.id === data?.lead?.id) {
      setDraft(null)
      await pane.refreshActiveRecord()
    } else {
      pane.reload()
    }
  }

  return (
    <>
      <CrmListPage
        id="pane-leads"
        title="Leads"
        subtitle={
          conversionEnabled
            ? 'Prospects kept separate from Accounts and Contacts until conversion.'
            : 'Prospects tracked in this workspace.'
        }
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate}
        createLabel="New Lead"
        onCreateClick={openCreateModal}
        headerActions={
          conversionEnabled ? (
            <Button
              type="button"
              variant="secondary"
              disabled={!canConvert}
              data-tooltip={
                canConvert
                  ? undefined
                  : `Your ${roleName} role lacks permission to convert leads`
              }
              onClick={() => openConvertModal(null)}
              className="px-3 py-1.5 text-xs flex items-center space-x-1.5"
            >
              <svg
                className="w-3.5 h-3.5 text-sub shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Convert Lead</span>
            </Button>
          ) : null
        }
        extraContent={
          <ConversionResultBanner
            result={conversionResult}
            contactLabel={contactLabel}
            onOpenRecord={onOpenLinkedRecord}
            onDismiss={() => setConversionResult(null)}
          />
        }
        stats={[
          {
            label: 'Visible leads',
            value: pane.totalCount,
            caption: 'Matching current filter',
          },
          ...(!hideStatus
            ? [
                {
                  label: 'Open leads',
                  value: pane.summary?.open_count ?? 0,
                  caption: 'Not yet converted',
                },
              ]
            : []),
        ]}
        statsAddon={
          !hideStatus ? (
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
          ) : null
        }
        toolbarCaption={
          conversionEnabled
            ? 'Open a row to edit lead details, convert open leads, or log notes, tasks, calls, and meetings.'
            : 'Open a row to edit lead details or log notes, tasks, calls, and meetings.'
        }
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search leads..."
        filters={
          <>
            {!hideStatus ? (
              <div className="w-44">
                <Select
                  id="lead-status-filter"
                  ariaLabel="Filter leads by status"
                  value={pane.filters.status || ''}
                  onChange={(val) => pane.updateFilter('status', val)}
                  options={STATUS_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            <div className="w-40">
              <Select
                id="lead-visibility-filter"
                ariaLabel="Filter leads by sharing"
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
        emptyMessage="No leads yet."
        columns={columns}
        renderRow={(lead) => (
          <tr
            key={lead.id}
            className="crm-hover cursor-pointer"
            onClick={() => handleInspect(lead.id)}
          >
            <td className="py-3 px-4 font-medium text-main">
              {lead.name ?? lead.display_label}
            </td>
            {!hideCompany ? (
              <td className="py-3 px-4 text-sub">{lead.company || 'Not set'}</td>
            ) : null}
            {!hideEmail ? (
              <td className="py-3 px-4 text-sub break-all">{lead.email || 'Not set'}</td>
            ) : null}
            {!hidePhone ? (
              <td className="py-3 px-4 text-sub num-tabular">{lead.phone || 'Not set'}</td>
            ) : null}
            {!hideConsent ? (
              <td className="py-3 px-4">
                <span
                  className={`badge ${
                    lead.sms_consent ? 'badge-success' : 'badge-neutral'
                  }`}
                >
                  {lead.sms_consent ? 'On' : 'Off'}
                </span>
              </td>
            ) : null}
            {!hideStatus ? (
              <td className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`badge ${
                      lead.status === 'converted' ? 'badge-success' : 'badge-info'
                    }`}
                  >
                    {lead.status === 'converted' ? 'Converted' : 'Open'}
                  </span>
                  {lead.status === 'converted' && lead.converted_deal?.record_code ? (
                    <span className="text-[11px] text-sub num-tabular">
                      {lead.converted_deal.record_code}
                    </span>
                  ) : null}
                </div>
              </td>
            ) : null}
            <td className="py-3 px-4">
              <SharingBadge record={lead} />
            </td>
            <td
              className="py-3 px-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="inline-flex items-center gap-1.5">
                {conversionEnabled && !lead.converted ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canConvert}
                    data-tooltip={
                      canConvert
                        ? undefined
                        : `Your ${roleName} role lacks permission to convert leads`
                    }
                    onClick={() => openConvertModal(lead)}
                    className="px-2.5 py-1 text-xs"
                  >
                    Convert
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleInspect(lead.id)}
                  className="px-2.5 py-1 text-xs"
                >
                  Inspect
                </Button>
              </div>
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
          {!hideName || !hideCompany ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hideName ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-lead-name" label="Name" readOnly={isFieldReadOnly(fr, 'name')} />
                  <input
                    id="new-lead-name"
                    type="text"
                    required={!isFieldReadOnly(fr, 'name')}
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Akua Mensah"
                    disabled={creating || isFieldReadOnly(fr, 'name')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
              {!hideCompany ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-lead-company" label="Company" readOnly={isFieldReadOnly(fr, 'company')} />
                  <input
                    id="new-lead-company"
                    type="text"
                    value={createForm.company}
                    onChange={(e) => setCreateForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="e.g. Ghana Water Company"
                    disabled={creating || isFieldReadOnly(fr, 'company')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hidePhone || !hideEmail ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!hidePhone ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-lead-phone" label="Phone" readOnly={isFieldReadOnly(fr, 'phone')} />
                  <input
                    id="new-lead-phone"
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+233 24 000 0000"
                    disabled={creating || isFieldReadOnly(fr, 'phone')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
              {!hideEmail ? (
                <div className="space-y-1">
                  <FieldLabel htmlFor="new-lead-email" label="Email" readOnly={isFieldReadOnly(fr, 'email')} />
                  <input
                    id="new-lead-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="name@company.com.gh"
                    disabled={creating || isFieldReadOnly(fr, 'email')}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideConsent ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-lead-consent" label="SMS consent" readOnly={isFieldReadOnly(fr, 'sms_consent')} />
              <Select
                id="new-lead-consent"
                ariaLabel="SMS consent"
                value={createForm.sms_consent}
                onChange={(val) => setCreateForm((f) => ({ ...f, sms_consent: val }))}
                options={CONSENT_FIELD_OPTIONS}
                disabled={creating || isFieldReadOnly(fr, 'sms_consent')}
              />
            </div>
          ) : null}

          {!hideNotes ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-lead-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
              <textarea
                id="new-lead-notes"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={creating || isFieldReadOnly(fr, 'notes')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          <RecordSharingControl
            idPrefix="new-lead-sharing"
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
          pane.closeInspector()
        }}
        objectKey="lead"
        objectLabel="Lead"
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
        error={pane.inspectorError}
        notice={pane.actionNotice}
        canUpdate={pane.rights.canUpdate}
        canDelete={pane.rights.canDelete && !isActiveConverted}
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
        badgeText={!hideStatus ? (active?.status === 'converted' ? 'Converted' : 'Open') : ''}
        badgeClassName={`badge ${
          active?.status === 'converted' ? 'badge-success' : 'badge-info'
        }`}
      >
        {isActiveConverted ? (
          <p className="text-[11px] text-sub">
            Name, company, email, and phone stay with the Account and {contactLabel} created from this lead.
          </p>
        ) : null}

        {!hideName || !hideCompany ? (
          <div className="grid grid-cols-2 gap-3">
            {!hideName ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="lead-insp-name" label="Name" readOnly={isFieldReadOnly(fr, 'name')} />
                <input
                  id="lead-insp-name"
                  type="text"
                  value={formValues.name}
                  disabled={identityLocked || isFieldReadOnly(fr, 'name')}
                  onChange={(e) => setDraft({ ...formValues, name: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
            {!hideCompany ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="lead-insp-company" label="Company" readOnly={isFieldReadOnly(fr, 'company')} />
                <input
                  id="lead-insp-company"
                  type="text"
                  value={formValues.company}
                  disabled={identityLocked || isFieldReadOnly(fr, 'company')}
                  onChange={(e) => setDraft({ ...formValues, company: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hidePhone || !hideEmail ? (
          <div className="grid grid-cols-2 gap-3">
            {!hidePhone ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="lead-insp-phone" label="Phone" readOnly={isFieldReadOnly(fr, 'phone')} />
                <input
                  id="lead-insp-phone"
                  type="text"
                  value={formValues.phone}
                  disabled={identityLocked || isFieldReadOnly(fr, 'phone')}
                  onChange={(e) => setDraft({ ...formValues, phone: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
            {!hideEmail ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="lead-insp-email" label="Email" readOnly={isFieldReadOnly(fr, 'email')} />
                <input
                  id="lead-insp-email"
                  type="email"
                  value={formValues.email}
                  disabled={identityLocked || isFieldReadOnly(fr, 'email')}
                  onChange={(e) => setDraft({ ...formValues, email: e.target.value })}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!hideConsent ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="lead-insp-consent" label="SMS consent" readOnly={isFieldReadOnly(fr, 'sms_consent')} />
            <Select
              id="lead-insp-consent"
              ariaLabel="SMS consent"
              value={formValues.sms_consent}
              onChange={(val) => setDraft({ ...formValues, sms_consent: val })}
              options={CONSENT_FIELD_OPTIONS}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'sms_consent')}
            />
          </div>
        ) : null}

        {!hideNotes ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="lead-insp-notes" label="Notes" readOnly={isFieldReadOnly(fr, 'notes')} />
            <textarea
              id="lead-insp-notes"
              rows={3}
              value={formValues.notes}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'notes')}
              onChange={(e) => setDraft({ ...formValues, notes: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        {conversionEnabled && active && !active.converted ? (
          <div className="pt-1">
            <Button
              type="button"
              variant="secondary"
              disabled={!canConvert}
              data-tooltip={
                canConvert
                  ? undefined
                  : `Your ${roleName} role lacks permission to convert leads`
              }
              onClick={() => openConvertModal(active)}
              className="px-3 py-1.5 text-xs"
            >
              Convert this lead
            </Button>
          </div>
        ) : null}
      </RecordInspectorDrawer>

      {conversionEnabled ? (
        <ConvertLeadModal
          open={convertModalOpen}
          onClose={() => {
            setConvertModalOpen(false)
            setConvertTargetLead(null)
          }}
          workspaceSlug={workspace?.slug}
          contactLabel={contactLabel}
          initialLead={convertTargetLead}
          onConverted={handleLeadConverted}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </>
  )
}
