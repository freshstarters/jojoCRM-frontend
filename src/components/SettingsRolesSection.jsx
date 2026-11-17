import { useEffect, useMemo, useState } from 'react'
import { updateWorkspaceRole } from '../service/crmService.js'
import { apiGet } from '../utils/api.js'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { Checkbox } from './Checkbox.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'
import { RefreshButton } from './RefreshButton.jsx'

const SWITCH_LABELS = [
  { key: 'import', label: 'Import' },
  { key: 'export', label: 'Export' },
  { key: 'automations', label: 'Automations' },
  { key: 'scripts', label: 'Scripts' },
  { key: 'users_and_roles', label: 'Users & roles' },
  { key: 'theme_and_layouts', label: 'Theme & layouts' },
  { key: 'unattended_agent', label: 'Unattended agent' },
]

const CRUD_COLUMNS = [
  { key: 'create', label: 'Create' },
  { key: 'read', label: 'Read' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
]

export function SettingsRolesSection({
  workspace,
  workspaceSlug,
  permissions,
  onWorkspaceUpdated,
  onAuditRecorded,
  onSessionExpired,
}) {
  const effectiveSlug = workspace?.slug || workspaceSlug
  const contactLabel = workspace?.contact_label || 'Contact'

  const [rolesData, setRolesData] = useState(null)
  const [loading, setLoading] = useState(Boolean(effectiveSlug))
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [draftRightsByRoleId, setDraftRightsByRoleId] = useState({})
  const [savingRoleId, setSavingRoleId] = useState(null)
  const [roleFeedback, setRoleFeedback] = useState({})

  useEffect(() => {
    if (!effectiveSlug) return
    let cancelled = false

    apiGet(`/api/v1/workspaces/${encodeURIComponent(effectiveSlug)}/roles/`)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setError(
            data?.error || data?.detail || 'Could not load workspace roles.',
          )
          return
        }
        setError('')
        setRolesData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Network error while loading workspace roles.')
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
  }, [effectiveSlug, refreshTick, onSessionExpired])

  const objectRows = useMemo(
    () => [
      { key: 'account', label: 'Account', kind: 'Core' },
      { key: 'contact', label: contactLabel, kind: 'Core' },
      { key: 'activity', label: 'Activity', kind: 'Core' },
      { key: 'lead', label: 'Lead', kind: 'Pack' },
      { key: 'deal', label: 'Deal', kind: 'Pack' },
      { key: 'job', label: 'Job', kind: 'Pack' },
      { key: 'appointment', label: 'Appointment', kind: 'Pack' },
      { key: 'ticket', label: 'Ticket', kind: 'Pack' },
    ],
    [contactLabel],
  )

  const enabledObjectKeys = workspace?.enabled_object_keys
  const enabledKeysSet = useMemo(
    () => (Array.isArray(enabledObjectKeys) ? new Set(enabledObjectKeys) : null),
    [enabledObjectKeys],
  )

  function handleRefresh() {
    setError('')
    setDraftRightsByRoleId({})
    setRoleFeedback({})
    setLoading(true)
    setRefreshTick((prev) => prev + 1)
  }

  function handleToggleRight(role, objectKey, action) {
    const baseRights = draftRightsByRoleId[role.id] || role.object_rights || {}
    const currentEntry = baseRights[objectKey] || {
      create: false,
      read: false,
      update: false,
      delete: false,
    }
    const nextRights = {
      ...baseRights,
      [objectKey]: {
        ...currentEntry,
        [action]: !currentEntry[action],
      },
    }
    setDraftRightsByRoleId((prev) => ({
      ...prev,
      [role.id]: nextRights,
    }))
    setRoleFeedback((prev) => ({
      ...prev,
      [role.id]: null,
    }))
  }

  function handleDiscardRoleDraft(roleId) {
    setDraftRightsByRoleId((prev) => {
      const copy = { ...prev }
      delete copy[roleId]
      return copy
    })
    setRoleFeedback((prev) => ({
      ...prev,
      [roleId]: null,
    }))
  }

  async function handleSaveRoleRights(role) {
    const draftRights = draftRightsByRoleId[role.id]
    if (!draftRights || !effectiveSlug) return

    const payloadRights = {}
    for (const { key } of objectRows) {
      if (draftRights[key]) {
        payloadRights[key] = {
          create: Boolean(draftRights[key].create),
          read: Boolean(draftRights[key].read),
          update: Boolean(draftRights[key].update),
          delete: Boolean(draftRights[key].delete),
        }
      }
    }

    setSavingRoleId(role.id)
    setRoleFeedback((prev) => ({ ...prev, [role.id]: null }))

    try {
      const { response, data } = await updateWorkspaceRole(effectiveSlug, role.id, {
        object_rights: payloadRights,
      })

      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setRoleFeedback((prev) => ({
          ...prev,
          [role.id]: {
            tone: 'danger',
            message: data?.error || data?.detail || 'Could not update role permissions.',
          },
        }))
        return
      }

      const updatedRole = data?.role
      if (updatedRole) {
        setRolesData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            roles: (prev.roles || []).map((item) =>
              item.id === updatedRole.id ? updatedRole : item,
            ),
          }
        })
      }

      setDraftRightsByRoleId((prev) => {
        const copy = { ...prev }
        delete copy[role.id]
        return copy
      })

      setRoleFeedback((prev) => ({
        ...prev,
        [role.id]: {
          tone: 'success',
          message: data?.message || `Updated permissions for ${role.name}.`,
        },
      }))

      onAuditRecorded?.()

      if (onWorkspaceUpdated) {
        try {
          const wsRes = await apiGet(
            `/api/v1/workspaces/${encodeURIComponent(effectiveSlug)}/`,
          )
          if (wsRes.response.ok && wsRes.data) {
            onWorkspaceUpdated(wsRes.data)
          }
        } catch {
          // Best-effort refresh for active workspace permission state.
        }
      }
    } catch {
      setRoleFeedback((prev) => ({
        ...prev,
        [role.id]: {
          tone: 'danger',
          message: 'Network error while saving role permissions.',
        },
      }))
    } finally {
      setSavingRoleId(null)
    }
  }

  const roles = rolesData?.roles || []
  const currentRoleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const activeSeats = rolesData?.active_seat_count ?? null
  const canManageRoles = Boolean(
    permissions?.is_owner || permissions?.can_manage_users_and_roles,
  )

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-main">Workspace roles</h3>
          <p className="text-xs text-sub mt-0.5">
            Owner retains full access. Manage create, read, update, and delete object permissions on non-Owner roles below. Your current role is{' '}
            <span className="font-medium text-main">{currentRoleName}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSeats !== null ? (
            <span className="badge badge-neutral num-tabular">
              Active paid seats: {activeSeats}
            </span>
          ) : null}
          <RefreshButton
            loading={loading}
            label="Refresh workspace roles"
            onClick={handleRefresh}
          />
        </div>
      </Card>

      <FeedbackNotice tone="danger" message={error} />

      {loading && !rolesData ? (
        <Card className="p-5">
          <p className="text-xs text-sub">Loading workspace roles...</p>
        </Card>
      ) : null}

      {!loading && !error && roles.length === 0 ? (
        <Card className="p-5">
          <p className="text-xs text-sub">No roles found for this workspace yet.</p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {roles.map((role) => {
          const isDirty = Boolean(draftRightsByRoleId[role.id])
          const isSaving = savingRoleId === role.id
          const feedback = roleFeedback[role.id]
          const effectiveRights = draftRightsByRoleId[role.id] || role.object_rights || {}

          return (
            <Card key={role.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-main">{role.name}</h4>
                    {role.is_owner ? (
                      <span className="badge badge-info">Owner</span>
                    ) : null}
                    {role.is_default_staff ? (
                      <span className="badge badge-neutral">Default Staff</span>
                    ) : null}
                    {!role.is_removable ? (
                      <span className="badge badge-neutral">Cannot be removed</span>
                    ) : null}
                  </div>
                  {role.description ? (
                    <p className="text-xs text-sub max-w-2xl leading-relaxed">
                      {role.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-sub num-tabular">
                  <span className="badge badge-neutral">
                    {role.active_member_count ?? 0} active / {role.member_count ?? 0} total
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="crm-subtle px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-sub">Seat plan management</span>
                  <span
                    className={`badge ${
                      role.can_manage_seat_plan ? 'badge-success' : 'badge-neutral'
                    }`}
                  >
                    {role.can_manage_seat_plan ? 'Owner only' : 'No access'}
                  </span>
                </div>
                <div className="crm-subtle px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-sub">SMS wallet management</span>
                  <span
                    className={`badge ${
                      role.can_manage_sms_wallet ? 'badge-success' : 'badge-neutral'
                    }`}
                  >
                    {role.can_manage_sms_wallet ? 'Owner only' : 'No access'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-sub">
                  Role capability switches
                </p>
                <div className="flex flex-wrap gap-2">
                  {SWITCH_LABELS.map(({ key, label }) => {
                    const enabled = Boolean(role.switches?.[key])
                    return (
                      <span
                        key={key}
                        className={`badge ${enabled ? 'badge-success' : 'badge-neutral'}`}
                      >
                        {label}: {enabled ? 'On' : 'Off'}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t crm-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-sub">
                      Object rights (CRUD)
                    </p>
                    <p className="text-xs text-sub mt-0.5">
                      {role.is_owner
                        ? 'Owner always holds create, read, update, and delete access on every object.'
                        : canManageRoles
                          ? 'Toggle object rights and save to update this role across all assigned members.'
                          : 'View-only object rights matrix. Ask a workspace Owner or manager to update permissions.'}
                    </p>
                  </div>

                  {!role.is_owner && canManageRoles ? (
                    <div className="flex items-center gap-2">
                      {isDirty ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={isSaving}
                          onClick={() => handleDiscardRoleDraft(role.id)}
                          className="px-2.5 py-1 text-xs"
                        >
                          Discard
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="primary"
                        disabled={!isDirty || isSaving}
                        onClick={() => handleSaveRoleRights(role)}
                        className="px-3 py-1 text-xs font-medium"
                      >
                        {isSaving ? 'Saving...' : 'Save permissions'}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {feedback ? (
                  <FeedbackNotice tone={feedback.tone} message={feedback.message} />
                ) : null}

                <div className="overflow-x-auto border crm-border rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b crm-border text-[11px] uppercase tracking-wider text-sub">
                        <th className="py-2 px-3 font-semibold">Object</th>
                        <th className="py-2 px-3 font-semibold">Table status</th>
                        {CRUD_COLUMNS.map((col) => (
                          <th key={col.key} className="py-2 px-3 font-semibold text-center">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y crm-border">
                      {objectRows.map((obj) => {
                        const rowRights = effectiveRights[obj.key] || {
                          create: role.is_owner,
                          read: role.is_owner,
                          update: role.is_owner,
                          delete: role.is_owner,
                        }
                        const isTableActive = enabledKeysSet ? enabledKeysSet.has(obj.key) : true
                        const checkboxesDisabled =
                          role.is_owner || !canManageRoles || isSaving

                        return (
                          <tr key={obj.key}>
                            <td className="py-2 px-3 font-medium text-main">
                              {obj.label}
                              <span className="ml-1.5 text-[10px] text-sub uppercase">
                                {obj.kind}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`badge ${
                                  isTableActive ? 'badge-success' : 'badge-neutral'
                                }`}
                              >
                                {isTableActive ? 'Active' : 'Off'}
                              </span>
                            </td>
                            {CRUD_COLUMNS.map((col) => (
                              <td key={col.key} className="py-2 px-3 text-center">
                                <Checkbox
                                  aria-label={`${role.name} ${obj.label} ${col.label}`}
                                  checked={Boolean(rowRights[col.key])}
                                  disabled={checkboxesDisabled}
                                  onChange={() =>
                                    handleToggleRight(role, obj.key, col.key)
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
