import { useEffect, useRef, useState } from 'react'
import { AuthCardShell } from '../components/AuthCardShell.jsx'
import { Button } from '../components/Button.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { apiPost } from '../utils/api.js'

export function VerifyEmailScreen({ token, onVerifiedSuccess, onNavigate }) {
  const [verifying, setVerifying] = useState(Boolean(token))
  const [errorMessage, setErrorMessage] = useState(
    token ? '' : 'Verification token is missing from this URL.'
  )
  const [resendEmail, setResendEmail] = useState('')
  const [resendStatus, setResendStatus] = useState('')
  const [resending, setResending] = useState(false)
  const attemptedTokenRef = useRef('')

  useEffect(() => {
    if (!token || attemptedTokenRef.current === token) {
      return
    }
    attemptedTokenRef.current = token

    apiPost('/api/v1/verify-email/', { token })
      .then(({ response, data }) => {
        if (!response.ok) {
          setErrorMessage(
            data.error || 'This verification link is invalid or has expired.'
          )
          setVerifying(false)
          return
        }
        onVerifiedSuccess(data)
      })
      .catch(() => {
        setErrorMessage('Unable to reach the server. Please try again.')
        setVerifying(false)
      })
  }, [token, onVerifiedSuccess])

  async function handleResend(event) {
    event.preventDefault()
    if (!resendEmail) return
    setErrorMessage('')
    setResendStatus('')
    setResending(true)

    try {
      const { response, data } = await apiPost('/api/v1/resend-verification/', {
        email: resendEmail,
      })
      if (!response.ok) {
        setErrorMessage(data.error || 'Could not resend verification message.')
        return
      }
      setResendStatus(
        data.message ||
          'If an unverified account exists, a new verification link was sent.'
      )
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthCardShell
      title={verifying ? 'Verifying your email...' : 'Email verification'}
      subtitle={
        verifying
          ? 'Confirming your single-use verification token and opening your workspace.'
          : 'Request a fresh verification message or return to sign in.'
      }
    >
      <FeedbackNotice message={errorMessage} tone="danger" />
      <FeedbackNotice message={resendStatus} tone="success" />

      {!verifying && (
        <form onSubmit={handleResend} className="space-y-4 text-xs" noValidate>
          <div>
            <label
              htmlFor="resendEmailInput"
              className="block font-medium text-body mb-1"
            >
              Email address for a new verification link
            </label>
            <input
              id="resendEmailInput"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
              placeholder="name@company.com"
              className="crm-input w-full px-3 py-2"
            />
          </div>

          <Button
            type="submit"
            variant="secondary"
            disabled={resending}
            className="w-full py-2 text-xs font-medium"
          >
            {resending ? 'Sending...' : 'Send new verification email'}
          </Button>
        </form>
      )}

      <div className="border-t crm-border pt-4 flex items-center justify-between text-xs text-sub">
        <span>Already verified?</span>
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
