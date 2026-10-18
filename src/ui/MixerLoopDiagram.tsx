import { useId } from 'react'

import { FSC } from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { loopSlice } from './hueKey'
import { HueWheel, LevelBar } from './HueWheel'
import { BAND_MHZ, bandMHz, lapGains, type MixerLoop } from './loopGain'
import own from './MixerLoopDiagram.module.css'
import { MIXER_LOOP_KEYS, MIXER_LOOP_OPENS as OPENS } from './schematicKeys'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 50
const H = 20
const FADER = { x: 52, w: 52 }
const KEY_UP_X = 60
const RING_UP_X = 92
const DROP_X = 317
const ROW = {
  keyer: { x: 0, w: 43 },
  ring: { x: 70, w: 60 },
  resonance: { x: 142, w: 66 },
  return: { x: 220, w: 66 },
  store: { x: 296, w: 43 },
}

const PLOT = { left: 22, right: 236, top: 84, bottom: 128 }
const HEIGHT = PLOT.bottom + 14
const SLICE_X = 298
const WHEEL = { cx: SLICE_X, cy: 108, radius: 30 }
const GAIN_TOP = 2
const FSC_MHZ = FSC / 1e6
const MHZ_TICKS = [0, 2, 4, BAND_MHZ]
const RIM = 0.7
const POINTS = 121
const CURVE_MHZ = bandMHz(POINTS)

const plotX = (mhz: number) =>
  PLOT.left + ((PLOT.right - PLOT.left) * mhz) / BAND_MHZ
const plotY = (g: number) =>
  PLOT.bottom -
  ((PLOT.bottom - PLOT.top) * Math.min(Math.max(g, 0), GAIN_TOP)) / GAIN_TOP

const trace = (gains: readonly number[]) =>
  gains
    .map(
      (g, i) =>
        `${i === 0 ? 'M' : 'L'}${plotX(CURVE_MHZ[i]!).toFixed(1)} ${plotY(g).toFixed(1)}`,
    )
    .join(' ')

