import { Button } from '../Button.jsx'

export function PaginationBar({
  page = 1,
  totalPages = 1,
  totalCount = 0,
  hasPrevious = false,
  hasNext = false,
  loading = false,
  onPageChange,
  itemLabel = 'record',
  pluralLabel = 'records',
}) {
  return (
    <div className="px-4 py-3 border-t crm-border flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-sub num-tabular">
        Page {page} of {totalPages} ({totalCount}{' '}
        {totalCount === 1 ? itemLabel : pluralLabel})
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="secondary-icon"
          disabled={loading || !hasPrevious}
          onClick={() => onPageChange?.(Math.max(1, page - 1))}
          data-tooltip="Previous page"
          aria-label="Previous page"
        >
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Button>
        <Button
          type="button"
          variant="secondary-icon"
          disabled={loading || !hasNext}
          onClick={() => onPageChange?.(page + 1)}
          data-tooltip="Next page"
          aria-label="Next page"
        >
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
