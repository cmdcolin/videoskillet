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
import { boxWidth, useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import { BoxRows, BoxView, Diagram, Label, Wire } from './DiagramParts'
import { DECODER_KEYS } from './schematicKeys'

const READ = [...DECODER_KEYS, 'lumaMHz', 'lumaPeak', 'vbi'] as const
type Key = (typeof READ)[number]

interface Lane {
  y: number
  h: number
}

const LANE = {
  luma: { y: 18, h: 24 },
  chroma: { y: 62, h: 24 },
  burst: { y: 110, h: 33 },
  vir: { y: 162, h: 24 },
} satisfies Record<string, Lane>
const mid = (lane: Lane) => lane.y + lane.h / 2
const bottom = (lane: Lane) => lane.y + lane.h

// Column centres: the encoder, the front end, the demodulator's column, the
// gain stages after it, and the matrix.
const COL = { enc: 28, front: 103, demod: 189, late: 265, matrix: 317 }
const MATRIX_W = 46

const BURST_X = 66
const TAP_X = 238
const SUB_Y = 51
const AMP_Y = 153
const GAIN_X = 300
const GAIN_Y = 96

const PLOT = { left: 14, right: 232, zero: 272, one: 228, ceiling: 210 }
const VPLOT = { left: 250, right: 336 }
const LEGEND_Y = PLOT.zero + 28
const MHZ_MAX = 6
const POINTS = 241
const HEIGHT = LEGEND_Y + 22

const plotX = (hz: number) =>
  PLOT.left + ((PLOT.right - PLOT.left) * hz) / (MHZ_MAX * 1e6)
const plotY = (gain: number) =>
  PLOT.zero -
  (PLOT.zero - PLOT.one) *
    Math.min(
      Math.max(gain, 0),
      (PLOT.zero - PLOT.ceiling) / (PLOT.zero - PLOT.one),
    )
const vplotX = (nu: number) => VPLOT.left + (VPLOT.right - VPLOT.left) * 2 * nu

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

const COMB_GAIN = [
  () => 1,
  (nu: number) => Math.abs(Math.sin(Math.PI * nu)),
  (nu: number) => Math.sin(Math.PI * nu) ** 2,
]
const COMB_NAME = ['trap', '2-line', '3-line']

const line = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')

const area = (pts: [number, number][]) =>
  `${line(pts)} L${pts.at(-1)![0].toFixed(1)} ${PLOT.zero} L${pts[0]![0].toFixed(1)} ${PLOT.zero} Z`

// The receiver's colour decoder as decode.wgsl runs it, with what reaches the
// luma channel and the chroma demodulator plotted underneath from the taps the
// filter bank uploads. The burst gate and its two RC memories are
// line_analyze.wgsl; the VIR corrector is vir.wgsl.
export function DecoderDiagram() {
  const r = useReadings(READ)
  const pick = useSelectedBox()
  const v = r.value

  const agcOn = v('agc') > 0
  const lock = v('burstLock')
  const virOn = v('vir') > 0 && v('vbi') > 0
  const killerLive = v('killThresh') > 0 && lock > 0
  const comb = Math.round(v('combMode'))
  const bleed = v('svideoBleed')

  const box = (
    x: number,
    lane: Lane,
    name: string,
    help: string,
    keys: Key[],
    extra: Partial<BoxSpec> = {},
  ): BoxSpec => {
    const w = extra.w ?? boxWidth(name)
    return {
      x: x - w / 2,
      y: lane.y,
      w,
      h: lane.h,
      name,
      touched: r.touched(...keys),
      help,
      id: name,
      keys,
      ...extra,
    }
  }

  const boxes: BoxSpec[] = [
    box(
      COL.enc,
      LANE.luma,
      'encoder',
      "The encoder's colour bandwidth at the camera end, upstream of the channel and the receiver. It sets how wide the chroma sidebands are when they reach the set.",
      ['encChromaMHz'],
    ),
    box(
      COL.front,
      LANE.luma,
      'AGC',
      'The IF gain, set off the sync tip. It scales the whole composite ahead of everything else, so luma, chroma and the burst all move together. Dim while the gain is fixed.',
      ['agc'],
      { off: !agcOn },
    ),
    box(
      COL.late,
      LANE.luma,
      'luma',
      'The luma channel: the composite minus the chroma the demodulator recovered, remodulated onto the subcarrier. S-video bleed scales that subtraction down, and past 0.5 adds the chroma back.',
      ['svideoBleed'],
    ),
    box(
      COL.matrix,
      { y: LANE.luma.y, h: bottom(LANE.chroma) - LANE.luma.y },
      'matrix',
      'The YUV to RGB matrix and the three output amplifiers. Clip 0 fits the result into gamut without moving hue; clip 1 lets each gun hit its rail on its own.',
      ['matrixClip'],
      { w: MATRIX_W },
    ),
    box(
      COL.front,
      LANE.chroma,
      'Y/C comb',
      'What feeds the chroma demodulator. The trap passes the composite as it is; the combs subtract the line above, or the lines above and below, so only what alternates line to line reaches it.',
      ['combMode'],
    ),
    box(
      COL.demod,
      LANE.chroma,
      'demodulator',
      'Two synchronous detectors on the subcarrier, each followed by the chroma lowpass. Bandwidth and trail shape that lowpass; axis is the angle between the detectors; upsample error is how often the demodulator samples before interpolating.',
      ['demodMHz', 'demodAxisDeg', 'chromaTail', 'chromaCoarse'],
    ),
    box(
      COL.late,
      LANE.chroma,
      'ACC',
      "Chroma gain: the burst's amplitude, weighted by burst lock, times the colour control. Its lag is the RC on the burst amplitude that both this gain and the colour killer read. The code applies the gain after the demodulator, which gives the same product.",
      ['chromaGain', 'accLagLines'],
    ),
    box(
      COL.front,
      LANE.burst,
      'burst\ngate',
      'line_analyze gates the nine cycles of burst off the sync timing, after the AGC. Its phase feeds the reference oscillator and its amplitude feeds the ACC and the colour killer.',
      [],
    ),
    box(
      COL.demod,
      LANE.burst,
      'reference',
      "The 3.58 MHz crystal oscillator the demodulator detects against, pulled toward the burst's phase by burst lock. Tint and the VIR hue trim turn it; detune pulls the crystal off frequency. Dim while it runs free at burst lock 0.",
      ['burstLock', 'afpcLagLines', 'tintDeg', 'scDetuneKHz'],
      { off: lock <= 0 },
    ),
    box(
      COL.late,
      LANE.burst,
      'colour\nkiller',
      'The colour killer zeroes the burst-derived gain when the lagged burst amplitude falls below its threshold. It acts through the ACC, so at burst lock 0 it does nothing.',
      ['killThresh'],
      { off: !killerLive },
    ),
    box(
      COL.demod,
      LANE.vir,
      'VIR',
      'The VIR corrector reads the reference on line 19 and integrates a hue trim into the reference oscillator and a saturation trim into the ACC.',
      ['vir', 'virLag'],
      {
        off: !virOn,
        note: v('vbi') > 0 ? undefined : 'Needs the VBI test signals on.',
      },
    ),
  ]
  const edge = (id: string) => {
    const found = boxes.find(b => b.id === id)!
    return { left: found.x, right: found.x + found.w }
  }

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
  const combGain = COMB_GAIN[comb] ?? COMB_GAIN[0]!
  const vertical = Array.from({ length: 41 }, (_, i): [number, number] => {
    const nu = i / 80
    return [vplotX(nu), plotY(combGain(nu))]
  })

  const open = boxes.find(b => b.id === pick.selected)
  const enc = edge('encoder')
  const agc = edge('AGC')
  const luma = edge('luma')
  const matrix = edge('matrix')
  const yc = edge('Y/C comb')
  const dem = edge('demodulator')
  const acc = edge('ACC')
  const gate = edge('burst\ngate')
  const ref = edge('reference')
  const vir = edge('VIR')
  const y = {
    luma: mid(LANE.luma),
    chroma: mid(LANE.chroma),
    burst: mid(LANE.burst),
    vir: mid(LANE.vir),
  }
  const tapY = bottom(LANE.luma) + 10
  return (
    <>
      <Diagram
        width={340}
        height={HEIGHT}
        label="receiver colour decoder signal path and Y/C split"
      >
        {arrow => (
          <>
            <Label x={COL.enc} y={11} anchor="middle">
              camera
            </Label>
            <Label x={COL.front} y={11} anchor="middle">
              receiver
            </Label>
            <Wire
              look="dash"
              arrow={arrow}
              d={`M${enc.right} ${y.luma} H${agc.left}`}
            />
            <Wire arrow={arrow} d={`M${agc.right} ${y.luma} H${luma.left}`} />
            <Wire
              arrow={arrow}
              d={`M${luma.right} ${y.luma} H${matrix.left}`}
            />
            <Wire
              arrow={arrow}
              d={`M${COL.front} ${bottom(LANE.luma)} V${LANE.chroma.y}`}
            />
            <Wire arrow={arrow} d={`M${yc.right} ${y.chroma} H${dem.left}`} />
            <Wire arrow={arrow} d={`M${dem.right} ${y.chroma} H${acc.left}`} />
            <circle cx={TAP_X} cy={y.chroma} r={1.8} className={local.dot} />
            <Wire
              arrow={arrow}
              look={bleed > 0.5 ? 'alarm' : 'plain'}
              d={`M${TAP_X} ${y.chroma} V${SUB_Y} H${COL.late} V${bottom(LANE.luma)}`}
            />
            <Label x={TAP_X + 3} y={SUB_Y - 3}>
              −C
            </Label>
            <Wire
              arrow={arrow}
              d={`M${acc.right} ${y.chroma} H${matrix.left}`}
            />
            <Wire
              arrow={arrow}
              d={`M${COL.matrix} ${bottom(LANE.chroma)} V${bottom(LANE.chroma) + 12}`}
            />
            <Label x={COL.matrix} y={bottom(LANE.chroma) + 23} anchor="middle">
              RGB
            </Label>

            <circle cx={COL.front} cy={tapY} r={1.8} className={local.dot} />
            <Wire
              arrow={arrow}
              d={`M${COL.front} ${tapY} H${BURST_X} V${y.burst} H${gate.left}`}
            />
            <Wire
              arrow={arrow}
              look={lock > 0 ? 'plain' : 'dash'}
              d={`M${gate.right} ${y.burst} H${ref.left}`}
            />
            <Wire
              arrow={arrow}
              d={`M${COL.demod} ${LANE.burst.y} V${bottom(LANE.chroma)}`}
            />
            <Label x={COL.demod + 4} y={LANE.burst.y - 8}>
              ref
            </Label>
            <Wire
              arrow={arrow}
              look={lock > 0 ? 'plain' : 'dash'}
              d={`M${COL.front} ${bottom(LANE.burst)} V${AMP_Y} H${COL.demod - 4} a4 4 0 0 1 8 0 H${COL.late} V${bottom(LANE.burst)}`}
            />
            <Label x={COL.front + 4} y={AMP_Y + 12}>
              amp
            </Label>
            <Wire
              arrow={arrow}
              look={killerLive ? 'plain' : 'dash'}
              d={`M${COL.late} ${LANE.burst.y} V${bottom(LANE.chroma)}`}
            />
            <Wire
              arrow={arrow}
              look={virOn ? 'plain' : 'dash'}
              d={`M${COL.demod} ${LANE.vir.y} V${bottom(LANE.burst)}`}
            />
            <Wire
              arrow={arrow}
              look={virOn ? 'plain' : 'dash'}
              d={`M${vir.right} ${y.vir} H${GAIN_X} V${GAIN_Y} H${acc.right - 6} V${bottom(LANE.chroma)}`}
            />
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
            <Label x={VPLOT.left} y={PLOT.ceiling - 6}>
              down the frame
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
                <line
                  x1={VPLOT.left}
                  x2={VPLOT.right}
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

            <path d={line(vertical)} className={local.chroma} />
            <Label x={VPLOT.right} y={PLOT.one - 5} anchor="end">
              {COMB_NAME[comb] ?? 'trap'}
            </Label>
            <Label x={VPLOT.left} y={PLOT.zero + 12}>
              still
            </Label>
            <Label x={VPLOT.right} y={PLOT.zero + 12} anchor="end">
              alternate
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
            <Label x={0} y={LEGEND_Y + 15}>
              {comb === 0
                ? 'trap: still detail in the C band decodes as colour'
                : 'comb: still detail cancels before it reaches C'}
            </Label>
          </>
        )}
      </Diagram>
      <BoxRows keys={open?.keys} note={open?.note} />
    </>
  )
}
