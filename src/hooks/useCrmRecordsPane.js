import { useCallback, useEffect, useState } from 'react'
import {
  createCrmRecord,
  deleteCrmRecord,
  fetchCrmOptions,
  getCrmRecord,
  getObjectRights,
  listCrmRecords,
  updateCrmRecord,
} from '../service/crmService.js'

export function useCrmRecordsPane({
  workspaceSlug,
  objectKey,
  permissions,
  initialInspectRequest = null,
  onInspectRequestConsumed,
  needOptions = false,
  onAuditRecorded,
  onSessionExpired,
}) {
  const rights = getObjectRights(permissions, objectKey)

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [refreshTick, setRefreshTick] = useState(0)

  const [listData, setListData] = useState(null)
  const [completedRequestKey, setCompletedRequestKey] = useState('')
  const [loadError, setLoadError] = useState('')

  const [optionsData, setOptionsData] = useState({
    assignees: [],
    accounts: [],
    contacts: [],
    constants: {},
  })

  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorLoading, setInspectorLoading] = useState(false)
  const [inspectorError, setInspectorError] = useState('')
  const [activeRecord, setActiveRecord] = useState(null)
  const [activeRecordPermissions, setActiveRecordPermissions] = useState(null)
  const [savingInspector, setSavingInspector] = useState(false)
  const [deletingInspector, setDeletingInspector] = useState(false)
  const [actionNotice, setActionNotice] = useState('')

  const serializedFilters = JSON.stringify(filters)
  const requestKey =
    workspaceSlug && rights.canRead
      ? `${workspaceSlug}:${objectKey}:${page}:${search.trim()}:${serializedFilters}:${refreshTick}`
      : ''
  const loading = Boolean(requestKey && completedRequestKey !== requestKey)

  const reload = useCallback(() => {
    setRefreshTick((prev) => prev + 1)
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
      ...(search.trim() ? { q: search.trim() } : {}),
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
  }, [requestKey, workspaceSlug, objectKey, page, search, filters, onSessionExpired])

  useEffect(() => {
    if (!workspaceSlug || !needOptions) return undefined
    let cancelled = false

    fetchCrmOptions(workspaceSlug)
      .then(({ response, data }) => {
        if (cancelled) return
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        if (response.ok && data) {
          setOptionsData({
            assignees: data.assignees || [],
            accounts: data.accounts || [],
            contacts: data.contacts || [],
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
  }, [workspaceSlug, needOptions, refreshTick, onSessionExpired])

  const openInspector = useCallback(
    async (recordId) => {
      if (!workspaceSlug || !recordId || !rights.canRead) return
      setInspectorOpen(true)
      setInspectorLoading(true)
      setInspectorError('')
      setActionNotice('')
      try {
        const { response, data } = await getCrmRecord(
          workspaceSlug,
          objectKey,
          recordId,
        )
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setInspectorError(data?.error || 'Could not load record details.')
          return
        }
        setActiveRecord(data.record || null)
        setActiveRecordPermissions(data.permissions || null)
      } catch {
        setInspectorError('Network error while loading record details.')
      } finally {
        setInspectorLoading(false)
      }
    },
    [workspaceSlug, objectKey, rights.canRead, onSessionExpired],
  )

  const refreshActiveRecord = useCallback(async () => {
    if (!activeRecord?.id) return
    await openInspector(activeRecord.id)
    reload()
  }, [activeRecord, openInspector, reload])

  useEffect(() => {
    const targetId = initialInspectRequest?.recordId
    const targetNonce = initialInspectRequest?.nonce
    if (!targetId || !rights.canRead || !workspaceSlug) {
      return undefined
    }
    let cancelled = false

    getCrmRecord(workspaceSlug, objectKey, targetId)
      .then(({ response, data }) => {
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpired?.(data?.error || data?.detail)
            return
          }
          setInspectorOpen(true)
          setInspectorError(data?.error || 'Could not load record details.')
          onInspectRequestConsumed?.(targetNonce)
          return
        }
        setInspectorError('')
        setActionNotice('')
        setActiveRecord(data.record || null)
        setActiveRecordPermissions(data.permissions || null)
        setInspectorOpen(true)
        onInspectRequestConsumed?.(targetNonce)
      })
      .catch(() => {
        if (!cancelled) {
          setInspectorOpen(true)
          setInspectorError('Network error while loading record details.')
          onInspectRequestConsumed?.(targetNonce)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    initialInspectRequest?.recordId,
    initialInspectRequest?.nonce,
    rights.canRead,
    workspaceSlug,
    objectKey,
    onInspectRequestConsumed,
    onSessionExpired,
  ])

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setActiveRecord(null)
    setInspectorError('')
    setActionNotice('')
  }, [])

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
      if (!workspaceSlug || !activeRecord?.id) return false
      setInspectorError('')
      setActionNotice('')
      setSavingInspector(true)
      try {
        const { response, data } = await updateCrmRecord(
          workspaceSlug,
          objectKey,
          activeRecord.id,
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
    [workspaceSlug, objectKey, activeRecord, onAuditRecorded, reload, onSessionExpired],
  )

  const currentPageRecordCount = listData?.results?.length ?? 0

  const deleteActiveRecord = useCallback(async () => {
    if (!workspaceSlug || !activeRecord?.id) return { ok: false, error: '' }
    setInspectorError('')
    setDeletingInspector(true)
    try {
      const { response, data } = await deleteCrmRecord(
        workspaceSlug,
        objectKey,
        activeRecord.id,
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
      setInspectorOpen(false)
      setActiveRecord(null)
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
    activeRecord,
    currentPageRecordCount,
    page,
    onAuditRecorded,
    reload,
    onSessionExpired,
  ])

  return {
    rights,
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
    inspectorOpen,
    inspectorLoading,
    inspectorError,
    setInspectorError,
    actionNotice,
    activeRecord,
    activeRecordPermissions,
    savingInspector,
    deletingInspector,
    openInspector,
    closeInspector,
    refreshActiveRecord,
    createRecord,
    saveInspectorRecord,
    deleteActiveRecord,
  }
}
