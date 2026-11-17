import { useEffect, useMemo, useState } from 'react'
import { AuthCardShell } from '../components/AuthCardShell.jsx'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Select } from '../components/Select.jsx'
import {
  apiPost,
  fetchAuthSession,
  fetchBusinessTypesCatalog,
} from '../utils/api.js'

function slugifyWorkspaceName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export function SignupScreen({
  initialSessionInfo,
  onSignedOut,
  onSignupSuccess,
  onNavigate,
}) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [businessType, setBusinessType] = useState('')
  const [catalogData, setCatalogData] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(() =>
    initialSessionInfo?.verificationRequired
      ? {
          email: initialSessionInfo.email || '',
          workspace: initialSessionInfo.workspace,
          hasSession: true,
          message:
            'Your workspace is awaiting email verification. Open the link in your email to unlock your workspace, or sign out to create a different workspace.',
        }
      : null,
  )
  const [activeSession, setActiveSession] = useState(() =>
    initialSessionInfo?.authenticated ? initialSessionInfo : null,
  )
  const [signingOut, setSigningOut] = useState(false)

  const effectiveSlug = slugEdited ? slug : slugifyWorkspaceName(workspaceName)

  const businessTypes = useMemo(
    () => catalogData?.business_types || [],
    [catalogData],
  )
  const businessTypeOptions = useMemo(
    () => businessTypes.map((bt) => ({ value: bt.key, label: bt.label })),
    [businessTypes],
  )
  const selectedBusinessType = useMemo(
    () => businessTypes.find((bt) => bt.key === businessType) || null,
    [businessTypes, businessType],
  )

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const { response, data } = await fetchBusinessTypesCatalog()
        if (cancelled) return
        if (!response.ok || !Array.isArray(data?.business_types)) {
          setCatalogError(data?.error || 'Could not load business types.')
          return
        }
        setCatalogData(data)
      } catch {
        if (!cancelled) {
          setCatalogError('Unable to load business types from the server.')
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false)
        }
      }
    }
    loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (initialSessionInfo !== undefined) {
      return undefined
    }
    let cancelled = false
    async function checkSession() {
      try {
        const { response, data } = await fetchAuthSession()
        if (cancelled || !response.ok) return
        if (data?.authenticated && data?.workspace?.slug) {
          setActiveSession(data)
        } else if (data?.verification_required) {
          setPendingVerification({
            email: data.email || '',
            workspace: data.workspace,
            hasSession: true,
            message:
              'Your workspace is awaiting email verification. Open the link in your email to unlock your workspace, or sign out to create a different workspace.',
          })
        }
      } catch {
        // Unauthenticated or unreachable session endpoint does not block signup view
      }
    }
    checkSession()
    return () => {
      cancelled = true
    }
  }, [initialSessionInfo])

  async function handleSignOutSession() {
    setSigningOut(true)
    setErrorMessage('')
    try {
      await apiPost('/api/v1/logout/', {})
      setActiveSession(null)
      setPendingVerification(null)
      onSignedOut?.()
      setStatusMessage('Signed out. You can now create a new workspace.')
    } catch {
      setErrorMessage('Could not sign out cleanly. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  function handleSlugChange(event) {
    const rawValue = event.target.value
    if (!rawValue) {
      setSlugEdited(false)
      setSlug('')
      return
    }
    const sanitized = rawValue
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .slice(0, 80)
    setSlugEdited(true)
    setSlug(sanitized)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    if (!businessType) {
      setErrorMessage('Select one of the 20 business types for your workspace.')
      return
    }
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        workspace_name: workspaceName,
        business_type: businessType,
        email,
        password,
      }
      const trimmedSlug = effectiveSlug.replace(/^-+|-+$/g, '')
      if (trimmedSlug) {
        payload.slug = trimmedSlug
      }

      const { response, data } = await apiPost('/api/v1/signup/', payload)

      if (!response.ok) {
        if (data?.verification_required) {
          setPendingVerification({
            email: data.email || email,
            workspace: data.workspace,
            hasSession: true,
            message:
              data.error ||
              'Verify your email address or sign out before creating a new workspace.',
          })
          return
        }
        setErrorMessage(
          data.error || 'Unable to create workspace. Please try again.'
        )
        return
      }

      if (data.verification_required) {
        setPendingVerification({
          email: data.user?.email || email,
          workspace: data.workspace,
          message:
            data.message ||
            'Verification message sent. Open the link in your email to unlock your workspace.',
        })
        return
      }

      if (data.workspace && data.workspace.slug) {
        onSignupSuccess(data)
      }
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResendVerification() {
    if (!pendingVerification?.email) return
    setErrorMessage('')
    setStatusMessage('')
    setResending(true)
    try {
      const { response, data } = await apiPost('/api/v1/resend-verification/', {
        email: pendingVerification.email,
      })
      if (!response.ok) {
        setErrorMessage(data.error || 'Could not resend verification message.')
        return
      }
      setStatusMessage(
        data.message || 'A new verification message has been sent.'
      )
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (pendingVerification) {
    return (
      <AuthCardShell
        title="Verify your email address"
        subtitle={
          <>
            Your workspace{' '}
            <span className="font-semibold text-main">
              {pendingVerification.workspace?.name}
            </span>{' '}
            is created and stays closed until you open the verification link sent to{' '}
            <span className="font-semibold text-main">
              {pendingVerification.email}
            </span>
            .
          </>
        }
      >
        <FeedbackNotice message={pendingVerification.message} tone="info" />
        <FeedbackNotice message={statusMessage} tone="success" />
        <FeedbackNotice message={errorMessage} tone="danger" />

        <div className="space-y-2.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={resending}
            onClick={handleResendVerification}
            className="w-full py-2 text-xs font-medium"
          >
            {resending ? 'Sending verification email...' : 'Resend verification email'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => onNavigate('/login')}
            className="w-full py-2 text-xs font-medium"
          >
            Go to sign in
          </Button>
          {pendingVerification.hasSession ? (
            <Button
              type="button"
              variant="secondary"
              disabled={signingOut}
              onClick={handleSignOutSession}
              className="w-full py-2 text-xs font-medium"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </Button>
          ) : null}
        </div>
      </AuthCardShell>
    )
  }

  if (activeSession) {
    return (
      <AuthCardShell
        title="Already signed in"
        subtitle="Each jojoCRM account belongs to one workspace only."
      >
        <FeedbackNotice message={errorMessage} tone="danger" />

        <Card variant="subtle" className="p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sub">Signed in as</span>
            <span className="font-medium text-main break-all">
              {activeSession.user?.email}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sub">Workspace</span>
            <span className="font-semibold text-main">
              {activeSession.workspace?.name}
            </span>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <Button
            type="button"
            variant="primary"
            className="flex-1 py-2 text-xs font-semibold"
            onClick={() => onSignupSuccess?.(activeSession)}
          >
            Return to workspace
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 py-2 text-xs"
            disabled={signingOut}
            onClick={handleSignOutSession}
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell
      title="Create your workspace"
      subtitle="Registration runs a connection-location check and continues only when the connection is clearly in Ghana."
    >
      <FeedbackNotice message={errorMessage} tone="danger" />

      <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
        <div>
          <label
            htmlFor="workspaceNameInput"
            className="block font-medium text-body mb-1"
          >
            Workspace name
          </label>
          <input
            id="workspaceNameInput"
            name="workspace_name"
            type="text"
            required
            autoComplete="organization"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="Accra North Supply"
            className="crm-input w-full px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="workspaceSlugInput"
            className="block font-medium text-body mb-1"
          >
            Workspace URL
          </label>
          <div className="relative flex items-center">
            <span className="text-sub font-medium select-none absolute left-3 pointer-events-none">
              /
            </span>
            <input
              id="workspaceSlugInput"
              name="slug"
              type="text"
              autoComplete="off"
              spellCheck="false"
              maxLength={80}
              value={effectiveSlug}
              onChange={handleSlugChange}
              placeholder="accra-north-supply"
              className="crm-input w-full pl-6 pr-3 py-2 num-tabular"
            />
          </div>
          <p className="mt-1 text-[11px] text-sub">
            Lowercase letters, numbers, and hyphens only. Leave as generated or customize.
          </p>
        </div>

        <div>
          <label
            htmlFor="businessTypeSelect"
            className="block font-medium text-body mb-1"
          >
            Business type
          </label>
          <Select
            id="businessTypeSelect"
            ariaLabel="Business type"
            value={businessType}
            onChange={setBusinessType}
            options={businessTypeOptions}
            placeholder={
              catalogLoading
                ? 'Loading 20 business types...'
                : 'Select one of the 20 business types'
            }
            disabled={catalogLoading || businessTypeOptions.length === 0 || submitting}
          />
          {catalogError ? (
            <p className="mt-1 text-[11px] text-sub">{catalogError}</p>
          ) : (
            <p className="mt-1 text-[11px] text-sub">
              Creates the 5 core tables (Account, Contact, Activity, File, Tag) plus your 12-table pack.
            </p>
          )}
          {selectedBusinessType ? (
            <Card variant="subtle" className="mt-2 p-3 space-y-2 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-main">
                  {selectedBusinessType.label}
                </span>
                <span className="badge badge-info num-tabular">
                  {selectedBusinessType.total_starter_tables} tables (5 core +{' '}
                  {selectedBusinessType.pack_table_count} pack)
                </span>
              </div>
              <p className="text-sub leading-relaxed">
                {selectedBusinessType.description}
              </p>
              {selectedBusinessType.default_contact_label !== 'Contact' ? (
                <div>
                  <span className="badge badge-info">
                    Contact labeled as {selectedBusinessType.default_contact_label}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1">
                {selectedBusinessType.pack_objects.map((obj) => (
                  <span key={obj.key} className="badge badge-neutral">
                    {obj.label}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="emailInput"
            className="block font-medium text-body mb-1"
          >
            Email address
          </label>
          <input
            id="emailInput"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            className="crm-input w-full px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="passwordInput"
            className="block font-medium text-body mb-1"
          >
            Password
          </label>
          <input
            id="passwordInput"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            className="crm-input w-full px-3 py-2"
          />
          <p className="mt-1 text-[11px] text-sub">
            Use at least 8 characters and avoid common passwords or your email address.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPasswordInput"
            className="block font-medium text-body mb-1"
          >
            Confirm password
          </label>
          <input
            id="confirmPasswordInput"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat password"
            className="crm-input w-full px-3 py-2"
          />
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="w-full py-2 text-xs font-medium"
          >
            {submitting ? 'Checking connection...' : 'Create workspace'}
          </Button>
        </div>
      </form>

      <div className="border-t crm-border pt-4 flex items-center justify-between text-xs text-sub">
        <span>Already have a workspace account?</span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onNavigate('/login')}
        >
          Sign in
        </Button>
      </div>
    </AuthCardShell>
  )
}
