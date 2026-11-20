import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { AuthCardShell } from './components/AuthCardShell.jsx'
import { Button } from './components/Button.jsx'
import { CrmTooltipLayer } from './components/CrmTooltipLayer.jsx'
import { FeedbackNotice } from './components/FeedbackNotice.jsx'
import { LoginScreen } from './screens/LoginScreen.jsx'
import { SignupScreen } from './screens/SignupScreen.jsx'
import {
  apiGet,
  apiPost,
  fetchAuthSession,
  subscribePermissionsVersion,
} from './utils/api.js'
import { buildWorkspacePath } from './utils/catalog.js'

const AcceptInviteScreen = lazy(() =>
  import('./screens/AcceptInviteScreen.jsx').then((m) => ({
    default: m.AcceptInviteScreen,
  })),
)
const ForgotPasswordScreen = lazy(() =>
  import('./screens/ForgotPasswordScreen.jsx').then((m) => ({
    default: m.ForgotPasswordScreen,
  })),
)
const ResetPasswordScreen = lazy(() =>
  import('./screens/ResetPasswordScreen.jsx').then((m) => ({
    default: m.ResetPasswordScreen,
  })),
)
const VerifyEmailScreen = lazy(() =>
  import('./screens/VerifyEmailScreen.jsx').then((m) => ({
    default: m.VerifyEmailScreen,
  })),
)
const WorkspaceShell = lazy(() =>
  import('./screens/WorkspaceShell.jsx').then((m) => ({
    default: m.WorkspaceShell,
  })),
)

const AUTH_ROUTES = new Set([
  '',
  'signup',
  'login',
  'verify-email',
  'forgot-password',
  'reset-password',
  'accept-invite',
])

const RECOVERY_ROUTES = new Set(['root', 'login', 'signup'])

