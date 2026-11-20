import { Button } from '../Button.jsx'
import { Card } from '../Card.jsx'
import { FeedbackNotice } from '../FeedbackNotice.jsx'
import { PaginationBar } from './PaginationBar.jsx'

export function CrmListPage({
  id,
  title,
  subtitle,
  roleName = 'Staff',
  canRead = true,
  canCreate = false,
  createLabel = 'New Record',
  onCreateClick,
  headerActions = null,
  stats = [],
  statsAddon = null,
  extraContent = null,
  toolbarCaption = '',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = null,
  loading = false,
  error = '',
  records = [],
  emptyMessage = 'No records yet.',
  columns = [],
  renderRow,
  page = 1,
  totalPages = 1,
  totalCount = 0,
  hasPrevious = false,
  hasNext = false,
  onPageChange,
  itemLabel = 'record',
  pluralLabel = 'records',
  hideTable = false,
  keepToolbarWhenTableHidden = false,
  hidePaginationWhenTableHidden = false,
  customTableContent = null,
}) {
  const toolbarBar = (
    <div className="px-4 py-3 border-b crm-border flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
      <span className="text-xs text-sub min-w-0">{toolbarCaption}</span>
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange ? (
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="crm-input px-3 py-1.5 text-xs w-44"
          />
        ) : null}
        {filters}
        <span className="text-xs font-semibold text-main num-tabular shrink-0">
          {totalCount} {totalCount === 1 ? itemLabel : pluralLabel}
        </span>
      </div>
    </div>
  )

  const paginationBar = (
    <PaginationBar
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      loading={loading}
      onPageChange={onPageChange}
      itemLabel={itemLabel}
      pluralLabel={pluralLabel}
    />
  )

  return (
    <section id={id} className="space-y-5 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b crm-border">
        <div>
          <h1 className="text-xl font-semibold text-main tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-sub mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {canRead && onCreateClick ? (
            <Button
              type="button"
              variant="primary"
              disabled={!canCreate}
              data-tooltip={
                canCreate
                  ? undefined
                  : `Your ${roleName} role does not have create permission`
              }
              onClick={onCreateClick}
              className="px-3 py-1.5 text-xs flex items-center space-x-1.5"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{createLabel}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!canRead ? (
        <Card className="p-6 space-y-2">
          <span className="badge badge-warn">Access restricted</span>
          <h2 className="text-sm font-semibold text-main">
            Read access is disabled for {roleName}
          </h2>
          <p className="text-xs text-sub">
            Your current role ({roleName}) does not have read permission for {title}. Contact a workspace administrator or update role permissions under Settings -&gt; Roles.
          </p>
        </Card>
      ) : (
        <>
          {(stats.length > 0 || statsAddon) ? (
            <div className="flex flex-wrap items-stretch gap-4">
              {stats.map((stat) => (
                <Card
                  key={stat.label}
                  className="p-4 w-max max-w-xs min-w-[11rem] min-h-[6.75rem]"
                >
                  <span className="text-xs font-medium text-sub">{stat.label}</span>
                  <div className="mt-1 text-xl font-bold text-main num-tabular">
                    {stat.value}
                  </div>
                  {stat.caption ? (
                    <span className="text-[11px] text-sub">{stat.caption}</span>
                  ) : null}
                </Card>
              ))}
              {statsAddon}
            </div>
          ) : null}

          {extraContent}

          <FeedbackNotice tone="danger" message={error} />

          {hideTable && keepToolbarWhenTableHidden ? (
            <Card className="overflow-hidden">
              {toolbarBar}
            </Card>
          ) : null}

          {customTableContent}

          {hideTable &&
          keepToolbarWhenTableHidden &&
          !hidePaginationWhenTableHidden &&
          totalCount > 0 ? (
            <Card className="overflow-hidden">
              {paginationBar}
            </Card>
          ) : null}

          {!hideTable ? (
            <Card className="overflow-hidden">
              {toolbarBar}

              {loading && records.length === 0 ? (
                <p className="p-5 text-xs text-sub">Loading {pluralLabel}...</p>
              ) : records.length === 0 && totalCount > 0 && page > totalPages ? (
                <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-sub">
                    No {pluralLabel} on page {page}.
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onPageChange?.(1)}
                    className="px-3 py-1 text-xs"
                  >
                    Back to page 1
                  </Button>
                </div>
              ) : records.length === 0 ? (
                <div className="p-5">
                  <div className="crm-subtle px-3.5 py-3 text-xs text-sub">
                    {emptyMessage}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b crm-border text-[11px] font-semibold uppercase text-sub crm-subtle">
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className={`py-3 px-4 font-medium ${col.align === 'right' ? 'text-right' : ''}`.trim()}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y crm-border text-xs">
                      {records.map((rec) => renderRow(rec))}
                    </tbody>
                  </table>
                </div>
              )}

              {paginationBar}
            </Card>
          ) : null}
        </>
      )}
    </section>
  )
}
