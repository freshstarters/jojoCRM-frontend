export function formatGhs(amount) {
  const num = Number(amount || 0)
  if (!Number.isFinite(num)) return 'GHS 0.00'
  return `GHS ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDateTime(isoString, timeZone = 'Africa/Accra') {
  if (!isoString) return 'Not set'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return String(isoString)
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || 'Africa/Accra',
    }).format(date)
  } catch {
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }
}

export function formatDateOnly(isoDate) {
  if (!isoDate) return 'Not set'
  const parts = String(isoDate).split('-')
  if (parts.length === 3) {
    const year = Number(parts[0])
    const month = Number(parts[1]) - 1
    const day = Number(parts[2])
    const d = new Date(Date.UTC(year, month, day))
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(d)
    }
  }
  return String(isoDate)
}

export function toDateTimeLocalValue(isoString, timeZone = 'Africa/Accra') {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Africa/Accra',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const map = {}
    for (const part of parts) {
      map[part.type] = part.value
    }
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
  } catch {
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}
