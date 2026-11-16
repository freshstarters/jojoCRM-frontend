export const CORE_TIMEZONES = [
  'Africa/Accra',
  'UTC',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

export function detectBrowserTimezone() {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (resolved && typeof resolved === 'string') {
      return resolved
    }
  } catch {
    // Fall back to workspace default timezone
  }
  return 'Africa/Accra'
}

export function getTimezoneOptions(preferredTimezone = '') {
  let intlZones = []
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      intlZones = Intl.supportedValuesOf('timeZone')
    }
  } catch {
    intlZones = []
  }

  const allSupported = new Set([...CORE_TIMEZONES, ...intlZones])
  if (preferredTimezone && typeof preferredTimezone === 'string') {
    allSupported.add(preferredTimezone)
  }

  const priority = ['Africa/Accra']
  if (preferredTimezone && preferredTimezone !== 'Africa/Accra') {
    priority.push(preferredTimezone)
  }

  const rest = Array.from(allSupported)
    .filter((zone) => Boolean(zone) && !priority.includes(zone))
    .sort((a, b) => a.localeCompare(b))

  return [...priority, ...rest].map((zone) => ({
    value: zone,
    label: zone === 'Africa/Accra' ? 'Africa/Accra (Ghana)' : zone,
  }))
}
