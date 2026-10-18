import styles from './Diagram.module.css'
import { Label } from './DiagramParts'
import {
  BARS,
  BURST_ANGLE,
  sliceContour,
  unsmooth,
  type HueSlice,
  type PolarPoint,
} from './hueKey'
import own from './HueWheel.module.css'

const LEVELS = [0.06, 0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.9]
const STEPS = 96
const LABEL_GAP = 7

// A hue keyer's slice drawn on the U/V plane, vectorscope way up: +U to the
// right, +V up, the 75% bars and the burst marked round the rim. Each band is
// a level the slice reaches, so the stack shades it from its edges in, and the
// line is where it is half way.
export function HueWheel({
  cx,
  cy,
  radius,
  rim,
  slice,
  invert,
  on,
  strength,
  dot,
  names,
}: {
  cx: number
  cy: number
  radius: number
  /** The chroma the rim stands for, in the slice's own units. */
  rim: number
  slice: HueSlice
  /** Shades outside the slice. */
  invert?: boolean
  on: boolean
  /** How much of the slice acts, 0 to 1. */
  strength?: number
  dot?: PolarPoint & { label: string }
  /** Names the bars and the burst, which a small wheel has no room for. */
  names?: boolean
}) {
  const k = radius / rim
  const point = (angle: number, r: number) => {
    const d = Math.min(r, rim) * k
    return [cx + d * Math.cos(angle), cy - d * Math.sin(angle)] as const
  }
  const xy = (angle: number, r: number) =>
    point(angle, r)
      .map(n => n.toFixed(1))
      .join(' ')
  const disk = `M${cx + radius} ${cy} A${radius} ${radius} 0 1 0 ${cx - radius} ${cy} A${radius} ${radius} 0 1 0 ${cx + radius} ${cy} Z`
  const region = (level: number) => {
    const c = sliceContour(slice, level, STEPS)
    if (!c) return ''
    const inner = `M${c.edge.map(p => xy(p.angle, p.r)).join(' L')} Z`
    if (c.whole) return `${disk} ${inner}`
    const outer = c.edge.toReversed().map(p => xy(p.angle, rim))
    return `M${c.edge.map(p => xy(p.angle, p.r)).join(' L')} L${outer.join(' L')} Z`
  }
  const halfway = () => {
    const c = sliceContour(slice, 0.5, STEPS)
    if (!c) return ''
    const line = c.edge.map(p => xy(p.angle, p.r)).join(' L')
    if (c.whole) return `M${line} Z`
    const first = c.edge[0]!.angle
    const last = c.edge.at(-1)!.angle
    return `M${xy(first, rim)} L${line} L${xy(last, rim)}`
  }
  const band = (level: number) =>
    invert ? `${disk} ${region(1 - level)}` : region(level)
  const ring = (angle: number) => {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const d = radius + LABEL_GAP
    return {
      x: cx + d * c,
      y: cy - d * s + 3 - (s > 0.7 ? 2 : 0) + (s < -0.7 ? 5 : 0),
      anchor: c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle',
    } as const
  }
  const burst = ring(BURST_ANGLE)
  const hueEnd = xy(slice.hue, rim)
  const dotAt = dot && point(dot.angle, dot.r)

  return (
    <>
      <path d={disk} className={own.face} />
      <line
        x1={cx - radius}
        x2={cx + radius}
        y1={cy}
        y2={cy}
        className={styles.grid}
      />
      <line
        x1={cx}
        x2={cx}
        y1={cy - radius}
        y2={cy + radius}
        className={styles.grid}
      />
      <g opacity={on ? 0.35 + 0.65 * (strength ?? 1) : 1}>
        {LEVELS.map(level => (
          <path
            key={level}
            d={band(level)}
            fillRule="evenodd"
            className={on ? own.band : own.bandOff}
          />
        ))}
        <path d={halfway()} className={on ? own.edge : own.edgeOff} />
      </g>
      <circle
        cx={cx}
        cy={cy}
        r={Math.min(slice.clip, rim) * k}
        className={own.clip}
      />
      <path
        d={`M${cx} ${cy} L${hueEnd}`}
        className={on ? own.hueOn : own.hue}
      />
      {BARS.map(b => {
        const at = ring(b.angle)
        const [x, y] = point(b.angle, b.r)
        return (
          <g key={b.name}>
            <circle cx={x} cy={y} r={1.6} className={own.bar} />
            {names !== false && (
              <Label x={at.x} y={at.y} anchor={at.anchor}>
                {b.name}
              </Label>
            )}
          </g>
        )
      })}
      <line
        x1={cx - radius}
        x2={cx - radius - 4}
        y1={cy}
        y2={cy}
        className={own.tick}
      />
      {names !== false && (
        <Label x={burst.x - 2} y={burst.y} anchor="end">
          burst
        </Label>
      )}
      {dotAt && dot && (
        <>
          <circle cx={dotAt[0]} cy={dotAt[1]} r={3} className={own.dot} />
          <Label x={dotAt[0] + 5} y={dotAt[1] - 4}>
            {dot.label}
          </Label>
        </>
      )}
    </>
  )
}

// A luma keyer's slice on a 0-100 IRE scale, shaded the same way as the wheel:
// fb_composite.wgsl keyGate's level branch rises from level − soft to
// level + soft, so the slice is everything above it, or below it inverted.
export function LevelBar({
  x,
  top,
  bottom,
  level,
  soft,
  invert,
  on,
  strength,
}: {
  x: number
  top: number
  bottom: number
  level: number
  soft: number
  invert?: boolean
  on: boolean
  strength?: number
}) {
  const w = 10
  const y = (ire: number) =>
    bottom - ((bottom - top) * Math.min(Math.max(ire, 0), 100)) / 100
  const reach = (lv: number) => level - soft + 2 * soft * unsmooth(lv)
  const band = (lv: number) => {
    const edge = y(invert ? reach(1 - lv) : reach(lv))
    return invert
      ? { y: edge, height: bottom - edge }
      : { y: top, height: edge - top }
  }
  return (
    <>
      <rect
        x={x}
        y={top}
        width={w}
        height={bottom - top}
        className={own.face}
      />
      <g opacity={on ? 0.35 + 0.65 * (strength ?? 1) : 1}>
        {LEVELS.map(lv => (
          <rect
            key={lv}
            x={x}
            width={w}
            {...band(lv)}
            className={on ? own.band : own.bandOff}
          />
        ))}
      </g>
      <line
        x1={x - 3}
        x2={x + w + 3}
        y1={y(level)}
        y2={y(level)}
        className={on ? own.hueOn : own.hue}
      />
      <Label x={x - 4} y={top + 3} anchor="end">
        100
      </Label>
      <Label x={x - 4} y={bottom + 3} anchor="end">
        0
      </Label>
      <Label x={x + w + 5} y={y(level) + 3}>
        {String(Math.round(level))}
      </Label>
    </>
  )
}
