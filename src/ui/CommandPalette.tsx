import { useState } from 'react'

import styles from './CommandPalette.module.css'
import { GROUPS, snapToStep } from './controls'
import { cx } from './cx'
import dlg from './dialog.module.css'
import { readingOf } from './format'
import { splitTail, tailTarget } from './paletteQuery'
import { PRESETS, presetLabel } from './presets'
import { fromTravel, toTravel } from './travel'
import { useModalDialog } from './useModalDialog'

import type { ControlKey, Controls } from '../core/controls'
import type { SliderDef } from './controls'
import type { PresetDef } from './presets'
import type { KeyboardEvent } from 'react'

export interface PaletteAction {
  name: string
  blurb: string
  run: () => void
}

type Item =
  | { kind: 'preset'; def: PresetDef }
  | { kind: 'control'; slider: SliderDef; group: string }
  | { kind: 'action'; action: PaletteAction }

// One flat index of everything reachable from the palette, built once at module
// load. Presets first so a bare query lands on a look rather than a knob.
const CONTROL_ITEMS: Item[] = GROUPS.flatMap(g =>
  g.sliders.map((slider): Item => ({ kind: 'control', slider, group: g.name })),
)
const PRESET_ITEMS: Item[] = PRESETS.map(def => ({ kind: 'preset', def }))

const MAX_RESULTS = 40

// Name match beats prose match, and an earlier hit in the name beats a later
// one, so typing "vhs" ranks the preset above the sliders that mention VHS.
function score(query: string, name: string, prose: string): number {
  const i = name.toLowerCase().indexOf(query)
  if (i >= 0) return 1000 - i
  // One scan of the prose, not two. This runs over every preset, control and
  // action on each keystroke, and the miss is the common case — so the branch
  // that used to ask `includes` and then `indexOf` for the same answer was
  // lowercasing and walking the help text twice for every row that did not
  // match.
  const j = prose.toLowerCase().indexOf(query)
  return j >= 0 ? 100 - Math.min(99, j / 8) : -1
}

const itemName = (it: Item) =>
  it.kind === 'preset'
    ? presetLabel(it.def)
    : it.kind === 'control'
      ? it.slider.label
      : it.action.name

const itemProse = (it: Item) =>
  it.kind === 'preset'
    ? `${it.def.group} ${it.def.blurb}`
    : it.kind === 'control'
      ? `${it.group} ${it.slider.help}`
      : it.action.blurb

// A control's coarse nudge: 1% of its span for continuous knobs, one mode for
// discrete ones, snapped back onto the control's own step grid.
//
// 1% of *travel* on a curved control, which is the same gesture read off the
// track the panel draws rather than off the raw span — and has to be, or a nudge
// on a fine-at-zero control jumps straight past everything it was curved for
// (1% of rotate's span is 3.6°, where the whole spiral lives inside the first
// half degree) and a nudge on the synth oscillator moves it 80 kHz.
function nudge(s: SliderDef, value: number, dir: number): number {
  if (s.choices !== undefined)
    return Math.max(s.min, Math.min(s.max, Math.round(value + dir)))
  if (s.curve !== undefined)
    return snapToStep(
      s,
      fromTravel(s, Math.max(0, Math.min(1, toTravel(s, value) + dir * 0.01))),
    )
  const delta = Math.max(
    s.step,
    Math.round((s.max - s.min) / 100 / s.step) * s.step,
  )
  const next = Math.round((value + dir * delta) / s.step) * s.step
  return Math.max(s.min, Math.min(s.max, next))
}

const readout = (s: SliderDef, value: number): string =>
  readingOf(value, s.step, s.unit, s.choices)

