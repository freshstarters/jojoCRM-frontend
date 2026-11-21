import { useMemo, useState } from 'react'
import {
  createRecordActivity,
  deleteCrmRecord,
  filterWritablePayload,
  getFieldRights,
  getObjectRights,
  isFieldHidden,
  isFieldReadOnly,
  updateCrmRecord,
} from '../../service/crmService.js'
import { buildAssigneeSelectOptions } from '../../utils/crmFormOptions.js'
import { formatDateTime, toDateTimeLocalValue } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'
import { Checkbox } from '../Checkbox.jsx'
import { DateTimePicker } from '../DateTimePicker.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Select } from '../Select.jsx'

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
]

const ACTIVITY_BADGE_MAP = {
  note: { label: 'Note', className: 'badge badge-neutral' },
  task: { label: 'Task', className: 'badge badge-warn' },
  call: { label: 'Call', className: 'badge badge-info' },
  meeting: { label: 'Meeting', className: 'badge badge-info' },
}

export function ActivityTimeline({
  workspaceSlug,
  objectKey,
  recordId,
  activities = [],
  activitiesTotalCount = null,
  hasMoreActivities = false,
  activitiesReadable = true,
  assignees = [],
  permissions,
  userTimezone = 'Africa/Accra',
  onChanged,
  onSessionExpired,
}) {
  const activityRights = getObjectRights(permissions, 'activity')
  const activityFieldRights = getFieldRights(permissions, 'activity')
  const hideSummary = isFieldHidden(activityFieldRights, 'summary')
  const hideActivityType = isFieldHidden(activityFieldRights, 'activity_type')
  const hideDueAt = isFieldHidden(activityFieldRights, 'due_at')
  const hideAssignee = isFieldHidden(activityFieldRights, 'assignee')
  const hideCompleted = isFieldHidden(activityFieldRights, 'is_completed')
  const canCreateWithFields =
    activityRights.canCreate &&
    !hideSummary &&
    !isFieldReadOnly(activityFieldRights, 'summary') &&
    !hideActivityType &&
    !isFieldReadOnly(activityFieldRights, 'activity_type')

  const assigneeOptions = useMemo(
    () => buildAssigneeSelectOptions(assignees, 'Unassigned'),
    [assignees],
  )

  const [newType, setNewType] = useState('note')
  const [newSummary, setNewSummary] = useState('')
  const [newDueAt, setNewDueAt] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editType, setEditType] = useState('note')
  const [editSummary, setEditSummary] = useState('')
  const [editDueAt, setEditDueAt] = useState('')
  const [editAssigneeId, setEditAssigneeId] = useState('')
  const [editCompleted, setEditCompleted] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function handleAddActivity(event) {
    event.preventDefault()
    if (!workspaceSlug || !recordId || !activityRights.canCreate) return
    const trimmed = newSummary.trim()
    if (!trimmed) {
      setError('Enter an activity summary before logging.')
      return
    }

    setError('')
    setSavingNew(true)
    try {
      const rawPayload = {
        activity_type: newType,
        summary: trimmed,
        assignee_id: newAssigneeId ? Number(newAssigneeId) : null,
      }
      if (newType !== 'note' && newDueAt) {
        rawPayload.due_at = newDueAt
      }
      const payload = filterWritablePayload(rawPayload, activityFieldRights, {
        assignee_id: 'assignee',
      })
      const { response, data } = await createRecordActivity(
        workspaceSlug,
        objectKey,
        recordId,
        payload,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not log activity.')
        return
      }
      setNewSummary('')
      setNewDueAt('')
      setNewAssigneeId('')
      onChanged?.()
    } catch {
      setError('Unable to reach the server while logging activity.')
    } finally {
      setSavingNew(false)
    }
  }

  function startEditing(act) {
    setError('')
    setEditingId(act.id)
    setEditType(act.activity_type || 'note')
    setEditSummary(act.summary || '')
    setEditDueAt(toDateTimeLocalValue(act.due_at, userTimezone))
    setEditAssigneeId(act.assignee_id ? String(act.assignee_id) : '')
    setEditCompleted(Boolean(act.is_completed))
  }

  async function handleSaveEdit(actId) {
    if (!workspaceSlug || !activityRights.canUpdate) return
    const trimmed = editSummary.trim()
    if (!trimmed) {
      setError('Activity summary cannot be empty.')
      return
    }

    setError('')
    setSavingEdit(true)
    try {
      const rawPayload = {
        activity_type: editType,
        summary: trimmed,
        is_completed: editCompleted,
        assignee_id: editAssigneeId ? Number(editAssigneeId) : null,
        due_at: editType !== 'note' && editDueAt ? editDueAt : null,
      }
      const payload = filterWritablePayload(rawPayload, activityFieldRights, {
        assignee_id: 'assignee',
      })
      const { response, data } = await updateCrmRecord(
        workspaceSlug,
        'activity',
        actId,
        payload,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not update activity.')
        return
      }
      setEditingId(null)
      onChanged?.()
    } catch {
      setError('Unable to reach the server while updating activity.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleToggleTask(act) {
    if (!workspaceSlug || !activityRights.canUpdate) return
    setError('')
    setBusyId(act.id)
    try {
      const { response, data } = await updateCrmRecord(
        workspaceSlug,
        'activity',
        act.id,
        { is_completed: !act.is_completed },
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not update task status.')
        return
      }
      onChanged?.()
    } catch {
      setError('Unable to reach the server while updating task.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteActivity(actId) {
    if (!workspaceSlug || !activityRights.canDelete) return
    setError('')
    setBusyId(actId)
    try {
      const { response, data } = await deleteCrmRecord(
        workspaceSlug,
        'activity',
        actId,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setError(data?.error || 'Could not delete activity.')
        return
      }
      if (editingId === actId) setEditingId(null)
      onChanged?.()
    } catch {
      setError('Unable to reach the server while deleting activity.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3 pt-2 border-t crm-border">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-sub">
          Activity timeline
        </h4>
        <span className="text-[11px] text-sub">Notes, tasks, calls &amp; meetings</span>
      </div>

      <FeedbackNotice tone="danger" message={error} />

      {canCreateWithFields ? (
        <form onSubmit={handleAddActivity} className="space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="w-full sm:w-28 shrink-0">
              <Select
                ariaLabel="Activity type"
                value={newType}
                onChange={setNewType}
                options={ACTIVITY_TYPE_OPTIONS}
                disabled={savingNew}
              />
            </div>
            <input
              type="text"
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Add a note, task, call summary, or meeting..."
              aria-label="Activity summary"
              disabled={savingNew}
              className="crm-input flex-1 px-3 py-1.5 text-xs"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={savingNew}
              className="px-3 py-1.5 text-xs shrink-0"
            >
              {savingNew ? 'Saving...' : 'Log'}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {assignees.length > 0 && !hideAssignee && !isFieldReadOnly(activityFieldRights, 'assignee') ? (
              <Select
                ariaLabel="Activity assignee"
                value={newAssigneeId}
                onChange={setNewAssigneeId}
                options={assigneeOptions}
                disabled={savingNew}
              />
            ) : null}
            {newType !== 'note' && !hideDueAt && !isFieldReadOnly(activityFieldRights, 'due_at') ? (
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`new-activity-due-${objectKey}-${recordId}`}
                  className="text-[11px] text-sub shrink-0"
                >
                  Due:
                </label>
                <div className="flex-1 min-w-0">
                  <DateTimePicker
                    id={`new-activity-due-${objectKey}-${recordId}`}
                    ariaLabel="Activity due date and time"
                    value={newDueAt}
                    onChange={setNewDueAt}
                    disabled={savingNew}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="text-[11px] text-sub">
          Your role cannot log new activities.
        </p>
      )}

      {!activitiesReadable || !activityRights.canRead ? (
        <div className="crm-subtle px-3 py-2.5 text-xs text-sub">
          Your role does not have read permission for activities.
        </div>
      ) : activities.length === 0 ? (
        <div className="crm-subtle px-3 py-2.5 text-xs text-sub">
          No activities yet.
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((act) => {
            const badge = ACTIVITY_BADGE_MAP[act.activity_type] || {
              label: act.activity_type || 'Activity',
              className: 'badge badge-neutral',
            }
            const isEditing = editingId === act.id
            const isTask = act.activity_type === 'task'
            const isBusy = busyId === act.id

            return (
              <div key={act.id} className="crm-subtle p-3 space-y-2 text-xs">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        ariaLabel="Edit activity type"
                        value={editType}
                        onChange={setEditType}
                        options={ACTIVITY_TYPE_OPTIONS}
                        disabled={savingEdit}
                      />
                      {editType !== 'note' ? (
                        <DateTimePicker
                          ariaLabel="Edit activity due date and time"
                          value={editDueAt}
                          onChange={setEditDueAt}
                          disabled={savingEdit}
                        />
                      ) : null}
                    </div>
                    {assignees.length > 0 ? (
                      <Select
                        ariaLabel="Edit activity assignee"
                        value={editAssigneeId}
                        onChange={setEditAssigneeId}
                        options={assigneeOptions}
                        disabled={savingEdit}
                      />
                    ) : null}
                    <textarea
                      rows={2}
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      disabled={savingEdit}
                      className="crm-input w-full px-2.5 py-1.5 text-xs"
                    />
                    {editType === 'task' ? (
                      <Checkbox
                        checked={editCompleted}
                        onChange={(e) => setEditCompleted(e.target.checked)}
                        disabled={savingEdit}
                        label="Mark task completed"
                        className="text-xs text-main"
                      />
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={savingEdit}
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-[11px]"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(act.id)}
                        className="px-2.5 py-1 text-[11px]"
                      >
                        {savingEdit ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={
                            isTask && act.is_completed
                              ? 'badge badge-success'
                              : badge.className
                          }
                        >
                          {isTask && act.is_completed ? 'Task · Done' : badge.label}
                        </span>
                        {act.created_by?.email ? (
                          <span className="text-[11px] text-sub">
                            {act.created_by.email}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-sub num-tabular">
                        {formatDateTime(act.created_at, userTimezone)}
                      </span>
                    </div>

                    <p
                      className={`text-main leading-relaxed ${
                        isTask && act.is_completed ? 'line-through opacity-70' : ''
                      }`}
                    >
                      {act.summary ?? act.display_label}
                    </p>

                    {act.due_at || act.assignee?.email ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sub num-tabular">
                        {act.due_at ? (
                          <span>
                            Scheduled: {formatDateTime(act.due_at, userTimezone)}
                          </span>
                        ) : null}
                        {act.assignee?.email ? (
                          <span>Assignee: {act.assignee.email}</span>
                        ) : null}
                      </div>
                    ) : null}

                    {(activityRights.canUpdate || activityRights.canDelete) ? (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                        {isTask && activityRights.canUpdate && !hideCompleted && !isFieldReadOnly(activityFieldRights, 'is_completed') ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => handleToggleTask(act)}
                            className="px-2 py-0.5 text-[11px]"
                          >
                            {act.is_completed ? 'Reopen' : 'Complete'}
                          </Button>
                        ) : null}
                        {activityRights.canUpdate ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => startEditing(act)}
                            className="px-2 py-0.5 text-[11px]"
                          >
                            Edit
                          </Button>
                        ) : null}
                        {activityRights.canDelete ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => handleDeleteActivity(act.id)}
                            className="px-2 py-0.5 text-[11px] text-rose-600"
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}
          {hasMoreActivities ? (
            <div className="crm-subtle px-3 py-2 text-[11px] text-sub">
              Showing latest {activities.length} of {activitiesTotalCount} activities.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
