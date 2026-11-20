import { useEffect, useMemo, useState } from 'react'
import {
  convertLeadRecord,
  fetchLeadConversionPreview,
  isFieldHidden,
  isFieldReadOnly,
  listCrmRecords,
} from '../../service/crmService.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { Select } from '../Select.jsx'
import { FieldLabel } from './FieldLabel.jsx'
import { RecordRelationPicker } from './RecordRelationPicker.jsx'

const FALLBACK_STAGE_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Proposal', label: 'Proposal' },
  { value: 'Won', label: 'Won' },
  { value: 'Lost', label: 'Lost' },
]

function normalizeContactOption(item) {
  if (!item) return null
  return {
    id: item.id,
    record_code: item.record_code,
    name: item.name || item.display_label || '',
    title: item.title || '',
    email: item.email || '',
    phone: item.phone || '',
    account_id: item.account_id ?? item.account?.id ?? null,
    account_name: item.account_name || item.account?.name || '',
    match_reasons: item.match_reasons || [],
  }
}

function normalizeAccountOption(item) {
  if (!item) return null
  return {
    id: item.id,
    record_code: item.record_code,
    name: item.name || item.display_label || '',
    city: item.city || '',
    email: item.email || '',
    phone: item.phone || '',
    match_reasons: item.match_reasons || [],
  }
}

