import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../utils/api.js'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'
import { Modal } from './Modal.jsx'

export function SettingsPacksSection({
  workspace,
  permissions,
  onWorkspaceUpdated,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const canManagePacks = Boolean(permissions?.can_manage_packs ?? permissions?.is_owner)

  const [packsData, setPacksData] = useState(null)
  const [loading, setLoading] = useState(Boolean(workspaceSlug))
  const [loadError, setLoadError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [packFilter, setPackFilter] = useState('')

  const [pendingPack, setPendingPack] = useState(null)
  const [enablingPack, setEnablingPack] = useState(false)

  const [pendingDisableTable, setPendingDisableTable] = useState(null)
  const [togglingTableKey, setTogglingTableKey] = useState('')

  useEffect(() => {
    if (!workspaceSlug) return
    let cancelled = false

    apiGet(`/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/packs/`)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setLoadError(data?.error || data?.detail || 'Could not load packs and tables.')
          return
        }
        setLoadError('')
        setPacksData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Network error while loading packs and tables.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [workspaceSlug, refreshTick, onSessionExpired])

  function handleRefresh() {
    setLoadError('')
    setLoading(true)
    setRefreshTick((prev) => prev + 1)
  }

  async function handleConfirmEnablePack() {
    if (!pendingPack || !workspaceSlug) return
    setActionError('')
    setActionSuccess('')
    setEnablingPack(true)
    try {
      const { response, data } = await apiPost(
        `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/packs/`,
        { pack_key: pendingPack.key },
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || 'Could not enable selected pack.')
        setPendingPack(null)
        return
      }
      setPacksData(data)
      setActionSuccess(data?.message || `${pendingPack.label} pack enabled.`)
      setPendingPack(null)
      if (data?.workspace) {
        onWorkspaceUpdated?.({ workspace: data.workspace })
      }
      onAuditRecorded?.()
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setEnablingPack(false)
    }
  }

  async function handleToggleTable(table, nextEnabled) {
    if (!workspaceSlug || !table) return
    setActionError('')
    setActionSuccess('')
    setTogglingTableKey(table.key)
    try {
      const { response, data } = await apiPatch(
        `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/tables/${encodeURIComponent(table.key)}/`,
        { is_enabled: nextEnabled },
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || `Could not update ${table.label}.`)
        setPendingDisableTable(null)
        return
      }
      setPacksData(data)
      setPendingDisableTable(null)
      setActionSuccess(
        data?.message || `${table.label} ${nextEnabled ? 'turned on' : 'turned off'}.`,
      )
      if (data?.workspace) {
        onWorkspaceUpdated?.({ workspace: data.workspace })
      }
      if (data?.changed) {
        onAuditRecorded?.()
      }
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setTogglingTableKey('')
    }
  }

  const tables = useMemo(() => packsData?.tables || [], [packsData])
  const coreTables = useMemo(
    () => tables.filter((tbl) => tbl.is_core),
    [tables],
  )
  const catalogTables = useMemo(() => {
    const nonCore = tables.filter((tbl) => !tbl.is_core)
    return nonCore.sort((a, b) => {
      if (a.is_enabled !== b.is_enabled) return a.is_enabled ? -1 : 1
      if (a.in_workspace !== b.in_workspace) return a.in_workspace ? -1 : 1
      return a.label.localeCompare(b.label)
    })
  }, [tables])

  const allPacks = useMemo(() => packsData?.packs || [], [packsData])
  const activePacks = useMemo(
    () => allPacks.filter((pack) => pack.is_pack_enabled),
    [allPacks],
  )
  const filteredPacks = useMemo(() => {
    const query = packFilter.trim().toLowerCase()
    if (!query) return allPacks
    return allPacks.filter(
      (pack) =>
        pack.label.toLowerCase().includes(query) ||
        pack.description.toLowerCase().includes(query) ||
        pack.pack_objects.some((obj) => obj.label.toLowerCase().includes(query)),
    )
  }, [allPacks, packFilter])

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-main">
            Starter core & business-type packs
          </h2>
          <p className="text-xs text-sub">
            Turn on additional business-type packs anytime. Existing tables and saved records stay intact, and empty pack tables can be turned off.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {packsData ? (
            <span className="badge badge-info num-tabular">
              {packsData.active_table_count} active tables ({packsData.core_table_count} core +{' '}
              {packsData.pack_table_count} pack)
            </span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={handleRefresh}
            className="px-3 py-1.5 text-xs"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </Card>

      {!canManagePacks && (
        <FeedbackNotice
          tone="info"
          message="Only the workspace Owner or a role with Users & Roles or Theme & Layouts access can turn packs on or toggle tables."
        />
      )}

      <FeedbackNotice tone="danger" message={loadError} />
      <FeedbackNotice tone="danger" message={actionError} />
      <FeedbackNotice tone="success" message={actionSuccess} />

      {loading && !packsData ? (
        <Card className="p-6">
          <p className="text-xs text-sub">Loading workspace packs and tables...</p>
        </Card>
      ) : null}

      {packsData ? (
        <>
          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-main">
                  Core tables ({coreTables.length})
                </h3>
                <p className="text-xs text-sub mt-0.5">
                  Shared across every workspace and always enabled.
                </p>
              </div>
              <span className="badge badge-neutral">Always on</span>
            </div>

            <div className="divide-y crm-border text-xs">
              {coreTables.map((tbl) => (
                <div
                  key={tbl.key}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-main">{tbl.label}</span>
                      {tbl.key === 'contact' && tbl.label !== 'Contact' ? (
                        <span className="badge badge-info">Stored object: Contact</span>
                      ) : null}
                      <span className="badge badge-success">Core</span>
                    </div>
                    <p className="text-sub">{tbl.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge badge-neutral num-tabular">
                      {tbl.record_count} {tbl.record_count === 1 ? 'record' : 'records'}
                    </span>
                    <span className="text-[11px] text-sub">Required</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-main">
                  Catalog tables ({packsData.pack_table_count} active of {catalogTables.length})
                </h3>
                <p className="text-xs text-sub mt-0.5">
                  Empty tables from a pack can be turned off. Tables that already hold records stay enabled.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activePacks.map((pack) => (
                  <span
                    key={pack.key}
                    className={`badge ${pack.is_primary ? 'badge-info' : 'badge-success'}`}
                  >
                    {pack.label}
                    {pack.is_primary ? ' · Primary' : ''}
                  </span>
                ))}
              </div>
            </div>

            <div className="divide-y crm-border text-xs">
              {catalogTables.map((tbl) => {
                const isBusy = togglingTableKey === tbl.key
                const hasRecords = tbl.record_count > 0
                return (
                  <div
                    key={tbl.key}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-main">{tbl.label}</span>
                        <span
                          className={`badge ${
                            tbl.is_enabled ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {tbl.is_enabled ? 'On' : 'Off'}
                        </span>
                        {tbl.source_pack_label ? (
                          <span className="badge badge-neutral">
                            {tbl.source_pack_label}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sub">{tbl.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge badge-neutral num-tabular">
                        {tbl.record_count} {tbl.record_count === 1 ? 'record' : 'records'}
                      </span>
                      {canManagePacks ? (
                        tbl.is_enabled ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isBusy || hasRecords}
                            data-tooltip={
                              hasRecords
                                ? `Cannot turn off ${tbl.label} while it holds ${tbl.record_count} record${tbl.record_count === 1 ? '' : 's'}`
                                : `Turn off empty ${tbl.label} table`
                            }
                            onClick={() => setPendingDisableTable(tbl)}
                            className="px-2.5 py-1 text-xs"
                          >
                            {isBusy
                              ? 'Updating...'
                              : hasRecords
                                ? 'Locked (has records)'
                                : 'Turn off'}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => handleToggleTable(tbl, true)}
                            className="px-2.5 py-1 text-xs"
                          >
                            {isBusy ? 'Updating...' : 'Turn on'}
                          </Button>
                        )
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b crm-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-main">
                  Business-type packs (20)
                </h3>
                <p className="text-xs text-sub mt-0.5">
                  Each pack turns on its 12 catalog tables alongside your existing workspace data.
                </p>
              </div>
              <div className="w-full sm:w-64">
                <input
                  type="search"
                  value={packFilter}
                  onChange={(event) => setPackFilter(event.target.value)}
                  placeholder="Filter packs or objects..."
                  aria-label="Filter business-type packs"
                  className="crm-input w-full px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            {filteredPacks.length === 0 ? (
              <p className="text-xs text-sub">
                No business-type packs match &quot;{packFilter}&quot;.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {filteredPacks.map((pack) => {
                  const needsEnable = !pack.is_pack_enabled || !pack.all_tables_enabled
                  return (
                    <Card
                      key={pack.key}
                      variant="subtle"
                      className="p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="font-semibold text-main">{pack.label}</div>
                          <span
                            className={`badge ${
                              pack.is_primary
                                ? 'badge-info'
                                : pack.all_tables_enabled
                                  ? 'badge-success'
                                  : pack.is_pack_enabled
                                    ? 'badge-warn'
                                    : 'badge-neutral'
                            }`}
                          >
                            {pack.is_primary
                              ? `Primary · ${pack.enabled_table_count}/12`
                              : pack.all_tables_enabled
                                ? 'Enabled · 12/12'
                                : pack.is_pack_enabled
                                  ? `Partial · ${pack.enabled_table_count}/12`
                                  : '12 tables'}
                          </span>
                        </div>

                        <p className="text-sub leading-relaxed">{pack.description}</p>

                        {pack.default_contact_label !== 'Contact' ? (
                          <div>
                            <span className="badge badge-info">
                              Default Contact label: {pack.default_contact_label}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {pack.pack_objects.map((obj) => (
                            <span key={obj.key} className="badge badge-neutral">
                              {obj.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {canManagePacks ? (
                        <div className="pt-2 border-t crm-border flex items-center justify-between gap-2">
                          <span className="text-[11px] text-sub num-tabular">
                            {pack.enabled_table_count} / {pack.pack_table_count} active
                          </span>
                          {needsEnable ? (
                            <Button
                              type="button"
                              variant={pack.is_pack_enabled ? 'secondary' : 'primary'}
                              onClick={() => setPendingPack(pack)}
                              className="px-3 py-1.5 text-xs"
                            >
                              {pack.is_pack_enabled ? 'Enable missing tables' : 'Turn on pack'}
                            </Button>
                          ) : (
                            <span className="text-[11px] font-medium text-sub">
                              All pack tables active
                            </span>
                          )}
                        </div>
                      ) : null}
                    </Card>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      ) : null}

      <Modal
        open={Boolean(pendingPack)}
        title={pendingPack ? `Turn on ${pendingPack.label}?` : 'Turn on pack'}
        subtitle="Adds the pack's 12 catalog tables to this workspace"
        onClose={() => {
          if (!enablingPack) setPendingPack(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={enablingPack}
              onClick={() => setPendingPack(null)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={enablingPack}
              onClick={handleConfirmEnablePack}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {enablingPack ? 'Turning on...' : 'Turn on pack'}
            </Button>
          </>
        }
      >
        {pendingPack ? (
          <div className="space-y-3 text-xs">
            <p className="text-sub leading-relaxed">
              Turning on <span className="font-semibold text-main">{pendingPack.label}</span> enables its 12 pack tables while keeping every existing table, custom label, and saved record intact.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pendingPack.pack_objects.map((obj) => (
                <span key={obj.key} className="badge badge-neutral">
                  {obj.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pendingDisableTable)}
        title={
          pendingDisableTable
            ? `Turn off ${pendingDisableTable.label}?`
            : 'Turn off table'
        }
        subtitle="Empty pack tables can be hidden and turned back on later"
        onClose={() => {
          if (!togglingTableKey) setPendingDisableTable(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(togglingTableKey)}
              onClick={() => setPendingDisableTable(null)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={Boolean(togglingTableKey)}
              onClick={() => handleToggleTable(pendingDisableTable, false)}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {togglingTableKey ? 'Turning off...' : 'Turn off table'}
            </Button>
          </>
        }
      >
        {pendingDisableTable ? (
          <p className="text-xs text-sub leading-relaxed">
            <span className="font-semibold text-main">{pendingDisableTable.label}</span> currently has 0 records. Turning it off hides it from workspace navigation until you turn it back on.
          </p>
        ) : null}
      </Modal>
    </div>
  )
}
