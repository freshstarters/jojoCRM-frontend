import { formatGhs } from '../../utils/formatters.js'
import { Button } from '../Button.jsx'

export function RecordLinksSection({
  linkedRecords,
  contactLabel = 'Contact',
  contactPluralLabel = '',
  onOpenRecord,
}) {
  if (!linkedRecords) return null

  const resolvedContactPlural = contactPluralLabel || `${contactLabel}s`
  const groups = []

  if (linkedRecords.account) {
    groups.push({
      title: 'Account',
      items: [
        {
          paneId: 'accounts',
          recordId: linkedRecords.account.id,
          label: linkedRecords.account.name,
          meta: linkedRecords.account.city || 'Company',
        },
      ],
    })
  }

  if (linkedRecords.contact) {
    groups.push({
      title: contactLabel,
      items: [
        {
          paneId: 'contacts',
          recordId: linkedRecords.contact.id,
          label: linkedRecords.contact.name,
          meta:
            linkedRecords.contact.email ||
            linkedRecords.contact.phone ||
            contactLabel,
        },
      ],
    })
  }

  if (Array.isArray(linkedRecords.contacts) && linkedRecords.contacts.length > 0) {
    groups.push({
      title: `Linked ${resolvedContactPlural}`,
      items: linkedRecords.contacts.map((c) => ({
        paneId: 'contacts',
        recordId: c.id,
        label: c.name,
        meta: c.title || c.email || contactLabel,
      })),
    })
  }

  if (Array.isArray(linkedRecords.deals) && linkedRecords.deals.length > 0) {
    groups.push({
      title: 'Deals',
      items: linkedRecords.deals.map((d) => ({
        paneId: 'deals',
        recordId: d.id,
        label: d.title,
        meta: `${d.stage} · ${formatGhs(d.amount)}`,
      })),
    })
  }

  if (Array.isArray(linkedRecords.jobs) && linkedRecords.jobs.length > 0) {
    groups.push({
      title: 'Jobs',
      items: linkedRecords.jobs.map((j) => ({
        paneId: 'jobs',
        recordId: j.id,
        label: j.title,
        meta: j.due_date ? `${j.status} · Due ${j.due_date}` : j.status,
      })),
    })
  }

  if (
    Array.isArray(linkedRecords.appointments) &&
    linkedRecords.appointments.length > 0
  ) {
    groups.push({
      title: 'Appointments',
      items: linkedRecords.appointments.map((a) => ({
        paneId: 'appointments',
        recordId: a.id,
        label: a.title,
        meta: a.status,
      })),
    })
  }

  if (Array.isArray(linkedRecords.tickets) && linkedRecords.tickets.length > 0) {
    groups.push({
      title: 'Support Tickets',
      items: linkedRecords.tickets.map((t) => ({
        paneId: 'tickets',
        recordId: t.id,
        label: t.title,
        meta: `${t.status} · ${t.priority}`,
      })),
    })
  }

  if (Array.isArray(linkedRecords.source_leads) && linkedRecords.source_leads.length > 0) {
    groups.push({
      title:
        linkedRecords.source_leads.length === 1
          ? 'Converted from Lead'
          : 'Converted from Leads',
      items: linkedRecords.source_leads.map((lead) => ({
        paneId: 'leads',
        recordId: lead.id,
        label: lead.name,
        meta: [lead.record_code, lead.company, lead.status === 'converted' ? 'Converted' : 'Open']
          .filter(Boolean)
          .join(' · '),
      })),
    })
  } else if (linkedRecords.lead) {
    groups.push({
      title: 'Converted from Lead',
      items: [
        {
          paneId: 'leads',
          recordId: linkedRecords.lead.id,
          label: linkedRecords.lead.name,
          meta: [
            linkedRecords.lead.record_code,
            linkedRecords.lead.company,
            linkedRecords.lead.status === 'converted' ? 'Converted' : 'Open',
          ]
            .filter(Boolean)
            .join(' · '),
        },
      ],
    })
  }

  if (groups.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 pt-2 border-t crm-border">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-sub">
        Linked records
      </h4>
      <div className="space-y-2.5">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <div className="text-[11px] font-medium text-sub">{group.title}</div>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <div
                  key={`${item.paneId}-${item.recordId}`}
                  className="crm-subtle px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-main truncate">{item.label}</div>
                    {item.meta ? (
                      <div className="text-[11px] text-sub truncate">{item.meta}</div>
                    ) : null}
                  </div>
                  {onOpenRecord ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onOpenRecord(item.paneId, item.recordId)}
                      className="px-2.5 py-1 text-[11px] shrink-0"
                    >
                      Open
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