export function CommandPalette(props: {
  controls: Controls
  actions: PaletteAction[]
  onApplyPreset: (name: string, patch: Partial<Controls>) => void
  onMixStart: () => void
  onWriteControl: (key: ControlKey, value: number) => void
  // Surfaces a control in the panel behind the palette by filtering to it —
  // every section force-opens while a filter is live, so this reaches controls
  // in collapsed stages and in the contextual A/B and audio sections alike.
  onRevealControl: (label: string) => void
  onClose: () => void
}) {
  const ref = useModalDialog()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const q = query.trim().toLowerCase()
  const pool = [
    ...PRESET_ITEMS,
    ...CONTROL_ITEMS,
    ...props.actions.map((action): Item => ({ kind: 'action', action })),
  ]
  const search = (text: string) =>
    pool
      .map(it => ({ it, s: score(text, itemName(it), itemProse(it)) }))
      .filter(r => r.s >= 0)
      .toSorted((a, b) => b.s - a.s)
      .slice(0, MAX_RESULTS)
      .map(r => r.it)

  // The head first, and the whole query when the head finds nothing: a control
  // named with a number in it ("vbi test signals 2") is then still reachable by
  // typing its name, and the split costs that query nothing.
  const { head, tail } = splitTail(q)
  const headHits = head === '' || head === q ? [] : search(head)
  const results =
    q === ''
      ? pool.filter(it => it.kind !== 'control').slice(0, MAX_RESULTS)
      : headHits.length > 0
        ? headHits
        : search(q)

  const selected =
    results.length === 0 ? null : results[Math.min(cursor, results.length - 1)]
  // Where the tail sends one row, and null on every row it says nothing about.
  // Asked per row rather than of the cursor, because a click can land on a row
  // the cursor is not on — and because each row shows its own answer.
  //
  // Only against what the head found: with the whole query searched, the tail is
  // part of the name that matched, and setting a control to it would be reading
  // one word two ways.
  const rowTarget = (it: Item) =>
    it.kind === 'control' && headHits.length > 0
      ? tailTarget(it.slider, tail)
      : null
  const choose = (it: Item) => {
    if (it.kind === 'preset') {
      props.onMixStart()
      props.onApplyPreset(it.def.name, it.def.patch)
      props.onClose()
    } else if (it.kind === 'action') {
      it.action.run()
      props.onClose()
    } else {
      const to = rowTarget(it)
      if (to === null) props.onRevealControl(it.slider.label)
      else props.onWriteControl(it.slider.key, to)
      props.onClose()
    }
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const n = results.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => (n === 0 ? 0 : (Math.min(c, n - 1) + 1) % n))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => (n === 0 ? 0 : (Math.min(c, n - 1) + n - 1) % n))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selected !== null) choose(selected)
    } else if (
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
      selected?.kind === 'control'
    ) {
      // Adjust without leaving: the picture is right there behind the palette.
      e.preventDefault()
      const s = selected.slider
      props.onWriteControl(
        s.key,
        nudge(s, props.controls[s.key], e.key === 'ArrowRight' ? 1 : -1),
      )
    }
  }

  return (
    <dialog
      ref={ref}
      className={cx(dlg.modal, styles.paletteModal)}
      aria-label="command palette"
      onCancel={props.onClose}
      onClick={e => {
        if (e.target === ref.current) props.onClose()
      }}
    >
      <div className={styles.paletteCard} onKeyDown={onKeyDown}>
        <input
          data-autofocus
          className={styles.paletteInput}
          type="text"
          placeholder="jump to a preset, control, or action…"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setCursor(0)
          }}
        />
        <div className={styles.paletteList}>
          {results.length === 0 ? (
            <div className={styles.paletteEmpty}>
              nothing matches “{query.trim()}”
            </div>
          ) : (
            results.map((it, i) => {
              // On the cursor's row alone. Every row a search hit can take the
              // tail, and drawn on all of them the list read as four controls
              // about to move — with three of them showing 9 clamped to their
              // own ceiling, which is a promise about a press that will never
              // happen. Hovering claims the cursor, so the arrow is still there
              // before the row is clicked.
              const to = it === selected ? rowTarget(it) : null
              return (
                <button
                  key={`${it.kind}:${itemName(it)}`}
                  className={cx(
                    styles.paletteRow,
                    it === selected && styles.paletteRowOn,
                  )}
                  // Movement, not entry: a pointer left resting over the list
                  // would otherwise claim the cursor back from the arrow keys
                  // every time the results re-rendered under it.
                  onPointerMove={() => setCursor(i)}
                  onClick={() => choose(it)}
                >
                  <span className={styles.paletteKind}>
                    {it.kind === 'preset'
                      ? 'preset'
                      : it.kind === 'control'
                        ? 'control'
                        : 'action'}
                  </span>
                  <span className={styles.paletteName}>{itemName(it)}</span>
                  <span className={styles.paletteSub}>
                    {it.kind === 'control' ? it.group : itemProse(it)}
                  </span>
                  {it.kind === 'control' ? (
                    <span className={styles.paletteValue}>
                      {readout(it.slider, props.controls[it.slider.key])}
                      {to === null ? null : ` → ${readout(it.slider, to)}`}
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
        <div className={styles.paletteFoot}>
          ↑↓ move · ↵ apply or jump · ←→ nudge a control live · “noise 9” sets
          one · esc close
        </div>
      </div>
    </dialog>
  )
}
