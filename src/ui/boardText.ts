import { DEFAULT_CONTROLS, atRest } from '../core/controls'
import { ALL_SLIDERS } from './controls'
import { readingOf } from './format'
import { groupOf } from './placement'

import type { Controls } from '../core/controls'

// The whole board in one block of labelled text: what look is up, what is on
// each deck, every control sitting off stock with its reading and its stock
// value, everything the bay is driving, and the link.
//
// It exists for the reader who cannot see the picture. An agent driving this app
// from outside has three ways to ask what is on the board and all of them are
// partial: the address bar carries every value but names them in wire keys with
// no units, the palette's list answers one query at a time, and a screenshot of
// a `<canvas>` says what the fault looks like and never what a control is set
// to. This is the fourth, and the only one that answers in one read.
//
// **Text on screen rather than text on the clipboard.** A browsing agent reads
// the page; it does not read the clipboard, and a verb whose only output went
// there would have helped a person pasting into a chat and done nothing for the
// reader who asked. The copy button on the dialog is the second audience, not
// the first.
//
// Pure, and its own module, for the reason `packed.ts` is: the format is a
// contract with whatever is parsing it on the far side, and a dialog is an
// expensive place to find out that a column moved.

export interface BoardControl {
  group: string
  label: string
  key: string
  value: string
  stock: string
}

export interface BoardMotion {
  // What the routing drives, as the panel labels it.
  target: string
  // The routing at tooltip length — `modDetail` writes it, so the dump and the
  // row's own tooltip say the same sentence about the same patch.
  detail: string
  // A patch that exists but is parked. It stays in the list: a slot held still
  // is part of the look, and dropping it would make the dump disagree with the
  // link, which carries it.
  still: boolean
}

export interface Board {
  // What the look is called: a preset by name, one edited since, or neither.
  look: string
  sources: readonly { tag: string; what: string }[]
  controls: readonly BoardControl[]
  motion: readonly BoardMotion[]
  link: string
}

// Every control the look moves, in signal-path order, against the value it
// would rest at. Off `atRest` rather than off `DEFAULT_CONTROLS` so a bare load
// reports an empty board — the same question the look menu and the chain map's
// counts ask, answered the same way.
export const boardControls = (controls: Controls): BoardControl[] =>
  ALL_SLIDERS.filter(s => !atRest(controls[s.key], s.key)).map(s => ({
    group: groupOf(s.key)?.name ?? '',
    label: s.label,
    key: s.key,
    value: readingOf(controls[s.key], s.step, s.unit, s.choices),
    stock: readingOf(DEFAULT_CONTROLS[s.key], s.step, s.unit, s.choices),
  }))

// Columns padded to the widest cell in each, which is what makes the block
// scannable by eye and splittable on runs of spaces by anything parsing it.
const table = (rows: readonly (readonly string[])[]): string[] => {
  const widths = (rows[0] ?? []).map((_, i) =>
    Math.max(...rows.map(r => r[i]?.length ?? 0)),
  )
  return rows.map(r =>
    r
      .map((cell, i) => (i === r.length - 1 ? cell : cell.padEnd(widths[i])))
      .join('  ')
      .trimEnd(),
  )
}

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

export function boardText(board: Board): string {
  const head = table([
    ['look', board.look],
    ...board.sources.map(s => [`source ${s.tag}`, s.what]),
  ])
  // The group as a caption over its run of rows rather than a column repeated
  // down them — the same shape the look menu draws, and the difference between
  // a block that fits the card and one that scrolls sideways.
  const rows = table(
    board.controls.map(c => [c.label, c.key, c.value, `stock ${c.stock}`]),
  )
  const controls =
    board.controls.length === 0
      ? ['every control is at its default']
      : [
          `${count(board.controls.length, 'control', 'controls')} off stock`,
          ...board.controls.flatMap((c, i) => [
            ...(c.group === board.controls[i - 1]?.group
              ? []
              : [`  ${c.group}`]),
            `    ${rows[i]}`,
          ]),
        ]
  const motion =
    board.motion.length === 0
      ? ['nothing is moving on its own']
      : [
          `${count(board.motion.length, 'control', 'controls')} moving`,
          ...table(
            board.motion.map(m => [
              m.target,
              m.still ? `${m.detail} — held still` : m.detail,
            ]),
          ).map(line => `  ${line}`),
        ]
  return [
    ...head,
    '',
    ...controls,
    '',
    ...motion,
    '',
    'link',
    `  ${board.link}`,
  ].join('\n')
}
