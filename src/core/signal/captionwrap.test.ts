import { describe, expect, it } from 'vitest'

import { CC_COLS, wrapCaption } from './captionwrap'

describe('wrapCaption', () => {
  it('leaves a short line as one row', () => {
    expect(wrapCaption('BE KIND')).toEqual(['BE KIND'])
  })

  it('keeps explicit line breaks as row breaks', () => {
    expect(wrapCaption('ONE\nTWO')).toEqual(['ONE', 'TWO'])
  })

  it('wraps at word boundaries within the page width', () => {
    const rows = wrapCaption(
      'the quick brown fox jumps over the lazy dog and runs away',
    )
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.every(r => r.length <= CC_COLS)).toBe(true)
    expect(rows.join(' ')).toBe(
      'the quick brown fox jumps over the lazy dog and runs away',
    )
  })

  it('breaks a word wider than the page rather than dropping its tail', () => {
    const rows = wrapCaption('X'.repeat(CC_COLS + 5))
    expect(rows).toEqual(['X'.repeat(CC_COLS), 'X'.repeat(5)])
  })

  it('counts a character outside the BMP as one column', () => {
    const rows = wrapCaption('😀'.repeat(CC_COLS))
    expect(rows).toHaveLength(1)
  })
})
