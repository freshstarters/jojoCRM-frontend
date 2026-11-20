export const VISIBILITY_OPTIONS = [
  { value: 'workspace', label: 'Whole workspace' },
  { value: 'role', label: 'One role' },
  { value: 'owner', label: 'Owner only' },
]

export const VISIBILITY_FILTER_OPTIONS = [
  { value: '', label: 'All sharing' },
  { value: 'workspace', label: 'Whole workspace' },
  { value: 'role', label: 'One role' },
  { value: 'owner', label: 'Owner only' },
]

export function formatSharingLabel(record) {
  const vis = record?.visibility || 'workspace'
  if (vis === 'owner') return 'Owner only'
  if (vis === 'role') {
    return record?.shared_role?.name ? `Role: ${record.shared_role.name}` : 'One role'
  }
  return 'Workspace'
}

export function getSharingBadgeClass(visibility) {
  if (visibility === 'owner') return 'badge badge-warn'
  if (visibility === 'role') return 'badge badge-info'
  return 'badge badge-neutral'
}

export function buildAccountSelectOptions(accounts = [], emptyLabel = 'No Account') {
  return [
    { value: '', label: emptyLabel },
    ...accounts.map((acc) => ({
      value: String(acc.id),
      label: acc.name,
    })),
  ]
}

export function buildContactSelectOptions(
  contacts = [],
  selectedAccountId = '',
  emptyLabel = 'No Contact',
) {
  const filtered = selectedAccountId
    ? contacts.filter((con) => !con.account_id || String(con.account_id) === selectedAccountId)
    : contacts
  return [
    { value: '', label: emptyLabel },
    ...filtered.map((con) => ({
      value: String(con.id),
      label: con.account_name ? `${con.name} (${con.account_name})` : con.name,
    })),
  ]
}

export function buildAssigneeSelectOptions(assignees = [], emptyLabel = 'Unassigned') {
  return [
    { value: '', label: emptyLabel },
    ...assignees.map((member) => ({
      value: String(member.id),
      label: `${member.email} (${member.role_name || 'Staff'})`,
    })),
  ]
}

export function syncAccountAndContactPatch(currentForm, nextAccountId, contacts = []) {
  const currentContact = contacts.find((c) => String(c.id) === currentForm.contact_id)
  if (
    currentContact &&
    currentContact.account_id &&
    nextAccountId &&
    String(currentContact.account_id) !== nextAccountId
  ) {
    return { ...currentForm, account_id: nextAccountId, contact_id: '' }
  }
  return { ...currentForm, account_id: nextAccountId }
}

export function syncContactAndAccountPatch(currentForm, nextContactId, contacts = []) {
  const picked = contacts.find((c) => String(c.id) === nextContactId)
  if (picked?.account_id) {
    return {
      ...currentForm,
      contact_id: nextContactId,
      account_id: String(picked.account_id),
    }
  }
  return { ...currentForm, contact_id: nextContactId }
}
