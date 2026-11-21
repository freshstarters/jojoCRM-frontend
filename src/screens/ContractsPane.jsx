import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { RecordRelationPicker } from '../components/crm/RecordRelationPicker.jsx'
import { SharingBadge } from '../components/crm/RecordSharingControl.jsx'
import { ContractFormModal } from '../components/contracts/ContractFormModal.jsx'
import { ContractInspectorDrawer } from '../components/contracts/ContractInspectorDrawer.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  CONTRACT_STATUSES,
  getContractStatusBadgeClass,
  getContractStatusColor,
} from '../service/commercialService.js'
import { isFieldHidden } from '../service/crmService.js'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import { formatDateOnly, formatGhs } from '../utils/formatters.js'

export function ContractsPane({
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
  const workspaceSlug = workspace?.slug
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')

  const pane = useCrmRecordsPane({
    workspaceSlug,
    objectKey: 'contract',
    permissions,
    permissionsRevision,
    enabled: true,
    urlInspectRecordId,
    onInspectRecord,
    onCloseInspect,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const fr = pane.fieldRights
  const hideTitle = isFieldHidden(fr, 'title')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hideValue = isFieldHidden(fr, 'value')
  const hideRenewal = isFieldHidden(fr, 'renewal_date')
  const hideStatus = isFieldHidden(fr, 'status')

  const [createOpen, setCreateOpen] = useState(false)

  const configuredStatuses = useMemo(
    () => pane.optionsData?.constants?.contract_statuses || CONTRACT_STATUSES,
    [pane.optionsData?.constants?.contract_statuses],
  )

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'All statuses' },
      ...configuredStatuses.map((s) => ({ value: s, label: s })),
    ],
    [configuredStatuses],
  )

  const statusMixSegments = useMemo(() => {
    if (hideStatus) return []
    const counts = pane.summary?.status_counts || {}
    const total = configuredStatuses.reduce((sum, s) => sum + Number(counts[s] || 0), 0)
    return configuredStatuses.map((s) => {
      const cnt = Number(counts[s] || 0)
      const pct = total > 0 ? (cnt / total) * 100 : 0
      return {
        name: s,
        count: cnt,
        pct,
        color: getContractStatusColor(s),
      }
    })
  }, [configuredStatuses, pane.summary?.status_counts, hideStatus])

  const columns = useMemo(() => {
    const cols = []
    cols.push({ key: 'title', label: 'Title' })
    if (!hideAccount) cols.push({ key: 'account', label: 'Account' })
    if (!hideContact) cols.push({ key: 'contact', label: contactLabel })
    if (!hideValue) cols.push({ key: 'value', label: 'Value (GHS)' })
    if (!hideRenewal) cols.push({ key: 'renewal', label: 'Renewal' })
    if (!hideStatus) cols.push({ key: 'status', label: 'Status' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideAccount, hideContact, hideValue, hideRenewal, hideStatus, contactLabel])

  const renewingYear = pane.summary?.renewing_year || new Date().getFullYear()

  return (
    <>
      <CrmListPage
        id="pane-contracts"
      title="Contracts"
      subtitle="Agreements with an account and one of its people. The GHS value is typed; catalog lines do not change it."
      roleName={roleName}
      canRead={pane.rights.canRead}
      headerActions={
        pane.rights.canCreate ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 text-xs flex items-center space-x-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Contract</span>
          </Button>
        ) : null
      }
      stats={[
        {
          label: 'Visible contracts',
          value: pane.totalCount,
          sublabel: 'Agreements in this view',
        },
        ...(!hideValue && !hideStatus
          ? [
              {
                label: 'Active value',
                value:
                  pane.summary?.active_value !== null &&
                  pane.summary?.active_value !== undefined
                    ? formatGhs(pane.summary.active_value)
                    : '-',
                sublabel: 'Typed value on Active agreements',
              },
            ]
          : []),
        ...(!hideRenewal
          ? [
              {
                label: `Renew in ${renewingYear}`,
                value: pane.summary?.renewing_this_year_count ?? 0,
                sublabel: 'Renewal date falls this year',
              },
            ]
          : []),
      ]}
      extraContent={
        !hideStatus && statusMixSegments.length > 0 ? (
          <div className="crm-card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="shrink-0 sm:w-40">
              <h3 className="text-xs font-semibold text-main leading-tight">Status mix</h3>
              <p className="text-[11px] text-sub leading-snug mt-0.5">
                Draft, Active, Expired, and Terminated
              </p>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-2.5 w-full rounded-full overflow-hidden crm-subtle flex">
                {statusMixSegments.map((seg) =>
                  seg.pct > 0 ? (
                    <div
                      key={seg.name}
                      style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
                      title={`${seg.name}: ${seg.count}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                {statusMixSegments.map((seg) => (
                  <span key={seg.name} className="inline-flex items-center gap-1.5 text-sub">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="font-medium text-main">{seg.name}</span>
                    <span className="num-tabular">({seg.count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null
      }
      toolbarCaption={`Each contract belongs to one account and one ${contactLabel.toLowerCase()} at that company.`}
      searchValue={pane.search}
      onSearchChange={pane.setSearch}
      searchPlaceholder="Search contracts..."
      filters={
        <>
          {!hideStatus ? (
            <div className="w-40">
              <Select
                ariaLabel="Filter by contract status"
                value={pane.filters.status || ''}
                onChange={(val) => pane.updateFilter('status', val)}
                options={statusFilterOptions}
              />
            </div>
          ) : null}
          {!hideAccount ? (
            <div className="w-52">
              <RecordRelationPicker
                ariaLabel="Filter by account"
                workspaceSlug={workspaceSlug}
                objectKey="account"
                objectPluralLabel="accounts"
                value={pane.filters.account_id || ''}
                fallbackOptions={pane.optionsData?.accounts || []}
                allowEmpty
                emptyLabel="All accounts"
                placeholder="All accounts"
                searchPlaceholder="Search accounts..."
                onChange={(val) => pane.updateFilter('account_id', val)}
                onSessionExpired={onSessionExpired}
              />
            </div>
          ) : null}
          <div className="w-40">
            <Select
              ariaLabel="Filter by sharing"
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
      emptyMessage="No contracts yet."
      columns={columns}
      page={pane.page}
      totalPages={pane.totalPages}
      totalCount={pane.totalCount}
      hasPrevious={pane.hasPrevious}
      hasNext={pane.hasNext}
      onPageChange={pane.setPage}
      itemLabel="contract"
      pluralLabel="contracts"
      renderRow={(row) => (
        <tr
          key={row.id}
          onClick={() => pane.openInspector(row.id)}
          className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
        >
          <td className="py-2.5 px-3">
            <div className="font-medium text-main">
              {hideTitle ? row.record_code : row.title}
            </div>
            <div className="text-[11px] text-sub num-tabular">
              {row.record_code}
              {row.line_items_count > 0
                ? ` · ${row.line_items_count} ${row.line_items_count === 1 ? 'line' : 'lines'}`
                : ''}
            </div>
          </td>
          {!hideAccount ? (
            <td className="py-2.5 px-3 text-body">
              {row.account?.name || '-'}
            </td>
          ) : null}
          {!hideContact ? (
            <td className="py-2.5 px-3 text-body">
              {row.contact?.name || '-'}
            </td>
          ) : null}
          {!hideValue ? (
            <td className="py-2.5 px-3 font-semibold text-main num-tabular">
              {formatGhs(row.value)}
            </td>
          ) : null}
          {!hideRenewal ? (
            <td className="py-2.5 px-3 text-sub num-tabular">
              {row.renewal_date ? formatDateOnly(row.renewal_date) : '-'}
            </td>
          ) : null}
          {!hideStatus ? (
            <td className="py-2.5 px-3">
              <span className={getContractStatusBadgeClass(row.status)}>
                {row.status}
              </span>
            </td>
          ) : null}
          <td className="py-2.5 px-3">
            <SharingBadge
              visibility={row.visibility}
              sharedRole={row.shared_role}
            />
          </td>
          <td
            className="py-2.5 px-3 text-right whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                pane.openInspector(row.id)
              }}
              className="px-2.5 py-1 text-xs"
            >
              Inspect
            </Button>
          </td>
        </tr>
      )}
      />

      <ContractFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspace={workspace}
        workspaceSlug={workspaceSlug}
        fieldRights={fr}
        optionsData={pane.optionsData || {}}
        contactLabel={contactLabel}
        contactPlural={contactPlural}
        onSubmitCreate={async (payload) => {
          const res = await pane.createRecord(payload)
          if (res.ok && res.record?.id) {
            pane.openInspector(res.record.id)
          }
          return res
        }}
        onSessionExpired={onSessionExpired}
      />

      <ContractInspectorDrawer
        open={pane.inspectorOpen}
        onClose={pane.closeInspector}
        workspace={workspace}
        workspaceSlug={workspaceSlug}
        user={user}
        permissions={permissions}
        pane={pane}
        contactLabel={contactLabel}
        contactPlural={contactPlural}
        onOpenLinkedRecord={onOpenLinkedRecord}
        onContractMutated={() => pane.reload()}
        onSessionExpired={onSessionExpired}
      />
    </>
  )
}
