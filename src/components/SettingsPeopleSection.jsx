import { useCallback, useEffect, useMemo, useState } from 'react'
import { updateWorkspaceMemberRole } from '../service/crmService.js'
import { apiGet, apiPost } from '../utils/api.js'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'
import { Modal } from './Modal.jsx'
import { RefreshButton } from './RefreshButton.jsx'
import { Select } from './Select.jsx'

const INVITE_STATUS_CLASSES = {
  pending: 'badge badge-info',
  accepted: 'badge badge-success',
  expired: 'badge badge-warn',
  revoked: 'badge badge-danger',
}

function formatDateTime(isoString, timeZone) {
  if (!isoString) return 'Not available'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Not available'
  try {
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || 'Africa/Accra',
    })
  } catch {
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }
}

function formatInviteStatusLabel(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function SettingsPeopleSection({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  onAuditRecorded,
  onSessionExpired,
}) {
  const workspaceSlug = workspace?.slug
  const userTimezone = user?.timezone || 'Africa/Accra'
  const [peopleData, setPeopleData] = useState(null)
  const [loading, setLoading] = useState(Boolean(workspaceSlug))
  const [loadError, setLoadError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [resendingId, setResendingId] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [memberActionId, setMemberActionId] = useState(null)
  const [roleUpdatingMemberId, setRoleUpdatingMemberId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [revoking, setRevoking] = useState(false)

  const loadPeople = useCallback(async () => {
    if (!workspaceSlug) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const { response, data } = await apiGet(
        `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/people/`,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setLoadError(
          data?.error ||
            data?.detail ||
            'Could not load workspace people right now.',
        )
      } else {
        setPeopleData(data)
      }
    } catch {
      setLoadError('Network error while loading workspace people.')
    } finally {
      setLoading(false)
    }
  }, [workspaceSlug, onSessionExpired])

  useEffect(() => {
    if (!workspaceSlug) {
      return
    }
    let cancelled = false
    apiGet(`/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/people/`)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setLoadError(
            data?.error ||
              data?.detail ||
              'Could not load workspace people right now.',
          )
        } else {
          setPeopleData(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Network error while loading workspace people.')
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
  }, [workspaceSlug, permissionsRevision, onSessionExpired])

  const canManageInvites =
    peopleData?.can_manage_users_and_roles ??
    peopleData?.can_manage_invites ??
    Boolean(
      permissions?.can_manage_users_and_roles ??
        permissions?.can_manage_invites,
    )
  const members = peopleData?.members || []
  const invites = peopleData?.invites || []
  const assignableRoles = useMemo(
    () => peopleData?.assignable_roles || [],
    [peopleData?.assignable_roles],
  )
  const roleOptions = useMemo(
    () =>
      assignableRoles.map((role) => ({
        value: String(role.id),
        label: role.name,
      })),
    [assignableRoles],
  )
  const defaultStaffRoleId = useMemo(() => {
    const staff = assignableRoles.find((r) => r.is_default_staff) || assignableRoles[0]
    return staff ? String(staff.id) : ''
  }, [assignableRoles])

  const effectiveInviteRoleId = inviteRoleId || defaultStaffRoleId

  const activeSeatCount =
    peopleData?.active_seat_count ??
    members.filter((m) => m.counts_as_active_seat).length

  async function sendOrResendInvite(emailAddress, inviteId = null, roleIdOverride = null) {
    if (!workspaceSlug) return
    setActionError('')
    setActionNotice('')
    if (inviteId) {
      setResendingId(inviteId)
    } else {
      setSendingInvite(true)
    }

    const chosenRoleId = roleIdOverride ?? effectiveInviteRoleId
    try {
      const payload = {
        email: emailAddress,
        ...(chosenRoleId ? { role_id: Number(chosenRoleId) } : {}),
      }
      const { response, data } = await apiPost(
        `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/invites/`,
        payload,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(
          data?.error ||
            data?.detail ||
            'Could not send workspace invite. Please try again.',
        )
        return
      }
      if (!inviteId) {
        setInviteEmail('')
      }
      setActionNotice(data?.message || `Invitation sent to ${emailAddress}.`)
      onAuditRecorded?.()
      await loadPeople()
    } catch {
      setActionError('Network error while sending workspace invite.')
    } finally {
      setSendingInvite(false)
      setResendingId(null)
    }
  }

  async function handleSendSubmit(event) {
    event.preventDefault()
    const trimmed = inviteEmail.trim()
    if (!trimmed) {
      setActionError('Enter an email address to send an invite.')
      return
    }
    await sendOrResendInvite(trimmed)
  }

  async function handleReassignMemberRole(member, nextRoleId) {
    if (!workspaceSlug || !member || !nextRoleId) return
    if (String(member.role?.id || '') === String(nextRoleId)) return

    setActionError('')
    setActionNotice('')
    setRoleUpdatingMemberId(member.id)
    try {
      const { response, data } = await updateWorkspaceMemberRole(
        workspaceSlug,
        member.id,
        nextRoleId,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(
          data?.error || data?.detail || 'Could not update member role.',
        )
        return
      }
      setActionNotice(
        data?.message || `Updated role for ${member.email}.`,
      )
      onAuditRecorded?.()
      await loadPeople()
    } catch {
      setActionError('Network error while updating member role.')
    } finally {
      setRoleUpdatingMemberId(null)
    }
  }

  async function handleConfirmRevoke() {
    if (!workspaceSlug || !revokeTarget) return
    setActionError('')
    setActionNotice('')
    setRevoking(true)
    try {
      const { response, data } = await apiPost(
        `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/invites/${revokeTarget.id}/revoke/`,
        {},
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(
          data?.error ||
            data?.detail ||
            'Could not revoke invite. Please try again.',
        )
        return
      }
      const targetEmail = revokeTarget.email
      setRevokeTarget(null)
      setActionNotice(`Revoked invite for ${targetEmail}.`)
      onAuditRecorded?.()
      await loadPeople()
    } catch {
      setActionError('Network error while revoking invite.')
    } finally {
      setRevoking(false)
    }
  }

  async function handleConfirmDeactivate() {
    if (!workspaceSlug || !deactivateTarget) return
    setActionError('')
    setActionNotice('')
    setMemberActionId(deactivateTarget.id)
    try {
      const { response, data } = await apiPost(
        `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/members/${deactivateTarget.id}/deactivate/`,
        {},
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(
          data?.error ||
            data?.detail ||
            'Could not deactivate workspace member.',
        )
        return
      }
      const targetEmail = deactivateTarget.email
      setDeactivateTarget(null)
      setActionNotice(
        data?.message || `${targetEmail} has been deactivated and signed out.`,
      )
      onAuditRecorded?.()
      await loadPeople()
    } catch {
      setActionError('Network error while deactivating workspace member.')
    } finally {
      setMemberActionId(null)
    }
  }

  async function handleReactivateMember(member) {
    if (!workspaceSlug || !member) return
    setActionError('')
    setActionNotice('')
    setMemberActionId(member.id)
    try {
      const { response, data } = await apiPost(
        `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/members/${member.id}/reactivate/`,
        {},
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(
          data?.error ||
            data?.detail ||
            'Could not reactivate workspace member.',
        )
        return
      }
      setActionNotice(
        data?.message || `${member.email} has been reactivated.`,
      )
      onAuditRecorded?.()
      await loadPeople()
    } catch {
      setActionError('Network error while reactivating workspace member.')
    } finally {
      setMemberActionId(null)
    }
  }

  return (
    <div className="space-y-4">
      <FeedbackNotice message={loadError} tone="danger" />
      <FeedbackNotice message={actionError} tone="danger" />
      <FeedbackNotice message={actionNotice} tone="success" />

      {!loading && !canManageInvites ? (
        <Card variant="subtle" className="p-4 text-xs text-sub">
          Only the workspace owner or a role with users-and-roles permission can send invites or reassign member roles.
        </Card>
      ) : null}

      {canManageInvites ? (
        <Card className="p-5 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-main">
              Invite a team member
            </h2>
            <p className="text-xs text-sub">
              Choose any non-Owner role. Invited people join {workspace?.name || 'this workspace'} only and are not location-checked when accepting or signing in.
            </p>
          </div>

          <form
            onSubmit={handleSendSubmit}
            className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="invite-member-email"
                className="block text-xs font-medium text-main"
              >
                Work email address
              </label>
              <input
                id="invite-member-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@company.com"
                className="crm-input w-full px-3 py-2 text-sm rounded-lg"
                disabled={sendingInvite}
              />
            </div>
            {roleOptions.length > 0 ? (
              <div className="sm:w-48 space-y-1.5">
                <label
                  htmlFor="invite-member-role"
                  className="block text-xs font-medium text-main"
                >
                  Role
                </label>
                <Select
                  id="invite-member-role"
                  ariaLabel="Invite role"
                  value={effectiveInviteRoleId}
                  onChange={setInviteRoleId}
                  options={roleOptions}
                  disabled={sendingInvite}
                />
              </div>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              disabled={sendingInvite}
              className="px-4 py-2 text-xs font-semibold shrink-0"
            >
              {sendingInvite ? 'Sending invite...' : 'Send invite'}
            </Button>
          </form>
        </Card>
      ) : null}

      {canManageInvites ? (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b crm-border flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-main">
                Workspace invites
              </h2>
              <p className="text-xs text-sub">
                Invitations expire after 24 hours unless accepted or revoked.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-neutral num-tabular">
                {invites.length} total
              </span>
              <RefreshButton
                loading={loading}
                label="Refresh people and invites"
                onClick={loadPeople}
              />
            </div>
          </div>

          {loading && !peopleData ? (
            <p className="p-5 text-xs text-sub">Loading invites...</p>
          ) : invites.length === 0 ? (
            <p className="p-5 text-xs text-sub">
              No invites have been sent for this workspace yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b crm-border text-[11px] uppercase text-sub">
                    <th className="py-2.5 px-5 font-medium">Email</th>
                    <th className="py-2.5 px-4 font-medium">Role</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Invited by</th>
                    <th className="py-2.5 px-4 font-medium">Last sent</th>
                    <th className="py-2.5 px-4 font-medium">Expires</th>
                    <th className="py-2.5 px-5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y crm-border text-xs">
                  {invites.map((invite) => {
                    const statusClass =
                      INVITE_STATUS_CLASSES[invite.status] ||
                      'badge badge-neutral'
                    const canResend =
                      invite.status === 'pending' || invite.status === 'expired'
                    const canRevoke = invite.status === 'pending'

                    return (
                      <tr key={invite.id}>
                        <td className="py-3 px-5 font-medium text-main break-all">
                          {invite.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className="badge badge-neutral">
                            {invite.role?.name || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={statusClass}>
                            {formatInviteStatusLabel(invite.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sub break-all">
                          {invite.invited_by_email || 'Workspace owner'}
                        </td>
                        <td className="py-3 px-4 text-sub num-tabular whitespace-nowrap">
                          {formatDateTime(invite.last_sent_at, userTimezone)}
                        </td>
                        <td className="py-3 px-4 text-sub num-tabular whitespace-nowrap">
                          {formatDateTime(invite.expires_at, userTimezone)}
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {canResend ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                                disabled={resendingId === invite.id}
                                onClick={() =>
                                  sendOrResendInvite(
                                    invite.email,
                                    invite.id,
                                    invite.role?.id || null,
                                  )
                                }
                              >
                                {resendingId === invite.id
                                  ? 'Sending...'
                                  : 'Resend'}
                              </Button>
                            ) : null}
                            {canRevoke ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                                onClick={() => setRevokeTarget(invite)}
                              >
                                Revoke
                              </Button>
                            ) : null}
                            {!canResend && !canRevoke ? (
                              <span className="text-sub">None</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b crm-border flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-main">
              Workspace members
            </h2>
            <p className="text-xs text-sub">
              Reassigning a non-Owner member updates their API and active session permissions immediately. Deactivating ends their session immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-info num-tabular">
              Active paid {activeSeatCount === 1 ? 'seat' : 'seats'}: {activeSeatCount}
            </span>
            <span className="badge badge-neutral num-tabular">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>

        {loading && !peopleData ? (
          <p className="p-5 text-xs text-sub">Loading workspace members...</p>
        ) : members.length === 0 ? (
          <p className="p-5 text-xs text-sub">No workspace members found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b crm-border text-[11px] uppercase text-sub">
                  <th className="py-2.5 px-5 font-medium">Email</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium">Timezone</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  {canManageInvites ? (
                    <th className="py-2.5 px-5 font-medium text-right">
                      Access
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y crm-border text-xs">
                {members.map((member) => {
                  const isCurrentUser =
                    Boolean(user?.email) && member.email === user.email
                  const roleName =
                    member.role?.name || (member.is_owner ? 'Owner' : 'Staff')
                  const isBusy = memberActionId === member.id
                  const isUpdatingRole = roleUpdatingMemberId === member.id
                  const canReassignThisMember =
                    canManageInvites &&
                    !member.is_owner &&
                    roleOptions.length > 0 &&
                    !(isCurrentUser && !permissions?.is_owner)

                  return (
                    <tr key={member.id}>
                      <td className="py-3 px-5 font-medium text-main break-all">
                        <span>{member.email}</span>
                        {isCurrentUser ? (
                          <span className="ml-2 badge badge-neutral">You</span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        {member.is_owner ? (
                          <span className="badge badge-info">{roleName}</span>
                        ) : canReassignThisMember ? (
                          <div className="w-44">
                            <Select
                              id={`member-role-${member.id}`}
                              ariaLabel={`Role for ${member.email}`}
                              value={member.role?.id ? String(member.role.id) : defaultStaffRoleId}
                              onChange={(nextId) =>
                                handleReassignMemberRole(member, nextId)
                              }
                              options={roleOptions}
                              disabled={isUpdatingRole || isBusy}
                            />
                          </div>
                        ) : (
                          <span className="badge badge-neutral">{roleName}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sub">{member.timezone}</td>
                      <td className="py-3 px-4">
                        {!member.is_active ? (
                          <span className="badge badge-danger">
                            Deactivated
                          </span>
                        ) : member.email_verified ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-warn">
                            Pending verification
                          </span>
                        )}
                      </td>
                      {canManageInvites ? (
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          {member.is_owner ? (
                            <span className="text-sub">Permanent owner</span>
                          ) : isCurrentUser ? (
                            <span className="text-sub">Current session</span>
                          ) : member.is_active ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isBusy}
                              onClick={() => setDeactivateTarget(member)}
                              className="px-2.5 py-1 text-xs"
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isBusy}
                              onClick={() => handleReactivateMember(member)}
                              className="px-2.5 py-1 text-xs"
                            >
                              {isBusy ? 'Reactivating...' : 'Reactivate'}
                            </Button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(revokeTarget)}
        title="Revoke workspace invite"
        subtitle={
          revokeTarget
            ? `Cancel the invitation for ${revokeTarget.email}?`
            : ''
        }
        onClose={() => {
          if (!revoking) setRevokeTarget(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={revoking}
              onClick={() => setRevokeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="px-3 py-1.5 text-xs font-semibold"
              disabled={revoking}
              onClick={handleConfirmRevoke}
            >
              {revoking ? 'Revoking...' : 'Revoke invite'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-sub">
          The existing link sent to{' '}
          <span className="font-medium text-main">{revokeTarget?.email}</span>{' '}
          will stop working immediately. You can send a new invite later if needed.
        </p>
      </Modal>
      <Modal
        open={Boolean(deactivateTarget)}
        title="Deactivate workspace member"
        subtitle={
          deactivateTarget
            ? `End active sessions for ${deactivateTarget.email}?`
            : ''
        }
        onClose={() => {
          if (memberActionId === null) setDeactivateTarget(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={memberActionId !== null}
              onClick={() => setDeactivateTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="px-3 py-1.5 text-xs font-semibold"
              disabled={memberActionId !== null}
              onClick={handleConfirmDeactivate}
            >
              {memberActionId !== null ? 'Deactivating...' : 'Deactivate member'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-sub leading-relaxed">
          <span className="font-medium text-main">
            {deactivateTarget?.email}
          </span>{' '}
          will be signed out immediately, blocked from signing in, and excluded from active paid seats. You can reactivate them at any time.
        </p>
      </Modal>
    </div>
  )
}
