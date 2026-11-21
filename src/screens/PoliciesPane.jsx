import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { SharingBadge } from '../components/crm/RecordSharingControl.jsx'
import { PolicyFormModal } from '../components/policies/PolicyFormModal.jsx'
import { PolicyInspectorDrawer } from '../components/policies/PolicyInspectorDrawer.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  POLICY_STATUSES,
  getPolicyStatusBadgeClass,
  getPolicyStatusColor,
} from '../service/commercialService.js'
import { isFieldHidden } from '../service/crmService.js'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import { formatDateOnly, formatGhs } from '../utils/formatters.js'

export function PoliciesPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenLinkedRecord,
  prefillCreate = null,
  onClearPrefillCreate,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const contactLabel = workspace?.contact_label || 'Contact'
  const contactPlural = workspace?.contact_plural_label || 'Contacts'
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')

  const pane = useCrmRecordsPane({
    workspaceSlug,
    objectKey: 'policy',
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
  const hideProduct = isFieldHidden(fr, 'product')
  const hideAccount = isFieldHidden(fr, 'account')
  const hideContact = isFieldHidden(fr, 'contact')
  const hidePremium = isFieldHidden(fr, 'premium')
  const hideRenewal = isFieldHidden(fr, 'renewal_date')
  const hideStatus = isFieldHidden(fr, 'status')

  const [createOpen, setCreateOpen] = useState(() => Boolean(prefillCreate))
  const [modalPrefill, setModalPrefill] = useState(() => prefillCreate)

  useEffect(() => {
    if (prefillCreate) {
      setModalPrefill(prefillCreate)
      setCreateOpen(true)
    }
  }, [prefillCreate])

  const configuredStatuses = useMemo(
    () => pane.optionsData?.constants?.policy_statuses || POLICY_STATUSES,
    [pane.optionsData?.constants?.policy_statuses],
  )

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'All statuses' },
      ...configuredStatuses.map((s) => ({ value: s, label: s })),
    ],
    [configuredStatuses],
  )

  const accountFilterOptions = useMemo(
    () => [
      { value: '', label: 'All accounts' },
      ...(pane.optionsData?.accounts || []).map((acc) => ({
        value: String(acc.id),
        label: acc.name,
      })),
    ],
    [pane.optionsData?.accounts],
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
        color: getPolicyStatusColor(s),
      }
    })
  }, [configuredStatuses, pane.summary?.status_counts, hideStatus])

  const columns = useMemo(() => {
    const cols = [{ key: 'product', label: 'Finance Product' }]
    if (!hideAccount) cols.push({ key: 'account', label: 'Account' })
    if (!hideContact) cols.push({ key: 'contact', label: contactLabel })
    if (!hidePremium) cols.push({ key: 'premium', label: 'Premium (GHS)' })
    if (!hideRenewal) cols.push({ key: 'renewal', label: 'Renewal' })
    if (!hideStatus) cols.push({ key: 'status', label: 'Status' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideAccount, hideContact, hidePremium, hideRenewal, hideStatus, contactLabel])

  const renewingYear = pane.summary?.renewing_year || new Date().getFullYear()

  return (
    <>
      <CrmListPage
        id="pane-policies"
        title="Policies"
        subtitle="Finance products with premium, status, and renewal linked to an Account or Contact."
        roleName={roleName}
        canRead={pane.rights.canRead}
        headerActions={
          pane.rights.canCreate ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setModalPrefill(null)
                setCreateOpen(true)
              }}
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
              <span>New Policy</span>
            </Button>
          ) : null
        }
        stats={[
          {
            label: 'Visible policies',
            value: pane.totalCount,
            sublabel: 'Policies in this view',
          },
          ...(!hidePremium && !hideStatus
            ? [
                {
                  label: 'Active premium',
                  value:
                    pane.summary?.active_premium !== null &&
                    pane.summary?.active_premium !== undefined
                      ? formatGhs(pane.summary.active_premium)
                      : '-',
                  sublabel: 'Total premium on Active policies',
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
                  Draft, Active, Pending Renewal, Expired, Cancelled
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
        toolbarCaption={`Each policy records a product, premium, status, and renewal linked to an Account or ${contactLabel.toLowerCase()}.`}
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search policies..."
        filters={
          <>
            {!hideStatus ? (
              <div className="w-44">
                <Select
                  ariaLabel="Filter by policy status"
                  value={pane.filters.status || ''}
                  onChange={(val) => pane.updateFilter('status', val)}
                  options={statusFilterOptions}
                />
              </div>
            ) : null}
            {!hideAccount ? (
              <div className="w-48">
                <Select
                  ariaLabel="Filter by account"
                  value={pane.filters.account_id || ''}
                  onChange={(val) => pane.updateFilter('account_id', val)}
                  options={accountFilterOptions}
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
        emptyMessage="No policies yet."
        columns={columns}
        renderRow={(row) => (
          <tr
            key={row.id}
            onClick={() => pane.openInspector(row.id)}
            className="hover:bg-slate-500/5 transition-colors cursor-pointer"
          >
            <td className="px-4 py-3 font-medium text-main">
              <div>{hideProduct ? row.record_code : row.product_name || row.record_code}</div>
              <div className="text-[11px] text-sub num-tabular">
                {[row.record_code, !hideProduct ? row.product_sku : ''].filter(Boolean).join(' · ')}
              </div>
            </td>
            {!hideAccount ? (
              <td className="px-4 py-3 text-sub">{row.account?.name || '-'}</td>
            ) : null}
            {!hideContact ? (
              <td className="px-4 py-3 text-sub">{row.contact?.name || '-'}</td>
            ) : null}
            {!hidePremium ? (
              <td className="px-4 py-3 font-semibold text-main num-tabular">
                {formatGhs(row.premium)}
              </td>
            ) : null}
            {!hideRenewal ? (
              <td className="px-4 py-3 text-sub num-tabular">
                {row.renewal_date ? formatDateOnly(row.renewal_date) : '-'}
              </td>
            ) : null}
            {!hideStatus ? (
              <td className="px-4 py-3">
                <span className={getPolicyStatusBadgeClass(row.status)}>
                  {row.status}
                </span>
              </td>
            ) : null}
            <td className="px-4 py-3">
              <SharingBadge record={row} />
            </td>
            <td className="px-4 py-3 text-right">
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  pane.openInspector(row.id)
                }}
                className="px-2.5 py-1 text-[11px]"
              >
                Open
              </Button>
            </td>
          </tr>
        )}
        page={pane.page}
        totalPages={pane.totalPages}
        totalCount={pane.totalCount}
        onPageChange={pane.setPage}
        pluralLabel="policies"
      />

      <PolicyFormModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setModalPrefill(null)
          onClearPrefillCreate?.()
        }}
        workspace={workspace}
        workspaceSlug={workspaceSlug}
        fieldRights={fr}
        optionsData={pane.optionsData}
        contactLabel={contactLabel}
        contactPlural={contactPlural}
        prefill={modalPrefill}
        onSubmitCreate={pane.createRecord}
        onSessionExpired={onSessionExpired}
      />

      <PolicyInspectorDrawer
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
        onPolicyMutated={pane.reloadList}
        onSessionExpired={onSessionExpired}
      />
    </>
  )
}
