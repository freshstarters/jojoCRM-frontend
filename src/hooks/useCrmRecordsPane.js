import { useCallback, useEffect, useState } from 'react'
import {
  createCrmRecord,
  deleteCrmRecord,
  fetchCrmOptions,
  getCrmRecord,
  getFieldRights,
  getObjectRights,
  listCrmRecords,
  updateCrmRecord,
} from '../service/crmService.js'

export function useCrmRecordsPane({
  workspaceSlug,
  objectKey,
  permissions,
  permissionsRevision = 0,
  enabled = true,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  needOptions = false,
  onAuditRecorded,
  onSessionExpired,
}) {
  const rights = getObjectRights(permissions, objectKey)
  const fieldRights = getFieldRights(permissions, objectKey)

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [refreshTick, setRefreshTick] = useState(0)
  const [optionsRefreshTick, setOptionsRefreshTick] = useState(0)

  const [listData, setListData] = useState(null)
  const [completedRequestKey, setCompletedRequestKey] = useState('')
  const [loadError, setLoadError] = useState('')

  const [optionsData, setOptionsData] = useState({
    assignees: [],
    roles: [],
    accounts: [],
    accounts_total_count: 0,
    accounts_truncated: false,
    contacts: [],
    contacts_total_count: 0,
    contacts_truncated: false,
    products: [],
    warehouses: [],
    inventory_enabled: false,
    constants: {},
  })

  const [localInspectId, setLocalInspectId] = useState(null)
  const [inspectorReloadTick, setInspectorReloadTick] = useState(0)
  const [completedInspectKey, setCompletedInspectKey] = useState('')
  const [inspectorError, setInspectorError] = useState('')
  const [activeRecord, setActiveRecord] = useState(null)
  const [activeRecordPermissions, setActiveRecordPermissions] = useState(null)
  const [savingInspector, setSavingInspector] = useState(false)
  const [deletingInspector, setDeletingInspector] = useState(false)
  const [actionNotice, setActionNotice] = useState('')
  const [recordAuditRevision, setRecordAuditRevision] = useState(0)

  const effectiveInspectId = onInspectRecord ? urlInspectRecordId : localInspectId
  const inspectorOpen = Boolean(effectiveInspectId && rights.canRead)

  useEffect(() => {
    const trimmed = search.trim()
    if (!trimmed) return undefined
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const effectiveSearch = search.trim() ? debouncedSearch : ''
  const serializedFilters = JSON.stringify(filters)
  const requestKey =
    workspaceSlug && rights.canRead && enabled
      ? `${workspaceSlug}:${objectKey}:${page}:${effectiveSearch}:${serializedFilters}:${refreshTick}:${permissionsRevision}`
      : ''
  const loading = Boolean(requestKey && completedRequestKey !== requestKey)

  const reload = useCallback(() => {
    setRefreshTick((prev) => prev + 1)
  }, [])

  const reloadOptions = useCallback(() => {
    setOptionsRefreshTick((prev) => prev + 1)
  }, [])

  const bumpRecordAuditRevision = useCallback(() => {
    setRecordAuditRevision((prev) => prev + 1)
  }, [])

  const updateFilter = useCallback((key, value) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateSearch = useCallback((value) => {
    setPage(1)
    setSearch(value)
  }, [])

  useEffect(() => {
    if (!requestKey) return undefined
    let cancelled = false
    const activeKey = requestKey

    const params = {
      page,
      page_size: 25,
      ...(effectiveSearch ? { q: effectiveSearch } : {}),
      ...filters,
    }

    listCrmRecords(workspaceSlug, objectKey, params)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setLoadError(data?.error || data?.detail || 'Could not load records.')
          return
        }
        setLoadError('')
        if (data?.total_pages && page > data.total_pages) {
          setPage(data.total_pages)
        }
        setListData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Network error while loading records.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedRequestKey(activeKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [requestKey, workspaceSlug, objectKey, page, effectiveSearch, filters, onSessionExpired])

  useEffect(() => {
    if (!workspaceSlug || !needOptions) return undefined
    let cancelled = false

    fetchCrmOptions(workspaceSlug, { force: optionsRefreshTick > 0 })
      .then(({ response, data }) => {
        if (cancelled) return
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        if (response.ok && data) {
          setOptionsData({
            assignees: data.assignees || [],
            roles: data.roles || [],
            accounts: data.accounts || [],
            accounts_total_count: data.accounts_total_count ?? 0,
            accounts_truncated: Boolean(data.accounts_truncated),
            contacts: data.contacts || [],
            contacts_total_count: data.contacts_total_count ?? 0,
            contacts_truncated: Boolean(data.contacts_truncated),
            products: data.products || [],
            warehouses: data.warehouses || [],
            inventory_enabled: Boolean(data.inventory_enabled),
            constants: data.constants || {},
          })
        }
      })
      .catch(() => {
        // Leave empty options if network unavailable; main list error notice covers failures
      })

    return () => {
      cancelled = true
    }
  }, [workspaceSlug, needOptions, permissionsRevision, optionsRefreshTick, onSessionExpired])

  const inspectRequestKey =
    workspaceSlug && inspectorOpen && effectiveInspectId
      ? `${workspaceSlug}:${objectKey}:${effectiveInspectId}:${inspectorReloadTick}:${permissionsRevision}`
      : ''
  const inspectorLoading = Boolean(
    inspectRequestKey && completedInspectKey !== inspectRequestKey,
  )

  useEffect(() => {
    if (!inspectRequestKey || !effectiveInspectId) return undefined
    let cancelled = false
    const activeKey = inspectRequestKey

    getCrmRecord(workspaceSlug, objectKey, effectiveInspectId)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setActiveRecord(null)
          setActiveRecordPermissions(null)
          setInspectorError(data?.error || 'Could not load record details.')
          return
        }
        setInspectorError('')
        setActiveRecord(data.record || null)
        setActiveRecordPermissions(data.permissions || null)
      })
      .catch(() => {
        if (!cancelled) {
          setInspectorError('Network error while loading record details.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedInspectKey(activeKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [inspectRequestKey, workspaceSlug, objectKey, effectiveInspectId, onSessionExpired])

  const openInspector = useCallback(
    (recordId) => {
      if (!workspaceSlug || !recordId || !rights.canRead) return
      setInspectorError('')
      setActionNotice('')
      if (onInspectRecord) {
        if (String(effectiveInspectId || '') === String(recordId)) {
          setInspectorReloadTick((prev) => prev + 1)
        }
        onInspectRecord(recordId)
      } else {
        setLocalInspectId(recordId)
        setInspectorReloadTick((prev) => prev + 1)
      }
    },
    [workspaceSlug, rights.canRead, onInspectRecord, effectiveInspectId],
  )

  const closeInspector = useCallback(() => {
    setInspectorError('')
    setActionNotice('')
    if (onCloseInspect) {
      onCloseInspect()
    } else {
      setLocalInspectId(null)
    }
  }, [onCloseInspect])

  const refreshActiveRecord = useCallback(async () => {
    if (!effectiveInspectId) return
    setInspectorReloadTick((prev) => prev + 1)
    setRecordAuditRevision((prev) => prev + 1)
    reload()
  }, [effectiveInspectId, reload])

  const displayedActiveRecord =
    inspectorOpen && activeRecord && String(activeRecord.id) === String(effectiveInspectId)
      ? activeRecord
      : null

  const createRecord = useCallback(
    async (payload) => {
      if (!workspaceSlug) return { ok: false, error: 'Workspace unavailable.' }
      try {
        const { response, data } = await createCrmRecord(
          workspaceSlug,
          objectKey,
          payload,
        )
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return { ok: false, error: '' }
          }
          return {
            ok: false,
            error: data?.error || 'Could not create record.',
          }
        }
        onAuditRecorded?.()
        reload()
        return { ok: true, record: data.record, message: data.message }
      } catch {
        return {
          ok: false,
          error: 'Unable to reach the server. Please try again.',
        }
      }
    },
    [workspaceSlug, objectKey, onAuditRecorded, reload, onSessionExpired],
  )

  const saveInspectorRecord = useCallback(
    async (payload) => {
      if (!workspaceSlug || !displayedActiveRecord?.id) return false
      setInspectorError('')
      setActionNotice('')
      setSavingInspector(true)
      try {
        const { response, data } = await updateCrmRecord(
          workspaceSlug,
          objectKey,
          displayedActiveRecord.id,
          payload,
        )
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return false
          }
          setInspectorError(data?.error || 'Could not save changes.')
          return false
        }
        setActiveRecord(data.record || null)
        setActionNotice(data?.message || 'Changes saved.')
        if (data?.changed) {
          onAuditRecorded?.()
          setRecordAuditRevision((prev) => prev + 1)
        }
        reload()
        return true
      } catch {
        setInspectorError('Unable to reach the server. Please try again.')
        return false
      } finally {
        setSavingInspector(false)
      }
    },
    [workspaceSlug, objectKey, displayedActiveRecord, onAuditRecorded, reload, onSessionExpired],
  )

  const currentPageRecordCount = listData?.results?.length ?? 0

  const deleteActiveRecord = useCallback(async () => {
    if (!workspaceSlug || !displayedActiveRecord?.id) return { ok: false, error: '' }
    setInspectorError('')
    setDeletingInspector(true)
    try {
      const { response, data } = await deleteCrmRecord(
        workspaceSlug,
        objectKey,
        displayedActiveRecord.id,
      )
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return { ok: false, error: '' }
        }
        const message = data?.error || 'Could not delete record.'
        setInspectorError(message)
        return { ok: false, error: message }
      }
      setActiveRecord(null)
      if (onCloseInspect) {
        onCloseInspect({ replace: true })
      } else {
        setLocalInspectId(null)
      }
      onAuditRecorded?.()
      if (currentPageRecordCount <= 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1))
      } else {
        reload()
      }
      return { ok: true, message: data?.message }
    } catch {
      const msg = 'Unable to reach the server while deleting record.'
      setInspectorError(msg)
      return { ok: false, error: msg }
    } finally {
      setDeletingInspector(false)
    }
  }, [
    workspaceSlug,
    objectKey,
    displayedActiveRecord,
    currentPageRecordCount,
    page,
    onCloseInspect,
    onAuditRecorded,
    reload,
    onSessionExpired,
  ])

  return {
    rights,
    fieldRights:
      activeRecordPermissions?.field_rights ||
      listData?.permissions?.field_rights ||
      fieldRights,
    records: listData?.results || [],
    summary: listData?.summary || {},
    page: listData?.page ?? page,
    totalPages: listData?.total_pages ?? 1,
    totalCount: listData?.total_count ?? 0,
    hasPrevious: Boolean(listData?.has_previous),
    hasNext: Boolean(listData?.has_next),
    setPage,
    search,
    setSearch: updateSearch,
    filters,
    updateFilter,
    loading,
    loadError,
    optionsData,
    reload,
    reloadOptions,
    inspectorOpen,
    inspectorLoading,
    inspectorError,
    setInspectorError,
    actionNotice,
    activeRecord: displayedActiveRecord,
    activeRecordPermissions,
    savingInspector,
    deletingInspector,
    recordAuditRevision: recordAuditRevision + permissionsRevision,
    bumpRecordAuditRevision,
    openInspector,
    closeInspector,
    refreshActiveRecord,
    createRecord,
    saveInspectorRecord,
    deleteActiveRecord,
  }
}
