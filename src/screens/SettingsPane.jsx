import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { SettingsPacksSection } from '../components/SettingsPacksSection.jsx'
import { SettingsPeopleSection } from '../components/SettingsPeopleSection.jsx'
import { SettingsRolesSection } from '../components/SettingsRolesSection.jsx'
import { SettingsWorkspaceSection } from '../components/SettingsWorkspaceSection.jsx'
import { Subtabs } from '../components/Subtabs.jsx'
import { apiDelete, apiGet, apiPatch, apiPost } from '../utils/api.js'
import { SETTINGS_TABS } from '../utils/catalog.js'
import { getTimezoneOptions } from '../utils/timezones.js'
import {
  createPasskeyCredential,
  formatWebAuthnError,
  isWebAuthnSupported,
} from '../utils/webauthn.js'

const VALID_SETTINGS_TAB_IDS = new Set(SETTINGS_TABS.map((tab) => tab.id))

function formatTimestamp(isoString, timeZone) {
  if (!isoString) return 'Never used'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Recently'
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

export function SettingsPane({
  workspace,
  user,
  permissions,
  activeTab: controlledTab,
  onTabChange,
  onWorkspaceUpdated,
  onUserUpdated,
  onAuditRecorded,
  onSessionExpired,
}) {
  const [internalTab, setInternalTab] = useState('workspace')
  const activeTab = VALID_SETTINGS_TAB_IDS.has(controlledTab)
    ? controlledTab
    : VALID_SETTINGS_TAB_IDS.has(internalTab)
      ? internalTab
      : 'workspace'

  function handleTabChange(nextTab) {
    setInternalTab(nextTab)
    onTabChange?.(nextTab)
  }
  const [methods, setMethods] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [draftTimezone, setDraftTimezone] = useState(null)
  const selectedTimezone = draftTimezone ?? (user?.timezone || 'Africa/Accra')
  const [savingTimezone, setSavingTimezone] = useState(false)
  const [timezoneError, setTimezoneError] = useState('')
  const [timezoneStatus, setTimezoneStatus] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')

  const [unlinkTarget, setUnlinkTarget] = useState(null)
  const [unlinkingProvider, setUnlinkingProvider] = useState(false)

  const [passkeyLabel, setPasskeyLabel] = useState('')
  const [registering, setRegistering] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionStatus, setActionStatus] = useState('')

  const timezoneOptions = useMemo(
    () => getTimezoneOptions(selectedTimezone),
    [selectedTimezone],
  )

  const fetchMethods = useCallback(async () => {
    try {
      const { response, data } = await apiGet('/api/v1/auth/methods/')
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setLoadError(data.error || 'Could not load sign-in methods.')
        return
      }
      setLoadError('')
      setMethods(data)
    } catch {
      setLoadError('Could not load sign-in methods.')
    } finally {
      setLoading(false)
    }
  }, [onSessionExpired])

  useEffect(() => {
    let cancelled = false
    apiGet('/api/v1/auth/methods/')
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setLoadError(data.error || 'Could not load sign-in methods.')
          return
        }
        setLoadError('')
        setMethods(data)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load sign-in methods.')
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
  }, [onSessionExpired])

  async function handleSaveTimezone(event) {
    event.preventDefault()
    setTimezoneError('')
    setTimezoneStatus('')
    setSavingTimezone(true)
    try {
      const { response, data } = await apiPatch('/api/v1/account/profile/', {
        timezone: selectedTimezone,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setTimezoneError(data?.error || 'Could not update timezone.')
        return
      }
      if (data?.user) {
        onUserUpdated?.(data.user)
        setDraftTimezone(null)
      }
      if (data?.changed) {
        onAuditRecorded?.()
      }
      setTimezoneStatus(data?.message || `Timezone updated to ${selectedTimezone}.`)
    } catch {
      setTimezoneError('Unable to reach the server. Please try again.')
    } finally {
      setSavingTimezone(false)
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordStatus('')

    if (!currentPassword) {
      setPasswordError('Enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setChangingPassword(true)
    try {
      const { response, data } = await apiPost('/api/v1/account/password/change/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setPasswordError(data?.error || 'Could not update password.')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordStatus(data?.message || 'Your password has been updated.')
      onAuditRecorded?.()
    } catch {
      setPasswordError('Unable to reach the server. Please try again.')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleConfirmUnlink() {
    if (!unlinkTarget) return
    setActionError('')
    setActionStatus('')
    setUnlinkingProvider(true)
    try {
      const { response, data } = await apiDelete(
        `/api/v1/auth/providers/${encodeURIComponent(unlinkTarget)}/`,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || 'Could not unlink sign-in identity.')
        setUnlinkTarget(null)
        return
      }
      const providerLabel = unlinkTarget === 'google' ? 'Google' : 'Microsoft'
      setUnlinkTarget(null)
      setActionStatus(
        data?.message ||
          `${providerLabel} sign-in unlinked. Email and password login remains active.`,
      )
      onAuditRecorded?.()
      await fetchMethods()
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setUnlinkingProvider(false)
    }
  }

  async function handleRegisterPasskey(event) {
    event.preventDefault()
    setActionError('')
    setActionStatus('')

    if (!isWebAuthnSupported()) {
      setActionError('Passkeys are not supported in this browser.')
      return
    }

    setRegistering(true)
    try {
      const { response: optRes, data: optData } = await apiPost(
        '/api/v1/auth/passkey/register/options/',
        { name: passkeyLabel.trim() }
      )
      if (!optRes.ok || !optData.options) {
        if (optRes.status === 401) {
          onSessionExpired?.(optData?.error || optData?.detail)
          return
        }
        setActionError(optData.error || 'Could not start passkey registration.')
        return
      }

      const credential = await createPasskeyCredential(optData.options)
      const { response: verifyRes, data: verifyData } = await apiPost(
        '/api/v1/auth/passkey/register/verify/',
        {
          credential,
          name: passkeyLabel.trim(),
        }
      )
      if (!verifyRes.ok) {
        if (verifyRes.status === 401) {
          onSessionExpired?.(verifyData?.error || verifyData?.detail)
          return
        }
        setActionError(verifyData.error || 'Could not verify new passkey.')
        return
      }

      setPasskeyLabel('')
      setActionStatus(
        `Passkey "${verifyData.passkey?.name || 'Passkey'}" registered. Email and password sign-in remains active.`
      )
      onAuditRecorded?.()
      await fetchMethods()
    } catch (err) {
      setActionError(formatWebAuthnError(err))
    } finally {
      setRegistering(false)
    }
  }

  async function handleDeletePasskey(passkeyId) {
    setActionError('')
    setActionStatus('')
    setDeletingId(passkeyId)
    try {
      const { response, data } = await apiDelete(
        `/api/v1/auth/passkey/${passkeyId}/`
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data.error || 'Could not remove passkey.')
        return
      }
      setActionStatus('Passkey removed from your account.')
      onAuditRecorded?.()
      await fetchMethods()
    } catch {
      setActionError('Unable to reach the server. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const email = methods?.email || user?.email || ''
  const userTimezone = user?.timezone || 'Africa/Accra'
  const googleInfo = methods?.providers?.google
  const microsoftInfo = methods?.providers?.microsoft
  const mailbox = methods?.mailbox_connection || {
    connected: false,
    provider: null,
  }
  const passkeys = methods?.passkeys || []

  return (
    <section id="pane-settings" className="space-y-5 w-full max-w-4xl mx-auto my-6">
      <div className="pb-4 border-b crm-border">
        <h1 className="text-xl font-semibold text-main tracking-tight">
          Settings
        </h1>
        <p className="text-xs text-sub mt-0.5">
          Manage your workspace profile, starter packs, members, roles, and account security.
        </p>
      </div>

      <Subtabs
        tabs={SETTINGS_TABS}
        activeId={activeTab}
        onChange={handleTabChange}
        ariaLabel="Settings sections"
      />

      {activeTab === 'workspace' && (
        <SettingsWorkspaceSection
          workspace={workspace}
          permissions={permissions}
          onWorkspaceUpdated={onWorkspaceUpdated}
          onAuditRecorded={onAuditRecorded}
          onSessionExpired={onSessionExpired}
        />
      )}

      {activeTab === 'packs' && (
        <SettingsPacksSection
          workspace={workspace}
          permissions={permissions}
          onWorkspaceUpdated={onWorkspaceUpdated}
          onAuditRecorded={onAuditRecorded}
          onSessionExpired={onSessionExpired}
        />
      )}

      {activeTab === 'security' && (
        <>
          {loading && (
            <Card className="p-6">
              <p className="text-xs text-sub">Loading sign-in settings...</p>
            </Card>
          )}

          {!loading && loadError && (
            <Card className="p-6">
              <p className="text-xs text-sub">{loadError}</p>
            </Card>
          )}

          {!loading && !loadError && (
            <div className="space-y-5">
              <Card className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-main">
                      Profile & timezone
                    </h2>
                    <p className="text-xs text-sub mt-0.5">
                      Signed in as <span className="font-medium text-main">{email}</span>.
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      permissions?.is_owner ? 'badge-info' : 'badge-neutral'
                    }`}
                  >
                    {permissions?.role_name ||
                      (permissions?.is_owner ? 'Owner' : 'Staff')}
                  </span>
                </div>

                <FeedbackNotice message={timezoneError} tone="danger" />
                <FeedbackNotice message={timezoneStatus} tone="success" />

                <form
                  onSubmit={handleSaveTimezone}
                  className="flex flex-col sm:flex-row gap-3 sm:items-end text-xs"
                >
                  <div className="flex-1 space-y-1.5">
                    <label
                      htmlFor="account-timezone-select"
                      className="block text-xs font-medium text-main"
                    >
                      IANA timezone
                    </label>
                    <Select
                      id="account-timezone-select"
                      ariaLabel="Account timezone"
                      value={selectedTimezone}
                      onChange={setDraftTimezone}
                      options={timezoneOptions}
                      disabled={savingTimezone}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingTimezone}
                    className="px-4 py-2 text-xs font-medium shrink-0"
                  >
                    {savingTimezone ? 'Saving...' : 'Save timezone'}
                  </Button>
                </form>
              </Card>

              <Card className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-main">
                      Password
                    </h2>
                    <p className="text-xs text-sub mt-0.5">
                      Update your password after verifying your current password. Your active session stays signed in.
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      methods?.has_password ? 'badge-success' : 'badge-neutral'
                    }`}
                  >
                    {methods?.has_password ? 'Configured' : 'Not set'}
                  </span>
                </div>

                {methods?.has_password ? (
                  <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                    <FeedbackNotice message={passwordError} tone="danger" />
                    <FeedbackNotice message={passwordStatus} tone="success" />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="current-password-input"
                          className="block font-medium text-main"
                        >
                          Current password
                        </label>
                        <input
                          id="current-password-input"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="crm-input w-full px-3 py-2 text-sm"
                          disabled={changingPassword}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="new-password-input"
                          className="block font-medium text-main"
                        >
                          New password
                        </label>
                        <input
                          id="new-password-input"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="crm-input w-full px-3 py-2 text-sm"
                          disabled={changingPassword}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="confirm-new-password-input"
                          className="block font-medium text-main"
                        >
                          Confirm new password
                        </label>
                        <input
                          id="confirm-new-password-input"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="crm-input w-full px-3 py-2 text-sm"
                          disabled={changingPassword}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={changingPassword}
                        className="px-4 py-2 text-xs font-medium"
                      >
                        {changingPassword ? 'Updating...' : 'Update password'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-sub">
                    Password login is not configured on this account yet. Use Forgot Password from the sign-in screen if you want to add one.
                  </p>
                )}
              </Card>

              <FeedbackNotice message={actionError} tone="danger" />
              <FeedbackNotice message={actionStatus} tone="success" />

              <Card className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-main">
                      Sign-in methods
                    </h2>
                    <p className="text-xs text-sub mt-0.5">
                      All sign-in methods open the same verified account ({email}).
                    </p>
                  </div>
                  <span className="badge badge-success">Verified email</span>
                </div>

                <div className="divide-y crm-border text-xs">
                  <div className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-main">Email and password</div>
                      <div className="text-sub">
                        Always available alongside Google, Microsoft, and passkeys.
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        methods?.has_password ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {methods?.has_password ? 'Active' : 'Not set'}
                    </span>
                  </div>

                  <div className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-main">Google</div>
                      <div className="text-sub">
                        {googleInfo?.linked
                          ? `Last used: ${formatTimestamp(googleInfo.last_used_at, userTimezone)}`
                          : 'Sign in using your matching Google account email.'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${
                          googleInfo?.linked
                            ? 'badge-success'
                            : googleInfo?.configured
                              ? 'badge-neutral'
                              : 'badge-warn'
                        }`}
                      >
                        {googleInfo?.linked
                          ? 'Linked'
                          : googleInfo?.configured
                            ? 'Available'
                            : 'Not configured'}
                      </span>
                      {googleInfo?.linked ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setUnlinkTarget('google')}
                          className="px-2.5 py-1 text-xs"
                        >
                          Unlink
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-main">Microsoft</div>
                      <div className="text-sub">
                        {microsoftInfo?.linked
                          ? `Last used: ${formatTimestamp(microsoftInfo.last_used_at, userTimezone)}`
                          : 'Sign in using your matching Microsoft account email.'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${
                          microsoftInfo?.linked
                            ? 'badge-success'
                            : microsoftInfo?.configured
                              ? 'badge-neutral'
                              : 'badge-warn'
                        }`}
                      >
                        {microsoftInfo?.linked
                          ? 'Linked'
                          : microsoftInfo?.configured
                            ? 'Available'
                            : 'Not configured'}
                      </span>
                      {microsoftInfo?.linked ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setUnlinkTarget('microsoft')}
                          className="px-2.5 py-1 text-xs"
                        >
                          Unlink
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>

          <Card className="p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-main">
                  Mailbox connection
                </h2>
                <p className="text-xs text-sub mt-0.5">
                  Signing in with Google or Microsoft only verifies your identity and leaves your mailbox disconnected.
                </p>
              </div>
              <span
                className={`badge ${
                  mailbox.connected ? 'badge-success' : 'badge-neutral'
                }`}
              >
                {mailbox.connected
                  ? `Connected (${mailbox.provider})`
                  : 'Not connected'}
              </span>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
              <div>
                <h2 className="text-base font-semibold text-main">Passkeys</h2>
                <p className="text-xs text-sub mt-0.5">
                  Optional passwordless sign-in. Registering a passkey does not disable email and password or require a second factor.
                </p>
              </div>
              <span className="badge badge-info num-tabular">
                {passkeys.length} registered
              </span>
            </div>

            <form
              onSubmit={handleRegisterPasskey}
              className="flex flex-col sm:flex-row gap-2 text-xs"
            >
              <input
                type="text"
                maxLength={100}
                value={passkeyLabel}
                onChange={(event) => setPasskeyLabel(event.target.value)}
                placeholder="Passkey label (optional, e.g. Work laptop)"
                aria-label="Passkey label"
                className="crm-input flex-1 px-3 py-2"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={registering}
                className="px-4 py-2 text-xs font-medium shrink-0"
              >
                {registering ? 'Waiting for passkey...' : 'Register passkey'}
              </Button>
            </form>

            {passkeys.length === 0 ? (
              <p className="text-xs text-sub">No passkeys registered yet.</p>
            ) : (
              <div className="divide-y crm-border text-xs">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-medium text-main">{pk.name}</div>
                      <div className="text-sub">
                        Added {formatTimestamp(pk.created_at, userTimezone)} · Last used:{' '}
                        {formatTimestamp(pk.last_used_at, userTimezone)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={deletingId === pk.id}
                      onClick={() => handleDeletePasskey(pk.id)}
                      className="px-2.5 py-1 text-xs"
                    >
                      {deletingId === pk.id ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
            </div>
          )}
        </>
      )}

      {activeTab === 'people' && (
        <SettingsPeopleSection
          workspace={workspace}
          user={user}
          permissions={permissions}
          onAuditRecorded={onAuditRecorded}
          onSessionExpired={onSessionExpired}
        />
      )}

      {activeTab === 'roles' && (
        <SettingsRolesSection
          workspaceSlug={workspace?.slug}
          permissions={permissions}
          onSessionExpired={onSessionExpired}
        />
      )}

      <Modal
        open={Boolean(unlinkTarget)}
        title={`Unlink ${unlinkTarget === 'google' ? 'Google' : 'Microsoft'} sign-in`}
        subtitle="Remove this external identity from your account"
        onClose={() => {
          if (!unlinkingProvider) setUnlinkTarget(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={unlinkingProvider}
              onClick={() => setUnlinkTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="px-3 py-1.5 text-xs font-semibold"
              disabled={unlinkingProvider}
              onClick={handleConfirmUnlink}
            >
              {unlinkingProvider
                ? 'Unlinking...'
                : `Unlink ${unlinkTarget === 'google' ? 'Google' : 'Microsoft'}`}
            </Button>
          </>
        }
      >
        <p className="text-xs text-sub leading-relaxed">
          Unlinking {unlinkTarget === 'google' ? 'Google' : 'Microsoft'} only disconnects that sign-in identity. Email and password sign-in and your active session remain unaffected.
        </p>
      </Modal>
    </section>
  )
}
