import {
  VISIBILITY_OPTIONS,
  formatSharingLabel,
  getSharingBadgeClass,
} from '../../utils/crmFormOptions.js'
import { Select } from '../Select.jsx'

export function SharingBadge({ record }) {
  return (
    <span className={getSharingBadgeClass(record?.visibility)}>
      {formatSharingLabel(record)}
    </span>
  )
}

export function RecordSharingControl({
  idPrefix = 'record-sharing',
  visibility = 'workspace',
  sharedRoleId = '',
  roles = [],
  disabled = false,
  canManageSharing = true,
  onChange,
}) {
  const isDisabled = disabled || !canManageSharing
  const roleOptions = [
    { value: '', label: 'Select a role...' },
    ...(roles || []).map((r) => ({
      value: String(r.id),
      label: r.name,
    })),
  ]

  function handleVisibilityChange(nextVis) {
    if (nextVis === 'role') {
      const defaultRoleId =
        sharedRoleId ||
        String(
          roles.find((r) => r.is_default_staff)?.id ||
            roles[0]?.id ||
            '',
        )
      onChange?.({
        visibility: nextVis,
        shared_role_id: defaultRoleId,
      })
    } else {
      onChange?.({
        visibility: nextVis,
        shared_role_id: '',
      })
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t crm-border">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`${idPrefix}-visibility`}
          className="block text-xs font-medium text-main"
        >
          Sharing visibility
        </label>
        {!canManageSharing ? (
          <span className="text-[11px] text-sub">Managed by owner</span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Select
          id={`${idPrefix}-visibility`}
          ariaLabel="Sharing visibility"
          value={visibility || 'workspace'}
          onChange={handleVisibilityChange}
          options={VISIBILITY_OPTIONS}
          disabled={isDisabled}
        />
        {visibility === 'role' ? (
          <Select
            id={`${idPrefix}-role`}
            ariaLabel="Shared role"
            value={sharedRoleId ? String(sharedRoleId) : ''}
            onChange={(val) =>
              onChange?.({
                visibility: 'role',
                shared_role_id: val,
              })
            }
            options={roleOptions}
            disabled={isDisabled}
          />
        ) : null}
      </div>
    </div>
  )
}
