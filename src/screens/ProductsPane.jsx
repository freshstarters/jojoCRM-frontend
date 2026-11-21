import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Checkbox } from '../components/Checkbox.jsx'
import { FeedbackNotice } from '../components/FeedbackNotice.jsx'
import { Modal } from '../components/Modal.jsx'
import { Select } from '../components/Select.jsx'
import { CrmListPage } from '../components/crm/CrmListPage.jsx'
import { FieldLabel } from '../components/crm/FieldLabel.jsx'
import { RecordInspectorDrawer } from '../components/crm/RecordInspectorDrawer.jsx'
import {
  RecordSharingControl,
  SharingBadge,
} from '../components/crm/RecordSharingControl.jsx'
import { useCrmRecordsPane } from '../hooks/useCrmRecordsPane.js'
import {
  filterWritablePayload,
  isFieldHidden,
  isFieldReadOnly,
} from '../service/crmService.js'
import { VISIBILITY_FILTER_OPTIONS } from '../utils/crmFormOptions.js'
import { formatGhs } from '../utils/formatters.js'

const EMPTY_FORM = {
  name: '',
  sku: '',
  unit_price: '0.00',
  description: '',
  is_active: true,
  visibility: 'workspace',
  shared_role_id: '',
}

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'All products' },
  { value: 'true', label: 'Active only' },
  { value: 'false', label: 'Inactive only' },
]

