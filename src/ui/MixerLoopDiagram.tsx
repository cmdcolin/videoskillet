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
import { BAND_MHZ, bandMHz, lapGains, type MixerLoop } from './loopGain'
import own from './MixerLoopDiagram.module.css'
import { MIXER_LOOP_KEYS } from './schematicKeys'

type Key = (typeof MIXER_LOOP_KEYS)[number]

const OPENS = {
  fader: ['cfbMix', 'cfbGain'],
  keyer: [
    'cfbKey',
    'cfbKeyExt',
    'cfbKeyLevel',
    'cfbKeySoft',
    'cfbKeyAcceptDeg',
    'cfbKeyHueDeg',
  ],
  store: ['cfbHold', 'cfbTrail', 'cfbGenlock', 'cfbClockPct', 'cfbLines'],
  delay: ['cfbDelayUs', 'cfbServoUs'],
  return: ['cfbReturn', 'cfbNoiseIre'],
  resonance: ['cfbFilterMHz', 'cfbFilterQ', 'cfbFilterBoost'],
  ring: ['cfbRing', 'cfbRingSrc', 'cfbCarrierKHz'],
} as const satisfies Record<string, readonly Key[]>

type Part = keyof typeof OPENS

const WIDTH = 336
const TOP_Y = 20
const BOT_Y = 160
const UP_X = 100
const RIGHT_X = 306
const STORE_Y = 62
const DELAY_Y = 112
const KEY_Y = 86
const H = 20
const TALL_H = 33

const PLOT = { left: 22, right: 330, top: 200, bottom: 270 }
const HEIGHT = PLOT.bottom + 14
const GAIN_TOP = 2
const FSC_MHZ = FSC / 1e6
const POINTS = 121
const CURVE_MHZ = bandMHz(POINTS)

const plotX = (mhz: number) =>
  PLOT.left + ((PLOT.right - PLOT.left) * mhz) / BAND_MHZ
const plotY = (g: number) =>
  PLOT.bottom -
  ((PLOT.bottom - PLOT.top) * Math.min(Math.max(g, 0), GAIN_TOP)) / GAIN_TOP

// The mixer loop as fb_composite.wgsl runs it, one box per stage. The program
// crosses the fader into the rest of the chain, the frame store captures what
// came out, and the return comes back through the delay, the Y/C split, the
// resonance and the ring modulator into the fader, which the keyer gates.
// Under the loop, what one lap hands back at each frequency.
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
  const keyLook: WireLook = v('cfbKey') !== 0 && !off ? 'on' : 'dash'
  const curve = gains
    .map(
      (g, i) =>
        `${i === 0 ? 'M' : 'L'}${plotX(CURVE_MHZ[i]!).toFixed(1)} ${plotY(g).toFixed(1)}`,
    )
    .join(' ')

  const box = (
    id: Part,
    cx: number,
    cy: number,
    w: number,
    name: string,
    help: string,
    h = H,
  ): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    name,
    off: off && id !== 'fader',
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'fader',
      UP_X,
      TOP_Y,
      56,
      'fader',
      'The crossfader between the program and the loop return, and the trim on the return. Together they set the round trip; a negative trim inverts every lap.',
    ),
    box(
      'keyer',
      30,
      KEY_Y,
      52,
      'keyer',
      'Gates the fader with a slice of the return or of the program, by level or, with an acceptance angle, by hue.',
    ),
    box(
      'store',
      RIGHT_X,
      STORE_Y,
      52,
      'frame\nstore',
      'Captures what the decoder saw and reads it back a frame later: hold, trails, frame sync, and the read clock and line offset against the write.',
      TALL_H,
    ),
    box(
      'delay',
      RIGHT_X,
      DELAY_Y,
      52,
      'delay',
      'The cable on the return, and the varactor that lets the video pull its own delay. Every 70 ns is 90° of subcarrier.',
    ),
    box(
      'return',
      258,
      BOT_Y,
      66,
      'Y/C split',
      'Which half of the return goes round, and the noise it picks up on the way.',
    ),
    box(
      'resonance',
      178,
      BOT_Y,
      70,
      'resonance',
      'A bandpass bridged across the return. The loop gain rises in its band by the boost.',
    ),
    box(
      'ring',
      UP_X,
      BOT_Y,
      62,
      'ring mod',
      "A balanced bridge multiplying the return by the live program or by the box's own subcarrier oscillator.",
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]
  const edge = (id: Part) => boxes.find(b => b.id === id)!

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="mixer feedback loop">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              program
            </Label>
            <Wire arrow={arrow} d={`M0 ${TOP_Y} H${edge('fader').x}`} />
            <Wire
              arrow={arrow}
              d={`M${UP_X + 28} ${TOP_Y} H${RIGHT_X} V${edge('store').y}`}
            />
            <Label x={RIGHT_X - 6} y={TOP_Y - 6} anchor="end">
              to the chain
            </Label>

            <g opacity={off ? 0.55 : 1}>
              <Wire
                arrow={arrow}
                d={`M${RIGHT_X} ${STORE_Y + TALL_H / 2} V${DELAY_Y - H / 2}`}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M${RIGHT_X} ${DELAY_Y + H / 2} V${BOT_Y} H${258 + 33}`}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M${258 - 33} ${BOT_Y} H${178 + 35}`}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M${178 - 35} ${BOT_Y} H${UP_X + 31}`}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M${UP_X} ${BOT_Y - H / 2} V${TOP_Y + H / 2}`}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M56 ${KEY_Y} H${UP_X - 18} V${TOP_Y + H / 2}`}
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
              className={own.unity}
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
            {Array.from({ length: BAND_MHZ + 1 }, (_, n) => (
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
            <path
              d={curve}
              className={own.curveAlarm}
              clipPath={`url(#${clip})`}
            />
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
