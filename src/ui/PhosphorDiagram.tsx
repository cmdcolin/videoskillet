import {
  openBox,
  useReadings,
  useSelectedBox,
  stageBoxes,
  polyline,
  rightOf,
} from './diagram'
import styles from './Diagram.module.css'
import { BoxRows, Boxes, Diagram, Label, Wire } from './DiagramParts'
import own from './PhosphorDiagram.module.css'
import {
  afterglow,
  afterglowSpan,
  burnEfficiency,
  dosePerSecond,
  FIELD_HZ,
} from './phosphorModel'
import { PlotProbe } from './PlotProbe'
import { PHOSPHOR_KEYS, PHOSPHOR_OPENS as OPENS } from './schematicKeys'

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 46
const H = 20
const COL = {
  primaries: { x: 30, w: 64 },
  persistence: { x: 112, w: 66 },
  scatter: { x: 117, w: 56 },
  gun: { x: 198, w: 34 },
  burn: { x: 250, w: 40 },
}
const LOOP = { out: 188, back: 102 }
const PLOT = { top: 72, bottom: 112 }
const LEFT_PLOT = { left: 26, right: 150 }
const RIGHT_PLOT = { left: 196, right: 326 }
const HEIGHT = PLOT.bottom + 14
const CHANNELS = ['r', 'g', 'b'] as const
const DASH = { r: own.red, g: '', b: own.blue }
const DOSE_SPAN = 4
const BURN_POINTS = 41
const LABEL_GAP = 10
const GLOW_FLOOR = 0.001

const span = (seconds: number) =>
  seconds < 60
    ? `${Number(seconds.toPrecision(2))} s`
    : `${Number((seconds / 60).toPrecision(2))} min`

// Short ticks under a plot: every field while they are a few pixels apart,
// then every second, then every ten.
function fieldTicks(fields: number) {
  const every = fields <= 30 ? 1 : fields <= 600 ? FIELD_HZ : 10 * FIELD_HZ
  return Array.from(
    { length: Math.floor(fields / every) + 1 },
    (_, i) => (i * every) / fields,
  )
}

const fieldsLabel = (fields: number) =>
  fields < 60 ? `${fields} fields` : span(fields / FIELD_HZ)

// Each channel's label at the curve's right end, nudged apart where the curves
// end close together.
function endLabels(ends: readonly number[], top: number, bottom: number) {
  const order = ends.map((_, i) => i).toSorted((a, b) => ends[a]! - ends[b]!)
  const placed = [...ends]
  order.forEach((i, n) => {
    if (n > 0)
      placed[i] = Math.max(ends[i]!, placed[order[n - 1]!]! + LABEL_GAP)
  })
  const over = Math.max(placed[order.at(-1)!]! - (bottom + 3), 0)
  return placed.map(y => Math.max(y - over, top + 3))
}

// Three channels against a 0 to 1 axis, told apart by dash and named at their
// right ends.
function ChannelPlot({
  left,
  right,
  top,
  bottom,
  title,
  series,
  ends,
  ticks,
  floor,
  on,
  along,
}: {
  left: number
  right: number
  top: number
  bottom: number
  title: string
  series: readonly (readonly number[])[]
  ends: readonly [string, string]
  ticks?: readonly number[]
  /** A log axis from this up to 1, gridded by decade. */
  floor?: number
  on: boolean
  /** Names the place a fraction of the way across the axis stands for. */
  along: (fraction: number) => string
}) {
  const x = (i: number, n: number) => left + ((right - left) * i) / (n - 1)
  const at = (v: number) =>
    floor
      ? 1 - Math.log10(Math.max(v, floor)) / Math.log10(floor)
      : Math.max(v, 0)
  const y = (v: number) => bottom - (bottom - top) * Math.min(at(v), 1)
  const grid = floor
    ? Array.from(
        { length: Math.round(-Math.log10(floor)) + 1 },
        (_, i) => 10 ** -i,
      )
    : [0, 1]
  const curves = CHANNELS.map((_, c) =>
    polyline(series.map((p, i) => [x(i, series.length), y(p[c]!)])),
  )
  const labelY = endLabels(
    CHANNELS.map((_, c) => y(series.at(-1)![c]!)),
    top,
    bottom,
  )
  return (
    <>
      <Label x={left} y={top - 6}>
        {title}
      </Label>
      {grid.map(v => (
        <line
          key={v}
          x1={left}
          x2={right}
          y1={y(v)}
          y2={y(v)}
          className={styles.grid}
        />
      ))}
      {grid.map(v => (
        <Label key={v} x={left - 3} y={y(v) + 3} anchor="end">
          {v === floor ? '' : String(v)}
        </Label>
      ))}
      {ticks?.map(t => (
        <line
          key={t}
          x1={left + (right - left) * t}
          x2={left + (right - left) * t}
          y1={bottom}
          y2={bottom - 3}
          className={own.tick}
        />
      ))}
      <Label x={left} y={bottom + 11}>
        {ends[0]}
      </Label>
      <Label x={right} y={bottom + 11} anchor="end">
        {ends[1]}
      </Label>
      {curves.map((d, c) => (
        <path
          key={CHANNELS[c]}
          d={d}
          className={`${on ? styles.curveOn : styles.curve} ${DASH[CHANNELS[c]!]}`}
        />
      ))}
      {CHANNELS.map((name, c) => (
        <Label key={name} x={right + 3} y={labelY[c]! + 3}>
          {name}
        </Label>
      ))}
      <PlotProbe
        left={left}
        right={right}
        top={top}
        bottom={bottom}
        read={fraction => {
          const i = Math.round(fraction * (series.length - 1))
          const here = series[i]!
          return {
            x: x(i, series.length),
            y: y(here[1]!),
            text: `${along(i / (series.length - 1))} · g ${Number(here[1]!.toPrecision(2))}`,
          }
        }}
      />
    </>
  )
}