export function ProductsPane({
  workspace,
  user,
  permissions,
  permissionsRevision = 0,
  urlInspectRecordId = null,
  onInspectRecord,
  onCloseInspect,
  onOpenInventory = null,
  onOpenLinkedRecord,
  onAuditRecorded,
  onSessionExpired,
}) {
  const roleName = permissions?.role_name || (permissions?.is_owner ? 'Owner' : 'Staff')

  const pane = useCrmRecordsPane({
    workspaceSlug: workspace?.slug,
    objectKey: 'product',
    permissions,
    permissionsRevision,
    urlInspectRecordId,
    onInspectRecord,
    onCloseInspect,
    needOptions: true,
    onAuditRecorded,
    onSessionExpired,
  })

  const fr = pane.fieldRights
  const hideName = isFieldHidden(fr, 'name')
  const hideSku = isFieldHidden(fr, 'sku')
  const hidePrice = isFieldHidden(fr, 'unit_price')
  const hideDesc = isFieldHidden(fr, 'description')
  const hideActive = isFieldHidden(fr, 'is_active')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(null)

  const active = pane.activeRecord
  const formValues = draft ?? {
    name: active?.name || '',
    sku: active?.sku || '',
    unit_price: active?.unit_price ?? '0.00',
    description: active?.description || '',
    is_active: active?.is_active ?? true,
    visibility: active?.visibility || 'workspace',
    shared_role_id: active?.shared_role_id ? String(active.shared_role_id) : '',
  }

  const columns = useMemo(() => {
    const cols = [{ key: 'name', label: 'Product' }]
    if (!hideSku) cols.push({ key: 'sku', label: 'SKU' })
    if (!hidePrice) cols.push({ key: 'unit_price', label: 'Unit Price (GHS)' })
    if (!hideActive) cols.push({ key: 'status', label: 'Status' })
    cols.push({ key: 'sharing', label: 'Sharing' })
    cols.push({ key: 'action', label: 'Action', align: 'right' })
    return cols
  }, [hideSku, hidePrice, hideActive])

  function openCreateModal() {
    setCreateForm(EMPTY_FORM)
    setCreateError('')
    setCreateOpen(true)
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    setCreateError('')
    const payload = filterWritablePayload(
      {
        name: createForm.name,
        sku: createForm.sku,
        unit_price: createForm.unit_price,
        description: createForm.description,
        is_active: Boolean(createForm.is_active),
      },
      fr,
    )
    payload.visibility = createForm.visibility
    if (createForm.visibility === 'role' && createForm.shared_role_id) {
      payload.shared_role_id = Number(createForm.shared_role_id)
    }

    setCreating(true)
    const res = await pane.createRecord(payload)
    setCreating(false)
    if (!res.ok) {
      setCreateError(res.error || 'Could not create product.')
      return
    }
    setCreateOpen(false)
  }

  async function handleSaveInspector() {
    const payload = filterWritablePayload(
      {
        name: formValues.name,
        sku: formValues.sku,
        unit_price: formValues.unit_price,
        description: formValues.description,
        is_active: Boolean(formValues.is_active),
      },
      fr,
    )
    if (active?.can_manage_sharing) {
      payload.visibility = formValues.visibility
      payload.shared_role_id =
        formValues.visibility === 'role' && formValues.shared_role_id
          ? Number(formValues.shared_role_id)
          : null
    }
    const res = await pane.saveActiveRecord(payload)
    if (res.ok) {
      setDraft(null)
    }
  }

  async function handleDeleteActiveRecord() {
    const res = await pane.deleteActiveRecord()
    if (res.ok) {
      setDraft(null)
    }
    return res
  }

  return (
    <>
      <CrmListPage
        id="pane-products"
        title="Products"
        subtitle="Commercial catalog items with GHS unit pricing for deals and invoices."
        roleName={roleName}
        canRead={pane.rights.canRead}
        canCreate={pane.rights.canCreate && !hideName}
        createLabel="New Product"
        onCreateClick={openCreateModal}
        stats={[
          {
            label: 'Total Products',
            value: pane.totalCount,
            sublabel: 'Matching catalog items',
          },
          {
            label: 'Active',
            value: pane.summary?.active_count ?? 0,
            sublabel: 'Available for line items',
          },
        ]}
        toolbarCaption="Products linked to issued invoices cannot be deleted while commercial links exist."
        searchValue={pane.search}
        onSearchChange={pane.setSearch}
        searchPlaceholder="Search products or SKU..."
        filters={
          <>
            {!hideActive ? (
              <div className="w-36">
                <Select
                  ariaLabel="Filter by product status"
                  value={pane.filters.is_active || ''}
                  onChange={(val) => pane.updateFilter('is_active', val)}
                  options={ACTIVE_FILTER_OPTIONS}
                />
              </div>
            ) : null}
            <div className="w-36">
              <Select
                ariaLabel="Filter by visibility"
                value={pane.filters.visibility || ''}
                onChange={(val) => pane.updateFilter('visibility', val)}
                options={VISIBILITY_FILTER_OPTIONS}
              />
            </div>
          </>
        }
        loading={pane.loading}
        error={pane.loadError}
        records={pane.records}
        emptyMessage="No products yet."
        columns={columns}
        page={pane.page}
        totalPages={pane.totalPages}
        totalCount={pane.totalCount}
        hasPrevious={pane.hasPrevious}
        hasNext={pane.hasNext}
        onPageChange={pane.setPage}
        itemLabel="product"
        pluralLabel="products"
        renderRow={(row) => (
          <tr
            key={row.id}
            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition cursor-pointer"
            onClick={() => {
              setDraft(null)
              pane.openInspector(row.id)
            }}
          >
            <td className="py-2.5 px-3">
              <div className="font-medium text-main">{row.display_label}</div>
              {!hideDesc && row.description ? (
                <div className="text-[11px] text-sub truncate max-w-xs">{row.description}</div>
              ) : null}
            </td>
            {!hideSku ? (
              <td className="py-2.5 px-3 text-body num-tabular">{row.sku || '-'}</td>
            ) : null}
            {!hidePrice ? (
              <td className="py-2.5 px-3 font-medium text-main num-tabular">
                {formatGhs(row.unit_price)}
              </td>
            ) : null}
            {!hideActive ? (
              <td className="py-2.5 px-3">
                <span className={row.is_active ? 'badge badge-success' : 'badge badge-neutral'}>
                  {row.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            ) : null}
            <td className="py-2.5 px-3">
              <SharingBadge record={row} />
            </td>
            <td className="py-2.5 px-3 text-right">
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setDraft(null)
                  pane.openInspector(row.id)
                }}
                className="px-2.5 py-1 text-xs"
              >
                Inspect
              </Button>
            </td>
          </tr>
        )}
      />

      <Modal
        open={createOpen}
        title="New Product"
        subtitle="Add a product or service to your workspace catalog."
        onClose={() => {
          if (!creating) setCreateOpen(false)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-product-form"
              variant="primary"
              disabled={creating}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              {creating ? 'Creating...' : 'Create Product'}
            </Button>
          </>
        }
      >
        <form id="create-product-form" onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <FeedbackNotice tone="danger" message={createError} />

          {!hideName ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-prod-name" label="Product name" required readOnly={isFieldReadOnly(fr, 'name')} />
              <input
                id="new-prod-name"
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Solar Inverter 5kVA"
                disabled={creating || isFieldReadOnly(fr, 'name')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!hideSku ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="new-prod-sku" label="SKU" readOnly={isFieldReadOnly(fr, 'sku')} />
                <input
                  id="new-prod-sku"
                  type="text"
                  value={createForm.sku}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. SOL-5KVA"
                  disabled={creating || isFieldReadOnly(fr, 'sku')}
                  className="crm-input w-full px-3 py-2"
                />
              </div>
            ) : null}
            {!hidePrice ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="new-prod-price" label="Unit price (GHS)" readOnly={isFieldReadOnly(fr, 'unit_price')} />
                <input
                  id="new-prod-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.unit_price}
                  onChange={(e) => setCreateForm((f) => ({ ...f, unit_price: e.target.value }))}
                  disabled={creating || isFieldReadOnly(fr, 'unit_price')}
                  className="crm-input w-full px-3 py-2 num-tabular"
                />
              </div>
            ) : null}
          </div>

          {!hideDesc ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="new-prod-desc" label="Description" readOnly={isFieldReadOnly(fr, 'description')} />
              <textarea
                id="new-prod-desc"
                rows={2}
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                disabled={creating || isFieldReadOnly(fr, 'description')}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}

          {!hideActive ? (
            <Checkbox
              id="new-prod-active"
              checked={Boolean(createForm.is_active)}
              onChange={(checked) => setCreateForm((f) => ({ ...f, is_active: checked }))}
              label="Active in catalog"
              disabled={creating || isFieldReadOnly(fr, 'is_active')}
            />
          ) : null}

          <RecordSharingControl
            idPrefix="new-prod-sharing"
            visibility={createForm.visibility}
            sharedRoleId={createForm.shared_role_id}
            roles={pane.optionsData?.roles || []}
            disabled={creating}
            onChange={(next) => setCreateForm((f) => ({ ...f, ...next }))}
          />
        </form>
      </Modal>

      <RecordInspectorDrawer
        open={pane.inspectorOpen}
        onClose={() => {
          setDraft(null)
          pane.closeInspector()
        }}
        objectKey="product"
        objectLabel="Product"
        assignees={pane.optionsData?.assignees || []}
        roles={pane.optionsData?.roles || []}
        workspaceSlug={workspace?.slug}
        userTimezone={user?.timezone || 'Africa/Accra'}
        permissions={permissions}
        record={active}
        loading={pane.inspectorLoading}
        saving={pane.savingInspector}
        deleting={pane.deletingInspector}
        error={pane.inspectorError}
        notice={pane.actionNotice}
        canUpdate={pane.rights.canUpdate}
        canDelete={pane.rights.canDelete}
        sharingValue={{
          visibility: formValues.visibility,
          shared_role_id: formValues.shared_role_id,
        }}
        onSharingChange={(next) => setDraft({ ...formValues, ...next })}
        onSave={handleSaveInspector}
        onDelete={handleDeleteActiveRecord}
        onActivityChanged={pane.refreshActiveRecord}
        auditRefreshKey={pane.recordAuditRevision}
        onOpenLinkedRecord={onOpenLinkedRecord}
        onSessionExpired={onSessionExpired}
        badgeText={!hideActive && active ? (active.is_active ? 'Active' : 'Inactive') : ''}
        badgeClassName={active?.is_active ? 'badge badge-success' : 'badge badge-neutral'}
      >
        {!hideName ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="prod-insp-name" label="Product name" readOnly={isFieldReadOnly(fr, 'name')} />
            <input
              id="prod-insp-name"
              type="text"
              value={formValues.name}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'name')}
              onChange={(e) => setDraft({ ...formValues, name: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {!hideSku ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="prod-insp-sku" label="SKU" readOnly={isFieldReadOnly(fr, 'sku')} />
              <input
                id="prod-insp-sku"
                type="text"
                value={formValues.sku}
                disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'sku')}
                onChange={(e) => setDraft({ ...formValues, sku: e.target.value })}
                className="crm-input w-full px-3 py-2"
              />
            </div>
          ) : null}
          {!hidePrice ? (
            <div className="space-y-1">
              <FieldLabel htmlFor="prod-insp-price" label="Unit price (GHS)" readOnly={isFieldReadOnly(fr, 'unit_price')} />
              <input
                id="prod-insp-price"
                type="number"
                min="0"
                step="0.01"
                value={formValues.unit_price}
                disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'unit_price')}
                onChange={(e) => setDraft({ ...formValues, unit_price: e.target.value })}
                className="crm-input w-full px-3 py-2 num-tabular"
              />
            </div>
          ) : null}
        </div>

        {!hideDesc ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="prod-insp-desc" label="Description" readOnly={isFieldReadOnly(fr, 'description')} />
            <textarea
              id="prod-insp-desc"
              rows={3}
              value={formValues.description}
              disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'description')}
              onChange={(e) => setDraft({ ...formValues, description: e.target.value })}
              className="crm-input w-full px-3 py-2"
            />
          </div>
        ) : null}

        {!hideActive ? (
          <Checkbox
            id="prod-insp-active"
            checked={Boolean(formValues.is_active)}
            onChange={(checked) => setDraft({ ...formValues, is_active: checked })}
            label="Active in catalog"
            disabled={!pane.rights.canUpdate || pane.savingInspector || isFieldReadOnly(fr, 'is_active')}
          />
        ) : null}

        {active?.inventory_readable ? (
          <div className="pt-3 border-t crm-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-sub">
                Warehouse Stock
              </h4>
              {onOpenInventory ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDraft(null)
                    pane.closeInspector()
                    onOpenInventory()
                  }}
                  className="px-2.5 py-1 text-[11px]"
                >
                  Open Inventory
                </Button>
              ) : null}
            </div>
            {!Array.isArray(active.warehouse_stocks) || active.warehouse_stocks.length === 0 ? (
              <p className="text-xs text-sub">
                No warehouses configured yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {active.warehouse_stocks.map((row) => (
                  <div
                    key={row.warehouse_id}
                    className="p-2.5 rounded-lg crm-subtle border crm-border flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-main flex items-center gap-1.5">
                        <span>{row.warehouse_name}</span>
                        {row.is_default ? (
                          <span className="badge badge-info text-[10px]">Default</span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-sub num-tabular">
                        Reorder level: {Number(row.reorder_level).toFixed(2).replace(/\.00$/, '')}
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="font-semibold text-main num-tabular">
                        {Number(row.quantity_on_hand).toFixed(2).replace(/\.00$/, '')} on hand
                      </div>
                      <span
                        className={
                          row.status === 'In Stock'
                            ? 'badge badge-success'
                            : row.status === 'Low Stock'
                              ? 'badge badge-warn'
                              : 'badge badge-danger'
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </RecordInspectorDrawer>
    </>
  )
}
