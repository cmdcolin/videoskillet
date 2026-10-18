import styles from './Diagram.module.css'
import { Label } from './DiagramParts'
import own from './TracePlot.module.css'

export type TraceLook = 'plain' | 'on' | 'alarm'

const CURVE: Record<TraceLook, string> = {
  plain: styles.curve!,
  on: styles.curveOn!,
  alarm: styles.curveAlarm!,
}

/** A fixed axis, or one symmetric about 0 that grows to hold the trace. */
export type TraceScale =
  | { lo: number; hi: number; ticks: readonly number[]; reference: number }
  | { floor: number }

// The smallest of 1, 2 or 5 times a power of ten that holds `v`, and never
// less than `floor`, so a scale only steps when the trace outgrows it.
function niceSpan(v: number, floor: number) {
  const need = Math.max(Math.abs(v), floor)
  const decade = 10 ** Math.floor(Math.log10(need))
  return [1, 2, 5, 10].map(m => m * decade).find(s => s >= need - 1e-9)!
}

function axisOf(scale: TraceScale, values: readonly number[]) {
  if (!('floor' in scale)) return scale
  const span = niceSpan(Math.max(...values.map(Math.abs)), scale.floor)
  return { lo: -span, hi: span, ticks: [-span, 0, span], reference: 0 }
}

const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')

// One trace against an evenly spaced axis, drawn into a Diagram. A jump larger
// than `breakOver` between neighbours lifts the pen, which is where a wrapped
// offset crosses from one edge of its range to the other.
export function TracePlot({
  left,
  right,
  top,
  bottom,
  title,
  values,
  scale,
  format,
  ends,
  look,
  band,
  breakOver,
}: {
  left: number
  right: number
  top: number
  bottom: number
  title: string
  values: readonly number[]
  /** A fixed axis names its gridded values and the one the trace rests at,
      which is drawn dashed. */
  scale: TraceScale
  format?: (v: number) => string
  /** Labels under the left and right ends of the axis. */
  ends: readonly [string, string]
  look: TraceLook
  /** The stretch of the axis, as fractions of it, that the plot shades. */
  band?: readonly [number, number]
  breakOver?: number
}) {
  const { lo, hi, ticks, reference } = axisOf(scale, values)
  const x = (i: number) =>
    left + ((right - left) * i) / Math.max(values.length - 1, 1)
  const y = (v: number) =>
    bottom - ((bottom - top) * (Math.min(Math.max(v, lo), hi) - lo)) / (hi - lo)
  const path = values
    .map((v, i) => {
      const lift =
        i === 0 || Math.abs(v - values[i - 1]!) > (breakOver ?? Infinity)
      return `${lift ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
    })
    .join(' ')
  return (
    <>
      <Label x={left} y={top - 6}>
        {title}
      </Label>
      {band && (
        <rect
          x={left + (right - left) * band[0]}
          y={top}
          width={(right - left) * (band[1] - band[0])}
          height={bottom - top}
          className={own.band}
        />
      )}
      {ticks.map(t => (
        <line
          key={t}
          x1={left}
          x2={right}
          y1={y(t)}
          y2={y(t)}
          className={t === reference ? styles.unity : styles.grid}
        />
      ))}
      {ticks.map(t => (
        <Label key={t} x={left - 3} y={y(t) + 3} anchor="end">
          {(format ?? signed)(t)}
        </Label>
      ))}
      <Label x={left} y={bottom + 11}>
        {ends[0]}
      </Label>
      <Label x={right} y={bottom + 11} anchor="end">
        {ends[1]}
      </Label>
      <path d={path} className={CURVE[look]} />
    </>
  )
}
