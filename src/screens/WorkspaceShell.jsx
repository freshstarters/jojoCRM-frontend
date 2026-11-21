import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { AuditLogDrawer } from '../components/AuditLogDrawer.jsx'
import { Button } from '../components/Button.jsx'
import { Card } from '../components/Card.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { GlobalSearchBar } from '../components/GlobalSearchBar.jsx'
import { Modal } from '../components/Modal.jsx'
import { Subtabs } from '../components/Subtabs.jsx'
import { ThemeToggleButton } from '../components/ThemeToggleButton.jsx'
import {
  buildSidebarGroups,
  getActiveTableSummary,
  resolvePaneState,
} from '../utils/catalog.js'

const AccountsPane = lazy(() =>
  import('./AccountsPane.jsx').then((m) => ({ default: m.AccountsPane })),
)
const AppointmentsPane = lazy(() =>
  import('./AppointmentsPane.jsx').then((m) => ({ default: m.AppointmentsPane })),
)
const ContactsPane = lazy(() =>
  import('./ContactsPane.jsx').then((m) => ({ default: m.ContactsPane })),
)
const ContractsPane = lazy(() =>
  import('./ContractsPane.jsx').then((m) => ({ default: m.ContractsPane })),
)
const DashboardPane = lazy(() =>
  import('./DashboardPane.jsx').then((m) => ({ default: m.DashboardPane })),
)
const DealsPane = lazy(() =>
  import('./DealsPane.jsx').then((m) => ({ default: m.DealsPane })),
)
const JobsPane = lazy(() =>
  import('./JobsPane.jsx').then((m) => ({ default: m.JobsPane })),
)
const InvoicingPane = lazy(() =>
  import('./InvoicingPane.jsx').then((m) => ({ default: m.InvoicingPane })),
)
const LeadsPane = lazy(() =>
  import('./LeadsPane.jsx').then((m) => ({ default: m.LeadsPane })),
)
const PoliciesPane = lazy(() =>
  import('./PoliciesPane.jsx').then((m) => ({ default: m.PoliciesPane })),
)
const ProductsPane = lazy(() =>
  import('./ProductsPane.jsx').then((m) => ({ default: m.ProductsPane })),
)
const SettingsPane = lazy(() =>
  import('./SettingsPane.jsx').then((m) => ({ default: m.SettingsPane })),
)
const TicketsPane = lazy(() =>
  import('./TicketsPane.jsx').then((m) => ({ default: m.TicketsPane })),
)
const VisitsPane = lazy(() =>
  import('./VisitsPane.jsx').then((m) => ({ default: m.VisitsPane })),
)

function SidebarIcon({ id, isActive = false }) {
  const secondaryClass = `w-4 h-4 shrink-0 ${isActive ? '' : 'text-sub'}`.trim()

  switch (id) {
    case 'dashboard':
      return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'deals':
      return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="5" height="16" rx="1" />
          <rect x="10" y="4" width="5" height="11" rx="1" />
          <rect x="17" y="4" width="4" height="14" rx="1" />
        </svg>
      )
    case 'invoicing':
      return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    case 'accounts':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
        </svg>
      )
    case 'contacts':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'leads':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )
    case 'contracts':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )
    case 'products':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      )
    case 'policies':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    case 'memberships':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      )
    case 'tickets':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    case 'jobs':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      )
    case 'appointments':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'visits':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      )
    case 'bookings':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 7v11m0-4h18m0 4v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2" />
        </svg>
      )
    case 'programs':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    case 'enrollments':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      )
    case 'properties':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 21h18" />
          <path d="M9 8h1m-1 4h1m4-4h1m-1 4h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
        </svg>
      )
    case 'vehicles':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M5 17h14v-5l-2-5H7L5 12v5z" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </svg>
      )
    case 'assets':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M20 7l-8-4-8 4 8 4 8-4z" />
          <path d="M4 7v10l8 4 8-4V7" />
        </svg>
      )
    case 'suppliers':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      )
    case 'purchases':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      )
    case 'shipments':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'campaigns':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      )
    case 'automations':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )
    case 'settings':
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.42 1.2.15.04.3.05.46.05H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    case 'custom-tables':
    default:
      return (
        <svg className={secondaryClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      )
  }
}

