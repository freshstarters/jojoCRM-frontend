import { useState } from 'react'
import {
  createDraftInvoiceFromDeal,
  createJobFromDeal,
} from '../../service/commercialService.js'
import { getObjectRights } from '../../service/crmService.js'
import { Button } from '../Button.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { InvoiceLineItemsEditor } from './InvoiceLineItemsEditor.jsx'

export function DealLineItemsSection({
  workspace,
  workspaceSlug,
  permissions,
  deal,
  products = [],
  canUpdateDeal = false,
  onDealChanged,
  onOpenCreatedInvoice,
  onOpenCreatedJob,
  onSessionExpired,
}) {
  const enabledKeys = new Set(workspace?.enabled_object_keys || [])
  const productEnabled = enabledKeys.has('product')
  const lineItemEnabled = enabledKeys.has('line_item')
  const invoiceEnabled = enabledKeys.has('invoice')
  const jobEnabled = enabledKeys.has('job')

  const invoiceRights = getObjectRights(permissions, 'invoice')
  const jobRights = getObjectRights(permissions, 'job')
  const lineRights = getObjectRights(permissions, 'line_item')

  const canCreateInvoice = invoiceEnabled && invoiceRights.canCreate
  const canCreateJob =
    jobEnabled &&
    jobRights.canCreate &&
    Boolean(deal?.account_id || deal?.contact_id)

  const [creatingType, setCreatingType] = useState('')
  const [actionError, setActionError] = useState('')

  async function handleCreateInvoice() {
    if (!workspaceSlug || !deal?.id) return
    setCreatingType('invoice')
    setActionError('')
    try {
      const { response, data } = await createDraftInvoiceFromDeal(workspaceSlug, deal.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not create Draft invoice.')
        return
      }
      await onDealChanged?.()
      if (data?.record?.id) {
        onOpenCreatedInvoice?.(data.record.id)
      }
    } catch {
      setActionError('Network error while creating Draft invoice.')
    } finally {
      setCreatingType('')
    }
  }

  async function handleCreateJob() {
    if (!workspaceSlug || !deal?.id) return
    setCreatingType('job')
    setActionError('')
    try {
      const { response, data } = await createJobFromDeal(workspaceSlug, deal.id)
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired?.(data?.error || data?.detail)
          return
        }
        setActionError(data?.error || data?.detail || 'Could not create Job.')
        return
      }
      await onDealChanged?.()
      if (data?.record?.id) {
        onOpenCreatedJob?.(data.record.id)
      }
    } catch {
      setActionError('Network error while creating Job.')
    } finally {
      setCreatingType('')
    }
  }

  if (!deal) return null
  const showLines = lineItemEnabled && deal.line_items_readable

  return (
    <div className="pt-3 border-t crm-border space-y-3">
      {(canCreateInvoice || canCreateJob) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg crm-subtle border crm-border">
          <div>
            <div className="text-xs font-semibold text-main">Next Commercial Step</div>
            <div className="text-[11px] text-sub">
              Pre-fill a Draft invoice or Job directly with this deal&apos;s customer and line items.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateInvoice ? (
              <Button
                type="button"
                variant="primary"
                disabled={Boolean(creatingType)}
                onClick={handleCreateInvoice}
                className="px-3 py-1.5 text-xs font-medium"
              >
                {creatingType === 'invoice' ? 'Creating...' : 'Create Draft Invoice'}
              </Button>
            ) : null}
            {canCreateJob ? (
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(creatingType)}
                onClick={handleCreateJob}
                className="px-3 py-1.5 text-xs"
              >
                {creatingType === 'job' ? 'Creating...' : 'Create Job'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <FeedbackNotice tone="danger" message={actionError} />

      {showLines ? (
        <InvoiceLineItemsEditor
          workspaceSlug={workspaceSlug}
          parentObjectKey="deal"
          parentId={deal.id}
          items={Array.isArray(deal.line_items) ? deal.line_items : []}
          products={products}
          productEnabled={productEnabled}
          lineItemEnabled={lineItemEnabled}
          canEdit={
            canUpdateDeal &&
            (lineRights.canCreate || lineRights.canUpdate || lineRights.canDelete)
          }
          onChanged={onDealChanged}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  )
}
