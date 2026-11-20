import { useEffect, useMemo, useState } from 'react'
import {
  convertLeadRecord,
  fetchLeadConversionPreview,
  listCrmRecords,
} from '../../service/crmService.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { Modal } from '../Modal.jsx'
import { Select } from '../Select.jsx'

const FALLBACK_STAGE_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Proposal', label: 'Proposal' },
  { value: 'Won', label: 'Won' },
  { value: 'Lost', label: 'Lost' },
]

function ConvertLeadModalContent({
  onClose,
  workspaceSlug,
  contactLabel = 'Contact',
  initialLead = null,
  onConverted,
  onSessionExpired,
}) {
  const [leadSearch, setLeadSearch] = useState('')
  const [completedLeadsKey, setCompletedLeadsKey] = useState('')
  const [leadOptionsList, setLeadOptionsList] = useState(() =>
    initialLead ? [initialLead] : [],
  )
  const [selectedLeadId, setSelectedLeadId] = useState(() =>
    initialLead?.id ? String(initialLead.id) : '',
  )

  const [completedPreviewKey, setCompletedPreviewKey] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [previewError, setPreviewError] = useState('')

  const [accountMode, setAccountMode] = useState('create')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [searchedAccounts, setSearchedAccounts] = useState([])
  const [completedAccSearchKey, setCompletedAccSearchKey] = useState('')
  const [showAccountSearch, setShowAccountSearch] = useState(false)
  const [accountName, setAccountName] = useState(
    () => (initialLead?.company || '').trim() || initialLead?.name || '',
  )
  const [accountCity, setAccountCity] = useState('')

  const [contactMode, setContactMode] = useState('create')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [searchedContacts, setSearchedContacts] = useState([])
  const [completedConSearchKey, setCompletedConSearchKey] = useState('')
  const [showContactSearch, setShowContactSearch] = useState(false)
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

  const leadsRequestKey = workspaceSlug
    ? `${workspaceSlug}:${leadSearch.trim()}:${initialLead?.id || ''}`
    : ''
  const leadsLoading = Boolean(leadsRequestKey && completedLeadsKey !== leadsRequestKey)

  useEffect(() => {
    if (!leadsRequestKey) return undefined
    let cancelled = false
    const activeKey = leadsRequestKey

    listCrmRecords(workspaceSlug, 'lead', {
      page: 1,
      page_size: 50,
      ...(leadSearch.trim() ? { q: leadSearch.trim() } : {}),
    })
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
        const merged =
          initialLead && !fetched.some((row) => row.id === initialLead.id)
            ? [initialLead, ...fetched]
            : fetched
        setLeadOptionsList(merged)
        setSelectedLeadId((prev) => {
          if (prev && merged.some((row) => String(row.id) === prev)) {
            return prev
          }
          if (initialLead?.id && merged.some((row) => row.id === initialLead.id)) {
            return String(initialLead.id)
          }
          const firstOpen = merged.find((row) => row.status === 'open')
          return firstOpen
            ? String(firstOpen.id)
            : merged[0]
              ? String(merged[0].id)
              : ''
        })
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError('Network error while loading leads.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedLeadsKey(activeKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [leadsRequestKey, workspaceSlug, leadSearch, initialLead, onSessionExpired])

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null
    return (
      leadOptionsList.find((row) => String(row.id) === selectedLeadId) ||
      (initialLead && String(initialLead.id) === selectedLeadId ? initialLead : null)
    )
  }, [leadOptionsList, selectedLeadId, initialLead])

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
        setShowAccountSearch(
          resolvedAccMode === 'reuse' && !lockedByConAccId && !firstAccMatch,
        )
        setAccountSearch('')
        setSearchedAccounts([])

        setContactMode(defaultConMode)
        setSelectedContactId(firstConMatch?.id ? String(firstConMatch.id) : '')
        setContactName(defaults.contact_name || '')
        setContactTitle(defaults.contact_title || '')
        setShowContactSearch(defaultConMode === 'reuse' && !firstConMatch)
        setContactSearch('')
        setSearchedContacts([])

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

  const accSearchKey =
    workspaceSlug && showAccountSearch ? `${workspaceSlug}:acc:${accountSearch.trim()}` : ''
  const searchingAccounts = Boolean(
    accSearchKey && completedAccSearchKey !== accSearchKey,
  )

  useEffect(() => {
    if (!accSearchKey) return undefined
    let cancelled = false
    const activeKey = accSearchKey

    listCrmRecords(workspaceSlug, 'account', {
      page: 1,
      page_size: 25,
      ...(accountSearch.trim() ? { q: accountSearch.trim() } : {}),
    })
      .then(({ response, data }) => {
        if (cancelled) return
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        if (response.ok) {
          setSearchedAccounts(Array.isArray(data?.results) ? data.results : [])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompletedAccSearchKey(activeKey)
      })

    return () => {
      cancelled = true
    }
  }, [accSearchKey, workspaceSlug, accountSearch, onSessionExpired])

  const conSearchKey =
    workspaceSlug && showContactSearch ? `${workspaceSlug}:con:${contactSearch.trim()}` : ''
  const searchingContacts = Boolean(
    conSearchKey && completedConSearchKey !== conSearchKey,
  )

  useEffect(() => {
    if (!conSearchKey) return undefined
    let cancelled = false
    const activeKey = conSearchKey

    listCrmRecords(workspaceSlug, 'contact', {
      page: 1,
      page_size: 25,
      ...(contactSearch.trim() ? { q: contactSearch.trim() } : {}),
    })
      .then(({ response, data }) => {
        if (cancelled) return
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        if (response.ok) {
          setSearchedContacts(Array.isArray(data?.results) ? data.results : [])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompletedConSearchKey(activeKey)
      })

    return () => {
      cancelled = true
    }
  }, [conSearchKey, workspaceSlug, contactSearch, onSessionExpired])

  const accountMatches = useMemo(
    () => previewData?.account_matches || [],
    [previewData?.account_matches],
  )
  const contactMatches = useMemo(
    () => previewData?.contact_matches || [],
    [previewData?.contact_matches],
  )

  const combinedContacts = useMemo(() => {
    const byId = new Map()
    for (const c of contactMatches) byId.set(String(c.id), c)
    for (const c of searchedContacts) {
      if (!byId.has(String(c.id))) {
        byId.set(String(c.id), {
          id: c.id,
          record_code: c.record_code,
          name: c.name,
          title: c.title,
          email: c.email,
          phone: c.phone,
          account_id: c.account_id,
          account_name: c.account?.name || '',
          match_reasons: [],
        })
      }
    }
    return Array.from(byId.values())
  }, [contactMatches, searchedContacts])

  const selectedReusedContact = useMemo(() => {
    if (contactMode !== 'reuse' || !selectedContactId) return null
    return combinedContacts.find((c) => String(c.id) === selectedContactId) || null
  }, [contactMode, selectedContactId, combinedContacts])

  const lockedAccountId = selectedReusedContact?.account_id
    ? String(selectedReusedContact.account_id)
    : ''

  const combinedAccounts = useMemo(() => {
    const byId = new Map()
    for (const a of accountMatches) byId.set(String(a.id), a)
    for (const a of searchedAccounts) {
      if (!byId.has(String(a.id))) {
        byId.set(String(a.id), {
          id: a.id,
          record_code: a.record_code,
          name: a.name,
          city: a.city,
          email: a.email,
          phone: a.phone,
          match_reasons: [],
        })
      }
    }
    if (lockedAccountId && !byId.has(lockedAccountId) && selectedReusedContact) {
      byId.set(lockedAccountId, {
        id: Number(lockedAccountId),
        name: selectedReusedContact.account_name || `Account #${lockedAccountId}`,
        city: '',
        match_reasons: [`Linked to ${selectedReusedContact.name}`],
      })
    }
    return Array.from(byId.values())
  }, [accountMatches, searchedAccounts, lockedAccountId, selectedReusedContact])

  const effectiveAccountMode = lockedAccountId ? 'reuse' : accountMode
  const effectiveAccountId = lockedAccountId || selectedAccountId

  const selectedReusedAccount = useMemo(() => {
    if (effectiveAccountMode !== 'reuse' || !effectiveAccountId) return null
    return combinedAccounts.find((a) => String(a.id) === effectiveAccountId) || null
  }, [effectiveAccountMode, effectiveAccountId, combinedAccounts])

  function syncDefaultDealTitle(nextAccName) {
    if (!dealTitleDirty && nextAccName) {
      setDealTitle(`${nextAccName} Deal`)
    }
  }

  function handleAccountSelect(nextId) {
    setSelectedAccountId(nextId)
    const found = combinedAccounts.find((a) => String(a.id) === nextId)
    if (found?.name) {
      syncDefaultDealTitle(found.name)
    }
  }

  function handleContactSelect(nextId) {
    setSelectedContactId(nextId)
    const found = combinedContacts.find((c) => String(c.id) === nextId)
    if (found?.account_id) {
      setAccountMode('reuse')
      setSelectedAccountId(String(found.account_id))
      if (found.account_name) {
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

  const leadSelectOptions = useMemo(() => {
    if (leadOptionsList.length === 0) {
      return [{ value: '', label: leadsLoading ? 'Loading leads...' : 'No leads available' }]
    }
    return leadOptionsList.map((lead) => ({
      value: String(lead.id),
      label: `${lead.name}${lead.company ? ` — ${lead.company}` : ''} (${
        lead.status === 'converted' ? 'Already Converted' : 'Open Lead'
      })`,
    }))
  }, [leadOptionsList, leadsLoading])

  const accountReuseOptions = useMemo(() => {
    if (combinedAccounts.length === 0) {
      return [{ value: '', label: 'Search or pick an Account' }]
    }
    return combinedAccounts.map((acc) => ({
      value: String(acc.id),
      label: `${acc.name}${acc.city ? ` (${acc.city})` : ''}${
        acc.match_reasons?.length ? ` · Match: ${acc.match_reasons.join(', ')}` : ''
      }`,
    }))
  }, [combinedAccounts])

  const canUpdateContact = previewData?.capabilities?.can_update_contact !== false

  const contactReuseOptions = useMemo(() => {
    if (combinedContacts.length === 0) {
      return [{ value: '', label: `Search or pick a ${contactLabel}` }]
    }
    return combinedContacts.map((con) => ({
      value: String(con.id),
      label: `${con.name}${con.account_name ? ` (${con.account_name})` : ' (Standalone)'}${
        con.match_reasons?.length ? ` · Match: ${con.match_reasons.join(', ')}` : ''
      }${!con.account_id && !canUpdateContact ? ` · Requires ${contactLabel} update` : ''}`,
    }))
  }, [combinedContacts, contactLabel, canUpdateContact])

  const capabilities = previewData?.capabilities || {}
  const isConverted = Boolean(
    previewData?.already_converted || selectedLead?.status === 'converted',
  )
  const cannotLinkStandaloneContact = Boolean(
    !isConverted &&
      contactMode === 'reuse' &&
      selectedReusedContact &&
      !selectedReusedContact.account_id &&
      !canUpdateContact,
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedLeadId || !workspaceSlug) return
    setSubmitError('')

    if (!isConverted) {
      if (effectiveAccountMode === 'create' && !accountName.trim()) {
        setSubmitError('Account name is required when creating a new Account.')
        return
      }
      if (effectiveAccountMode === 'reuse' && !effectiveAccountId) {
        setSubmitError('Select an existing Account to reuse or switch to Create new.')
        return
      }
      if (contactMode === 'create' && !contactName.trim()) {
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
          `Your role lacks permission to update ${contactLabel}s, so standalone ${contactLabel} "${selectedReusedContact.name}" cannot be linked to an Account. Select a ${contactLabel} already on an Account or create a new one.`,
        )
        return
      }
      if (!dealTitle.trim()) {
        setSubmitError('Deal title is required.')
        return
      }
    }

    const payload = {
      ...(effectiveAccountMode === 'reuse'
        ? { account_id: Number(effectiveAccountId) }
        : {
            account_name: accountName.trim(),
            account_city: accountCity.trim(),
          }),
      ...(contactMode === 'reuse'
        ? { contact_id: Number(selectedContactId) }
        : {
            contact_name: contactName.trim(),
            contact_title: contactTitle.trim(),
          }),
      deal_title: dealTitle.trim() || undefined,
      deal_amount: dealAmount === '' ? '0.00' : dealAmount,
      deal_stage: dealStage || stageOptions[0]?.value || undefined,
      target_close_date: targetCloseDate || null,
      win_probability: winProbability === '' ? null : Number(winProbability),
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="convert-lead-select" className="font-medium text-body">
              Select Lead
            </label>
            <input
              type="search"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Search leads..."
              aria-label="Search leads to convert"
              disabled={submitting}
              className="crm-input px-2.5 py-1 text-[11px] w-44"
            />
          </div>
          <Select
            id="convert-lead-select"
            ariaLabel="Select lead to convert"
            value={selectedLeadId}
            onChange={(val) => {
              setSubmitError('')
              setSelectedLeadId(val)
            }}
            options={leadSelectOptions}
            disabled={submitting || leadOptionsList.length === 0}
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
                      if (!effectiveAccountId && combinedAccounts.length === 0) {
                        setShowAccountSearch(true)
                      }
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="convert-account-name"
                      className="block font-medium text-body mb-1"
                    >
                      Account Name
                    </label>
                    <input
                      id="convert-account-name"
                      type="text"
                      value={accountName}
                      disabled={submitting}
                      onChange={(e) => {
                        setAccountName(e.target.value)
                        syncDefaultDealTitle(e.target.value)
                      }}
                      placeholder="e.g. Volta Aluminum Co"
                      className="crm-input w-full px-3 py-2"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="convert-account-city"
                      className="block font-medium text-body mb-1"
                    >
                      City
                    </label>
                    <input
                      id="convert-account-city"
                      type="text"
                      value={accountCity}
                      disabled={submitting}
                      onChange={(e) => setAccountCity(e.target.value)}
                      placeholder="e.g. Accra"
                      className="crm-input w-full px-3 py-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Select
                    id="convert-account-reuse"
                    ariaLabel="Reuse existing Account"
                    value={effectiveAccountId}
                    onChange={handleAccountSelect}
                    options={accountReuseOptions}
                    disabled={submitting || Boolean(lockedAccountId)}
                  />
                  {!lockedAccountId ? (
                    <div className="flex items-center gap-2">
                      {!showAccountSearch ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowAccountSearch(true)}
                          className="text-[11px]"
                        >
                          Search all workspace Accounts
                        </Button>
                      ) : (
                        <input
                          type="search"
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder={
                            searchingAccounts
                              ? 'Searching Accounts...'
                              : 'Search any existing Account...'
                          }
                          aria-label="Search existing Accounts"
                          className="crm-input w-full px-2.5 py-1.5 text-[11px]"
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

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
                      if (!selectedContactId && combinedContacts.length === 0) {
                        setShowContactSearch(true)
                      }
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="convert-contact-name"
                      className="block font-medium text-body mb-1"
                    >
                      {contactLabel} Name
                    </label>
                    <input
                      id="convert-contact-name"
                      type="text"
                      value={contactName}
                      disabled={submitting}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Abena Koranteng"
                      className="crm-input w-full px-3 py-2"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="convert-contact-title"
                      className="block font-medium text-body mb-1"
                    >
                      Title
                    </label>
                    <input
                      id="convert-contact-title"
                      type="text"
                      value={contactTitle}
                      disabled={submitting}
                      onChange={(e) => setContactTitle(e.target.value)}
                      placeholder="e.g. Operations Lead"
                      className="crm-input w-full px-3 py-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Select
                    id="convert-contact-reuse"
                    ariaLabel={`Reuse existing ${contactLabel}`}
                    value={selectedContactId}
                    onChange={handleContactSelect}
                    options={contactReuseOptions}
                    disabled={submitting}
                  />
                  {cannotLinkStandaloneContact ? (
                    <FeedbackNotice
                      tone="info"
                      message={`Linking standalone ${contactLabel} "${selectedReusedContact.name}" to an Account requires ${contactLabel} update permission. Select a ${contactLabel} already on an Account or create a new one.`}
                    />
                  ) : null}
                  <div className="flex items-center gap-2">
                    {!showContactSearch ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowContactSearch(true)}
                        className="text-[11px]"
                      >
                        Search all workspace {contactLabel}s
                      </Button>
                    ) : (
                      <input
                        type="search"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder={
                          searchingContacts
                            ? `Searching ${contactLabel}s...`
                            : `Search any existing ${contactLabel}...`
                        }
                        aria-label={`Search existing ${contactLabel}s`}
                        className="crm-input w-full px-2.5 py-1.5 text-[11px]"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t crm-border">
              <div className="font-semibold text-main">Deal</div>
              <div>
                <label
                  htmlFor="convert-deal-title"
                  className="block font-medium text-body mb-1"
                >
                  Deal Title
                </label>
                <input
                  id="convert-deal-title"
                  type="text"
                  value={dealTitle}
                  disabled={submitting}
                  onChange={(e) => {
                    setDealTitleDirty(true)
                    setDealTitle(e.target.value)
                  }}
                  placeholder="e.g. VALCO Smelter Control Panels"
                  className="crm-input w-full px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="convert-deal-amount"
                    className="block font-medium text-body mb-1"
                  >
                    Estimated Deal Value (GHS)
                  </label>
                  <input
                    id="convert-deal-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={dealAmount}
                    disabled={submitting}
                    onChange={(e) => setDealAmount(e.target.value)}
                    className="crm-input w-full px-3 py-2 num-tabular"
                  />
                </div>
                <div>
                  <label
                    htmlFor="convert-deal-stage"
                    className="block font-medium text-body mb-1"
                  >
                    Initial Pipeline Stage
                  </label>
                  <Select
                    id="convert-deal-stage"
                    ariaLabel="Initial pipeline stage"
                    value={dealStage}
                    onChange={setDealStage}
                    options={stageOptions}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="convert-deal-close"
                    className="block font-medium text-body mb-1"
                  >
                    Target Close Date
                  </label>
                  <input
                    id="convert-deal-close"
                    type="date"
                    value={targetCloseDate}
                    disabled={submitting}
                    onChange={(e) => setTargetCloseDate(e.target.value)}
                    className="crm-input w-full px-3 py-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="convert-deal-prob"
                    className="block font-medium text-body mb-1"
                  >
                    Win Probability (%)
                  </label>
                  <input
                    id="convert-deal-prob"
                    type="number"
                    min="0"
                    max="100"
                    value={winProbability}
                    disabled={submitting}
                    onChange={(e) => setWinProbability(e.target.value)}
                    placeholder="0 - 100"
                    className="crm-input w-full px-3 py-2 num-tabular"
                  />
                </div>
              </div>
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