export function WorkspaceShell({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  permissionsToast = '',
  onDismissPermissionsToast,
  activePane = 'dashboard',
  activeSubtab = '',
  inspectRecordId = null,
  onNavigatePane,
  onInspectRecord,
  onCloseInspect,
  onWorkspaceUpdated,
  errorMessage,
  onLogout,
  onUserUpdated,
  onSessionExpired,
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false)
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [visitPrefill, setVisitPrefill] = useState(null)
  const [visitPrefillNonce, setVisitPrefillNonce] = useState(0)
  const [policyPrefill, setPolicyPrefill] = useState(null)
  const [policyPrefillNonce, setPolicyPrefillNonce] = useState(0)

  const handleAuditRecorded = useCallback(() => {
    setAuditRefreshKey((prev) => prev + 1)
  }, [])

  const handleClearVisitPrefill = useCallback(() => {
    setVisitPrefill(null)
  }, [])

  const handleClearPolicyPrefill = useCallback(() => {
    setPolicyPrefill(null)
  }, [])

  const handleStartRecordVisit = useCallback(
    (prefill) => {
      setMobileSidebarOpen(false)
      setVisitPrefill(prefill || {})
      setVisitPrefillNonce((prev) => prev + 1)
      onNavigatePane?.('visits', '')
    },
    [onNavigatePane],
  )

  const handleStartCreatePolicy = useCallback(
    (prefill) => {
      setMobileSidebarOpen(false)
      setPolicyPrefill(prefill || {})
      setPolicyPrefillNonce((prev) => prev + 1)
      onNavigatePane?.('policies', '')
    },
    [onNavigatePane],
  )

  const sidebarGroups = useMemo(
    () => buildSidebarGroups(workspace).filter((group) => group.visibleItems.length > 0),
    [workspace],
  )
  const resolvedPane = useMemo(
    () => resolvePaneState(activePane, activeSubtab, workspace),
    [activePane, activeSubtab, workspace],
  )
  const activeTablesSummary = useMemo(
    () => getActiveTableSummary(workspace),
    [workspace],
  )

  const workspaceName = workspace?.name || 'Workspace'
  const workspaceInitial = workspaceName.trim().charAt(0).toUpperCase() || 'W'
  const userInitial = user?.email?.trim().charAt(0).toUpperCase() || ''
  const roleLabel =
    permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')
  const canManageUsers = Boolean(
    permissions?.can_manage_users_and_roles ?? permissions?.can_manage_invites,
  )
  const activeEntryLabel = resolvedPane.item?.label || 'Workspace'
  const activeSubtabObj =
    resolvedPane.item?.subtabs?.find((tab) => tab.id === resolvedPane.subtab) || null

  function selectPane(paneId, subtabId = '', options = {}) {
    setMobileSidebarOpen(false)
    onNavigatePane?.(paneId, subtabId, options)
  }

  function handleOpenLinkedRecord(paneId, recordId, subtabId = '') {
    if (!paneId || !recordId) return
    setMobileSidebarOpen(false)
    const targetSubtab =
      subtabId ||
      (paneId === 'deals'
        ? resolvedPane.paneId === 'deals' && resolvedPane.subtab
          ? resolvedPane.subtab
          : 'kanban'
        : paneId === 'invoicing'
          ? 'invoices'
          : '')
    onInspectRecord?.(recordId, { paneId, subtabId: targetSubtab })
  }

  function handleInspectInCurrentPane(recordId) {
    if (!recordId) return
    onInspectRecord?.(recordId, {
      paneId: resolvedPane.paneId,
      subtabId: resolvedPane.subtab,
    })
  }

  function handleSelectGlobalSearchResult(hit) {
    if (!hit?.inspect_pane_id || !hit?.inspect_record_id) return
    handleOpenLinkedRecord(
      hit.inspect_pane_id,
      hit.inspect_record_id,
      hit.inspect_subtab_id || '',
    )
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden relative">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop Compact Dock Spacer */}
      <div className="hidden lg:block w-[5.25rem] shrink-0" />

      {/* Floating Compact-by-Default Left CRM Sidebar */}
      <aside
        id="sidebar"
        className={`floating-sidebar crm-sidebar flex flex-col justify-between shrink-0 overflow-y-auto z-40 ${
          mobileSidebarOpen ? 'flex mobile-open' : 'hidden lg:flex'
        }`}
      >
        <div className="p-2.5 space-y-3">
          {/* Workspace Header Card */}
          <Card className="sb-brand-card p-2 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md btn-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                {workspaceInitial}
              </div>
              <div className="sb-label min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-sm text-main truncate">
                    {workspaceName}
                  </span>
                </div>
                <div className="text-xs text-sub truncate">
                  {workspace?.business_type_label || `/${workspace?.slug}`}
                </div>
              </div>
            </div>
            <span
              className="sb-label w-2 h-2 rounded-full bg-emerald-500 shrink-0 ml-1"
              data-tooltip="Workspace Active"
            />
          </Card>

          {/* Dynamic Pack-Aware Sidebar Navigation */}
          {sidebarGroups.map((group) => (
            <div key={group.title}>
              <div className="sb-collapse-hide px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sub whitespace-nowrap">
                {group.title}
              </div>
              <nav className="space-y-1">
                {group.visibleItems.map((item) => {
                  const isActive =
                    resolvedPane.status === 'active' && resolvedPane.paneId === item.id
                  const defaultSubtab = item.subtabs?.[0]?.id || ''
                  return (
                    <Button
                      key={item.id}
                      variant="nav"
                      data-tooltip={item.label}
                      data-nav-pane={item.id}
                      onClick={() => selectPane(item.id, defaultSubtab)}
                      className={isActive ? 'active' : ''}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <SidebarIcon id={item.id} isActive={isActive} />
                        <span className="sb-label">{item.label}</span>
                      </div>
                    </Button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {user?.email && (
          <div className="p-2.5 border-t crm-border">
            <div
              className="sb-compact-only mx-auto w-8 h-8 rounded-full crm-subtle items-center justify-center text-xs font-semibold text-main select-none"
              data-tooltip={user.email}
              tabIndex={0}
              aria-label={user.email}
            >
              {userInitial}
            </div>
            <div className="sb-collapse-hide px-2 py-1 space-y-1">
              <div className="text-xs text-sub truncate">{user.email}</div>
              <span
                className={`badge ${
                  permissions?.is_owner ? 'badge-info' : 'badge-neutral'
                }`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
        {/* Floating Topbar */}
        <header className="floating-topbar sticky top-3 mx-3 sm:mx-4 px-4 sm:px-5 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary-icon"
              className="lg:hidden"
              onClick={() => setMobileSidebarOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </Button>
            <div className="flex items-center space-x-2 text-sm shrink-0">
              <span className="text-sub hidden sm:inline">{workspaceName}</span>
              <span className="text-sub hidden sm:inline">/</span>
              <span className="font-semibold text-main">{activeEntryLabel}</span>
              {activeSubtabObj ? (
                <>
                  <span className="text-sub hidden md:inline">/</span>
                  <span className="text-sub hidden md:inline">{activeSubtabObj.label}</span>
                </>
              ) : null}
            </div>
          </div>

          <GlobalSearchBar
            workspace={workspace}
            permissions={permissions}
            permissionsRevision={permissionsRevision}
            onSelectResult={handleSelectGlobalSearchResult}
            onSessionExpired={onSessionExpired}
          />

          <div className="flex items-center space-x-2 shrink-0">
            {workspace?.business_type_label ? (
              <span className="badge badge-info hidden md:inline-flex">
                {workspace.business_type_label}
              </span>
            ) : null}
            <span className="badge badge-neutral num-tabular hidden sm:inline-flex">
              /{workspace?.slug}
            </span>
            <Button
              type="button"
              variant="icon"
              onClick={() => setAuditDrawerOpen(true)}
              data-tooltip="Audit Log"
              aria-label="Audit Log"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </Button>
            <ThemeToggleButton />
            {onLogout && (
              <Button
                type="button"
                variant="icon"
                onClick={() => setLogoutModalOpen(true)}
                data-tooltip="Sign out"
                aria-label="Sign out"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </Button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pt-3 pb-6 px-3 sm:px-4 w-full">
          {permissionsToast ? (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-4 right-4 z-50 brand-soft backdrop-blur-md border crm-border rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-3 text-xs font-medium max-w-sm"
            >
              <span>{permissionsToast}</span>
              <button
                type="button"
                onClick={onDismissPermissionsToast}
                className="text-sub hover:text-main text-[11px] font-semibold"
                aria-label="Dismiss notification"
              >
                Dismiss
              </button>
            </div>
          ) : null}
          <Suspense
            fallback={
              <section className="max-w-4xl mx-auto my-6">
                <Card className="p-5">
                  <p className="text-xs text-sub">Loading view...</p>
                </Card>
              </section>
            }
          >
            {resolvedPane.status === 'active' && resolvedPane.paneId === 'settings' ? (
            <SettingsPane
              workspace={workspace}
              user={user}
              permissions={permissions}
              permissionsRevision={permissionsRevision}
              activeTab={resolvedPane.subtab}
              onTabChange={(nextTab) => selectPane('settings', nextTab)}
              onWorkspaceUpdated={onWorkspaceUpdated}
              onUserUpdated={onUserUpdated}
              onAuditRecorded={handleAuditRecorded}
              onSessionExpired={onSessionExpired}
            />
          ) : resolvedPane.status === 'active' && resolvedPane.paneId === 'dashboard' ? (
            <DashboardPane
              workspace={workspace}
              user={user}
              permissions={permissions}
              permissionsRevision={permissionsRevision}
              activeTablesSummary={activeTablesSummary}
              onSelectPane={selectPane}
              onOpenRecord={handleOpenLinkedRecord}
              onOpenAuditLog={() => setAuditDrawerOpen(true)}
              onAuditRecorded={handleAuditRecorded}
              onSessionExpired={onSessionExpired}
            />
          ) : resolvedPane.status === 'active' &&
            [
              'accounts',
              'contacts',
              'leads',
              'deals',
              'contracts',
              'policies',
              'products',
              'invoicing',
              'jobs',
              'appointments',
              'visits',
              'tickets',
            ].includes(resolvedPane.paneId) ? (
            (() => {
              const crmProps = {
                workspace,
                user,
                permissions,
                permissionsRevision,
                urlInspectRecordId: inspectRecordId,
                onInspectRecord: handleInspectInCurrentPane,
                onCloseInspect,
                onOpenLinkedRecord: handleOpenLinkedRecord,
                onAuditRecorded: handleAuditRecorded,
                onSessionExpired,
              }
              if (resolvedPane.paneId === 'accounts') {
                return <AccountsPane {...crmProps} onCreatePolicy={handleStartCreatePolicy} />
              }
              if (resolvedPane.paneId === 'contacts') {
                return (
                  <ContactsPane
                    {...crmProps}
                    onRecordVisit={handleStartRecordVisit}
                    onCreatePolicy={handleStartCreatePolicy}
                  />
                )
              }
              if (resolvedPane.paneId === 'leads') return <LeadsPane {...crmProps} />
              if (resolvedPane.paneId === 'deals') {
                return (
                  <DealsPane
                    {...crmProps}
                    activeSubtab={resolvedPane.subtab}
                    onSubtabChange={(nextTab) => selectPane('deals', nextTab)}
                    onOpenPipelineSettings={() => selectPane('settings', 'pipelines')}
                    onOpenCreatedInvoice={(invoiceId) =>
                      handleOpenLinkedRecord('invoicing', invoiceId)
                    }
                    onOpenCreatedContract={(contractId) =>
                      handleOpenLinkedRecord('contracts', contractId)
                    }
                    onOpenCreatedJob={(jobId) =>
                      handleOpenLinkedRecord('jobs', jobId)
                    }
                  />
                )
              }
              if (resolvedPane.paneId === 'contracts') {
                return <ContractsPane {...crmProps} />
              }
              if (resolvedPane.paneId === 'policies') {
                return (
                  <PoliciesPane
                    key={policyPrefillNonce}
                    {...crmProps}
                    prefillCreate={policyPrefill}
                    onClearPrefillCreate={handleClearPolicyPrefill}
                  />
                )
              }
              if (resolvedPane.paneId === 'products') {
                return (
                  <ProductsPane
                    {...crmProps}
                    onOpenInventory={() => selectPane('invoicing', 'inventory')}
                  />
                )
              }
              if (resolvedPane.paneId === 'invoicing') {
                return (
                  <InvoicingPane
                    {...crmProps}
                    subtabs={resolvedPane.item?.subtabs || []}
                    activeSubtab={resolvedPane.subtab}
                    onSubtabChange={(nextTab) => selectPane('invoicing', nextTab)}
                    onOpenInvoiceStatusSettings={() =>
                      selectPane('settings', 'invoice-statuses')
                    }
                  />
                )
              }
              if (resolvedPane.paneId === 'jobs') return <JobsPane {...crmProps} />
              if (resolvedPane.paneId === 'appointments') {
                return <AppointmentsPane {...crmProps} onRecordVisit={handleStartRecordVisit} />
              }
              if (resolvedPane.paneId === 'visits') {
                return (
                  <VisitsPane
                    key={visitPrefillNonce}
                    {...crmProps}
                    prefillCreate={visitPrefill}
                    onClearPrefillCreate={handleClearVisitPrefill}
                  />
                )
              }
              return <TicketsPane {...crmProps} />
            })()
          ) : resolvedPane.status === 'disabled' || resolvedPane.status === 'unknown' ? (
            <section id="pane-unavailable" className="max-w-4xl mx-auto my-6">
              <Card className="p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b crm-border pb-4">
                  <div>
                    <span className="badge badge-warn">
                      {resolvedPane.status === 'disabled' ? 'Table turned off' : 'Not found'}
                    </span>
                    <h1 className="text-xl font-semibold text-main tracking-tight mt-1.5">
                      {resolvedPane.item?.label || 'Module unavailable'}
                    </h1>
                    <p className="text-xs text-sub mt-0.5">
                      {resolvedPane.status === 'disabled'
                        ? `${resolvedPane.item?.label} is not active in this workspace. Enable a pack or turn on the table in Settings -> Packs.`
                        : 'This workspace route does not match an active pane.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => selectPane('dashboard')}
                      className="px-3 py-1.5 text-xs"
                    >
                      Dashboard
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => selectPane('settings', 'packs')}
                      className="px-3 py-1.5 text-xs"
                    >
                      Manage Packs
                    </Button>
                  </div>
                </div>
              </Card>
            </section>
          ) : (
            <section id="pane-directory-preview" className="max-w-4xl mx-auto my-6">
              <Card className="p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b crm-border pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-info">
                        {workspace?.business_type_label || 'CRM Directory'}
                      </span>
                      <span className="badge badge-neutral num-tabular">
                        {workspace?.active_table_count ?? 17} tables (
                        {workspace?.core_table_count ?? 5} core +{' '}
                        {workspace?.pack_table_count ?? 12} pack)
                      </span>
                      {workspace?.contact_label && workspace.contact_label !== 'Contact' ? (
                        <span className="badge badge-info">
                          Contact: {workspace.contact_label}
                        </span>
                      ) : null}
                    </div>
                    <h1 className="text-xl font-semibold text-main tracking-tight mt-2">
                      {activeEntryLabel}
                    </h1>
                    <p className="text-xs text-sub mt-0.5">
                      Select an active module from the sidebar or manage workspace packs and labels in Settings.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => selectPane('settings', 'packs')}
                      className="px-3 py-1.5 text-xs"
                    >
                      Packs &amp; Tables
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => selectPane('settings', 'workspace')}
                      className="px-3 py-1.5 text-xs"
                    >
                      Workspace Settings
                    </Button>
                  </div>
                </div>

                {resolvedPane.item?.subtabs?.length > 0 ? (
                  <Subtabs
                    tabs={resolvedPane.item.subtabs}
                    activeId={resolvedPane.subtab}
                    onChange={(nextSubtab) => selectPane(resolvedPane.paneId, nextSubtab)}
                    ariaLabel={`${activeEntryLabel} views`}
                  />
                ) : null}

                <FeedbackNotice message={errorMessage} tone="danger" />

                <Card variant="subtle" className="p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-main">
                    {activeSubtabObj
                      ? `${activeEntryLabel} · ${activeSubtabObj.label}`
                      : activeEntryLabel}
                  </div>
                  <p className="text-xs text-sub">
                    This module preview will light up in a future sprint.
                  </p>
                </Card>
              </Card>
            </section>
          )}
          </Suspense>
        </main>
      </div>

      <AuditLogDrawer
        open={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        workspaceSlug={workspace?.slug}
        userTimezone={user?.timezone || 'Africa/Accra'}
        contactLabel={workspace?.contact_label || 'Contact'}
        canManageUsers={canManageUsers}
        refreshKey={auditRefreshKey}
        permissionsRevision={permissionsRevision}
        onInspectRecord={handleOpenLinkedRecord}
        onSessionExpired={onSessionExpired}
      />

      <Modal
        open={logoutModalOpen}
        title="Sign out"
        subtitle={`End your active session in ${workspaceName}?`}
        onClose={() => {
          if (!loggingOut) setLogoutModalOpen(false)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={loggingOut}
              onClick={() => setLogoutModalOpen(false)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true)
                try {
                  await onLogout?.()
                } finally {
                  setLoggingOut(false)
                  setLogoutModalOpen(false)
                }
              }}
              className="px-3 py-1.5 text-xs"
            >
              {loggingOut ? 'Signing out...' : 'Sign out'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-sub">
          You will be signed out of{' '}
          <span className="font-medium text-main">{workspaceName}</span> and
          returned to the sign-in screen.
        </p>
      </Modal>
    </div>
  )
}

