import { FSC, SAMPLES_PER_LINE } from '../core/signal/constants'
import { openBox, useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import own from './EnhancerDiagram.module.css'
import {
  enhancedLine,
  gateSample,
  howls,
  peaking,
  peakingGains,
  type Enhancer,
} from './enhancerModel'
import { alongRange } from './plotAlong'
import { ENHANCER_KEYS, ENHANCER_OPENS as OPENS } from './schematicKeys'
import { LINE_US, PICTURE_BAND } from './testLine'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const H = 20
const LOOP_Y = 38
const ROW = {
  clamp: { x: 34, w: 46 },
  droop: { x: 98, w: 46 },
  peaking: { x: 162, w: 60 },
  regen: { x: 244, w: 72 },
} satisfies Record<Part, { x: number; w: number }>

const BAND_MHZ = 6
const POINTS = 241
const CURVE_MHZ = Array.from(
  { length: POINTS },
  (_, i) => (BAND_MHZ * i) / (POINTS - 1),
)
const PLOT = { top: 78, bottom: 122 }
const FREQ = { left: 24, right: 164, ...PLOT }
const GAIN_LO = 0.25
const GAIN_HI = 32
const GAIN_TICKS = [1, 4, 16]
const MHZ_TICKS = [0, 2, 4, BAND_MHZ]
const LINE = { left: 200, right: 336, ...PLOT }
const HEIGHT = LINE.bottom + 14
const FSC_MHZ = FSC / 1e6

const freqX = (mhz: number) =>
  FREQ.left + ((FREQ.right - FREQ.left) * mhz) / BAND_MHZ
const freqY = (g: number) =>
  FREQ.bottom -
  ((FREQ.bottom - FREQ.top) *
    Math.log2(Math.min(Math.max(g, GAIN_LO), GAIN_HI) / GAIN_LO)) /
    Math.log2(GAIN_HI / GAIN_LO)
const lineX = (s: number) =>
  LINE.left + ((LINE.right - LINE.left) * s) / (SAMPLES_PER_LINE - 1)
const after = (id: Part) => ROW[id].x + ROW[id].w
const LOOP_L = ROW.peaking.x + 12
const LOOP_R = after('peaking') - 12
const ire = (v: number) => (v < 0 ? `−${-v}` : String(v))

// The bent enhancer as enhancer.wgsl runs it, one box per stage in the order a
// line meets them: the clamp gate, the coupling capacitor that droops between
// gates, the peaking resonator with its regeneration loop, and the sync
// regenerator. Under the drawing, the peaking stage's gain at each frequency,
// and one line of a black picture with a white bar as it leaves the box.
export function EnhancerDiagram() {
  const r = useReadings(ENHANCER_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const e: Enhancer = {
    clampUs: v('enhClampUs'),
    droopUs: v('enhDroopUs'),
    peakMHz: v('enhPeakMHz'),
    peakQ: v('enhPeakQ'),
    peakBoost: v('enhPeakBoost'),
    sync: v('enhSync'),
    sliceIre: v('enhSliceIre'),
  }
  const peak = peaking(e)
  const howl = howls(e)
  const gains = peakingGains(e, CURVE_MHZ)
  const line = enhancedLine(e)
  const gate = lineX(gateSample(e))
  const curve = gains
    .map(
      (g, i) =>
        `${i === 0 ? 'M' : 'L'}${freqX(CURVE_MHZ[i]!).toFixed(1)} ${freqY(g).toFixed(1)}`,
    )
    .join(' ')
  const peakLook: WireLook = howl ? 'alarm' : peak ? 'on' : 'plain'
  const looks: Record<Part, WireLook> = {
    clamp: e.clampUs !== 0 ? 'on' : 'plain',
    droop: e.droopUs > 0 ? 'on' : 'plain',
    peaking: peakLook,
    regen: e.sync > 0 ? 'on' : 'plain',
  }

  const box = (id: Part, name: string, help: string): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: ROW[id].x,
    y: TOP_Y - H / 2,
    w: ROW[id].w,
    h: H,
    name,
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'clamp',
      'clamp',
      'The DC restorer. A gate pins one sample per line to blanking and the rest of the line rides on it. Slid into the picture, the gate pins picture content to blanking; slid onto the sync tip, it lifts the whole line.',
    ),
    box(
      'droop',
      'droop',
      'The coupling capacitor between gates. With a short time constant the level sags back toward blanking along the line, so a bright bar trails a dark streak.',
    ),
    box(
      'peaking',
      'peaking',
      "A two-pole resonator at the detail frequency, mixed back into the video by the boost. The regeneration loop sets the pole radius: low rings briefly after each edge, and from 0.75 the ring grows by itself until it reaches the amplifier's ±120 IRE rails.",
    ),
    box(
      'regen',
      'sync regen',
      'The stabilizer: a lowpass separator slices the video at the slice level and stamps a 4.7 µs pulse at every crossing, everywhere except over burst. Above blanking, dark picture trips it mid-line.',
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="bent video enhancer">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              video
            </Label>
            <Wire arrow={arrow} d={`M0 ${TOP_Y} H${ROW.clamp.x}`} />
            <Wire
              arrow={arrow}
              d={`M${after('clamp')} ${TOP_Y} H${ROW.droop.x}`}
              look={looks.clamp}
            />
            <Wire
              arrow={arrow}
              d={`M${after('droop')} ${TOP_Y} H${ROW.peaking.x}`}
              look={looks.droop}
            />
            <Wire
              arrow={arrow}
              d={`M${after('peaking')} ${TOP_Y} H${ROW.regen.x}`}
              look={looks.peaking}
            />
            <Wire
              arrow={arrow}
              d={`M${after('regen')} ${TOP_Y} H${WIDTH - 2}`}
              look={looks.regen}
            />
            <Label x={WIDTH - 2} y={TOP_Y - 6} anchor="end">
              out
            </Label>
            <Wire
              arrow={arrow}
              d={`M${LOOP_R} ${TOP_Y + H / 2} V${LOOP_Y} H${LOOP_L} V${TOP_Y + H / 2}`}
              look={peak ? peakLook : 'dash'}
            />
            <text
              x={(LOOP_L + LOOP_R) / 2}
              y={LOOP_Y + 11}
              textAnchor="middle"
              className={howl ? own.alarm : peak ? styles.noteOn : styles.note}
            >
              regen
            </text>

            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <text
              x={FREQ.left}
              y={FREQ.top - 6}
              className={howl ? own.alarm : styles.note}
            >
              {howl ? 'peaking howls' : 'peaking gain'}
            </text>
            {GAIN_TICKS.map(g => (
              <line
                key={g}
                x1={FREQ.left}
                x2={FREQ.right}
                y1={freqY(g)}
                y2={freqY(g)}
                className={g === 1 ? styles.unity : styles.grid}
              />
            ))}
            <line
              x1={FREQ.left}
              x2={FREQ.right}
              y1={FREQ.bottom}
              y2={FREQ.bottom}
              className={styles.grid}
            />
            {GAIN_TICKS.map(g => (
              <Label key={g} x={FREQ.left - 4} y={freqY(g) + 3} anchor="end">
                {`${g}×`}
              </Label>
            ))}
            <line
              x1={freqX(FSC_MHZ)}
              x2={freqX(FSC_MHZ)}
              y1={FREQ.top}
              y2={FREQ.bottom}
              className={own.fsc}
            />
            <Label x={freqX(FSC_MHZ)} y={FREQ.top - 6} anchor="middle">
              fsc
            </Label>
            {MHZ_TICKS.map(n => (
              <Label
                key={n}
                x={freqX(n)}
                y={FREQ.bottom + 11}
                anchor={n === BAND_MHZ ? 'end' : 'middle'}
              >
                {n === BAND_MHZ ? `${n} MHz` : String(n)}
              </Label>
            ))}
            <path
              d={curve}
              className={
                howl ? styles.curveAlarm : peak ? styles.curveOn : styles.curve
              }
            />
            {howl && (
              <line
                x1={freqX(e.peakMHz)}
                x2={freqX(e.peakMHz)}
                y1={freqY(1)}
                y2={FREQ.top}
                className={styles.wireAlarm}
              />
            )}

            <TracePlot
              {...LINE}
              title="one line, IRE"
              values={line}
              scale={{ lo: -60, hi: 140, ticks: [0, 100], reference: 0 }}
              format={ire}
              ends={['', `${LINE_US.toFixed(1)} µs`]}
              along={alongRange(0, LINE_US, 'µs')}
              band={PICTURE_BAND}
              look={
                howl ? 'alarm' : r.touched(...ENHANCER_KEYS) ? 'on' : 'plain'
              }
            />
            <line
              x1={gate}
              x2={gate}
              y1={LINE.bottom}
              y2={LINE.bottom + 4}
              className={e.clampUs !== 0 ? own.gateOn : own.gate}
            />
            <Label
              x={gate}
              y={LINE.bottom + 11}
              anchor="middle"
              on={e.clampUs !== 0}
            >
              gate
            </Label>
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
