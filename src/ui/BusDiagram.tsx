import styles from './BusDiagram.module.css'
import { clipBus, overloaded, sumBus, whiteAtFader, type Bus } from './busModel'
import { openBox, useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { alongRange } from './plotAlong'
import { BUS_KEYS, BUS_OPENS as OPENS } from './schematicKeys'
import { TracePlot, type TraceLook, type TraceScale } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const A_Y = 14
const B_Y = 44
const H = 20
const SUM_X = 226
const SUM_R = 5
const COL = {
  gainA: { x: 20, w: 49 },
  ring: { x: 244, w: 37 },
  clip: { x: 293, w: 37 },
  timing: { x: 20, w: 49 },
  lock: { x: 83, w: 55 },
  gainB: { x: 152, w: 49 },
} satisfies Record<Part, { x: number; w: number }>

const PLOT = { top: 72, bottom: 116 }
const IN_PLOT = { left: 24, right: 164, ...PLOT }
const FADER_PLOT = { left: 200, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const POINTS = 91
const IN_SPAN = { lo: -150, hi: 300 }
const FADER_SPAN = 3
const OUT: TraceScale = {
  lo: -60,
  hi: 260,
  ticks: [0, 100, 200],
  reference: 0,
}

const ire = (v: number) => (v < 0 ? `−${-v}` : String(v))
const times = (v: number) => (v < 0 ? `−${-v}×` : `${v}×`)
const after = (id: Part) => COL[id].x + COL[id].w
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi)
const dotX = (left: number, right: number, at: number) =>
  left + (right - left) * clamp(at, 0, 1)
const outY = (v: number) =>
  PLOT.bottom -
  ((PLOT.bottom - PLOT.top) * (clamp(v, OUT.lo, OUT.hi) - OUT.lo)) /
    (OUT.hi - OUT.lo)

export function BusDiagram() {
  const r = useReadings(BUS_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const bus: Bus = {
    aGain: v('aGain'),
    bGain: v('bGain'),
    bRing: v('bRing'),
    busClip: v('busClip'),
    genlock: v('bGenlock') > 0.5,
  }
  const live = (id: Part) => r.touched(...OPENS[id])
  const transfer = Array.from({ length: POINTS }, (_, i) =>
    clipBus(
      IN_SPAN.lo + ((IN_SPAN.hi - IN_SPAN.lo) * i) / (POINTS - 1),
      bus.busClip,
    ),
  )
  const sumWhite = sumBus(100, 100, { ...bus, busClip: 0 })
  const faderLine = whiteAtFader(bus, POINTS, FADER_SPAN)
  const hot = overloaded(bus)
  const faderLook: TraceLook = hot
    ? 'alarm'
    : r.touched('aGain', 'bGain', 'bRing', 'bGenlock')
      ? 'on'
      : 'plain'
  const whiteNow = bus.genlock ? 100 : sumBus(100, 100, bus)

  const box = (id: Part, y: number, name: string, help: string): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: COL[id].x,
    y: y - H / 2,
    w: COL[id].w,
    h: H,
    name,
    touched: live(id),
    help,
  })
  const boxes = [
    box(
      'gainA',
      A_Y,
      'A gain',
      "A's level on the summing bus, on the dirty sum only: the clean dissolve sets A to one minus B's fader. Negative inverts A into a difference key that cancels against B.",
    ),
    box(
      'ring',
      A_Y,
      'ring',
      'Multiplies the two composite signals instead of adding them. Two subcarriers multiplied land at their sum and difference, so colour arrives that neither source carries.',
    ),
    box(
      'clip',
      A_Y,
      'clip',
      'How little headroom the summing amplifier has. Its gain falls away toward the rail, and falling gain multiplies the two signals sharing the bus, so a detuned B beats against A into the chroma band.',
    ),
    box(
      'timing',
      B_Y,
      'timing',
      "B's own clocks, free-running against A's: line offset skews B a little more each line, frame roll drifts it vertically, and the subcarrier detune cycles its hue because the decoder locks to A's burst.",
    ),
    box(
      'lock',
      B_Y,
      'genlock',
      "Whether B is locked to the house reference. Off, B is summed into the composite, a wiring fault. On, B is re-encoded on A's raster and the combine is a clean dissolve.",
    ),
    box(
      'gainB',
      B_Y,
      'B gain',
      "How much of B reaches the composite. With genlock off it is the level B is summed in at, and negative inverts B's whole signal, sync tips included. With genlock on it is the crossfade fader.",
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="A/B mixer">
        {arrow => (
          <>
            <Label x={0} y={A_Y - 6}>
              A
            </Label>
            <Wire arrow={arrow} d={`M0 ${A_Y} H${COL.gainA.x}`} />
            <Wire
              arrow={arrow}
              d={`M${after('gainA')} ${A_Y} H${SUM_X - SUM_R}`}
              look={look(live('gainA'))}
            />
            <Wire
              arrow={arrow}
              d={`M${SUM_X + SUM_R} ${A_Y} H${COL.ring.x}`}
              look={look(live('gainA') || live('gainB'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('ring')} ${A_Y} H${COL.clip.x}`}
              look={look(live('ring'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('clip')} ${A_Y} H${WIDTH - 2}`}
              look={look(live('clip'))}
            />
            <circle
              cx={SUM_X}
              cy={A_Y}
              r={SUM_R}
              className={
                live('gainB') || live('gainA') ? styles.sumOn : styles.sum
              }
            />
            <path
              d={`M${SUM_X - 3} ${A_Y} H${SUM_X + 3} M${SUM_X} ${A_Y - 3} V${A_Y + 3}`}
              className={
                live('gainB') || live('gainA') ? styles.sumOn : styles.sum
              }
            />

            <Label x={0} y={B_Y - 6}>
              B
            </Label>
            <Wire arrow={arrow} d={`M0 ${B_Y} H${COL.timing.x}`} />
            <Wire
              arrow={arrow}
              d={`M${after('timing')} ${B_Y} H${COL.lock.x}`}
              look={look(live('timing'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('lock')} ${B_Y} H${COL.gainB.x}`}
              look={look(live('timing') || live('lock'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('gainB')} ${B_Y} H${SUM_X} V${A_Y + SUM_R}`}
              look={look(live('gainB'))}
            />

            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <TracePlot
              {...IN_PLOT}
              title="bus out, IRE"
              values={transfer}
              scale={OUT}
              format={ire}
              ends={[ire(IN_SPAN.lo), ire(IN_SPAN.hi)]}
              along={alongRange(IN_SPAN.lo, IN_SPAN.hi, 'IRE in')}
              look={bus.busClip > 0 ? 'on' : 'plain'}
            />
            {!bus.genlock && (
              <circle
                cx={dotX(
                  IN_PLOT.left,
                  IN_PLOT.right,
                  (sumWhite - IN_SPAN.lo) / (IN_SPAN.hi - IN_SPAN.lo),
                )}
                cy={outY(clipBus(sumWhite, bus.busClip))}
                r={2.5}
                className={hot ? styles.dotAlarm : styles.dot}
              />
            )}

            <TracePlot
              {...FADER_PLOT}
              title="both white, by B gain"
              values={faderLine}
              scale={OUT}
              format={ire}
              ends={[times(-FADER_SPAN), times(FADER_SPAN)]}
              along={alongRange(-FADER_SPAN, FADER_SPAN, '×')}
              look={faderLook}
            />
            <circle
              cx={dotX(
                FADER_PLOT.left,
                FADER_PLOT.right,
                (bus.bGain + FADER_SPAN) / (2 * FADER_SPAN),
              )}
              cy={outY(whiteNow)}
              r={2.5}
              className={hot ? styles.dotAlarm : styles.dot}
            />
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
