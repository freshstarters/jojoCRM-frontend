import { useState } from 'react'
import { apiPatch } from '../utils/api.js'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { FeedbackNotice } from './FeedbackNotice.jsx'
import { Select } from './Select.jsx'

const CONTACT_PRESETS = [
  { value: 'Contact', label: 'Contact (Default)' },
  { value: 'Patient', label: 'Patient (Healthcare)' },
  { value: 'Student or Guardian', label: 'Student or Guardian (Education)' },
  { value: 'Donor or Member', label: 'Donor or Member (Nonprofit / Faith)' },
  { value: '__custom__', label: 'Custom label...' },
]

const PRESET_VALUES = new Set([
  'Contact',
  'Patient',
  'Student or Guardian',
  'Donor or Member',
])

export function SettingsWorkspaceSection({
  workspace,
  permissions,
  onWorkspaceUpdated,
  onAuditRecorded,
  onSessionExpired,
}) {
  const canEdit = Boolean(permissions?.can_manage_workspace_profile ?? permissions?.is_owner)
  const currentBtLabel = workspace?.business_type_label || ''
  const currentContactLabel = workspace?.contact_label || 'Contact'

  const [draftBtLabel, setDraftBtLabel] = useState(null)
  const [draftContactChoice, setDraftContactChoice] = useState(null)
  const [draftCustomContact, setDraftCustomContact] = useState(null)

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const effectiveBtLabel = draftBtLabel ?? currentBtLabel
  const defaultSelectChoice = PRESET_VALUES.has(currentContactLabel)
    ? currentContactLabel
    : '__custom__'
  const effectiveSelectChoice = draftContactChoice ?? defaultSelectChoice
  const effectiveCustomContact =
    draftCustomContact ?? (PRESET_VALUES.has(currentContactLabel) ? '' : currentContactLabel)

  const resolvedContactLabel =
    effectiveSelectChoice === '__custom__'
      ? effectiveCustomContact
      : effectiveSelectChoice

  async function submitWorkspaceUpdate(payload, successFallback) {
    if (!workspace?.slug) return
    setErrorMessage('')
    setStatusMessage('')
    setSaving(true)
    try {
      const { response, data } = await apiPatch(
        `/api/v1/workspaces/${encodeURIComponent(workspace.slug)}/`,
        payload,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setErrorMessage(data?.error || 'Could not update workspace labels.')
        return
      }
      setDraftBtLabel(null)
      setDraftContactChoice(null)
      setDraftCustomContact(null)
      onWorkspaceUpdated?.(data)
      if (data?.changed) {
        onAuditRecorded?.()
      }
      setStatusMessage(data?.message || successFallback)
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canEdit) return

    const trimmedBt = effectiveBtLabel.trim()
    const trimmedContact = resolvedContactLabel.trim()
    if (!trimmedBt) {
      setErrorMessage('Business-type label cannot be empty.')
      return
    }
    if (!trimmedContact) {
      setErrorMessage('Contact screen label cannot be empty.')
      return
    }

    await submitWorkspaceUpdate(
      {
        business_type_label: trimmedBt,
        contact_label: trimmedContact,
      },
      'Workspace labels updated.',
    )
  }

  async function handleResetContactLabel() {
    if (!canEdit) return
    await submitWorkspaceUpdate(
      { reset_contact_label: true },
      'Contact label reset to primary business-type default.',
    )
  }

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b crm-border pb-3">
          <div>
            <h2 className="text-base font-semibold text-main">Workspace profile</h2>
            <p className="text-xs text-sub mt-0.5">
              Business type, active tables, and Ghana signup verification for {workspace?.name}.
            </p>
          </div>
          <span className="badge badge-success">Ghana connection verified</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="crm-subtle p-3 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-sub block">
              Workspace name
            </span>
            <span className="font-semibold text-main block truncate">
              {workspace?.name}
            </span>
          </div>
          <div className="crm-subtle p-3 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-sub block">
              URL slug
            </span>
            <span className="font-semibold text-main num-tabular block truncate">
              /{workspace?.slug}
            </span>
          </div>
          <div className="crm-subtle p-3 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-sub block">
              Active tables
            </span>
            <span className="font-semibold text-main num-tabular block">
              {workspace?.active_table_count ?? 17} tables (
              {workspace?.core_table_count ?? 5} core +{' '}
              {workspace?.pack_table_count ?? 12} pack)
            </span>
          </div>
          <div className="crm-subtle p-3 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-sub block">
              Contact label
            </span>
            <span className="font-semibold text-main block truncate">
              {workspace?.contact_label || 'Contact'} ({workspace?.contact_plural_label || 'Contacts'})
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b crm-border pb-3">
          <div>
            <h2 className="text-base font-semibold text-main">
              Business-type & Contact labels
            </h2>
            <p className="text-xs text-sub mt-0.5">
              Rename how your workspace labels its business type and Contact records on screen. The stored CRM object remains Contact.
            </p>
          </div>
          <span className="badge badge-info">{workspace?.business_type_label}</span>
        </div>

        {!canEdit && (
          <FeedbackNotice
            tone="info"
            message="Only the workspace Owner or a role with Users & Roles or Theme & Layouts access can rename workspace labels."
          />
        )}

        <FeedbackNotice tone="danger" message={errorMessage} />
        <FeedbackNotice tone="success" message={statusMessage} />

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="businessTypeLabelInput"
                className="block font-medium text-main"
              >
                Business-type label
              </label>
              <input
                id="businessTypeLabelInput"
                name="business_type_label"
                type="text"
                maxLength={150}
                required
                disabled={!canEdit || saving}
                value={effectiveBtLabel}
                onChange={(event) => setDraftBtLabel(event.target.value)}
                placeholder="e.g. Outpatient Clinic or General services"
                className="crm-input w-full px-3 py-2"
              />
              <p className="text-[11px] text-sub">
                Renaming the label does not alter your active packs or stored records.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="contactLabelSelect"
                className="block font-medium text-main"
              >
                Contact screen label
              </label>
              <Select
                id="contactLabelSelect"
                ariaLabel="Contact screen label"
                value={effectiveSelectChoice}
                onChange={(nextChoice) => {
                  setDraftContactChoice(nextChoice)
                  if (nextChoice !== '__custom__') {
                    setDraftCustomContact('')
                  }
                }}
                options={CONTACT_PRESETS}
                disabled={!canEdit || saving}
              />
              {effectiveSelectChoice === '__custom__' && (
                <input
                  id="customContactLabelInput"
                  name="contact_label"
                  type="text"
                  maxLength={80}
                  required
                  disabled={!canEdit || saving}
                  value={effectiveCustomContact}
                  onChange={(event) => setDraftCustomContact(event.target.value)}
                  placeholder="Enter custom label (e.g. Client)"
                  className="crm-input w-full px-3 py-2 mt-2"
                />
              )}
              <p className="text-[11px] text-sub">
                Primary pack default stays intact when adding other packs unless changed here.
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={handleResetContactLabel}
                className="px-3 py-1.5 text-xs"
              >
                Reset Contact label
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                className="px-4 py-1.5 text-xs font-medium"
              >
                {saving ? 'Saving...' : 'Save labels'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}
