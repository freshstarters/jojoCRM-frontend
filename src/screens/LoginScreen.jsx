import { useEffect, useState } from 'react'
import { AuthCardShell } from '../components/AuthCardShell.jsx'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { apiGet, apiPost } from '../utils/api.js'
import {
  formatWebAuthnError,
  getPasskeyAssertion,
  isWebAuthnSupported,
} from '../utils/webauthn.js'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
      <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
      <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
    </svg>
  )
}

function PasskeyIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="7.5" r="3.5" />
      <path d="M2 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="18.5" cy="11.5" r="2.5" />
      <path d="M18.5 14v7" />
      <path d="M18.5 18h2.5" />
    </svg>
  )
}

export function LoginScreen({ onLoginSuccess, onNavigate, initialError = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState(() => {
    if (initialError) return initialError
    const params = new URLSearchParams(window.location.search)
    return params.get('auth_error') || ''
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeMethod, setActiveMethod] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('auth_error')) {
      params.delete('auth_error')
      const nextSearch = params.toString()
      const nextUrl = nextSearch
        ? `${window.location.pathname}?${nextSearch}`
        : window.location.pathname
      window.history.replaceState({}, '', nextUrl)
    }
  }, [])

  const isBusy = submitting || Boolean(activeMethod)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')
    setUnverifiedEmail('')
    setSubmitting(true)

    try {
      const { response, data } = await apiPost('/api/v1/login/', {
        email,
        password,
      })

      if (!response.ok) {
        if (response.status === 403 && data.verification_required) {
          setUnverifiedEmail(data.email || email)
        }
        setErrorMessage(data.error || 'Invalid email or password.')
        return
      }

      if (data.workspace && data.workspace.slug) {
        onLoginSuccess(data)
      }
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOAuthStart(provider) {
    setErrorMessage('')
    setStatusMessage('')
    setUnverifiedEmail('')
    setActiveMethod(provider)

    try {
      const { response, data } = await apiGet(
        `/api/v1/auth/${provider}/start/?response=json`
      )
      if (!response.ok || !data.authorization_url) {
        setErrorMessage(
          data.error ||
            `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in is unavailable.`
        )
        setActiveMethod('')
        return
      }
      window.location.assign(data.authorization_url)
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
      setActiveMethod('')
    }
  }

  async function handlePasskeySignIn() {
    setErrorMessage('')
    setStatusMessage('')
    setUnverifiedEmail('')

    if (!isWebAuthnSupported()) {
      setErrorMessage('Passkeys are not supported in this browser.')
      return
    }

    setActiveMethod('passkey')
    try {
      const trimmedEmail = email.trim()
      const { response: optRes, data: optData } = await apiPost(
        '/api/v1/auth/passkey/login/options/',
        trimmedEmail ? { email: trimmedEmail } : {}
      )
      if (!optRes.ok || !optData.options) {
        setErrorMessage(optData.error || 'Could not start passkey sign-in.')
        return
      }

      const credential = await getPasskeyAssertion(optData.options)
      const { response: verifyRes, data: verifyData } = await apiPost(
        '/api/v1/auth/passkey/login/verify/',
        { credential }
      )

      if (!verifyRes.ok) {
        if (verifyRes.status === 403 && verifyData.verification_required) {
          setUnverifiedEmail(verifyData.email || trimmedEmail)
        }
        setErrorMessage(verifyData.error || 'Passkey sign-in failed.')
        return
      }

      if (verifyData.workspace && verifyData.workspace.slug) {
        onLoginSuccess(verifyData)
      }
    } catch (err) {
      setErrorMessage(formatWebAuthnError(err))
    } finally {
      setActiveMethod('')
    }
  }

  async function handleResendVerification() {
    const targetEmail = unverifiedEmail || email
    if (!targetEmail) return
    setErrorMessage('')
    setStatusMessage('')
    setResending(true)
    try {
      const { response, data } = await apiPost('/api/v1/resend-verification/', {
        email: targetEmail,
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

  return (
    <AuthCardShell
      title="Sign in to your workspace"
      subtitle="Sign in with your verified email and password, Google, Microsoft, or a registered passkey."
    >

        <FeedbackNotice message={errorMessage} tone="danger" />
        <FeedbackNotice message={statusMessage} tone="success" />

        {unverifiedEmail && (
          <Card variant="subtle" className="p-3.5 space-y-2.5 text-xs">
            <p className="text-sub">
              Need a new verification link for{' '}
              <span className="font-semibold text-main">{unverifiedEmail}</span>?
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={resending}
              onClick={handleResendVerification}
              className="w-full py-1.5 text-xs"
            >
              {resending ? 'Sending verification email...' : 'Resend verification email'}
            </Button>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
          <div>
            <label
              htmlFor="loginEmailInput"
              className="block font-medium text-body mb-1"
            >
              Email address
            </label>
            <input
              id="loginEmailInput"
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
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="loginPasswordInput"
                className="block font-medium text-body"
              >
                Password
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onNavigate('/forgot-password')}
              >
                Forgot password?
              </Button>
            </div>
            <input
              id="loginPasswordInput"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="crm-input w-full px-3 py-2"
            />
          </div>

          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              disabled={isBusy}
              className="w-full py-2 text-xs font-medium"
            >
              {submitting ? 'Signing in...' : 'Sign in with email'}
            </Button>
          </div>
        </form>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center space-x-2 text-[11px] uppercase tracking-wider text-sub">
            <span className="flex-1 border-t crm-border" />
            <span>Or continue with</span>
            <span className="flex-1 border-t crm-border" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => handleOAuthStart('google')}
              className="w-full py-2 text-xs font-medium inline-flex items-center justify-center space-x-2"
            >
              <GoogleIcon />
              <span>
                {activeMethod === 'google' ? 'Redirecting...' : 'Google'}
              </span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => handleOAuthStart('microsoft')}
              className="w-full py-2 text-xs font-medium inline-flex items-center justify-center space-x-2"
            >
              <MicrosoftIcon />
              <span>
                {activeMethod === 'microsoft' ? 'Redirecting...' : 'Microsoft'}
              </span>
            </Button>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={handlePasskeySignIn}
            className="w-full py-2 text-xs font-medium inline-flex items-center justify-center space-x-2"
          >
            <PasskeyIcon />
            <span>
              {activeMethod === 'passkey'
                ? 'Waiting for passkey...'
                : 'Sign in with passkey'}
            </span>
          </Button>
        </div>

        <div className="border-t crm-border pt-4 flex items-center justify-between text-xs text-sub">
          <span>New to jojoCRM?</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate('/signup')}
          >
            Create workspace
          </Button>
        </div>
      </AuthCardShell>
  )
}