function ConvertLeadModalContent({
  onClose,
  workspaceSlug,
  contactLabel = 'Contact',
  initialLead = null,
  onConverted,
  onSessionExpired,
}) {
  const [selectedLeadId, setSelectedLeadId] = useState(() =>
    initialLead?.id ? String(initialLead.id) : '',
  )
  const [pickedLeadsById, setPickedLeadsById] = useState(() =>
    initialLead?.id ? { [String(initialLead.id)]: initialLead } : {},
  )
  const [initialLeadsFetched, setInitialLeadsFetched] = useState(Boolean(initialLead?.id))

  const [completedPreviewKey, setCompletedPreviewKey] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [previewError, setPreviewError] = useState('')

  const [accountMode, setAccountMode] = useState('create')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [pickedAccountsById, setPickedAccountsById] = useState({})
  const [accountName, setAccountName] = useState(
    () => (initialLead?.company || '').trim() || initialLead?.name || '',
  )
  const [accountCity, setAccountCity] = useState('')

  const [contactMode, setContactMode] = useState('create')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [pickedContactsById, setPickedContactsById] = useState({})
  const [contactName, setContactName] = useState(() => initialLead?.name || '')
  const [contactTitle, setContactTitle] = useState('')

  const [dealTitle, setDealTitle] = useState(() => {
    const base = (initialLead?.company || '').trim() || initialLead?.name || ''
    return base ? `${base} Deal` : ''
  })
  const [dealTitleDirty, setDealTitleDirty] = useState(false)
  const [dealAmount, setDealAmount] = useState('0.00')
  const [dealStage, setDealStage] = useState('Qualified')
  const [targetCloseDate, setTargetCloseDate] = useState('')
  const [winProbability, setWinProbability] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // When opened without a pre-selected lead (e.g. from Deals pane), pre-select the first open lead.
  useEffect(() => {
    if (initialLeadsFetched || !workspaceSlug) return undefined
    let cancelled = false

    listCrmRecords(workspaceSlug, 'lead', { page: 1, page_size: 25 })
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setPreviewError(data?.error || 'Could not load leads.')
          return
        }
        const fetched = Array.isArray(data?.results) ? data.results : []
        if (fetched.length > 0) {
          const firstOpen = fetched.find((row) => row.status === 'open') || fetched[0]
          setPickedLeadsById((prev) => ({ ...prev, [String(firstOpen.id)]: firstOpen }))
          setSelectedLeadId((prev) => prev || String(firstOpen.id))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError('Network error while loading leads.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitialLeadsFetched(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [initialLeadsFetched, workspaceSlug, onSessionExpired])

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null
    return (
      (previewData?.lead && String(previewData.lead.id) === selectedLeadId
        ? previewData.lead
        : null) ||
      pickedLeadsById[selectedLeadId] ||
      (initialLead && String(initialLead.id) === selectedLeadId ? initialLead : null)
    )
  }, [selectedLeadId, previewData?.lead, pickedLeadsById, initialLead])

  const previewRequestKey =
    workspaceSlug && selectedLeadId ? `${workspaceSlug}:${selectedLeadId}` : ''
  const previewLoading = Boolean(
    previewRequestKey && completedPreviewKey !== previewRequestKey,
  )

  useEffect(() => {
    if (!previewRequestKey) return undefined
    let cancelled = false
    const activeKey = previewRequestKey

    fetchLeadConversionPreview(workspaceSlug, Number(selectedLeadId))
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setPreviewData(null)
          setPreviewError(data?.error || 'Could not load conversion preview.')
          return
        }
        setPreviewError('')
        setPreviewData(data)
        const defaults = data?.defaults || {}
        const caps = data?.capabilities || {}
        const nextAccName = defaults.account_name || ''
        const canCreateAcc = caps.can_create_account !== false
        const canReuseAcc = Boolean(caps.can_reuse_account)
        const defaultAccMode = !canCreateAcc && canReuseAcc ? 'reuse' : 'create'
        const firstAccMatch = data?.account_matches?.[0] || null

        const canCreateCon = caps.can_create_contact !== false
        const canReuseCon = Boolean(caps.can_reuse_contact)
        const defaultConMode = !canCreateCon && canReuseCon ? 'reuse' : 'create'
        const canUpdateCon = caps.can_update_contact !== false
        const firstConMatch =
          (!canUpdateCon && Array.isArray(data?.contact_matches)
            ? data.contact_matches.find((c) => Boolean(c.account_id))
            : null) ||
          data?.contact_matches?.[0] ||
          null
        const lockedByConAccId =
          defaultConMode === 'reuse' && firstConMatch?.account_id
            ? String(firstConMatch.account_id)
            : ''
        const resolvedAccMode = lockedByConAccId ? 'reuse' : defaultAccMode

        setAccountMode(resolvedAccMode)
        setSelectedAccountId(
          lockedByConAccId || (firstAccMatch?.id ? String(firstAccMatch.id) : ''),
        )
        setAccountName(nextAccName)
        setAccountCity(defaults.account_city || '')

        setContactMode(defaultConMode)
        setSelectedContactId(firstConMatch?.id ? String(firstConMatch.id) : '')
        setContactName(defaults.contact_name || '')
        setContactTitle(defaults.contact_title || '')

        const resolvedDealAccountTitle =
          (lockedByConAccId && firstConMatch?.account_name) ||
          (resolvedAccMode === 'reuse' && firstAccMatch?.name) ||
          nextAccName
        setDealTitle(
          lockedByConAccId || resolvedAccMode === 'reuse'
            ? resolvedDealAccountTitle
              ? `${resolvedDealAccountTitle} Deal`
              : ''
            : defaults.deal_title || (nextAccName ? `${nextAccName} Deal` : ''),
        )
        setDealTitleDirty(false)
        setDealAmount(defaults.deal_amount || '0.00')
        const firstServerStage = data?.deal_stages?.[0]
        const firstStageName =
          typeof firstServerStage === 'string'
            ? firstServerStage
            : firstServerStage?.name || ''
        setDealStage(defaults.deal_stage || firstStageName || 'Qualified')
        setTargetCloseDate(defaults.target_close_date || '')
        setWinProbability(
          defaults.win_probability !== null && defaults.win_probability !== undefined
            ? String(defaults.win_probability)
            : '',
        )
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError('Network error while checking matching records.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedPreviewKey(activeKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [previewRequestKey, workspaceSlug, selectedLeadId, onSessionExpired])

  const accountMatches = useMemo(
    () => (previewData?.account_matches || []).map(normalizeAccountOption),
    [previewData?.account_matches],
  )
  const contactMatches = useMemo(
    () => (previewData?.contact_matches || []).map(normalizeContactOption),
    [previewData?.contact_matches],
  )

  const selectedReusedContact = useMemo(() => {
    if (contactMode !== 'reuse' || !selectedContactId) return null
    return (
      pickedContactsById[selectedContactId] ||
      contactMatches.find((c) => String(c.id) === selectedContactId) ||
      null
    )
  }, [contactMode, selectedContactId, pickedContactsById, contactMatches])

  const lockedAccountId = selectedReusedContact?.account_id
    ? String(selectedReusedContact.account_id)
    : ''

  const effectiveAccountMode = lockedAccountId ? 'reuse' : accountMode
  const effectiveAccountId = lockedAccountId || selectedAccountId

  const selectedReusedAccount = useMemo(() => {
    if (effectiveAccountMode !== 'reuse' || !effectiveAccountId) return null
    const fromCache =
      pickedAccountsById[effectiveAccountId] ||
      accountMatches.find((a) => String(a.id) === effectiveAccountId)
    if (fromCache) return fromCache
    if (lockedAccountId && selectedReusedContact) {
      return {
        id: Number(lockedAccountId),
        name: selectedReusedContact.account_name || `Account #${lockedAccountId}`,
        city: '',
        match_reasons: [`Linked to ${selectedReusedContact.name}`],
      }
    }
    return null
  }, [
    effectiveAccountMode,
    effectiveAccountId,
    pickedAccountsById,
    accountMatches,
    lockedAccountId,
    selectedReusedContact,
  ])

  function syncDefaultDealTitle(nextAccName) {
    if (!dealTitleDirty && nextAccName) {
      setDealTitle(`${nextAccName} Deal`)
    }
  }

  function handleAccountSelect(nextId, pickedRecord = null) {
    setSelectedAccountId(nextId)
    const normalized = pickedRecord ? normalizeAccountOption(pickedRecord) : null
    if (normalized?.id) {
      setPickedAccountsById((prev) => ({ ...prev, [String(normalized.id)]: normalized }))
    }
    const found =
      normalized ||
      pickedAccountsById[nextId] ||
      accountMatches.find((a) => String(a.id) === nextId)
    if (found?.name) {
      syncDefaultDealTitle(found.name)
    }
  }

  function handleContactSelect(nextId, pickedRecord = null) {
    setSelectedContactId(nextId)
    const normalized = pickedRecord ? normalizeContactOption(pickedRecord) : null
    if (normalized?.id) {
      setPickedContactsById((prev) => ({ ...prev, [String(normalized.id)]: normalized }))
    }
    const found =
      normalized ||
      pickedContactsById[nextId] ||
      contactMatches.find((c) => String(c.id) === nextId)
    if (found?.account_id) {
      setAccountMode('reuse')
      const linkedAccId = String(found.account_id)
      setSelectedAccountId(linkedAccId)
      if (found.account_name) {
        setPickedAccountsById((prev) => ({
          ...prev,
          [linkedAccId]: {
            id: Number(found.account_id),
            name: found.account_name,
            city: '',
            match_reasons: [],
          },
        }))
        syncDefaultDealTitle(found.account_name)
      }
    }
  }

  const stageOptions = useMemo(() => {
    const rawStages = previewData?.deal_stages
    if (Array.isArray(rawStages) && rawStages.length > 0) {
      return rawStages.map((stage) => {
        const name = typeof stage === 'string' ? stage : stage.name
        return { value: name, label: name }
      })
    }
    return FALLBACK_STAGE_OPTIONS
  }, [previewData?.deal_stages])

  const canUpdateContact = previewData?.capabilities?.can_update_contact !== false
  const canLinkStandaloneContact =
    previewData?.capabilities?.can_link_standalone_contact !== undefined
      ? Boolean(previewData.capabilities.can_link_standalone_contact)
      : canUpdateContact
  const capabilities = previewData?.capabilities || {}
  const accountFieldRights = previewData?.field_rights?.account || {}
  const contactFieldRights = previewData?.field_rights?.contact || {}
  const dealFieldRights = previewData?.field_rights?.deal || {}

  const hideAccName = isFieldHidden(accountFieldRights, 'name')
  const roAccName = isFieldReadOnly(accountFieldRights, 'name')
  const hideAccCity = isFieldHidden(accountFieldRights, 'city')
  const roAccCity = isFieldReadOnly(accountFieldRights, 'city')

  const hideConName = isFieldHidden(contactFieldRights, 'name')
  const roConName = isFieldReadOnly(contactFieldRights, 'name')
  const hideConTitle = isFieldHidden(contactFieldRights, 'title')
  const roConTitle = isFieldReadOnly(contactFieldRights, 'title')

  const hideDealTitle = isFieldHidden(dealFieldRights, 'title')
  const roDealTitle = isFieldReadOnly(dealFieldRights, 'title')
  const hideDealAmount = isFieldHidden(dealFieldRights, 'amount')
  const roDealAmount = isFieldReadOnly(dealFieldRights, 'amount')
  const hideDealStage = isFieldHidden(dealFieldRights, 'stage')
  const roDealStage = isFieldReadOnly(dealFieldRights, 'stage')
  const hideDealClose = isFieldHidden(dealFieldRights, 'target_close_date')
  const roDealClose = isFieldReadOnly(dealFieldRights, 'target_close_date')
  const hideDealProb = isFieldHidden(dealFieldRights, 'win_probability')
  const roDealProb = isFieldReadOnly(dealFieldRights, 'win_probability')

  const isConverted = Boolean(
    previewData?.already_converted || selectedLead?.status === 'converted',
  )
  const cannotLinkStandaloneContact = Boolean(
    !isConverted &&
      contactMode === 'reuse' &&
      selectedReusedContact &&
      !selectedReusedContact.account_id &&
      !canLinkStandaloneContact,
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedLeadId || !workspaceSlug) return
    setSubmitError('')

    if (!isConverted) {
      if (effectiveAccountMode === 'create' && !hideAccName && !roAccName && !accountName.trim()) {
        setSubmitError('Account name is required when creating a new Account.')
        return
      }
      if (effectiveAccountMode === 'reuse' && !effectiveAccountId) {
        setSubmitError('Select an existing Account to reuse or switch to Create new.')
        return
      }
      if (contactMode === 'create' && !hideConName && !roConName && !contactName.trim()) {
        setSubmitError(
          `${contactLabel} name is required when creating a new ${contactLabel}.`,
        )
        return
      }
      if (contactMode === 'reuse' && !selectedContactId) {
        setSubmitError(
          `Select an existing ${contactLabel} to reuse or switch to Create new.`,
        )
        return
      }
      if (cannotLinkStandaloneContact) {
        setSubmitError(
          `Your role cannot link standalone ${contactLabel} "${selectedReusedContact.name}" to an Account. Select a ${contactLabel} already on an Account or create a new one.`,
        )
        return
      }
      if (!hideDealTitle && !roDealTitle && !dealTitle.trim()) {
        setSubmitError('Deal title is required.')
        return
      }
    }

    const payload = {}
    if (effectiveAccountMode === 'reuse') {
      payload.account_id = Number(effectiveAccountId)
    } else {
      if (!hideAccName && !roAccName) {
        payload.account_name = accountName.trim()
      }
      if (!hideAccCity && !roAccCity) {
        payload.account_city = accountCity.trim()
      }
    }

    if (contactMode === 'reuse') {
      payload.contact_id = Number(selectedContactId)
    } else {
      if (!hideConName && !roConName) {
        payload.contact_name = contactName.trim()
      }
      if (!hideConTitle && !roConTitle) {
        payload.contact_title = contactTitle.trim()
      }
    }

    if (!hideDealTitle && !roDealTitle && dealTitle.trim()) {
      payload.deal_title = dealTitle.trim()
    }
    if (!hideDealAmount && !roDealAmount) {
      payload.deal_amount = dealAmount === '' ? '0.00' : dealAmount
    }
    if (!hideDealStage && !roDealStage) {
      const nextStage = dealStage || stageOptions[0]?.value
      if (nextStage) payload.deal_stage = nextStage
    }
    if (!hideDealClose && !roDealClose) {
      payload.target_close_date = targetCloseDate || null
    }
    if (!hideDealProb && !roDealProb) {
      payload.win_probability = winProbability === '' ? null : Number(winProbability)
    }

    setSubmitting(true)
    try {
      const { response, data } = await convertLeadRecord(
        workspaceSlug,
        Number(selectedLeadId),
        payload,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setSubmitError(data?.error || 'Could not convert lead.')
        return
      }
      onConverted?.(data)
      onClose?.()
    } catch {
      setSubmitError('Network error while converting lead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!submitting) onClose?.()
      }}
      maxWidthClass="max-w-lg"
      title="Convert Lead to Deal"
      subtitle={`Create or link an Account, ${contactLabel}, and Deal from an open lead. Converted leads remain on record.`}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => onClose?.()}
            className="px-3 py-1.5 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="convert-lead-form"
            variant="primary"
            disabled={
              submitting ||
              !selectedLeadId ||
              previewLoading ||
              (previewData && capabilities.can_convert_lead === false)
            }
            className="px-3 py-1.5 text-xs font-semibold"
          >
            {submitting ? 'Converting...' : 'Convert Lead'}
          </Button>
        </>
      }
    >
      <form
        id="convert-lead-form"
        onSubmit={handleSubmit}
        className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1"
      >
        <FeedbackNotice tone="danger" message={submitError || previewError} />

        {/* Server-backed searchable & paginated Lead picker */}
        <div className="space-y-1.5">
          <label htmlFor="convert-lead-select" className="block font-medium text-body">
            Select Lead
          </label>
          <RecordRelationPicker
            id="convert-lead-select"
            ariaLabel="Select lead to convert"
            workspaceSlug={workspaceSlug}
            objectKey="lead"
            objectPluralLabel="Leads"
            value={selectedLeadId}
            selectedRecord={selectedLead}
            allowEmpty={false}
            placeholder={!initialLeadsFetched ? 'Loading leads...' : 'Search or pick a Lead...'}
            searchPlaceholder="Search all workspace Leads..."
            getOptionLabel={(lead) =>
              `${lead.name || lead.display_label}${lead.company ? ` — ${lead.company}` : ''}`
            }
            getOptionMeta={(lead) => [lead.email, lead.phone].filter(Boolean).join(' · ')}
            getOptionBadge={(lead) => ({
              label: lead.status === 'converted' ? 'Converted' : 'Open',
              className: lead.status === 'converted' ? 'badge badge-danger' : 'badge badge-success',
            })}
            onChange={(val, rec) => {
              setSubmitError('')
              if (rec?.id) {
                setPickedLeadsById((prev) => ({ ...prev, [String(rec.id)]: rec }))
              }
              setSelectedLeadId(val)
            }}
            disabled={submitting}
            onSessionExpired={onSessionExpired}
          />
        </div>

        {selectedLead ? (
          <div className="crm-subtle p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-main truncate">
                {selectedLead.company || selectedLead.name}
              </span>
              <span
                className={`badge ${
                  isConverted ? 'badge-danger' : 'badge-success'
                } shrink-0`}
              >
                {isConverted ? 'Already Converted' : 'Open for Conversion'}
              </span>
            </div>
            <div className="text-sub">
              {[selectedLead.name, selectedLead.email, selectedLead.phone]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {selectedLead.notes ? (
              <p className="text-body pt-0.5 line-clamp-2">{selectedLead.notes}</p>
            ) : null}
          </div>
        ) : null}

        {previewLoading ? (
          <p className="text-sub py-2">Checking workspace matches...</p>
        ) : null}

        {previewData && capabilities.can_convert_lead === false ? (
          <FeedbackNotice
            tone="info"
            message="Your current role lacks the permissions needed to convert leads."
          />
        ) : null}

        {selectedLead && !previewLoading ? (
          <>
            {/* Account section */}
            <div className="space-y-2 pt-2 border-t crm-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-main">Account</span>
                  {accountMatches.length > 0 ? (
                    <span className="ml-2 badge badge-info">
                      {accountMatches.length}{' '}
                      {accountMatches.length === 1 ? 'match found' : 'matches found'}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={effectiveAccountMode === 'create' ? 'primary' : 'secondary'}
                    disabled={
                      submitting ||
                      Boolean(lockedAccountId) ||
                      capabilities.can_create_account === false
                    }
                    onClick={() => {
                      setAccountMode('create')
                      syncDefaultDealTitle(accountName)
                    }}
                    className="px-2.5 py-1 text-[11px]"
                  >
                    Create new
                  </Button>
                  <Button
                    type="button"
                    variant={effectiveAccountMode === 'reuse' ? 'primary' : 'secondary'}
                    disabled={submitting || capabilities.can_reuse_account === false}
                    onClick={() => {
                      setAccountMode('reuse')
                      if (selectedReusedAccount?.name) {
                        syncDefaultDealTitle(selectedReusedAccount.name)
                      }
                    }}
                    className="px-2.5 py-1 text-[11px]"
                  >
                    Reuse existing
                  </Button>
                </div>
              </div>

              {lockedAccountId ? (
                <FeedbackNotice
                  tone="info"
                  message={`Locked to ${
                    selectedReusedContact?.account_name || 'linked Account'
                  } because ${selectedReusedContact?.name} already belongs to that Account.`}
                />
              ) : null}

              {effectiveAccountMode === 'create' ? (
                !hideAccName || !hideAccCity ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {!hideAccName ? (
                      <div className="space-y-1">
                        <FieldLabel
                          htmlFor="convert-account-name"
                          label="Account Name"
                          readOnly={roAccName}
                        />
                        <input
                          id="convert-account-name"
                          type="text"
                          value={accountName}
                          disabled={submitting || roAccName}
                          onChange={(e) => {
                            setAccountName(e.target.value)
                            syncDefaultDealTitle(e.target.value)
                          }}
                          placeholder="e.g. Volta Aluminum Co"
                          className="crm-input w-full px-3 py-2"
                        />
                      </div>
                    ) : null}
                    {!hideAccCity ? (
                      <div className="space-y-1">
                        <FieldLabel
                          htmlFor="convert-account-city"
                          label="City"
                          readOnly={roAccCity}
                        />
                        <input
                          id="convert-account-city"
                          type="text"
                          value={accountCity}
                          disabled={submitting || roAccCity}
                          onChange={(e) => setAccountCity(e.target.value)}
                          placeholder="e.g. Accra"
                          className="crm-input w-full px-3 py-2"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sub">
                    Account fields are hidden for your role; defaults from the lead will be applied.
                  </p>
                )
              ) : (
                <RecordRelationPicker
                  id="convert-account-reuse"
                  ariaLabel="Reuse existing Account"
                  workspaceSlug={workspaceSlug}
                  objectKey="account"
                  objectPluralLabel="Accounts"
                  value={effectiveAccountId}
                  selectedRecord={selectedReusedAccount}
                  suggestedItems={accountMatches}
                  suggestedHeading="Suggested matches"
                  allowEmpty={false}
                  placeholder="Search or pick an existing Account..."
                  searchPlaceholder="Search all workspace Accounts..."
                  getOptionLabel={(acc) =>
                    `${acc.name || acc.display_label}${acc.city ? ` (${acc.city})` : ''}`
                  }
                  getOptionMeta={(acc) =>
                    [
                      acc.match_reasons?.length ? `Match: ${acc.match_reasons.join(', ')}` : '',
                      acc.email,
                      acc.phone,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  onChange={handleAccountSelect}
                  disabled={submitting || Boolean(lockedAccountId)}
                  onSessionExpired={onSessionExpired}
                />
              )}
            </div>

            {/* Contact section */}
            <div className="space-y-2 pt-2 border-t crm-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-main">{contactLabel}</span>
                  {contactMatches.length > 0 ? (
                    <span className="ml-2 badge badge-info">
                      {contactMatches.length}{' '}
                      {contactMatches.length === 1 ? 'match found' : 'matches found'}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={contactMode === 'create' ? 'primary' : 'secondary'}
                    disabled={submitting || capabilities.can_create_contact === false}
                    onClick={() => setContactMode('create')}
                    className="px-2.5 py-1 text-[11px]"
                  >
                    Create new
                  </Button>
                  <Button
                    type="button"
                    variant={contactMode === 'reuse' ? 'primary' : 'secondary'}
                    disabled={submitting || capabilities.can_reuse_contact === false}
                    onClick={() => {
                      setContactMode('reuse')
                      if (selectedContactId) {
                        handleContactSelect(selectedContactId)
                      }
                    }}
                    className="px-2.5 py-1 text-[11px]"
                  >
                    Reuse existing
                  </Button>
                </div>
              </div>

              {contactMode === 'create' ? (
                !hideConName || !hideConTitle ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {!hideConName ? (
                      <div className="space-y-1">
                        <FieldLabel
                          htmlFor="convert-contact-name"
                          label={`${contactLabel} Name`}
                          readOnly={roConName}
                        />
                        <input
                          id="convert-contact-name"
                          type="text"
                          value={contactName}
                          disabled={submitting || roConName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="e.g. Abena Koranteng"
                          className="crm-input w-full px-3 py-2"
                        />
                      </div>
                    ) : null}
                    {!hideConTitle ? (
                      <div className="space-y-1">
                        <FieldLabel
                          htmlFor="convert-contact-title"
                          label="Title"
                          readOnly={roConTitle}
                        />
                        <input
                          id="convert-contact-title"
                          type="text"
                          value={contactTitle}
                          disabled={submitting || roConTitle}
                          onChange={(e) => setContactTitle(e.target.value)}
                          placeholder="e.g. Operations Lead"
                          className="crm-input w-full px-3 py-2"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sub">
                    {contactLabel} fields are hidden for your role; defaults from the lead will be applied.
                  </p>
                )
              ) : (
                <div className="space-y-2">
                  <RecordRelationPicker
                    id="convert-contact-reuse"
                    ariaLabel={`Reuse existing ${contactLabel}`}
                    workspaceSlug={workspaceSlug}
                    objectKey="contact"
                    objectPluralLabel={`${contactLabel}s`}
                    value={selectedContactId}
                    selectedRecord={selectedReusedContact}
                    suggestedItems={contactMatches}
                    suggestedHeading="Suggested matches"
                    extraParams={
                      effectiveAccountMode === 'reuse' && effectiveAccountId
                        ? { compatible_account_id: effectiveAccountId }
                        : undefined
                    }
                    allowEmpty={false}
                    placeholder={`Search or pick an existing ${contactLabel}...`}
                    searchPlaceholder={`Search all workspace ${contactLabel}s...`}
                    getOptionLabel={(con) => {
                      const accName = con.account?.name || con.account_name
                      return `${con.name || con.display_label}${
                        accName ? ` (${accName})` : ' (Standalone)'
                      }`
                    }}
                    getOptionMeta={(con) => {
                      const hasAcc = Boolean(con.account_id || con.account?.id)
                      return [
                        con.match_reasons?.length ? `Match: ${con.match_reasons.join(', ')}` : '',
                        !hasAcc && !canLinkStandaloneContact
                          ? `Cannot link standalone ${contactLabel} to an Account`
                          : '',
                        con.email,
                        con.phone,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                    onChange={handleContactSelect}
                    disabled={submitting}
                    onSessionExpired={onSessionExpired}
                  />
                  {cannotLinkStandaloneContact ? (
                    <FeedbackNotice
                      tone="info"
                      message={`Your role cannot link standalone ${contactLabel} "${selectedReusedContact.name}" to an Account. Select a ${contactLabel} already on an Account or create a new one.`}
                    />
                  ) : null}
                </div>
              )}
            </div>

            {/* Deal section */}
            <div className="space-y-3 pt-2 border-t crm-border">
              <div className="font-semibold text-main">Deal</div>
              {!hideDealTitle ? (
                <div className="space-y-1">
                  <FieldLabel
                    htmlFor="convert-deal-title"
                    label="Deal Title"
                    readOnly={roDealTitle}
                  />
                  <input
                    id="convert-deal-title"
                    type="text"
                    value={dealTitle}
                    disabled={submitting || roDealTitle}
                    onChange={(e) => {
                      setDealTitleDirty(true)
                      setDealTitle(e.target.value)
                    }}
                    placeholder="e.g. VALCO Smelter Control Panels"
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
              ) : null}

              {!hideDealAmount || !hideDealStage ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!hideDealAmount ? (
                    <div className="space-y-1">
                      <FieldLabel
                        htmlFor="convert-deal-amount"
                        label="Estimated Deal Value (GHS)"
                        readOnly={roDealAmount}
                      />
                      <input
                        id="convert-deal-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={dealAmount}
                        disabled={submitting || roDealAmount}
                        onChange={(e) => setDealAmount(e.target.value)}
                        className="crm-input w-full px-3 py-2 num-tabular"
                      />
                    </div>
                  ) : null}
                  {!hideDealStage ? (
                    <div className="space-y-1">
                      <FieldLabel
                        htmlFor="convert-deal-stage"
                        label="Initial Pipeline Stage"
                        readOnly={roDealStage}
                      />
                      <Select
                        id="convert-deal-stage"
                        ariaLabel="Initial pipeline stage"
                        value={dealStage}
                        onChange={setDealStage}
                        options={stageOptions}
                        disabled={submitting || roDealStage}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!hideDealClose || !hideDealProb ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!hideDealClose ? (
                    <div className="space-y-1">
                      <FieldLabel
                        htmlFor="convert-deal-close"
                        label="Target Close Date"
                        readOnly={roDealClose}
                      />
                      <input
                        id="convert-deal-close"
                        type="date"
                        value={targetCloseDate}
                        disabled={submitting || roDealClose}
                        onChange={(e) => setTargetCloseDate(e.target.value)}
                        className="crm-input w-full px-3 py-2"
                      />
                    </div>
                  ) : null}
                  {!hideDealProb ? (
                    <div className="space-y-1">
                      <FieldLabel
                        htmlFor="convert-deal-prob"
                        label="Win Probability (%)"
                        readOnly={roDealProb}
                      />
                      <input
                        id="convert-deal-prob"
                        type="number"
                        min="0"
                        max="100"
                        value={winProbability}
                        disabled={submitting || roDealProb}
                        onChange={(e) => setWinProbability(e.target.value)}
                        placeholder="0 - 100"
                        className="crm-input w-full px-3 py-2 num-tabular"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </form>
    </Modal>
  )
}

export function ConvertLeadModal(props) {
  if (!props.open) return null
  return (
    <ConvertLeadModalContent
      key={props.initialLead?.id ? `lead-${props.initialLead.id}` : 'picker'}
      {...props}
    />
  )
}