// The tube's phosphor layer as decode.wgsl runs it. The phosphor set's
// primaries tint the decoded picture, the layer holds the light it emitted
// and gives it back each field through the scatter in the deposit, the gun's
// transfer shapes what it writes, and the wear the coating has taken dims it.
// Under the drawing, what a white patch leaves after the beam moves on, and
// what the coating gives back once static white has worn it.
export function PhosphorDiagram() {
  const r = useReadings(PHOSPHOR_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const tube = {
    phosphor: v('phosphor'),
    phosphorSkew: v('phosphorSkew'),
    phosphorMode: v('phosphorMode'),
  }
  const held = tube.phosphor > 0
  const fields = afterglowSpan(tube)
  const glow = afterglow(tube, fields)
  const rate = dosePerSecond(v('burnRate'))
  const wear = Array.from({ length: BURN_POINTS }, (_, i) =>
    burnEfficiency(v('burnDepth'), (DOSE_SPAN * i) / (BURN_POINTS - 1)),
  )

  const box = stageBoxes(OPENS, H, r)
  const boxes = [
    box(
      'primaries',
      COL.primaries,
      TOP_Y,
      'phosphors',
      'The phosphor set fixes the primaries, and the decoder converts its colour to them in linear light.',
    ),
    box(
      'persistence',
      COL.persistence,
      TOP_Y,
      'afterglow',
      'The layer holds the light it emitted and gives back a share each field. The share falls as the square of what is left, and red and blue fall faster than green.',
      { off: !held },
    ),
    box(
      'scatter',
      COL.scatter,
      BOT_Y,
      'scatter',
      'Held light spreads sideways through the deposit into its neighbours each field, so the older light in a trail is wider.',
      { off: !held },
    ),
    {
      x: COL.gun.x,
      y: TOP_Y - H / 2,
      w: COL.gun.w,
      h: H,
      name: 'gun',
      touched: false,
      help: "The gun's cutoff and gamma sit in the tube face group. Burn-in wears the coating by the light the gun puts out.",
    },
    box(
      'burn',
      COL.burn,
      TOP_Y,
      'burn',
      'Each field adds wear to the coating by the light it carried, and a worn patch gives back less light, blue least of all.',
    ),
  ]
  const at = (id: keyof typeof COL) => COL[id].x
  const end = (id: keyof typeof COL) => rightOf(COL[id])
  const loopLook = held ? (r.touched('phosphorBleed') ? 'on' : 'plain') : 'dash'

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="phosphor layer">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              video
            </Label>
            <Wire arrow={arrow} d={`M0 ${TOP_Y} H${at('primaries')}`} />
            <Wire
              arrow={arrow}
              d={`M${end('primaries')} ${TOP_Y} H${at('persistence')}`}
            />
            <Wire
              arrow={arrow}
              d={`M${end('persistence')} ${TOP_Y} H${at('gun')}`}
            />
            <Wire arrow={arrow} d={`M${end('gun')} ${TOP_Y} H${at('burn')}`} />
            <Wire arrow={arrow} d={`M${end('burn')} ${TOP_Y} H${WIDTH - 2}`} />
            <Label x={WIDTH} y={TOP_Y - 6} anchor="end">
              glass
            </Label>
            <Wire
              arrow={arrow}
              d={`M${LOOP.out} ${TOP_Y} V${BOT_Y} H${end('scatter')}`}
              look={loopLook}
            />
            <Wire
              arrow={arrow}
              d={`M${at('scatter')} ${BOT_Y} H${LOOP.back} V${TOP_Y + 3}`}
              look={loopLook}
            />
            <Label x={LOOP.out + 4} y={BOT_Y + 3}>
              held light
            </Label>

            <Boxes boxes={boxes} pick={pick} />

            <ChannelPlot
              {...LEFT_PLOT}
              {...PLOT}
              title="afterglow of white"
              series={glow}
              ends={['beam leaves', fieldsLabel(fields)]}
              ticks={fieldTicks(fields)}
              floor={GLOW_FLOOR}
              on={held}
              along={f => `${Number((f * fields).toPrecision(2))} fields`}
            />
            <ChannelPlot
              {...RIGHT_PLOT}
              {...PLOT}
              title="burn-in, static white"
              series={wear}
              ends={['new', rate > 0 ? span(DOSE_SPAN / rate) : 'no wear']}
              on={r.touched(...OPENS.burn)}
              along={f => (rate > 0 ? span((f * DOSE_SPAN) / rate) : 'no wear')}
            />
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
