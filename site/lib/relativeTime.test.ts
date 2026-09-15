// CROSS_REPO_SYNC_FILE(relative-time-test)
import { expect, test } from 'vitest'

import { sinceWords } from './relativeTime'

const NOW = 1_700_000_000_000
const ago = (ms: number) => sinceWords(NOW - ms, NOW)

test('anything under a minute is just now', () => {
  expect(ago(0)).toBe('just now')
  expect(ago(59_000)).toBe('just now')
})

test('a clock that ran backwards reads as just now', () => {
  expect(ago(-90_000)).toBe('just now')
  expect(sinceWords(Number.NaN, NOW)).toBe('just now')
})

test('each unit takes over at its own boundary', () => {
  expect(ago(60_000)).toBe('1 minute ago')
  expect(ago(59 * 60_000)).toBe('59 minutes ago')
  expect(ago(3_600_000)).toBe('1 hour ago')
  expect(ago(2 * 3_600_000)).toBe('2 hours ago')
  expect(ago(23 * 3_600_000)).toBe('23 hours ago')
  expect(ago(86_400_000)).toBe('1 day ago')
  expect(ago(3 * 86_400_000)).toBe('3 days ago')
  expect(ago(29 * 86_400_000)).toBe('29 days ago')
  expect(ago(30 * 86_400_000)).toBe('1 month ago')
  expect(ago(364 * 86_400_000)).toBe('12 months ago')
  expect(ago(365 * 86_400_000)).toBe('1 year ago')
  expect(ago(900 * 86_400_000)).toBe('2 years ago')
})
