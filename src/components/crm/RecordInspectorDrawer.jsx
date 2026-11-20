import { useState } from 'react'
import { Button } from '../Button.jsx'
import { Drawer } from '../Drawer.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { ActivityTimeline } from './ActivityTimeline.jsx'
import { RecordAuditHistory } from './RecordAuditHistory.jsx'
import { RecordLinksSection } from './RecordLinksSection.jsx'
import { RecordSharingControl, SharingBadge } from './RecordSharingControl.jsx'

export function RecordInspectorDrawer({
  open,
  onClose,
  objectKey,
  objectLabel,
  contactLabel = 'Contact',
  contactPluralLabel = '',
  workspaceSlug,
  userTimezone = 'Africa/Accra',
  assignees = [],
  roles = [],
  permissions,
  record,
  loading = false,
  saving = false,
  deleting = false,
  error = '',
  notice = '',
  canUpdate = false,
  canDelete = false,
  sharingValue = null,
  onSharingChange,
  onSave,
  onDelete,
  onActivityChanged,
  auditRefreshKey = 0,
  onOpenLinkedRecord,
  onSessionExpired,
  badgeText = '',
  badgeClassName = 'badge badge-neutral',
  headerActions = null,
  subtitle = '',
  children,
}) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  async function handleConfirmDelete() {
    const res = await onDelete?.()
    if (res?.ok) {
      setDeleteModalOpen(false)
    } else {
      setDeleteModalOpen(false)
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        variant="default"
        title={record?.display_label || `${objectLabel} Inspector`}
        subtitle={subtitle || (record?.record_code ? `${record.record_code} · ${objectLabel}` : '')}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {record && canDelete ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving || deleting}
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-3 py-1.5 text-xs text-rose-600"
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving || deleting}
                onClick={onClose}
                className="px-3 py-1.5 text-xs"
              >
                Close
              </Button>
              {record && canUpdate ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving || deleting || loading}
                  onClick={onSave}
                  className="px-3 py-1.5 text-xs font-medium"
                >
                  {saving ? 'Saving...' : `Save ${objectLabel.toLowerCase()}`}
                </Button>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {record ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-neutral num-tabular">
                  {record.record_code}
                </span>
                <SharingBadge record={record} />
                {badgeText ? <span className={badgeClassName}>{badgeText}</span> : null}
              </div>
              {headerActions ? (
                <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
              ) : null}
            </div>
          ) : null}

          {!canUpdate && record ? (
            <FeedbackNotice
              tone="info"
              message={`Read-only view: your role does not have update permission for ${objectLabel}.`}
            />
          ) : null}

          <FeedbackNotice tone="danger" message={error} />
          <FeedbackNotice tone="success" message={notice} />

          {loading && !record ? (
            <p className="text-xs text-sub py-4">Loading record details...</p>
          ) : record ? (
            <>
              <div className="space-y-3 text-xs">{children}</div>

              {onSharingChange ? (
                <RecordSharingControl
                  idPrefix={`${objectKey}-inspector-sharing`}
                  visibility={sharingValue?.visibility ?? record.visibility ?? 'workspace'}
                  sharedRoleId={
                    sharingValue?.shared_role_id !== undefined
                      ? sharingValue.shared_role_id
                      : record.shared_role_id
                        ? String(record.shared_role_id)
                        : ''
                  }
                  roles={roles}
                  canManageSharing={Boolean(record.can_manage_sharing)}
                  disabled={!canUpdate || saving}
                  onChange={onSharingChange}
                />
              ) : null}

              <RecordLinksSection
                linkedRecords={record.linked_records}
                contactLabel={contactLabel}
                contactPluralLabel={contactPluralLabel}
                userTimezone={userTimezone}
                onOpenRecord={onOpenLinkedRecord}
              />

              <ActivityTimeline
                workspaceSlug={workspaceSlug}
                objectKey={objectKey}
                recordId={record.id}
                activities={record.activities || []}
                activitiesTotalCount={record.activities_total_count}
                hasMoreActivities={Boolean(record.has_more_activities)}
                activitiesReadable={record.activities_readable !== false}
                assignees={assignees}
                permissions={permissions}
                userTimezone={userTimezone}
                onChanged={onActivityChanged}
                onSessionExpired={onSessionExpired}
              />

              <RecordAuditHistory
                workspaceSlug={workspaceSlug}
                objectKey={objectKey}
                recordId={record.id}
                userTimezone={userTimezone}
                refreshKey={auditRefreshKey}
                onSessionExpired={onSessionExpired}
              />
            </>
          ) : null}
        </div>
      </Drawer>

      <Modal
        open={deleteModalOpen}
        title={`Delete ${objectLabel}?`}
        subtitle={record?.display_label || ''}
        onClose={() => {
          if (!deleting) setDeleteModalOpen(false)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(false)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {deleting ? 'Deleting...' : `Delete ${objectLabel}`}
            </Button>
          </>
        }
      >
        <p className="text-xs text-sub leading-relaxed">
          Delete <span className="font-semibold text-main">{record?.display_label}</span>? Attached activities will be removed, and this action is recorded in the audit log.
        </p>
      </Modal>
    </>
  )
}
