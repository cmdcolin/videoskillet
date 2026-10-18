import { useId } from 'react'

import { lumaKernel } from '../core/gpu/filterbank'
import { IRE_WHITE, SAMPLE_RATE } from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import { BoxRows, BoxView, Diagram, Label, Wire } from './DiagramParts'
import own from './RecordingDiagram.module.css'
import { BAR, barLine, chromaOn, fmCeiling, playBack } from './recordModel'
import { magnitude, response } from './response'
import { RECORDING_KEYS, RECORDING_OPENS as OPENS } from './schematicKeys'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 50
const H = 20
const ROW = {
  emphasis: { x: 18, w: 61 },
  fm: { x: 95, w: 84 },
  filter: { x: 195, w: 78 },
  differential: { x: 160, w: 101 },
}
const right = (s: { x: number; w: number }) => s.x + s.w
const TAP_X = 284
const KEY_X = 240
const KEY_Y = 32
const SUM_X = 304

const PLOT = { top: 84, bottom: 128 }
const BAR_PLOT = { left: 24, right: 196 }
const RESPONSE_PLOT = { left: 226, right: 336 }
const HEIGHT = PLOT.bottom + 14
const IRE_LO = -20
const IRE_HI = 245
const GAIN_TOPS = [2, 5, 15]
const MHZ_MAX = 6
const POINTS = 121
const LINE = barLine()

const barX = (n: number) =>
  BAR_PLOT.left +
  ((BAR_PLOT.right - BAR_PLOT.left) * n) / (BAR.us * 1e-6 * SAMPLE_RATE)
const usX = (us: number) => barX(us * 1e-6 * SAMPLE_RATE)
const ireY = (ire: number) =>
  PLOT.bottom - ((PLOT.bottom - PLOT.top) * (ire - IRE_LO)) / (IRE_HI - IRE_LO)
const mhzX = (mhz: number) =>
  RESPONSE_PLOT.left +
  ((RESPONSE_PLOT.right - RESPONSE_PLOT.left) * mhz) / MHZ_MAX
const path = (pts: readonly (readonly [number, number])[]) =>
  pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')

const signed = (v: number) => {
  const n = Number(Math.abs(v).toFixed(1))
  return v > 0 ? `+${n}` : v < 0 ? `−${n}` : '0'
}

