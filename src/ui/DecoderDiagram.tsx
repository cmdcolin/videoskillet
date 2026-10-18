import { FSC, SAMPLE_RATE } from '../core/signal/constants'
import {
  bandpass,
  lowpass,
  lowpassCausal,
  lowpassPeaked,
  mixTaps,
  TAPS,
} from '../core/signal/filters'
import local from './DecoderDiagram.module.css'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import { BoxRows, BoxView, Diagram, Label, Wire } from './DiagramParts'
import { DECODER_KEYS, DECODER_OPENS as OPENS } from './schematicKeys'

const READ = [...DECODER_KEYS, 'lumaMHz', 'lumaPeak', 'vbi'] as const

type Part = keyof typeof OPENS

interface Span {
  x: number
  w: number
}
const right = (s: Span) => s.x + s.w
const centre = (s: Span) => s.x + s.w / 2

const WIDTH = 340
const LUMA_Y = 6
const TOP_Y = 30
const BOT_Y = 64
const H = 20
const TAP_X = 54
const ROW = {
  input: { x: 0, w: 44 },
  split: { x: 64, w: 67 },
  demod: { x: 150, w: 78 },
  matrix: { x: 250, w: 46 },
  reference: { x: 100, w: 67 },
  acc: { x: 185, w: 72 },
} satisfies Record<Part, Span>
const REF_UP_X = 158
const ACC_UP_X = 210

const PLOT = { left: 14, right: 334, ceiling: 94, one: 108, zero: 140 }
const LEGEND_Y = PLOT.zero + 28
const HEIGHT = LEGEND_Y + 6
const MHZ_MAX = 6
const POINTS = 241

const plotX = (hz: number) =>
  PLOT.left + ((PLOT.right - PLOT.left) * hz) / (MHZ_MAX * 1e6)
const plotY = (gain: number) =>
  PLOT.zero -
  (PLOT.zero - PLOT.one) *
    Math.min(
      Math.max(gain, 0),
      (PLOT.zero - PLOT.ceiling) / (PLOT.zero - PLOT.one),
    )

type Complex = [number, number]

// A kernel's response to e^{jωn} when the shader reads tap k at offset k − m,
// as every bank section in decode and channel does.
function response(h: Float32Array, hz: number): Complex {
  const m = (h.length - 1) / 2
  const w = (2 * Math.PI * hz) / SAMPLE_RATE
  let re = 0
  let im = 0
  for (let k = 0; k < h.length; k++) {
    re += h[k]! * Math.cos(w * (k - m))
    im += h[k]! * Math.sin(w * (k - m))
  }
  return [re, im]
}

// Linear interpolation between demod outputs taken every `step` samples, as
// its magnitude on the baseband. The aliases the decimation folds in are left
// out.
function lattice(hz: number, step: number): number {
  if (step <= 1 || hz === 0) return 1
  const x = (Math.PI * hz) / SAMPLE_RATE
  const r = Math.sin(step * x) / (step * Math.sin(x))
  return r * r
}

const abs = ([re, im]: Complex) => Math.hypot(re, im)

interface Split {
  luma: number
  chroma: number
  sent: number
  leak: number
}

// What the receiver does to a horizontal frequency, end to end from the
// encoder: the channel's luma section and chroma bandpass (channel.wgsl), the
// demodulator's lowpass heterodyned to fsc and remodulated (decode.wgsl
// demodAt and chromaRecon), and luma as the input minus that remodulated
// chroma. Still detail reaches the chroma path only through the trap; a comb
// cancels it between lines.
function split(
  hz: number,
  demod: Float32Array,
  channelLuma: Float32Array,
  channelChroma: Float32Array,
  encoder: Float32Array,
  r: { step: number; bleed: number; trap: boolean },
): Split {
  const lumaCh = response(channelLuma, hz)[0]
  const bpCh = response(channelChroma, hz)[0]
  const channel = Math.abs(lumaCh * (1 - bpCh) + bpCh)
  const lo = response(demod, hz - FSC)
  const hi = response(demod, hz + FSC)
  const wl = lattice(hz - FSC, r.step)
  const wh = lattice(hz + FSC, r.step)
  const g: Complex = [lo[0] * wl + hi[0] * wh, lo[1] * wl + hi[1] * wh]
  const k = 1 - 2 * r.bleed
  const residue = abs([1 - k * g[0], -k * g[1]])
  const sent =
    Math.abs(response(encoder, hz - FSC)[0] + response(encoder, hz + FSC)[0]) *
    channel
  return {
    luma: channel * (r.trap ? residue : 1),
    chroma: channel * abs(g),
    sent,
    leak: sent * residue,
  }
}

const COMB_NAME = ['trap', '2-line comb', '3-line comb']

const line = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')

