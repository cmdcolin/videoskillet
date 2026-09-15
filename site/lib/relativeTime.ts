// How long ago something happened, in the words the home page puts on a resume
// card and under a saved look. Coarse on purpose: the reader is deciding which
// of their own looks to open, so "3 days ago" is the whole answer and a date is
// one more thing to read.
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const count = (ms: number, unit: number, name: string): string => {
  const n = Math.floor(ms / unit)
  return `${n} ${name}${n === 1 ? '' : 's'} ago`
}

// A clock that has run backwards — a machine whose time was wrong when the save
// landed, or two machines disagreeing — reads as "just now" rather than as a
// negative count.
export function sinceWords(at: number, now: number): string {
  const ms = now - at
  if (!Number.isFinite(ms) || ms < MINUTE) return 'just now'
  if (ms < HOUR) return count(ms, MINUTE, 'minute')
  if (ms < DAY) return count(ms, HOUR, 'hour')
  if (ms < MONTH) return count(ms, DAY, 'day')
  if (ms < YEAR) return count(ms, MONTH, 'month')
  return count(ms, YEAR, 'year')
}
