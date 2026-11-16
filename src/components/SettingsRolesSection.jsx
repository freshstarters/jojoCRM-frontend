import { useEffect, useState } from 'react'
import { apiGet } from '../utils/api.js'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'

const SWITCH_LABELS = [
  { key: 'import', label: 'Import' },
  { key: 'export', label: 'Export' },
  { key: 'automations', label: 'Automations' },
  { key: 'scripts', label: 'Scripts' },
  { key: 'users_and_roles', label: 'Users & roles' },
  { key: 'theme_and_layouts', label: 'Theme & layouts' },
  { key: 'unattended_agent', label: 'Unattended agent' },
]

export function SettingsRolesSection({
  workspaceSlug,
  permissions,
  onSessionExpired,
}) {
  const [rolesData, setRolesData] = useState(null)
  const [loading, setLoading] = useState(Boolean(workspaceSlug))
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!workspaceSlug) return
    let cancelled = false

    apiGet(`/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/roles/`)
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
  }, [workspaceSlug, refreshTick, onSessionExpired])

  function handleRefresh() {
    setError('')
    setLoading(true)
    setRefreshTick((prev) => prev + 1)
  }

  const roles = rolesData?.roles || []
  const currentRoleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const activeSeats = rolesData?.active_seat_count ?? null

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-main">Workspace roles</h3>
          <p className="text-xs text-sub mt-0.5">
            Every workspace starts with a permanent Owner role and a default Staff role ready to clone in S2.4. Your current role is{' '}
            <span className="font-medium text-main">{currentRoleName}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSeats !== null ? (
            <span className="badge badge-neutral num-tabular">
              Active paid seats: {activeSeats}
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
        {roles.map((role) => (
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
          </Card>
        ))}
      </div>
    </div>
  )
}