const area = (pts: [number, number][]) =>
  `${line(pts)} L${pts.at(-1)![0].toFixed(1)} ${PLOT.zero} L${pts[0]![0].toFixed(1)} ${PLOT.zero} Z`

// The receiver's colour decoder as decode.wgsl runs it. The composite splits
// into luma, which runs over the top to the matrix, and chroma, which the
// demodulator detects against the reference; the burst gated off line_analyze
// pulls the reference and sets the ACC. Underneath, what reaches luma and the
// demodulator across the line, from the taps the filter bank uploads.
export function DecoderDiagram() {
  const r = useReadings(READ)
  const pick = useSelectedBox()
  const v = r.value

  const lock = v('burstLock')
  const comb = Math.round(v('combMode'))
  const bleed = v('svideoBleed')

  const box = (
    id: Part,
    y: number,
    name: string,
    help: string,
    extra: Partial<BoxSpec> = {},
  ): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: ROW[id].x,
    y: y - H / 2,
    w: ROW[id].w,
    h: H,
    name,
    touched: r.touched(...OPENS[id]),
    help,
    ...extra,
  })

  const boxes: BoxSpec[] = [
    box(
      'input',
      TOP_Y,
      'input',
      "The composite as it reaches the decoder. The encoder's colour bandwidth at the camera end sets how wide the chroma sidebands are; the receiver's AGC sets the IF gain off the sync tip, so luma, chroma and the burst all move together.",
    ),
    box(
      'split',
      TOP_Y,
      'Y/C split',
      'What feeds the chroma demodulator. The trap passes the composite as it is, so still detail in the colour band decodes as colour. The 2-line and 3-line combs subtract the line above, or the lines above and below, so only what alternates line to line reaches it. Luma is the composite minus the chroma the demodulator recovered, remodulated onto the subcarrier; S-video bleed scales that subtraction down, and past 0.5 adds the chroma back.',
    ),
    box(
      'demod',
      TOP_Y,
      'demodulator',
      'Two synchronous detectors on the subcarrier, each followed by the chroma lowpass. Bandwidth and trail shape that lowpass; axis is the angle between the detectors; upsample error is how often the demodulator samples before interpolating.',
    ),
    box(
      'matrix',
      TOP_Y,
      'matrix',
      'The YUV to RGB matrix and the three output amplifiers. Clip 0 fits the result into gamut without moving hue; clip 1 lets each gun hit its rail on its own.',
    ),
    box(
      'reference',
      BOT_Y,
      'reference',
      "The 3.58 MHz crystal oscillator the demodulator detects against, pulled toward the burst's phase by burst lock with the lag of its phase loop. Tint and the VIR hue trim turn it; detune pulls the crystal off frequency. Dim while it runs free at burst lock 0.",
      { off: lock <= 0 },
    ),
    box(
      'acc',
      BOT_Y,
      'ACC/killer',
      "Chroma gain: the burst's amplitude, weighted by burst lock, times the colour control. Its lag is the RC on the burst amplitude that both this gain and the colour killer read, and the killer zeroes the gain when that amplitude falls below its threshold. The VIR corrector reads the reference on line 19 and integrates a saturation trim into this gain and a hue trim into the reference. The code applies the gain after the demodulator, which gives the same product.",
      {
        note:
          v('vbi') > 0
            ? undefined
            : 'VIR correction needs the VBI test signals on.',
      },
    ),
  ]

  const demod = mixTaps(
    lowpass(v('demodMHz') * 1e6, TAPS.demod),
    lowpassCausal(v('demodMHz') * 1e6, TAPS.demod),
    v('chromaTail'),
  )
  const channelLuma = lowpassPeaked(
    v('lumaMHz') * 1e6,
    v('lumaPeak'),
    v('lumaMHz') * 0.75e6,
    TAPS.luma,
  )
  const channelChroma = bandpass(FSC, 0.6e6, TAPS.chromaBp)
  const encoder = lowpass(v('encChromaMHz') * 1e6, TAPS.encChroma)
  const at = Array.from({ length: POINTS }, (_, i) => {
    const hz = (MHZ_MAX * 1e6 * i) / (POINTS - 1)
    return {
      x: plotX(hz),
      s: split(hz, demod, channelLuma, channelChroma, encoder, {
        step: Math.round(v('chromaCoarse')),
        bleed,
        trap: comb === 0,
      }),
    }
  })
  const trace = (f: (s: Split) => number) =>
    at.map(({ x, s }): [number, number] => [x, plotY(f(s))])

  const open = boxes.find(b => b.id === pick.selected)
  const top = TOP_Y - H / 2
  const under = TOP_Y + H / 2
  const lockLook = lock > 0 ? 'plain' : 'dash'
  return (
    <>
      <Diagram
        width={WIDTH}
        height={HEIGHT}
        label="receiver colour decoder signal path and Y/C split"
      >
        {arrow => (
          <>
            <Wire
              arrow={arrow}
              d={`M${right(ROW.input)} ${TOP_Y} H${ROW.split.x}`}
            />
            <Wire
              arrow={arrow}
              d={`M${right(ROW.split)} ${TOP_Y} H${ROW.demod.x}`}
            />
            <Label
              x={(right(ROW.split) + ROW.demod.x) / 2}
              y={TOP_Y - 4}
              anchor="middle"
            >
              C
            </Label>
            <Wire
              arrow={arrow}
              look={bleed > 0.5 ? 'alarm' : 'plain'}
              d={`M${centre(ROW.split)} ${top} V${LUMA_Y} H${centre(ROW.matrix)} V${top}`}
            />
            <Label
              x={(right(ROW.demod) + ROW.matrix.x) / 2}
              y={LUMA_Y + 11}
              anchor="middle"
            >
              Y
            </Label>
            <Wire
              arrow={arrow}
              d={`M${right(ROW.demod)} ${TOP_Y} H${ROW.matrix.x}`}
            />
            <Wire
              arrow={arrow}
              d={`M${right(ROW.matrix)} ${TOP_Y} H${WIDTH - 26}`}
            />
            <Label x={WIDTH - 23} y={TOP_Y + 3}>
              RGB
            </Label>

            <circle cx={TAP_X} cy={TOP_Y} r={1.8} className={local.dot} />
            <Wire
              arrow={arrow}
              look={lockLook}
              d={`M${TAP_X} ${TOP_Y} V${BOT_Y} H${ROW.reference.x}`}
            />
            <Label x={TAP_X + 6} y={BOT_Y - 4}>
              burst
            </Label>
            <Wire arrow={arrow} d={`M${REF_UP_X} ${BOT_Y - H / 2} V${under}`} />
            <Wire
              arrow={arrow}
              look={lockLook}
              d={`M${right(ROW.reference)} ${BOT_Y} H${ROW.acc.x}`}
            />
            <Wire arrow={arrow} d={`M${ACC_UP_X} ${BOT_Y - H / 2} V${under}`} />
            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <Label x={PLOT.left} y={PLOT.ceiling - 6}>
              across the line
            </Label>
            <Label
              x={PLOT.right}
              y={PLOT.ceiling - 6}
              anchor="end"
              on={comb > 0}
            >
              {comb === 0
                ? 'trap: still detail decodes as colour'
                : `${COMB_NAME[comb] ?? 'comb'}: still detail cancels`}
            </Label>
            {[0, 1].map(g => (
              <g key={g}>
                <line
                  x1={PLOT.left}
                  x2={PLOT.right}
                  y1={plotY(g)}
                  y2={plotY(g)}
                  className={styles.grid}
                />
                <Label x={PLOT.left - 4} y={plotY(g) + 3} anchor="end">
                  {String(g)}
                </Label>
              </g>
            ))}
            <path d={area(trace(s => s.sent))} className={local.sent} />
            <path d={area(trace(s => s.leak))} className={local.leak} />
            <line
              x1={plotX(FSC)}
              x2={plotX(FSC)}
              y1={PLOT.ceiling}
              y2={PLOT.zero}
              className={local.fsc}
            />
            <path d={line(trace(s => s.luma))} className={local.luma} />
            <path d={line(trace(s => s.chroma))} className={local.chroma} />
            {[0, 2].map(mhz => (
              <Label
                key={mhz}
                x={plotX(mhz * 1e6)}
                y={PLOT.zero + 12}
                anchor="middle"
              >
                {String(mhz)}
              </Label>
            ))}
            <Label x={plotX(FSC)} y={PLOT.zero + 12} anchor="middle" on>
              3.58
            </Label>
            <Label x={PLOT.right} y={PLOT.zero + 12} anchor="end">
              6 MHz
            </Label>

            <line
              x1={0}
              x2={10}
              y1={LEGEND_Y - 3}
              y2={LEGEND_Y - 3}
              className={local.luma}
            />
            <Label x={13} y={LEGEND_Y}>
              Y luma
            </Label>
            <line
              x1={56}
              x2={66}
              y1={LEGEND_Y - 3}
              y2={LEGEND_Y - 3}
              className={local.chroma}
            />
            <Label x={69} y={LEGEND_Y}>
              C to demod
            </Label>
            <rect
              x={132}
              y={LEGEND_Y - 8}
              width={9}
              height={9}
              className={local.sent}
            />
            <Label x={145} y={LEGEND_Y}>
              chroma sent
            </Label>
            <rect
              x={214}
              y={LEGEND_Y - 8}
              width={9}
              height={9}
              className={local.leak}
            />
            <Label x={227} y={LEGEND_Y}>
              chroma left in Y
            </Label>
          </>
        )}
      </Diagram>
      <BoxRows keys={open?.keys} note={open?.note} />
    </>
  )
}
