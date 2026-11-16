import { useEffect, useMemo, useState } from 'react'
import { AuthCardShell } from '../components/AuthCardShell.jsx'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Select } from '../components/Select.jsx'
import { apiGet, apiPost } from '../utils/api.js'
import {
  detectBrowserTimezone,
  getTimezoneOptions,
} from '../utils/timezones.js'

function formatExpiry(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function AcceptInviteScreen({ token, onAcceptSuccess, onNavigate }) {
  const initialTimezone = useMemo(() => detectBrowserTimezone(), [])
  const timezoneOptions = useMemo(
    () => getTimezoneOptions(initialTimezone),
    [initialTimezone],
  )

  const [loadingPreview, setLoadingPreview] = useState(Boolean(token))
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [timezone, setTimezone] = useState(initialTimezone)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      if (!token) {
        setPreview(null)
        setPreviewError(
          'This invitation link is missing a token. Ask your workspace administrator for a new invite.',
        )
        setLoadingPreview(false)
        return
      }

      setLoadingPreview(true)
      setPreviewError('')
      setPreview(null)
      setErrorMessage('')

      try {
        const { response, data } = await apiGet(
          `/api/v1/invites/preview/?token=${encodeURIComponent(token)}`,
        )
        if (cancelled) return
        if (!response.ok) {
          setPreviewError(
            data?.error ||
              data?.detail ||
              'This invitation is invalid, expired, or no longer available.',
          )
        } else {
          setPreview(data)
        }
      } catch {
        if (!cancelled) {
          setPreviewError('Could not load invitation details. Please try again.')
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false)
        }
      }
    }

    loadPreview()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const { response, data } = await apiPost('/api/v1/invites/accept/', {
        token,
        password,
        timezone,
      })
      if (!response.ok) {
        setErrorMessage(
          data?.error ||
            data?.detail ||
            'Could not accept invitation. Please check your details and try again.',
        )
        return
      }
      if (onAcceptSuccess) {
        onAcceptSuccess(data)
      }
    } catch {
      setErrorMessage('Network error while accepting invitation. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCardShell
      eyebrow="jojoCRM Workspace Invite"
      title="Accept workspace invitation"
      subtitle="Invited members join one workspace directly without a connection-location check."
    >

        {loadingPreview ? (
          <div className="crm-subtle rounded-lg p-4 text-xs text-sub">
            Checking your invitation link...
          </div>
        ) : previewError ? (
          <div className="space-y-4">
            <FeedbackNotice message={previewError} tone="danger" />
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                onClick={() => onNavigate?.('/login')}
              >
                Go to sign in
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                onClick={() => onNavigate?.('/signup')}
              >
                Create workspace
              </Button>
            </div>
          </div>
        ) : preview ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card variant="subtle" className="p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sub">Workspace</span>
                <span className="font-semibold text-main text-right">
                  {preview.workspace?.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sub">Invited email</span>
                <span className="font-medium text-main text-right break-all">
                  {preview.email}
                </span>
              </div>
              {preview.invited_by_email ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sub">Invited by</span>
                  <span className="text-main text-right break-all">
                    {preview.invited_by_email}
                  </span>
                </div>
              ) : null}
              {preview.expires_at ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sub">Expires</span>
                  <span className="text-main text-right num-tabular">
                    {formatExpiry(preview.expires_at)}
                  </span>
                </div>
              ) : null}
            </Card>

            <FeedbackNotice message={errorMessage} tone="danger" />

            <div className="space-y-1.5">
              <label
                htmlFor="invite-password"
                className="block text-xs font-medium text-main"
              >
                Create password
              </label>
              <input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="crm-input w-full px-3 py-2 text-sm rounded-lg"
                disabled={submitting}
              />
              <p className="text-[11px] text-sub">
                Use at least 8 characters and avoid common passwords or your email address.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="invite-confirm-password"
                className="block text-xs font-medium text-main"
              >
                Confirm password
              </label>
              <input
                id="invite-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                className="crm-input w-full px-3 py-2 text-sm rounded-lg"
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="invite-timezone"
                className="block text-xs font-medium text-main"
              >
                Timezone
              </label>
              <Select
                id="invite-timezone"
                value={timezone}
                onChange={setTimezone}
                options={timezoneOptions}
                ariaLabel="Timezone"
                disabled={submitting}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="w-full py-2 text-xs font-semibold"
            >
              {submitting ? 'Joining workspace...' : 'Join workspace'}
            </Button>
          </form>
        ) : null}

        <div className="border-t crm-border pt-3 flex items-center justify-between text-xs text-sub">
          <span>Already have a workspace account?</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate?.('/login')}
          >
            Sign in
          </Button>
        </div>
      </AuthCardShell>
  )
}
