import { useState } from 'react'
import { AuthCardShell } from '../components/AuthCardShell.jsx'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { apiPost } from '../utils/api.js'

export function ResetPasswordScreen({ token, onResetSuccess, onNavigate }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState(
    token ? '' : 'Password reset token is missing from this URL.'
  )
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!token) {
      setErrorMessage('Password reset token is missing from this URL.')
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
      const { response, data } = await apiPost('/api/v1/password-reset/confirm/', {
        token,
        password,
      })
      if (!response.ok) {
        setErrorMessage(
          data.error || 'This password reset link is invalid or has expired.'
        )
        return
      }
      if (data.workspace && data.workspace.slug) {
        onResetSuccess(data)
      }
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCardShell
      title="Set a new password"
      subtitle="Choose a new password of at least 8 characters to unlock your account and open your workspace."
    >
      <FeedbackNotice message={errorMessage} tone="danger" />

      <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
        <div>
          <label
            htmlFor="newPasswordInput"
            className="block font-medium text-body mb-1"
          >
            New password
          </label>
          <input
            id="newPasswordInput"
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
            Confirm new password
          </label>
          <input
            id="confirmPasswordInput"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat new password"
            className="crm-input w-full px-3 py-2"
          />
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !token}
            className="w-full py-2 text-xs font-medium"
          >
            {submitting ? 'Saving password...' : 'Save new password'}
          </Button>
        </div>
      </form>

      <div className="border-t crm-border pt-4 flex items-center justify-between text-xs text-sub">
        <span>Need a new reset link?</span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onNavigate('/forgot-password')}
        >
          Request reset email
        </Button>
      </div>
    </AuthCardShell>
  )
}
