import { useId } from 'react'

import { FSC } from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Pressable,
  Wire,
  type WireLook,
} from './DiagramParts'
import { BAND_MHZ, bandMHz, lapGains, type MixerLoop } from './loopGain'
import own from './MixerLoopDiagram.module.css'
import { MIXER_LOOP_KEYS } from './schematicKeys'

type Key = (typeof MIXER_LOOP_KEYS)[number]

const OPENS = {
  fader: ['cfbMix'],
  trim: ['cfbGain'],
  keyer: [
    'cfbKey',
    'cfbKeyExt',
    'cfbKeyLevel',
    'cfbKeySoft',
    'cfbKeyAcceptDeg',
    'cfbKeyHueDeg',
  ],
  store: ['cfbHold', 'cfbTrail', 'cfbGenlock'],
  read: ['cfbClockPct', 'cfbLines'],
  delay: ['cfbDelayUs', 'cfbServoUs'],
  return: ['cfbReturn'],
  noise: ['cfbNoiseIre'],
  resonance: ['cfbFilterMHz', 'cfbFilterQ', 'cfbFilterBoost'],
  ring: ['cfbRing', 'cfbRingSrc', 'cfbCarrierKHz'],
} as const satisfies Record<string, readonly Key[]>

type Part = keyof typeof OPENS

const WIDTH = 336
const PROG_Y = 22
const COL_X = 120
const RIGHT_X = 300
const BOT_Y = 200
const SELF_Y = 222
const TAP_X = 180
const RING_Y = 88
const RES_Y = 128
const NOISE_Y = 166
const JUNCTION_R = 7
const TRIM_TOP = 40
const TRIM_BASE = 56
const KEY_X = 6
const KEY_W = 48
const KEY_IN_X = KEY_X + KEY_W / 2
const KEY_CTRL_X = 102
const KEY_Y = 120
const BOX_H = 20
const TALL_H = 33
const FADER_W = 48
const CARRIER_X = 228

const PLOT = { left: 22, right: 330, top: 252, bottom: 322 }
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

function Junction({
  y,
  symbol,
  on,
}: {
  y: number
  symbol: string
  on: boolean
}) {
  return (
    <g>
      <circle
        cx={COL_X}
        cy={y}
        r={JUNCTION_R}
        className={on ? styles.boxOn : styles.box}
      />
      <text
        x={COL_X}
        y={y + 3.5}
        textAnchor="middle"
        className={on ? own.symbolOn : own.symbol}
      >
        {symbol}
      </text>
    </g>
  )
}