function safeDecodeSegment(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseLocation(locationObj) {
  const pathname = locationObj?.pathname || '/'
  const search = locationObj?.search || ''
  const trimmed = pathname.replace(/^\/+|\/+$/g, '')
  const segments = trimmed ? trimmed.split('/').filter(Boolean) : []
  const firstSegment = segments[0] || ''
  const params = new URLSearchParams(search)
  const token = params.get('token') || ''

  if (AUTH_ROUTES.has(firstSegment)) {
    return {
      route: firstSegment || 'root',
      slug: null,
      pane: '',
      subtab: '',
      token,
    }
  }

  const queryPane = params.get('pane') || ''
  const querySubtab = params.get('tab') || ''

  return {
    route: 'workspace',
    slug: safeDecodeSegment(firstSegment),
    pane: safeDecodeSegment(segments[1] || queryPane || 'dashboard').toLowerCase(),
    subtab: safeDecodeSegment(segments[2] || querySubtab || '').toLowerCase(),
    token: '',
  }
}

function App() {
  const [routeState, setRouteState] = useState(() =>
    parseLocation(window.location)
  )
  const [workspaceData, setWorkspaceData] = useState(null)
  const [fetchedSlugState, setFetchedSlugState] = useState({
    slug: null,
    status: 'idle',
    error: '',
    unverifiedEmail: '',
  })
  const [sessionRecoveryChecked, setSessionRecoveryChecked] = useState(false)
  const [initialSignupSession, setInitialSignupSession] = useState(null)
  const [sessionNotice, setSessionNotice] = useState('')
  const [resendFeedback, setResendFeedback] = useState('')
  const [resending, setResending] = useState(false)
  const [permissionsRevision, setPermissionsRevision] = useState(0)
  const [permissionsToast, setPermissionsToast] = useState('')
  const permissionsVersionRef = useRef('')
  const syncInFlightRef = useRef(false)
  const toastTimerRef = useRef(null)

  const currentPermissionsVersion =
    workspaceData?.permissions_version ||
    workspaceData?.permissions?.permissions_version ||
    ''

  useEffect(() => {
    permissionsVersionRef.current = currentPermissionsVersion
  }, [currentPermissionsVersion])

  const showPermissionsToast = useCallback((message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    setPermissionsToast(message)
    toastTimerRef.current = setTimeout(() => {
      setPermissionsToast('')
      toastTimerRef.current = null
    }, 4500)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const activeSlug = routeState.slug
  const isRecoveryRoute = !activeSlug && RECOVERY_ROUTES.has(routeState.route)
  const isAlreadyVerifiedForActiveSlug = Boolean(
    activeSlug &&
      workspaceData?.workspace?.slug === activeSlug &&
      workspaceData?.user?.email_verified
  )

  function navigateTo(nextUrl, { replace = false } = {}) {
    setResendFeedback('')
    setSessionNotice('')
    if (nextUrl !== window.location.pathname + window.location.search) {
      if (replace) {
        window.history.replaceState({}, '', nextUrl)
      } else {
        window.history.pushState({}, '', nextUrl)
      }
    }
    setRouteState(parseLocation(window.location))
  }

  function handleNavigatePane(paneId, subtabId = '') {
    if (!activeSlug) return
    const nextPath = buildWorkspacePath(activeSlug, paneId, subtabId)
    navigateTo(nextPath)
  }

  function handleWorkspaceUpdated(nextData) {
    if (!nextData) return
    const nextWorkspace = nextData.workspace || nextData
    const nextPermVer =
      nextData.permissions_version ||
      nextData.permissions?.permissions_version ||
      ''
    setWorkspaceData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        workspace: {
          ...prev.workspace,
          ...nextWorkspace,
        },
        ...(nextData.role ? { role: nextData.role } : {}),
        ...(nextData.permissions ? { permissions: nextData.permissions } : {}),
        ...(nextPermVer ? { permissions_version: nextPermVer } : {}),
        ...(nextData.user ? { user: { ...prev.user, ...nextData.user } } : {}),
      }
    })
  }

  useEffect(() => {
    function handlePopState() {
      setResendFeedback('')
      setSessionNotice('')
      const nextRoute = parseLocation(window.location)
      setRouteState(nextRoute)
      if (!nextRoute.slug && RECOVERY_ROUTES.has(nextRoute.route)) {
        setSessionRecoveryChecked(false)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!isRecoveryRoute || sessionRecoveryChecked) {
      return
    }

    let cancelled = false

    fetchAuthSession()
      .then(({ response: res, data: body }) => {
        if (cancelled) return

        if (res.ok && body?.authenticated && body?.workspace?.slug) {
          const targetSlug = body.workspace.slug
          setWorkspaceData(body)
          setInitialSignupSession(null)
          setFetchedSlugState({
            slug: targetSlug,
            status: 'open',
            unverifiedEmail: '',
            error: '',
          })
          setSessionRecoveryChecked(true)
          window.history.replaceState({}, '', `/${targetSlug}`)
          setRouteState(parseLocation(window.location))
          if (body.workspace?.name) {
            document.title = `jojoCRM — ${body.workspace.name}`
          }
          return
        }

        if (res.ok && body?.verification_required && body?.workspace?.slug) {
          if (routeState.route === 'signup') {
            setInitialSignupSession({
              verificationRequired: true,
              email: body.email || '',
              workspace: body.workspace,
            })
            setSessionRecoveryChecked(true)
            return
          }
          const targetSlug = body.workspace.slug
          setFetchedSlugState({
            slug: targetSlug,
            status: 'unverified',
            unverifiedEmail: body.email || '',
            error:
              body.error ||
              'Verify your email address from the verification message before opening this workspace.',
          })
          setSessionRecoveryChecked(true)
          window.history.replaceState({}, '', `/${targetSlug}`)
          setRouteState(parseLocation(window.location))
          return
        }

        setInitialSignupSession(null)
        setSessionRecoveryChecked(true)
      })
      .catch(() => {
        if (!cancelled) {
          setInitialSignupSession(null)
          setSessionRecoveryChecked(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isRecoveryRoute, sessionRecoveryChecked, routeState.route])

  useEffect(() => {
    if (!activeSlug) {
      if (routeState.route === 'login') {
        document.title = 'jojoCRM — Sign In'
      } else if (routeState.route === 'verify-email') {
        document.title = 'jojoCRM — Verify Email'
      } else if (routeState.route === 'forgot-password') {
        document.title = 'jojoCRM — Reset Password'
      } else if (routeState.route === 'reset-password') {
        document.title = 'jojoCRM — Set New Password'
      } else if (routeState.route === 'accept-invite') {
        document.title = 'jojoCRM — Accept Invitation'
      } else {
        document.title = 'jojoCRM — Create Workspace'
      }
      return
    }

    if (isAlreadyVerifiedForActiveSlug) {
      document.title = `jojoCRM — ${workspaceData.workspace.name}`
      return
    }

    let cancelled = false

    fetch(`/api/v1/workspaces/${encodeURIComponent(activeSlug)}/`, {
      credentials: 'same-origin',
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return

        if (!res.ok) {
          if (res.status === 403 && body.verification_required) {
            setFetchedSlugState({
              slug: activeSlug,
              status: 'unverified',
              unverifiedEmail: body.email || '',
              error:
                body.error ||
                'Verify your email address from the verification message before opening this workspace.',
            })
            return
          }
          if (res.status === 401) {
            setFetchedSlugState({
              slug: activeSlug,
              status: 'unauthenticated',
              unverifiedEmail: '',
              error:
                body.error ||
                'Sign in with a verified account to open this workspace.',
            })
            return
          }
          setFetchedSlugState({
            slug: activeSlug,
            status: 'closed',
            unverifiedEmail: '',
            error: body.error || 'Could not load workspace details.',
          })
          return
        }

        setWorkspaceData(body)
        setFetchedSlugState({
          slug: activeSlug,
          status: 'open',
          unverifiedEmail: '',
          error: '',
        })
        if (body.workspace?.name) {
          document.title = `jojoCRM — ${body.workspace.name}`
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedSlugState({
            slug: activeSlug,
            status: 'closed',
            unverifiedEmail: '',
            error: 'Could not load workspace details.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    activeSlug,
    isAlreadyVerifiedForActiveSlug,
    routeState.route,
    workspaceData,
  ])

  function handleAuthenticatedWorkspace(data) {
    const slug = data.workspace.slug
    setWorkspaceData(data)
    setFetchedSlugState({
      slug,
      status: 'open',
      unverifiedEmail: '',
      error: '',
    })
    setSessionRecoveryChecked(true)
    setSessionNotice('')
    navigateTo(`/${slug}`)
  }

  function handleUserUpdated(nextUser) {
    if (!nextUser) return
    setWorkspaceData((prev) =>
      prev ? { ...prev, user: { ...prev.user, ...nextUser } } : prev
    )
  }

  const handleSessionExpired = useCallback((message = '') => {
    setWorkspaceData(null)
    setFetchedSlugState({
      slug: null,
      status: 'idle',
      unverifiedEmail: '',
      error: '',
    })
    setSessionRecoveryChecked(true)
    setSessionNotice(
      message || 'Your session has ended. Sign in again to continue.'
    )
    window.history.replaceState({}, '', '/login')
    setRouteState(parseLocation(window.location))
  }, [])

  const syncLivePermissions = useCallback(
    async ({ viaSession = false } = {}) => {
      if (!activeSlug || !isAlreadyVerifiedForActiveSlug || syncInFlightRef.current) {
        return
      }
      syncInFlightRef.current = true
      try {
        const result = viaSession
          ? await fetchAuthSession()
          : await apiGet(`/api/v1/workspaces/${encodeURIComponent(activeSlug)}/`)
        const { response, data } = result
        if (response.status === 401 || (viaSession && response.ok && data?.authenticated === false)) {
          handleSessionExpired(data?.error || data?.detail)
          return
        }
        if (!response.ok || !data?.permissions) return
        const nextVersion =
          data.permissions_version || data.permissions?.permissions_version || ''
        if (nextVersion && nextVersion !== permissionsVersionRef.current) {
          permissionsVersionRef.current = nextVersion
          setWorkspaceData((prev) =>
            prev
              ? {
                  ...prev,
                  workspace: {
                    ...prev.workspace,
                    ...(data.workspace || {}),
                  },
                  role: data.role || prev.role,
                  permissions: data.permissions,
                  permissions_version: nextVersion,
                  ...(data.user ? { user: { ...prev.user, ...data.user } } : {}),
                }
              : data,
          )
          setPermissionsRevision((prev) => prev + 1)
          const roleName = data.role?.name || data.permissions?.role_name || ''
          showPermissionsToast(
            roleName
              ? `Your workspace permissions were updated (${roleName}).`
              : 'Your workspace permissions were updated.',
          )
        }
      } catch {
        // Ignore transient network failures during background permission sync.
      } finally {
        syncInFlightRef.current = false
      }
    },
    [
      activeSlug,
      isAlreadyVerifiedForActiveSlug,
      handleSessionExpired,
      showPermissionsToast,
    ],
  )

  useEffect(() => {
    if (!activeSlug || !isAlreadyVerifiedForActiveSlug) return undefined

    const unsubscribe = subscribePermissionsVersion((incomingVersion) => {
      if (
        incomingVersion &&
        permissionsVersionRef.current &&
        incomingVersion !== permissionsVersionRef.current
      ) {
        syncLivePermissions({ viaSession: false })
      }
    })

    function handleFocusOrVisible() {
      if (document.visibilityState === 'visible') {
        syncLivePermissions({ viaSession: true })
      }
    }

    window.addEventListener('focus', handleFocusOrVisible)
    document.addEventListener('visibilitychange', handleFocusOrVisible)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncLivePermissions({ viaSession: true })
      }
    }, 12000)

    return () => {
      unsubscribe()
      window.removeEventListener('focus', handleFocusOrVisible)
      document.removeEventListener('visibilitychange', handleFocusOrVisible)
      window.clearInterval(intervalId)
    }
  }, [activeSlug, isAlreadyVerifiedForActiveSlug, syncLivePermissions])

  async function handleLogout() {
    try {
      await apiPost('/api/v1/logout/')
    } catch {
      // Proceed to login screen even if network fails
    }
    setWorkspaceData(null)
    setInitialSignupSession(null)
    setFetchedSlugState({
      slug: null,
      status: 'idle',
      unverifiedEmail: '',
      error: '',
    })
    setSessionRecoveryChecked(true)
    setSessionNotice('')
    navigateTo('/login')
  }

  async function handleResendFromGate() {
    const targetEmail = fetchedSlugState.unverifiedEmail
    if (!targetEmail) return
    setResending(true)
    setResendFeedback('')
    try {
      const { response, data } = await apiPost('/api/v1/resend-verification/', {
        email: targetEmail,
      })
      if (!response.ok) {
        setFetchedSlugState((prev) => ({
          ...prev,
          error: data.error || 'Could not resend verification message.',
        }))
      } else {
        setResendFeedback(
          data.message || 'A new verification message has been sent.'
        )
      }
    } catch {
      setFetchedSlugState((prev) => ({
        ...prev,
        error: 'Unable to reach the server. Please try again.',
      }))
    } finally {
      setResending(false)
    }
  }

  function renderContent() {
    if (!activeSlug) {
      if (isRecoveryRoute && !sessionRecoveryChecked) {
        return (
          <AuthCardShell
            eyebrow="jojoCRM"
            title="Checking session..."
            subtitle="Opening your workspace if you are already signed in."
          />
        )
      }
      if (routeState.route === 'login') {
        return (
          <LoginScreen
            key={sessionNotice || 'login'}
            initialError={sessionNotice}
            onLoginSuccess={handleAuthenticatedWorkspace}
            onNavigate={navigateTo}
          />
        )
      }
      if (routeState.route === 'verify-email') {
        return (
          <VerifyEmailScreen
            token={routeState.token}
            onVerifiedSuccess={handleAuthenticatedWorkspace}
            onNavigate={navigateTo}
          />
        )
      }
      if (routeState.route === 'forgot-password') {
        return <ForgotPasswordScreen onNavigate={navigateTo} />
      }
      if (routeState.route === 'reset-password') {
        return (
          <ResetPasswordScreen
            token={routeState.token}
            onResetSuccess={handleAuthenticatedWorkspace}
            onNavigate={navigateTo}
          />
        )
      }
      if (routeState.route === 'accept-invite') {
        return (
          <AcceptInviteScreen
            token={routeState.token}
            onAcceptSuccess={handleAuthenticatedWorkspace}
            onNavigate={navigateTo}
          />
        )
      }
      return (
        <SignupScreen
          initialSessionInfo={initialSignupSession}
          onSignedOut={() => setInitialSignupSession(null)}
          onSignupSuccess={handleAuthenticatedWorkspace}
          onNavigate={navigateTo}
        />
      )
    }

    const effectiveStatus = isAlreadyVerifiedForActiveSlug
      ? 'open'
      : fetchedSlugState.slug === activeSlug
        ? fetchedSlugState.status
        : 'loading'

    const effectiveError =
      fetchedSlugState.slug === activeSlug ? fetchedSlugState.error : ''
    const effectiveUnverifiedEmail =
      fetchedSlugState.slug === activeSlug
        ? fetchedSlugState.unverifiedEmail
        : ''

    if (effectiveStatus !== 'open') {
      return (
        <AuthCardShell
          eyebrow={`/${activeSlug}`}
          eyebrowUppercase={false}
          title={
            effectiveStatus === 'loading'
              ? 'Checking workspace access...'
              : 'Workspace is closed'
          }
          subtitle={
            effectiveStatus === 'loading'
              ? 'Confirming your session and email verification status.'
              : 'This workspace is only accessible to a signed-in account with a verified email address.'
          }
        >
          <FeedbackNotice message={effectiveError} tone="danger" />
          <FeedbackNotice message={resendFeedback} tone="success" />

          {effectiveStatus === 'unverified' && effectiveUnverifiedEmail && (
            <Button
              type="button"
              variant="secondary"
              disabled={resending}
              onClick={handleResendFromGate}
              className="w-full py-2 text-xs font-medium"
            >
              {resending
                ? 'Sending verification email...'
                : 'Resend verification email'}
            </Button>
          )}

          {effectiveStatus !== 'loading' && (
            <div className="flex items-center space-x-2 pt-1">
              <Button
                type="button"
                variant="primary"
                onClick={() => navigateTo('/login')}
                className="flex-1 py-2 text-xs font-medium"
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigateTo('/signup')}
                className="flex-1 py-2 text-xs font-medium"
              >
                Create workspace
              </Button>
            </div>
          )}
        </AuthCardShell>
      )
    }

    return (
      <WorkspaceShell
        workspace={
          workspaceData?.workspace?.slug === activeSlug
            ? workspaceData.workspace
            : { name: activeSlug, slug: activeSlug }
        }
        user={workspaceData?.user}
        permissions={workspaceData?.permissions}
        permissionsRevision={permissionsRevision}
        permissionsToast={permissionsToast}
        onDismissPermissionsToast={() => setPermissionsToast('')}
        activePane={routeState.pane || 'dashboard'}
        activeSubtab={routeState.subtab || ''}
        onNavigatePane={handleNavigatePane}
        onWorkspaceUpdated={handleWorkspaceUpdated}
        errorMessage={effectiveError}
        onLogout={handleLogout}
        onUserUpdated={handleUserUpdated}
        onSessionExpired={handleSessionExpired}
      />
    )
  }

  return (
    <>
      <Suspense
        fallback={
          <AuthCardShell
            eyebrow="jojoCRM"
            title="Loading view..."
            subtitle="Preparing the requested screen."
          />
        }
      >
        {renderContent()}
      </Suspense>
      <CrmTooltipLayer />
    </>
  )
}

export default App
