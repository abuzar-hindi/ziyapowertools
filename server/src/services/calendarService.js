const fallbackTimezone = 'UTC'

export function businessTimezone(business) {
  const timezone = business?.settings?.timezone
  if (!timezone) return fallbackTimezone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
    return timezone
  } catch {
    return fallbackTimezone
  }
}

export function calendarDay(date = new Date(), business) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimezone(business),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}