// The mixer loop as fb_composite.wgsl runs it. The program crosses the fader
// and the output rails into the rest of the chain, the frame store captures
// what came out, and the return climbs back to the fader through the store's
// read, the cable, the Y/C split, the noise floor, the resonance, the ring
// modulator and the trim. The resonance and the keyer's self input tap the
// same read as the Y/C split. Under the loop, what one lap hands back at each
// frequency.
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
  const trip = loop.mix * loop.gain
  const loopLook: WireLook = off ? 'dash' : Math.abs(trip) > 1 ? 'alarm' : 'on'

  const gains = lapGains(loop, CURVE_MHZ)
  const peak = Math.max(...gains)
  const curve = gains
    .map(
      (g, i) =>
        `${i === 0 ? 'M' : 'L'}${plotX(CURVE_MHZ[i]!).toFixed(1)} ${plotY(g).toFixed(1)}`,
    )
    .join(' ')
  const resonating = loop.filterMHz > 0 && loop.filterBoost !== 0
  const resLook: WireLook =
    !resonating || off ? 'dash' : peak > 1 ? 'alarm' : 'on'

  const keyLook: WireLook = v('cfbKey') !== 0 && !off ? 'on' : 'dash'
  const keyExt = Math.round(v('cfbKeyExt')) === 1
  const ringing = v('cfbRing') !== 0
  const ringLook: WireLook = ringing && !off ? 'on' : 'dash'
  const osc = Math.round(v('cfbRingSrc')) === 1
  const noisy = v('cfbNoiseIre') > 0

  const box = (
    id: Part,
    x: number,
    midY: number,
    w: number,
    name: string,
    help: string,
    h = BOX_H,
    dim = off,
  ): BoxSpec => ({
    id,
    keys: OPENS[id],
    x,
    y: midY - h / 2,
    w,
    h,
    name,
    off: dim,
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'fader',
      COL_X - FADER_W / 2,
      PROG_Y,
      FADER_W,
      'fader',
      'The crossfader between the program and the loop return. It takes from the program what it gives the loop, so a loop regresses before it whites out.',
      BOX_H,
      false,
    ),
    box(
      'store',
      RIGHT_X - 24,
      62.5,
      48,
      'frame\nstore',
      'Captures what the decoder saw, every frame or every few with hold. Trails keep the brighter of the new frame and the decaying old one. A genlocked store writes its own sync and burst on the way out.',
      TALL_H,
    ),
    box(
      'read',
      RIGHT_X - 24,
      111.5,
      48,
      'store\nread',
      "The store's read clock against its write clock, and how many lines down it reads.",
      TALL_H,
    ),
    box(
      'delay',
      RIGHT_X - 86,
      BOT_Y,
      48,
      'delay',
      'The cable on the return, and the varactor that lets the video pull its own delay. Every 70 ns is 90° of subcarrier.',
    ),
    box(
      'return',
      COL_X - 34,
      BOT_Y,
      68,
      'Y/C split',
      'Which half of the return goes round. The other half comes from the live program.',
    ),
    box(
      'resonance',
      TAP_X - 34,
      RES_Y,
      68,
      'resonance',
      'A bandpass bridged across the return from the same read. The loop gain rises in its band by the boost.',
    ),
    box(
      'ring',
      COL_X + 20,
      RING_Y,
      64,
      'ring mod',
      "A balanced bridge multiplying the return by the live program or by the box's own subcarrier oscillator.",
    ),
    box(
      'keyer',
      KEY_X,
      KEY_Y,
      KEY_W,
      'keyer',
      'Gates the fader with a slice of the return or of the program, by level or, with an acceptance angle, by hue.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]
  const pickOf = (id: Part) => ({
    id,
    selected: pick.selected === id,
    onSelect: pick.toggle,
  })

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="mixer feedback loop">
        {arrow => (
          <>
            <Label x={0} y={PROG_Y - 5}>
              program
            </Label>
            <Wire arrow={arrow} d={`M0 ${PROG_Y} H${COL_X - FADER_W / 2}`} />
            <Wire arrow={arrow} d={`M${COL_X + FADER_W / 2} ${PROG_Y} H160`} />
            <BoxView
              box={{
                x: 160,
                y: PROG_Y - BOX_H / 2,
                w: 48,
                h: BOX_H,
                name: 'rails',
                touched: false,
                help: 'The output stage. It compresses into its rails past 110 IRE and below −50, and leaves anything inside them alone.',
              }}
            />
            <Wire arrow={arrow} d={`M208 ${PROG_Y} H${RIGHT_X} V46`} />
            <Label x={RIGHT_X} y={PROG_Y - 5} anchor="end">
              to the chain
            </Label>

            <g opacity={off ? 0.55 : 1}>
              <Wire arrow={arrow} d={`M${RIGHT_X} 79 V95`} look={loopLook} />
              <Wire
                arrow={arrow}
                d={`M${RIGHT_X} 128 V${BOT_Y} H${RIGHT_X - 38}`}
                look={loopLook}
              />
              <Wire
                arrow={arrow}
                d={`M${RIGHT_X - 86} ${BOT_Y} H${COL_X + 34}`}
                look={loopLook}
              />
              {[
                [BOT_Y - BOX_H / 2, NOISE_Y + JUNCTION_R],
                [NOISE_Y - JUNCTION_R, RES_Y + JUNCTION_R],
                [RES_Y - JUNCTION_R, RING_Y + JUNCTION_R],
                [RING_Y - JUNCTION_R, TRIM_BASE],
                [TRIM_TOP, PROG_Y + BOX_H / 2],
              ].map(([from, to]) => (
                <Wire
                  key={from}
                  arrow={arrow}
                  d={`M${COL_X} ${from} V${to}`}
                  look={loopLook}
                />
              ))}

              <Wire
                arrow={arrow}
                d={`M${TAP_X} ${BOT_Y} V${RES_Y + BOX_H / 2}`}
                look={resLook}
              />
              <Wire
                arrow={arrow}
                d={`M${TAP_X - 34} ${RES_Y} H${COL_X + JUNCTION_R}`}
                look={resLook}
              />
              <Wire
                arrow={arrow}
                d={`M${COL_X + 20} ${RING_Y} H${COL_X + JUNCTION_R}`}
                look={ringLook}
              />
              <Wire
                arrow={arrow}
                d={`M${CARRIER_X} ${RING_Y} H${COL_X + 84}`}
                look={ringLook}
              />
              <Label x={CARRIER_X + 4} y={RING_Y + 3.5} on={ringing}>
                {osc ? 'osc' : 'program'}
              </Label>
              <Wire
                arrow={arrow}
                d={`M${KEY_CTRL_X} ${NOISE_Y} H${COL_X - JUNCTION_R}`}
                look={noisy && !off ? 'on' : 'dash'}
              />
              <Label
                x={KEY_CTRL_X - 4}
                y={NOISE_Y + 3.5}
                anchor="end"
                on={r.touched('cfbNoiseIre')}
                pick={pickOf('noise')}
              >
                noise
              </Label>
              <circle
                cx={TAP_X}
                cy={BOT_Y}
                r={2.5}
                className={off ? own.tap : own.tapOn}
              />

              <g className={keyExt ? own.unpatched : undefined}>
                <Wire
                  arrow={arrow}
                  d={`M${TAP_X} ${BOT_Y} V${SELF_Y} H${KEY_IN_X} V${KEY_Y + BOX_H / 2}`}
                  look={keyExt ? 'dash' : keyLook}
                />
                <Label x={KEY_IN_X + 5} y={KEY_Y + 34}>
                  self
                </Label>
              </g>
              <g className={keyExt ? undefined : own.unpatched}>
                <Wire
                  arrow={arrow}
                  d={`M${KEY_IN_X} ${PROG_Y} V${KEY_Y - BOX_H / 2}`}
                  look={keyExt ? keyLook : 'dash'}
                />
                <Label x={KEY_IN_X + 5} y={KEY_Y - 24}>
                  program
                </Label>
              </g>
              <Wire
                arrow={arrow}
                d={`M${KEY_X + KEY_W} ${KEY_Y} H${KEY_CTRL_X} V${PROG_Y + BOX_H / 2}`}
                look={keyLook}
              />

              <Junction y={NOISE_Y} symbol="+" on={noisy} />
              <Junction y={RES_Y} symbol="+" on={resonating} />
              <Junction y={RING_Y} symbol="×" on={ringing} />

              <Pressable
                name="trim"
                selected={pick.selected === 'trim'}
                onSelect={() => pick.toggle('trim')}
              >
                <title>
                  trim — The proc amp on the return. With the fader it sets the
                  round trip; negative inverts every lap.
                </title>
                <path
                  d={`M${COL_X - 9} ${TRIM_BASE} L${COL_X + 9} ${TRIM_BASE} L${COL_X} ${TRIM_TOP} Z`}
                  className={`${r.touched('cfbGain') ? styles.boxOn : styles.box} ${pick.selected === 'trim' ? styles.selected : ''}`}
                />
                <text
                  x={COL_X + 14}
                  y={TRIM_BASE - 3}
                  className={r.touched('cfbGain') ? styles.nameOn : styles.name}
                >
                  trim
                </text>
              </Pressable>
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
