import { businessTimezone, calendarDay } from './calendarService.js'

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
}

const dayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function getShopStatus(business, now = new Date()) {
  const hours = business?.settings?.operatingHours || {}
  const days = Array.isArray(hours.days) ? hours.days : []
  const openTime = hours.openTime || '09:00'
  const closeTime = hours.closeTime || '21:00'
  const manualStatus = business?.settings?.manualStatus || 'auto'
  const timezone = businessTimezone(business)
  const parts = localParts(now, timezone)
  const today = dayIndex[parts.weekday]
  const fallback = { status: manualStatus === 'open' ? 'open' : manualStatus === 'closed' ? 'closed' : 'closed', label: manualStatus === 'open' ? 'Open now' : 'Closed', detail: 'Hours unavailable' }
  if (manualStatus === 'open') return { ...fallback, status: 'open', label: 'Open now', detail: closeTime ? `Open until ${formatTime(closeTime)}` : 'Open now' }
  if (manualStatus === 'closed') return { ...fallback, status: 'closed', label: 'Closed', detail: `Opens tomorrow at ${formatTime(openTime)}` }
  if (!days.includes(today)) return { status: 'closed', label: 'Closed', detail: `Opens tomorrow at ${formatTime(openTime)}` }
  const current = `${parts.hour}:${parts.minute}`
  const open = current >= openTime && current < closeTime
  return open
    ? { status: 'open', label: 'Open now', detail: `Open until ${formatTime(closeTime)}` }
    : { status: 'closed', label: 'Closed', detail: current < openTime ? `Opens today at ${formatTime(openTime)}` : `Opens tomorrow at ${formatTime(openTime)}` }
}

export function formatTime(value) {
  const [hour, minute] = value.split(':').map(Number)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

export function publicShopStatus(business, now = new Date()) {
  const result = getShopStatus(business, now)
  return { ...result, day: calendarDay(now, business), timezone: businessTimezone(business) }
}
