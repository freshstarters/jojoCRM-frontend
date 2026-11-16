import { useState } from 'react'
import { AuthCardShell } from '../components/AuthCardShell.jsx'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { apiPost } from '../utils/api.js'

export function ForgotPasswordScreen({ onNavigate }) {
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')
    setSubmitting(true)

    try {
      const { response, data } = await apiPost('/api/v1/password-reset/request/', {
        email,
      })
      if (!response.ok) {
        setErrorMessage(
          data.error || 'Could not send a password reset message right now.'
        )
        return
      }
      setStatusMessage(
        data.message ||
          'If an account exists for that email address, a password reset message has been sent.'
      )
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCardShell
      title="Reset your password"
      subtitle="Enter your account email address to receive a single-use password reset link valid for 15 minutes."
    >
      <FeedbackNotice message={errorMessage} tone="danger" />
      <FeedbackNotice message={statusMessage} tone="success" />

      <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
        <div>
          <label
            htmlFor="resetRequestEmailInput"
            className="block font-medium text-body mb-1"
          >
            Email address
          </label>
          <input
            id="resetRequestEmailInput"
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

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="w-full py-2 text-xs font-medium"
          >
            {submitting ? 'Sending reset link...' : 'Send reset message'}
          </Button>
        </div>
      </form>

      <div className="border-t crm-border pt-4 flex items-center justify-between text-xs text-sub">
        <span>Remembered your password?</span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onNavigate('/login')}
        >
          Back to sign in
        </Button>
      </div>
    </AuthCardShell>
  )
}
