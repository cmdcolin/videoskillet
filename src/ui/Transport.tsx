import { DEFAULT_CONTROLS } from '../core/controls'
import { clamp01 } from '../core/math'
import { sliderFor } from './controls'
import { useControlValue, useControlsApi } from './ControlsContext'
import { cx } from './cx'
import styles from './Deck.module.css'
import { SHUTTLE_STOPS } from './deckModel'
import { fromTravel, toTravel, TRAVEL_STEP } from './travel'

import type { SliderDef } from './controls'
import type { CSSProperties } from 'react'

// The two rows the strips below throw, read off the schema rather than restated
// here. A span is all the curve needs (min, max, step, curve), so taking the
// SliderDef whole is what makes it impossible for the deck's strip and the stage
// row for the same control to disagree about where play sits — which is exactly
// what they did while the ring's geometry lived in the deck alone.
const TAPE_SPAN: SliderDef = sliderFor('shuttleX')

// The shuttle ring, flattened into a strip.
//
// Geometric in speed (the 'shuttle' curve — see curve.ts), because the
// interesting half of a shuttle is between pause and double and a linear track
// hands that four pixels. Bipolar or not according to the span it is given, so
// a transport with a direction switch of its own would get a forwards-only ring
// off the same component; the deck has none, so its ring is signed.
//
// A range input, not a div with pointer handlers. That was ~50 lines of
// capture, a DOMRect frozen at the press, and a hand-drawn fill and thumb — and
// none of it reachable from a keyboard, which the lever and the pads beside it
// both were. The frozen box in particular was working around a problem the
// browser does not have: it existed because the first nudge takes the speed off
// stock, which at the time grew a section at the top of the panel and shoved
// every row below it, so a gesture measured against clientX aimed at a strip
// that had moved. A range input tracks its own thumb and never notices.
function ShuttleStrip(props: {
  span: SliderDef
  value: number
  disabled: boolean
  title: string
  onChange: (v: number) => void
}) {
  // Where the fill runs from and to: the row's stock — play, on both of these —
  // out to where the ring is set, which is the panel's reading of every other
  // track. The tick that marks the default is the play detent for free.
  const pct = (v: number) => clamp01(toTravel(props.span, v)) * 100
  const at = pct(props.value)
  const def = pct(DEFAULT_CONTROLS[props.span.key])
  const fill: CSSProperties & Record<'--lo' | '--hi' | '--def', string> = {
    '--lo': `${Math.min(at, def)}%`,
    '--hi': `${Math.max(at, def)}%`,
    '--def': `${def}%`,
  }
  return (
    <input
      type="range"
      className={cx(styles.shuttle, props.disabled && styles.shuttleOff)}
      style={fill}
      title={props.title}
      aria-label={props.span.label}
      // The travel is what the input rides, so what it would announce is a
      // 0..1 fraction. The speed is the honest reading, and the one the number
      // beside the strip shows.
      aria-valuetext={`${props.value}x`}
      disabled={props.disabled}
      min={0}
      max={1}
      step={TRAVEL_STEP}
      value={toTravel(props.span, props.value)}
      // Back to play, which is the only stop on here the picture survives.
      onDoubleClick={() => props.onChange(DEFAULT_CONTROLS[props.span.key])}
      onChange={e => {
        const v = fromTravel(props.span, Number(e.target.value))
        // Detents at pause and play, the two speeds worth being able to hit
        // exactly: a ring you cannot park on play is a ring that never gives
        // the picture back. Only pause needs the help now — play is the stock
        // value, so the double-click above lands on it too.
        const snapped = [0, 1, -1].find(d => Math.abs(v - d) < 0.12)
        props.onChange(snapped ?? Number(v.toFixed(2)))
      }}
    />
  )
}

// The deck playing the incoming tape: one speed control, signed, with the four
// speeds that are worth a button.
//
// Head speed, and only that. It is not the clip's playhead and never was: that
// lives under the source picker, where the timeline it addresses is. See
// SHUTTLE_STOPS for why the keys read as numbers rather than as ◀◀ ❚❚ ▶ ▶▶.
export function TapeTransport() {
  const shuttleX = useControlValue('shuttleX')
  const { writeControl } = useControlsApi()
  return (
    <div className={styles.deckRow}>
      <div
        className={styles.deckLabel}
        title="the deck playing the incoming tape — the speed its head sweeps at, while the clip plays on underneath at its own rate. At 1x the head follows one recorded track and the picture is clean"
      >
        tape deck
      </div>
      <div className={styles.stops}>
        {SHUTTLE_STOPS.map(s => (
          <button
            key={s.label}
            className={cx(
              styles.deckBtn,
              shuttleX === s.value && styles.deckBtnOn,
            )}
            title={s.title}
            onClick={() => writeControl('shuttleX', s.value)}
          >
            {s.label}
          </button>
        ))}
        <ShuttleStrip
          span={TAPE_SPAN}
          value={shuttleX}
          disabled={false}
          title="tape speed as a multiple of play — off 1 the head crosses tracks and the noise bars start"
          onChange={v => writeControl('shuttleX', v)}
        />
        <span className={styles.nums}>{`${shuttleX}x`}</span>
      </div>
    </div>
  )
}
