import { Button } from '../Button.jsx'
import { Card } from '../Card.jsx'

export function ConversionResultBanner({
  result,
  contactLabel = 'Contact',
  onOpenRecord,
  onDismiss,
}) {
  if (!result?.lead) return null

  const links = [
    result.account && {
      key: 'account',
      label: `Account: ${result.account.name}`,
      paneId: 'accounts',
      recordId: result.account.id,
    },
    result.contact && {
      key: 'contact',
      label: `${contactLabel}: ${result.contact.name}`,
      paneId: 'contacts',
      recordId: result.contact.id,
    },
    result.deal && {
      key: 'deal',
      label: `Deal: ${result.deal.title}`,
      paneId: 'deals',
      recordId: result.deal.id,
    },
    result.lead && {
      key: 'lead',
      label: `Lead: ${result.lead.name}`,
      paneId: 'leads',
      recordId: result.lead.id,
    },
  ].filter(Boolean)

  return (
    <Card
      variant="subtle"
      className="px-4 py-3 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-success">Converted</span>
          <span className="font-medium text-main">
            {result.message || `Converted ${result.lead.name}.`}
          </span>
        </div>
        {onOpenRecord && links.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {links.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="secondary"
                onClick={() => onOpenRecord(item.paneId, item.recordId)}
                className="px-2.5 py-1 text-[11px]"
              >
                {item.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onDismiss}
          className="text-[11px] shrink-0"
        >
          Dismiss
        </Button>
      ) : null}
    </Card>
  )
}