// The recording as channel.wgsl runs it, drawn in the deck's order: the
// pre-emphasis, the FM modulator whose deviation ceiling the emphasized edge
// can overrun, and the playback luma filter. The chroma rides through an
// amplifier whose gain and phase the luma keys. Underneath, a white bar
// recorded and played back, and the luma filter's response.
export function RecordingDiagram() {
  const r = useReadings(RECORDING_KEYS)
  const pick = useSelectedBox()
  const clip = useId()
  const v = r.value
  const rec = {
    lumaMHz: v('lumaMHz'),
    lumaPeak: v('lumaPeak'),
    fmOverdev: v('fmOverdev'),
    fmStreakUs: v('fmStreakUs'),
  }
  const ceiling = fmCeiling(rec.fmOverdev)
  const { emphasized, out } = playBack(rec, LINE)
  const folds = rec.fmOverdev > 0 && emphasized.some(e => e > ceiling)
  const white = chromaOn(IRE_WHITE, {
    diffGain: v('diffGain'),
    diffPhaseDeg: v('diffPhaseDeg'),
  })
  const kernel = lumaKernel(rec)
  const top = GAIN_TOPS.find(t => t >= 1 + rec.lumaPeak) ?? GAIN_TOPS.at(-1)!
  const gainY = (g: number) =>
    PLOT.bottom -
    ((PLOT.bottom - PLOT.top) * Math.min(Math.max(g, 0), top)) / top
  const gains = Array.from({ length: POINTS }, (_, i) => {
    const mhz = (MHZ_MAX * i) / (POINTS - 1)
    return [mhzX(mhz), gainY(magnitude(response(kernel, mhz * 1e6)))] as const
  })

  const box = (id: Part, y: number, name: string, help: string): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: ROW[id].x,
    y: y - H / 2,
    w: ROW[id].w,
    h: H,
    name,
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'emphasis',
      TOP_Y,
      'emphasis',
      'The record pre-emphasis: each sample plus 1.3 times its rise over the two samples before it. A hard edge from black to white leaves a spike more than twice the height of white in the signal the deck records. No control changes the boost.',
    ),
    box(
      'fm',
      TOP_Y,
      'FM deviation',
      'The FM modulator and the deviation the tape can carry. Where the emphasized signal passes the ceiling, the playback discriminator folds back and takes the excess off the luma, decaying through the deemphasis time constant into a dark streak after the edge. Over-deviation lowers the ceiling from 240 IRE to 112; inversion streak is the time constant.',
    ),
    box(
      'filter',
      TOP_Y,
      'luma filter',
      'The playback luma lowpass at the bandwidth, with the peaking boost from three quarters of the bandwidth up. Peaking overshoots every edge into a ringing outline.',
    ),
    box(
      'differential',
      BOT_Y,
      'diff gain/phase',
      'The video amplifier the chroma rides through. Its gain falls and its phase advances in step with the luma underneath, from nothing at black to the full setting at white. The burst sits at blanking, so the decoder reference keeps its phase.',
    ),
  ]
  const open = boxes.find(b => b.id === pick.selected)
  const keyLook = r.touched(...OPENS.differential) ? 'on' : 'dash'

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="recording luma and FM path">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y + 3}>
              Y
            </Label>
            <Wire arrow={arrow} d={`M9 ${TOP_Y} H${ROW.emphasis.x}`} />
            <Wire
              arrow={arrow}
              d={`M${right(ROW.emphasis)} ${TOP_Y} H${ROW.fm.x}`}
            />
            <Wire
              arrow={arrow}
              look={folds ? 'alarm' : 'plain'}
              d={`M${right(ROW.fm)} ${TOP_Y} H${ROW.filter.x}`}
            />
            <Wire
              arrow={arrow}
              d={`M${right(ROW.filter)} ${TOP_Y} H${WIDTH - 4}`}
            />
            <Label x={WIDTH - 4} y={TOP_Y - 6} anchor="end">
              out
            </Label>
            <circle cx={TAP_X} cy={TOP_Y} r={1.8} className={own.dot} />
            <Wire
              arrow={arrow}
              look={keyLook}
              d={`M${TAP_X} ${TOP_Y} V${KEY_Y} H${KEY_X} V${BOT_Y - H / 2}`}
            />
            <Label x={0} y={BOT_Y + 3}>
              C
            </Label>
            <Wire arrow={arrow} d={`M9 ${BOT_Y} H${ROW.differential.x}`} />
            <Label x={12} y={BOT_Y - 4} on={r.touched(...OPENS.differential)}>
              {`chroma on white ×${white.gain.toFixed(2)}, ${signed(white.phaseDeg)}°`}
            </Label>
            <Wire
              arrow={arrow}
              d={`M${right(ROW.differential)} ${BOT_Y} H${SUM_X} V${TOP_Y + 2}`}
            />
            <circle cx={SUM_X} cy={TOP_Y} r={1.8} className={own.dot} />
            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <Label x={BAR_PLOT.left} y={PLOT.top - 6}>
              white bar
            </Label>
            <line
              x1={86}
              x2={96}
              y1={PLOT.top - 9}
              y2={PLOT.top - 9}
              className={own.toTape}
            />
            <Label x={99} y={PLOT.top - 6}>
              to tape
            </Label>
            <line
              x1={140}
              x2={150}
              y1={PLOT.top - 9}
              y2={PLOT.top - 9}
              className={styles.curve}
            />
            <Label x={BAR_PLOT.right} y={PLOT.top - 6} anchor="end">
              off tape
            </Label>
            {[0, 100].map(ire => (
              <g key={ire}>
                <line
                  x1={BAR_PLOT.left}
                  x2={BAR_PLOT.right}
                  y1={ireY(ire)}
                  y2={ireY(ire)}
                  className={styles.grid}
                />
                <Label x={BAR_PLOT.left - 3} y={ireY(ire) + 3} anchor="end">
                  {String(ire)}
                </Label>
              </g>
            ))}
            <line
              x1={BAR_PLOT.left}
              x2={BAR_PLOT.right}
              y1={ireY(ceiling)}
              y2={ireY(ceiling)}
              className={folds ? own.ceilingHot : styles.unity}
            />
            <Label
              x={usX((BAR.from + BAR.to) / 2 + 0.6)}
              y={ceiling > 178 ? ireY(ceiling) + 9 : ireY(ceiling) - 3}
              anchor="middle"
              on={rec.fmOverdev > 0}
            >
              FM ceiling
            </Label>
            <clipPath id={`${clip}-plot`}>
              <rect
                x={BAR_PLOT.left}
                y={PLOT.top - 2}
                width={BAR_PLOT.right - BAR_PLOT.left}
                height={PLOT.bottom - PLOT.top + 2}
              />
            </clipPath>
            <clipPath id={`${clip}-over`}>
              <rect
                x={BAR_PLOT.left}
                y={PLOT.top - 2}
                width={BAR_PLOT.right - BAR_PLOT.left}
                height={Math.max(ireY(ceiling) - PLOT.top + 2, 0)}
              />
            </clipPath>
            <g clipPath={`url(#${clip}-plot)`}>
              <path
                d={path(emphasized.map((e, n) => [barX(n), ireY(e)]))}
                className={own.toTape}
              />
              <path
                d={path(emphasized.map((e, n) => [barX(n), ireY(e)]))}
                className={styles.curveAlarm}
                clipPath={`url(#${clip}-over)`}
              />
              <path
                d={path(out.map((o, n) => [barX(n), ireY(o)]))}
                className={
                  r.touched(...OPENS.fm, ...OPENS.filter)
                    ? styles.curveOn
                    : styles.curve
                }
              />
            </g>
            <Label x={BAR_PLOT.left} y={PLOT.bottom + 11}>
              black
            </Label>
            <Label
              x={usX((BAR.from + BAR.to) / 2)}
              y={PLOT.bottom + 11}
              anchor="middle"
            >
              white
            </Label>
            <Label x={BAR_PLOT.right} y={PLOT.bottom + 11} anchor="end">
              black
            </Label>

            <Label x={RESPONSE_PLOT.left} y={PLOT.top - 6}>
              luma response
            </Label>
            {[0, top].map(g => (
              <line
                key={g}
                x1={RESPONSE_PLOT.left}
                x2={RESPONSE_PLOT.right}
                y1={gainY(g)}
                y2={gainY(g)}
                className={styles.grid}
              />
            ))}
            <line
              x1={RESPONSE_PLOT.left}
              x2={RESPONSE_PLOT.right}
              y1={gainY(1)}
              y2={gainY(1)}
              className={styles.unity}
            />
            {(top > 2 ? [0, top] : [0, 1, top]).map(g => (
              <Label
                key={g}
                x={RESPONSE_PLOT.left - 3}
                y={gainY(g) + 3}
                anchor="end"
              >
                {g === 0 ? '0' : `${g}×`}
              </Label>
            ))}
            <path
              d={path(gains)}
              className={
                r.touched(...OPENS.filter) ? styles.curveOn : styles.curve
              }
            />
            <Label x={RESPONSE_PLOT.left} y={PLOT.bottom + 11}>
              0
            </Label>
            <Label x={RESPONSE_PLOT.right} y={PLOT.bottom + 11} anchor="end">
              6 MHz
            </Label>
          </>
        )}
      </Diagram>
      <BoxRows keys={open?.keys} note={open?.note} />
    </>
  )
}
