import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { boardControls, boardText } from './boardText'
import { sliderFor } from './controls'

import type { Board } from './boardText'

const EMPTY: Board = {
  look: 'dialed in from stock — no preset behind it',
  sources: [
    { tag: 'A', what: 'Color bars' },
    { tag: 'B', what: 'nothing patched in' },
  ],
  controls: [],
  motion: [],
  link: 'http://localhost/app/#set=',
}

describe('boardControls', () => {
  it('says nothing about a board nobody has touched', () => {
    expect(boardControls(DEFAULT_CONTROLS)).toEqual([])
  })

  it('reports a moved control with its group, key, reading and stock', () => {
    const rows = boardControls({ ...DEFAULT_CONTROLS, noiseIre: 9 })
    expect(rows).toHaveLength(1)
    const def = sliderFor('noiseIre')
    expect(rows[0]).toMatchObject({
      key: 'noiseIre',
      label: def.label,
      value: `9.00${def.unit}`,
    })
    expect(rows[0].group).not.toBe('')
    expect(rows[0].stock).toBe(`0.00${def.unit}`)
  })

  // The palette's list, the slider's readout and this all read a mode switch
  // through `readingOf`, so none of them can report an index at the other two's
  // expense.
  it('reads a mode switch as its option name, not its index', () => {
    const def = sliderFor('frameLock')
    const rows = boardControls({ ...DEFAULT_CONTROLS, frameLock: 1 })
    expect(rows[0].value).toBe(def.choices?.[1])
  })

  // atRest, not DEFAULT_CONTROLS: the landing look moves bGain before anyone
  // has touched anything, and a dump that opened by reporting it would be
  // describing a board the visitor did not build.
  it('leaves the landing look off an untouched board', () => {
    expect(boardControls({ ...DEFAULT_CONTROLS, bGain: 0.16 })).toEqual([])
  })
})

describe('boardText', () => {
  it('names the look, both decks and the link', () => {
    const out = boardText(EMPTY)
    expect(out).toContain('look')
    expect(out).toContain('source A  Color bars')
    expect(out).toContain('source B  nothing patched in')
    expect(out).toContain('http://localhost/app/#set=')
  })

  it('says so in words when there is nothing to report', () => {
    const out = boardText(EMPTY)
    expect(out).toContain('every control is at its default')
    expect(out).toContain('nothing is moving on its own')
  })

  it('counts what it lists, and agrees with itself about one', () => {
    const one = boardText({
      ...EMPTY,
      controls: [
        {
          group: 'Timebase',
          label: 'head switch',
          key: 'headSwitchShiftUs',
          value: '9.00us',
          stock: '0.80us',
        },
      ],
    })
    expect(one).toContain('1 control off stock')
    expect(one).toContain('headSwitchShiftUs')
    expect(one).toContain('stock 0.80us')
  })

  // Columns are what make the block splittable on runs of spaces, so a short
  // cell has to be padded out to the widest one in its column.
  it('pads every column to its widest cell', () => {
    const out = boardText({
      ...EMPTY,
      controls: [
        {
          group: 'Tape',
          label: 'dropout rate',
          key: 'dropoutRate',
          value: '6.00/s',
          stock: '0.00/s',
        },
        {
          group: 'Timebase',
          label: 'head switch',
          key: 'headSwitchShiftUs',
          value: '9.00us',
          stock: '0.80us',
        },
      ],
    })
    const rows = out
      .split('\n')
      .filter(l => l.includes('dropoutRate') || l.includes('headSwitchShiftUs'))
    expect(rows).toHaveLength(2)
    expect(rows[0].indexOf('dropoutRate')).toBe(
      rows[1].indexOf('headSwitchShiftUs'),
    )
  })

  // A caption per run, not a column: two rows from one group name it once.
  it('captions each run of rows with the group it came from', () => {
    const row = (label: string, key: string) => ({
      group: 'Timebase',
      label,
      key,
      value: '1.00',
      stock: '0.00',
    })
    const out = boardText({
      ...EMPTY,
      controls: [
        row('head switch', 'headSwitchShiftUs'),
        row('wow', 'tbWowNs'),
        { ...row('noise', 'noiseIre'), group: 'Noise & interference' },
      ],
    })
    const lines = out.split('\n')
    expect(lines.filter(l => l.trim() === 'Timebase')).toHaveLength(1)
    expect(lines.filter(l => l.trim() === 'Noise & interference')).toHaveLength(
      1,
    )
    expect(lines.indexOf('  Timebase')).toBeLessThan(
      lines.findIndex(l => l.includes('headSwitchShiftUs')),
    )
  })

  it('marks a parked routing as held still and still lists it', () => {
    const out = boardText({
      ...EMPTY,
      motion: [
        { target: 'head switch', detail: 'Sine at 0.35Hz', still: false },
        { target: 'noise', detail: 'Envelope', still: true },
      ],
    })
    expect(out).toContain('2 controls moving')
    expect(out).toContain('Sine at 0.35Hz')
    expect(out).toContain('held still')
  })
})