// The mixer loop as fb_composite.wgsl runs it, one box per stage. The program
// crosses the fader into the rest of the chain, the frame store captures what
// came out and reads it back late, and the return runs back along the bottom
// through the Y/C split, the resonance and the ring modulator into the fader,
// which the keyer gates. Under the loop, what one lap hands back at each
// frequency, and beside it the slice the keyer lets round, drawn on the U/V
// plane for a hue key and on the luma scale for a level key.
export function MixerLoopDiagram() {
  const r = useReadings(MIXER_LOOP_KEYS)
  const pick = useSelectedBox()
  const clip = useId()
  const v = r.value
  const loop: MixerLoop = {
    mix: v('cfbMix'),
    gain: v('cfbGain'),
    split: Math.round(v('cfbReturn')),
    filterMHz: v('cfbFilterMHz'),
    filterQ: v('cfbFilterQ'),
    filterBoost: v('cfbFilterBoost'),
  }
  const off = loop.mix === 0
  const gains = lapGains(loop, CURVE_MHZ)
  const peak = Math.max(...gains)
  const look: WireLook = off ? 'dash' : peak > 1 ? 'alarm' : 'on'
  const key = v('cfbKey')
  const keyOn = key !== 0 && !off
  const keyLook: WireLook = keyOn ? 'on' : 'dash'
  const byHue = v('cfbKeyAcceptDeg') > 0
  const curve = trace(gains)
  // With the fader down, the lap at its full travel, where mix is 1.
  const upGains = off ? lapGains({ ...loop, mix: 1 }, CURVE_MHZ) : null

  const box = (
    id: Part,
    at: { x: number; w: number },
    y: number,
    name: string,
    help: string,
  ): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: at.x,
    y: y - H / 2,
    w: at.w,
    h: H,
    name,
    off: off && id !== 'fader',
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'fader',
      FADER,
      TOP_Y,
      'fader',
      'The crossfader between the program and the loop return, and the trim on the return. Together they set the round trip; a negative trim inverts every lap.',
    ),
    box(
      'keyer',
      ROW.keyer,
      BOT_Y,
      'keyer',
      'Gates the fader with a slice of the return or of the program, by level or, with an acceptance angle, by hue.',
    ),
    box(
      'store',
      ROW.store,
      BOT_Y,
      'store',
      'The frame store: captures what the decoder saw and reads it back a frame later. Hold, trails and frame sync act on the write; the read clock, line offset and the cable delay with its varactor pull set where the read lands. Every 70 ns of delay is 90° of subcarrier.',
    ),
    box(
      'return',
      ROW.return,
      BOT_Y,
      'Y/C split',
      'Which half of the return goes round, and the noise it picks up on the way.',
    ),
    box(
      'resonance',
      ROW.resonance,
      BOT_Y,
      'resonance',
      'A bandpass bridged across the return. The loop gain rises in its band by the boost.',
    ),
    box(
      'ring',
      ROW.ring,
      BOT_Y,
      'ring mod',
      "A balanced bridge multiplying the return by the live program or by the box's own subcarrier oscillator.",
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]
  const bottom = BOT_Y - H / 2
  const under = TOP_Y + H / 2
  const back = (from: { x: number }, to: { x: number; w: number }) =>
    `M${from.x} ${BOT_Y} H${to.x + to.w}`

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="mixer feedback loop">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              program
            </Label>
            <Wire arrow={arrow} d={`M0 ${TOP_Y} H${FADER.x}`} />
            <Wire
              arrow={arrow}
              d={`M${FADER.x + FADER.w} ${TOP_Y} H${DROP_X} V${bottom}`}
            />
            <Label x={DROP_X - 6} y={TOP_Y - 6} anchor="end">
              to the chain
            </Label>

            <g opacity={off ? 0.55 : 1}>
              <Wire arrow={arrow} d={back(ROW.store, ROW.return)} look={look} />
              <Wire
                arrow={arrow}
                d={back(ROW.return, ROW.resonance)}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={back(ROW.resonance, ROW.ring)}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M${RING_UP_X} ${bottom} V${under}`}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M${ROW.keyer.w} ${BOT_Y} H${KEY_UP_X} V${under}`}
                look={keyLook}
              />
            </g>

            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <Label x={PLOT.left + 4} y={PLOT.top - 8}>
              loop gain per lap
            </Label>
            {[0, 2].map(g => (
              <line
                key={g}
                x1={PLOT.left}
                x2={PLOT.right}
                y1={plotY(g)}
                y2={plotY(g)}
                className={styles.grid}
              />
            ))}
            <line
              x1={PLOT.left}
              x2={PLOT.right}
              y1={plotY(1)}
              y2={plotY(1)}
              className={styles.unity}
            />
            {[0, 1, 2].map(g => (
              <Label key={g} x={PLOT.left - 4} y={plotY(g) + 3} anchor="end">
                {g === 0 ? '0' : `${g}×`}
              </Label>
            ))}
            <line
              x1={plotX(FSC_MHZ)}
              x2={plotX(FSC_MHZ)}
              y1={PLOT.top}
              y2={PLOT.bottom}
              className={own.fsc}
            />
            <Label x={plotX(FSC_MHZ)} y={PLOT.top - 8} anchor="middle">
              fsc
            </Label>
            {MHZ_TICKS.map(n => (
              <Label
                key={n}
                x={plotX(n)}
                y={PLOT.bottom + 12}
                anchor={n === BAND_MHZ ? 'end' : 'middle'}
              >
                {n === BAND_MHZ ? `${n} MHz` : String(n)}
              </Label>
            ))}
            <clipPath id={clip}>
              <rect
                x={PLOT.left}
                y={PLOT.top - 2}
                width={PLOT.right - PLOT.left}
                height={plotY(1) - PLOT.top + 2}
              />
            </clipPath>
            <path
              d={curve}
              className={
                r.touched('cfbMix', 'cfbGain', 'cfbReturn', ...OPENS.resonance)
                  ? styles.curveOn
                  : styles.curve
              }
            />
            {upGains && (
              <>
                <path d={trace(upGains)} className={own.faderUp} />
                <Label
                  x={PLOT.right}
                  y={Math.min(plotY(upGains.at(-1)!) + 11, PLOT.bottom - 4)}
                  anchor="end"
                >
                  fader up
                </Label>
              </>
            )}
            <path
              d={curve}
              className={styles.curveAlarm}
              clipPath={`url(#${clip})`}
            />

            <Label x={SLICE_X} y={WHEEL.cy - WHEEL.radius - 6} anchor="middle">
              {byHue ? 'keyed by hue' : 'keyed by level'}
            </Label>
            {byHue ? (
              <HueWheel
                {...WHEEL}
                rim={RIM}
                slice={loopSlice({
                  cfbKeyHueDeg: v('cfbKeyHueDeg'),
                  cfbKeyAcceptDeg: v('cfbKeyAcceptDeg'),
                  cfbKeySoft: v('cfbKeySoft'),
                })}
                invert={key < 0}
                on={keyOn}
                strength={Math.min(Math.abs(key), 1)}
                names={false}
              />
            ) : (
              <LevelBar
                x={SLICE_X - 5}
                top={PLOT.top}
                bottom={PLOT.bottom}
                level={v('cfbKeyLevel')}
                soft={v('cfbKeySoft')}
                invert={key < 0}
                on={keyOn}
                strength={Math.min(Math.abs(key), 1)}
              />
            )}
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
