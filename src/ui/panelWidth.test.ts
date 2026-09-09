// The rail can be dragged anywhere, and two of the places it can be dragged to
// are not widths: one that leaves the picture nothing, and one that leaves every
// label in the sidebar wrapping. Both ends are clamped here rather than at the
// pointer, so the stored number is sane whichever gesture set it — a drag, an
// arrow key, or a profile written on a display twice this size.

import { describe, expect, it } from 'vitest'

import { MIN_PANEL_W, PANEL_W, panelWidthIn } from './panelWidth'

const WIDE = 2560

describe('the sidebar’s width, as a drag can leave it', () => {
  it('takes a width that fits', () => {
    expect(panelWidthIn(480, WIDE)).toBe(480)
  })

  it('rounds to a whole pixel, since a pointer does not land on one', () => {
    expect(panelWidthIn(480.4, WIDE)).toBe(480)
  })

  it('stops where the labels start wrapping', () => {
    expect(panelWidthIn(120, WIDE)).toBe(MIN_PANEL_W)
  })

  it('leaves the picture its share on the way out', () => {
    expect(panelWidthIn(2400, WIDE)).toBe(WIDE - 320)
  })

  it('keeps the sidebar readable on a window too small to share', () => {
    // 500px of window cannot give 300 to the panel and 320 to the picture. The
    // floor wins: a picture a few pixels short beats a column of wrapped labels.
    expect(panelWidthIn(PANEL_W, 500)).toBe(MIN_PANEL_W)
  })
})
