import { useEffect, useMemo, useState } from 'react'
import {
  cloneWorkspaceRole,
  deleteWorkspaceRole,
  updateWorkspaceRole,
} from '../service/crmService.js'
import { apiGet } from '../utils/api.js'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { Checkbox } from './Checkbox.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'
import { Modal } from './Modal.jsx'
import { RefreshButton } from './RefreshButton.jsx'
import { Select } from './Select.jsx'

const SWITCH_LABELS = [
  { key: 'import', label: 'Import', future: true },
  { key: 'export', label: 'Export', future: true },
  { key: 'automations', label: 'Automations', future: true },
  { key: 'scripts', label: 'Scripts', future: true },
  { key: 'users_and_roles', label: 'Users & roles', future: false },
  { key: 'theme_and_layouts', label: 'Theme & layouts', future: false },
  { key: 'unattended_agent', label: 'Unattended agent', future: true },
]

const CRUD_COLUMNS = [
  { key: 'create', label: 'Create' },
  { key: 'read', label: 'Read' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
]

const FIELD_RIGHT_OPTIONS = [
  { value: 'editable', label: 'Editable' },
  { value: 'read_only', label: 'Read-only' },
  { value: 'hidden', label: 'Hidden' },
]

function countCustomizedFields(fieldRights) {
  if (!fieldRights || typeof fieldRights !== 'object') return { hidden: 0, readOnly: 0 }
  let hidden = 0
  let readOnly = 0
  for (const objMap of Object.values(fieldRights)) {
    if (!objMap || typeof objMap !== 'object') continue
    for (const level of Object.values(objMap)) {
      if (level === 'hidden') hidden += 1
      else if (level === 'read_only') readOnly += 1
    }
  }
  return { hidden, readOnly }
}

export function SettingsRolesSection({
  workspace,
  workspaceSlug,
  permissions,
  permissionsRevision = 0,
  onWorkspaceUpdated,
  onAuditRecorded,
  onSessionExpired,
}) {
  const effectiveSlug = workspace?.slug || workspaceSlug
  const contactLabel = workspace?.contact_label || 'Contact'

  const [rolesData, setRolesData] = useState(null)
  const [loading, setLoading] = useState(Boolean(effectiveSlug))
  const [error, setError] = useState('')
  const [globalNotice, setGlobalNotice] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  // Draft maps per roleId: { switches?, object_rights?, field_rights? }
  const [draftByRoleId, setDraftByRoleId] = useState({})
  const [selectedFieldObjectByRoleId, setSelectedFieldObjectByRoleId] = useState({})
  const [savingRoleId, setSavingRoleId] = useState(null)
  const [roleFeedback, setRoleFeedback] = useState({})

  // Clone from Staff modal state
  const [cloneModalOpen, setCloneModalOpen] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneDescription, setCloneDescription] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState('')

  // Delete cloned role modal state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingRole, setDeletingRole] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!effectiveSlug) return undefined
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
  }, [effectiveSlug, refreshTick, permissionsRevision, onSessionExpired])

  const enabledObjectKeys = workspace?.enabled_object_keys
  const enabledKeysSet = useMemo(
    () => (Array.isArray(enabledObjectKeys) ? new Set(enabledObjectKeys) : null),
    [enabledObjectKeys],
  )

  const objectRows = useMemo(() => {
    const base = [
      { key: 'account', label: 'Account', kind: 'Core' },
      { key: 'contact', label: contactLabel, kind: 'Core' },
      { key: 'activity', label: 'Activity', kind: 'Core' },
      { key: 'lead', label: 'Lead', kind: 'Pack' },
      { key: 'deal', label: 'Deal', kind: 'Pack' },
      { key: 'job', label: 'Job', kind: 'Pack' },
      { key: 'appointment', label: 'Appointment', kind: 'Pack' },
      { key: 'ticket', label: 'Ticket', kind: 'Pack' },
      { key: 'visit', label: 'Visit', kind: 'Pack' },
    ]
    if (!enabledKeysSet) return base
    // Show active tables first while keeping all configurable objects accessible.
    return [...base].sort((a, b) => {
      const aActive = enabledKeysSet.has(a.key) ? 0 : 1
      const bActive = enabledKeysSet.has(b.key) ? 0 : 1
      return aActive - bActive
    })
  }, [contactLabel, enabledKeysSet])

  const fieldSchemas = useMemo(
    () => rolesData?.field_schemas || {},
    [rolesData?.field_schemas],
  )

  const fieldObjectOptions = useMemo(
    () =>
      objectRows
        .filter((obj) => Array.isArray(fieldSchemas[obj.key]) && fieldSchemas[obj.key].length > 0)
        .map((obj) => ({
          value: obj.key,
          label: enabledKeysSet && !enabledKeysSet.has(obj.key)
            ? `${obj.label} (Off)`
            : obj.label,
        })),
    [objectRows, fieldSchemas, enabledKeysSet],
  )

  function handleRefresh() {
    setError('')
    setGlobalNotice('')
    setDraftByRoleId({})
    setRoleFeedback({})
    setLoading(true)
    setRefreshTick((prev) => prev + 1)
  }

  function updateRoleDraft(role, updater) {
    setDraftByRoleId((prev) => {
      const current = prev[role.id] || {
        switches: { ...(role.switches || {}) },
        object_rights: JSON.parse(JSON.stringify(role.object_rights || {})),
        field_rights: JSON.parse(JSON.stringify(role.field_rights || {})),
      }
      return {
        ...prev,
        [role.id]: updater(current),
      }
    })
    setRoleFeedback((prev) => ({
      ...prev,
      [role.id]: null,
    }))
  }

  function handleToggleSwitch(role, switchKey) {
    updateRoleDraft(role, (draft) => ({
      ...draft,
      switches: {
        ...draft.switches,
        [switchKey]: !draft.switches[switchKey],
      },
    }))
  }

  function handleToggleObjectRight(role, objectKey, action) {
    updateRoleDraft(role, (draft) => {
      const currentEntry = draft.object_rights[objectKey] || {
        create: false,
        read: false,
        update: false,
        delete: false,
      }
      return {
        ...draft,
        object_rights: {
          ...draft.object_rights,
          [objectKey]: {
            ...currentEntry,
            [action]: !currentEntry[action],
          },
        },
      }
    })
  }

  function handleChangeFieldRight(role, objectKey, fieldKey, nextLevel) {
    updateRoleDraft(role, (draft) => {
      const currentObjMap = draft.field_rights[objectKey] || {}
      return {
        ...draft,
        field_rights: {
          ...draft.field_rights,
          [objectKey]: {
            ...currentObjMap,
            [fieldKey]: nextLevel,
          },
        },
      }
    })
  }

  function handleDiscardRoleDraft(roleId) {
    setDraftByRoleId((prev) => {
      const copy = { ...prev }
      delete copy[roleId]
      return copy
    })
    setRoleFeedback((prev) => ({
      ...prev,
      [roleId]: null,
    }))
  }

  async function refreshActiveWorkspaceState() {
    if (!onWorkspaceUpdated || !effectiveSlug) return
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

  async function handleSaveRole(role) {
    const draft = draftByRoleId[role.id]
    if (!draft || !effectiveSlug) return

    const payloadObjectRights = {}
    for (const { key } of objectRows) {
      if (draft.object_rights?.[key]) {
        payloadObjectRights[key] = {
          create: Boolean(draft.object_rights[key].create),
          read: Boolean(draft.object_rights[key].read),
          update: Boolean(draft.object_rights[key].update),
          delete: Boolean(draft.object_rights[key].delete),
        }
      }
    }

    const payloadFieldRights = {}
    for (const { key } of objectRows) {
      if (draft.field_rights?.[key] && fieldSchemas[key]?.length) {
        payloadFieldRights[key] = draft.field_rights[key]
      }
    }

    setSavingRoleId(role.id)
    setRoleFeedback((prev) => ({ ...prev, [role.id]: null }))

    try {
      const { response, data } = await updateWorkspaceRole(effectiveSlug, role.id, {
        switches: draft.switches,
        object_rights: payloadObjectRights,
        field_rights: payloadFieldRights,
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

      setDraftByRoleId((prev) => {
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
      await refreshActiveWorkspaceState()
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

  async function handleCloneSubmit(event) {
    event.preventDefault()
    if (!effectiveSlug) return
    const trimmed = cloneName.trim()
    if (!trimmed) {
      setCloneError('Enter a name for the cloned role.')
      return
    }

    setCloneError('')
    setGlobalNotice('')
    setCloning(true)
    try {
      const { response, data } = await cloneWorkspaceRole(effectiveSlug, {
        name: trimmed,
        description: cloneDescription.trim(),
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setCloneError(data?.error || data?.detail || 'Could not clone role.')
        return
      }
      setCloneModalOpen(false)
      setCloneName('')
      setCloneDescription('')
      setGlobalNotice(data?.message || `Cloned role "${trimmed}" from Staff.`)
      onAuditRecorded?.()
      setRefreshTick((prev) => prev + 1)
    } catch {
      setCloneError('Network error while cloning role.')
    } finally {
      setCloning(false)
    }
  }

  async function handleConfirmDeleteRole() {
    if (!effectiveSlug || !deleteTarget) return
    setDeleteError('')
    setGlobalNotice('')
    setDeletingRole(true)
    try {
      const { response, data } = await deleteWorkspaceRole(
        effectiveSlug,
        deleteTarget.id,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setDeleteError(data?.error || data?.detail || 'Could not delete role.')
        return
      }
      const deletedName = deleteTarget.name
      setDeleteTarget(null)
      setGlobalNotice(data?.message || `Deleted role "${deletedName}".`)
      onAuditRecorded?.()
      setRefreshTick((prev) => prev + 1)
    } catch {
      setDeleteError('Network error while deleting role.')
    } finally {
      setDeletingRole(false)
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
            Clone Staff to create custom roles with tailored capability switches, object rights, and field-level permissions. Owner always retains full visibility and access. Your current role is{' '}
            <span className="font-medium text-main">{currentRoleName}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeSeats !== null ? (
            <span className="badge badge-neutral num-tabular">
              Active paid seats: {activeSeats}
            </span>
          ) : null}
          {canManageRoles ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setCloneName('')
                setCloneDescription('')
                setCloneError('')
                setCloneModalOpen(true)
              }}
              className="px-3 py-1.5 text-xs font-medium"
            >
              Clone from Staff
            </Button>
          ) : null}
          <RefreshButton
            loading={loading}
            label="Refresh workspace roles"
            onClick={handleRefresh}
          />
        </div>
      </Card>

      <FeedbackNotice tone="danger" message={error} />
      <FeedbackNotice tone="success" message={globalNotice} />

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

      <div className="space-y-4">
        {roles.map((role) => {
          const draft = draftByRoleId[role.id]
          const isDirty = Boolean(draft)
          const isSaving = savingRoleId === role.id
          const feedback = roleFeedback[role.id]
          const effectiveSwitches = draft?.switches || role.switches || {}
          const effectiveObjectRights = draft?.object_rights || role.object_rights || {}
          const effectiveFieldRights = draft?.field_rights || role.field_rights || {}
          const isOwnNonOwnerRole =
            !permissions?.is_owner &&
            permissions?.role_id &&
            permissions.role_id === role.id
          const activeFieldObject =
            selectedFieldObjectByRoleId[role.id] ||
            fieldObjectOptions[0]?.value ||
            'deal'
          const activeFieldList = fieldSchemas[activeFieldObject] || []
          const fieldCounts = countCustomizedFields(effectiveFieldRights)

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
                    {!role.is_owner && !role.is_default_staff ? (
                      <span className="badge badge-info">Custom role</span>
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
                  {role.is_removable && canManageRoles ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isSaving}
                      onClick={() => {
                        setDeleteError('')
                        setDeleteTarget(role)
                      }}
                      className="px-2.5 py-1 text-xs text-rose-600"
                    >
                      Delete role
                    </Button>
                  ) : null}
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

              {/* Capability Switches */}
              <div className="space-y-2 pt-2 border-t crm-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-sub">
                      Role capability switches
                    </p>
                    <p className="text-xs text-sub mt-0.5">
                      Switches for upcoming sprint features are stored now and enforced when those modules arrive.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                  {SWITCH_LABELS.map(({ key, label }) => {
                    const enabled = Boolean(effectiveSwitches[key])
                    const lockSelfUsersSwitch =
                      key === 'users_and_roles' && isOwnNonOwnerRole && enabled
                    const disabled =
                      role.is_owner || !canManageRoles || isSaving || lockSelfUsersSwitch

                    return (
                      <label
                        key={key}
                        className="crm-subtle px-3 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-main truncate">{label}</div>
                          {lockSelfUsersSwitch ? (
                            <div className="text-[10px] text-sub">Active on your role</div>
                          ) : null}
                        </div>
                        <Checkbox
                          aria-label={`${role.name} switch ${label}`}
                          checked={enabled}
                          disabled={disabled}
                          onChange={() => handleToggleSwitch(role, key)}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Save / Discard toolbar for non-Owner roles */}
              {!role.is_owner && canManageRoles ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t crm-border">
                  <p className="text-xs text-sub">
                    {isDirty
                      ? 'Unsaved changes to switches, object rights, or field permissions.'
                      : 'Changes apply immediately on save and refresh active member sessions.'}
                  </p>
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
                      onClick={() => handleSaveRole(role)}
                      className="px-3 py-1.5 text-xs font-medium"
                    >
                      {isSaving ? 'Saving...' : 'Save role changes'}
                    </Button>
                  </div>
                </div>
              ) : null}

              {feedback ? (
                <FeedbackNotice tone={feedback.tone} message={feedback.message} />
              ) : null}

              {/* Object Rights CRUD Matrix */}
              <div className="space-y-2.5 pt-2 border-t crm-border">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-sub">
                    Object rights (CRUD)
                  </p>
                  <p className="text-xs text-sub mt-0.5">
                    {role.is_owner
                      ? 'Owner always holds create, read, update, and delete access on every object.'
                      : 'Control create, read, update, and delete permissions for core and active pack objects (including Job, Appointment, and Visit).'}
                  </p>
                </div>

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
                        const rowRights = effectiveObjectRights[obj.key] || {
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
                                    handleToggleObjectRight(role, obj.key, col.key)
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

              {/* Field Rights Matrix */}
              {fieldObjectOptions.length > 0 ? (
                <div className="space-y-3 pt-2 border-t crm-border">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] uppercase tracking-wider text-sub">
                          Field rights
                        </p>
                        {fieldCounts.hidden > 0 ? (
                          <span className="badge badge-danger num-tabular">
                            {fieldCounts.hidden} hidden
                          </span>
                        ) : null}
                        {fieldCounts.readOnly > 0 ? (
                          <span className="badge badge-warn num-tabular">
                            {fieldCounts.readOnly} read-only
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-sub mt-0.5">
                        {role.is_owner
                          ? 'Owner always sees and edits every field.'
                          : 'Set each field to Editable, Read-only (shown but cannot be saved), or Hidden (omitted for this role).'}
                      </p>
                    </div>
                    <div className="w-48">
                      <Select
                        id={`role-${role.id}-field-object`}
                        ariaLabel={`Select object fields for ${role.name}`}
                        value={activeFieldObject}
                        onChange={(val) =>
                          setSelectedFieldObjectByRoleId((prev) => ({
                            ...prev,
                            [role.id]: val,
                          }))
                        }
                        options={fieldObjectOptions}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {activeFieldList.map((field) => {
                      const currentLevel =
                        role.is_owner
                          ? 'editable'
                          : effectiveFieldRights?.[activeFieldObject]?.[field.key] || 'editable'
                      const levelBadgeClass =
                        currentLevel === 'hidden'
                          ? 'badge-danger'
                          : currentLevel === 'read_only'
                            ? 'badge-warn'
                            : 'badge-neutral'

                      return (
                        <div
                          key={field.key}
                          className="crm-subtle px-3 py-2 rounded-lg flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-main truncate">
                              {field.label}
                            </div>
                            <span className={`badge ${levelBadgeClass} mt-1`}>
                              {currentLevel === 'read_only'
                                ? 'Read-only'
                                : currentLevel === 'hidden'
                                  ? 'Hidden'
                                  : 'Editable'}
                            </span>
                          </div>
                          <div className="w-36 shrink-0">
                            <Select
                              id={`role-${role.id}-${activeFieldObject}-${field.key}`}
                              ariaLabel={`${role.name} ${activeFieldObject} ${field.label} permission`}
                              value={currentLevel}
                              onChange={(val) =>
                                handleChangeFieldRight(
                                  role,
                                  activeFieldObject,
                                  field.key,
                                  val,
                                )
                              }
                              options={FIELD_RIGHT_OPTIONS}
                              disabled={role.is_owner || !canManageRoles || isSaving}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>

      {/* Clone from Staff Modal */}
      <Modal
        open={cloneModalOpen}
        title="Clone role from Staff"
        subtitle="Copies Staff's object rights, field rights, and capability switches into a new custom role."
        onClose={() => {
          if (!cloning) setCloneModalOpen(false)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={cloning}
              onClick={() => setCloneModalOpen(false)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="clone-role-form"
              variant="primary"
              disabled={cloning}
              className="px-3 py-1.5 text-xs font-medium"
            >
              {cloning ? 'Cloning...' : 'Create cloned role'}
            </Button>
          </>
        }
      >
        <form id="clone-role-form" onSubmit={handleCloneSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={cloneError} />
          <div className="space-y-1.5">
            <label htmlFor="clone-role-name" className="block font-medium text-main">
              Role name
            </label>
            <input
              id="clone-role-name"
              type="text"
              required
              maxLength={100}
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="e.g. Junior Sales, Field Technician, Reception"
              className="crm-input w-full px-3 py-2 text-sm"
              disabled={cloning}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="clone-role-description" className="block font-medium text-main">
              Description (optional)
            </label>
            <textarea
              id="clone-role-description"
              rows={2}
              maxLength={255}
              value={cloneDescription}
              onChange={(e) => setCloneDescription(e.target.value)}
              placeholder="Summarize who uses this role and what access it grants"
              className="crm-input w-full px-3 py-2 text-sm"
              disabled={cloning}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Role Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        title={`Delete role "${deleteTarget?.name || ''}"?`}
        subtitle="Remove this custom role from the workspace"
        onClose={() => {
          if (!deletingRole) setDeleteTarget(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={deletingRole}
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={deletingRole}
              onClick={handleConfirmDeleteRole}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {deletingRole ? 'Deleting...' : 'Delete role'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={deleteError} />
          {deleteTarget?.shared_record_count > 0 ? (
            <FeedbackNotice
              tone="warn"
              message={`${deleteTarget.shared_record_count} CRM ${
                deleteTarget.shared_record_count === 1 ? 'record is' : 'records are'
              } currently shared with "${deleteTarget.name}". Deleting this role will switch ${
                deleteTarget.shared_record_count === 1 ? 'that record' : 'those records'
              } to Owner only visibility.`}
            />
          ) : null}
          <p className="text-sub leading-relaxed">
            Deleting <span className="font-semibold text-main">{deleteTarget?.name}</span> is permanent and recorded in the workspace audit log. Roles with assigned members or pending invites must be cleared first.
          </p>
        </div>
      </Modal>
    </div>
  )
}
