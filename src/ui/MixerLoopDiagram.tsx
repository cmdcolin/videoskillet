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
import { HueWheel, LevelBar, TurnDial } from './HueWheel'
import { lapTurn, turnWords } from './lapTurn'
import { BAND_MHZ, bandMHz, lapGains, type MixerLoop } from './loopGain'
import own from './MixerLoopDiagram.module.css'
import { MIXER_LOOP_KEYS, MIXER_LOOP_OPENS as OPENS } from './schematicKeys'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 16
const BOT_Y = 56
const H = 24
const FADER = { x: 50, w: 76 }
const KEY_UP_X = 58
const RING_UP_X = 116
const DROP_X = 316
const ROW = {
  keyer: { x: 0, w: 42 },
  ring: { x: 64, w: 58 },
  resonance: { x: 137, w: 68 },
  return: { x: 220, w: 56 },
  store: { x: 292, w: 48 },
}

const KEY_IN_X = ROW.keyer.x + ROW.keyer.w / 2
const TAP_X = ROW.store.x - 4
const UNDER_Y = 73
const PLOT = { left: 22, right: 236, top: 92, bottom: 130 }
const FOLD_LO_MHZ = 1
const FOLD_DC_MHZ = 0.25
const WIDE_RIGHT = WIDTH - 6
const HEIGHT = PLOT.bottom + 14
const SLICE_X = 298
const WHEEL = { cx: SLICE_X, cy: 112, radius: 26 }
const GAIN_TOP = 2
const FSC_MHZ = FSC / 1e6
const MHZ_TICKS = [0, 2, 4, BAND_MHZ]
const RIM = 0.7
const POINTS = 121
const CURVE_MHZ = bandMHz(POINTS)

const plotX = (mhz: number, right: number) =>
  PLOT.left + ((right - PLOT.left) * mhz) / BAND_MHZ
const plotY = (g: number) =>
  PLOT.bottom -
  ((PLOT.bottom - PLOT.top) * Math.min(Math.max(g, 0), GAIN_TOP)) / GAIN_TOP

const trace = (gains: readonly number[], right: number) =>
  gains
    .map(
      (g, i) =>
        `${i === 0 ? 'M' : 'L'}${plotX(CURVE_MHZ[i]!, right).toFixed(1)} ${plotY(g).toFixed(1)}`,
    )
    .join(' ')

// The mixer loop as fb_composite.wgsl runs it, one box per stage. The program
// crosses the fader into the rest of the chain, the frame store captures what
// came out and reads it back late, and the return runs back along the bottom
// through the Y/C split, the resonance and the ring modulator into the fader,
// which the keyer gates. Under the loop, what one lap hands back at each
// frequency. Beside it, with the store open, how far one lap turns the hue;
// otherwise, while the key is in use or the keyer is open, the slice the keyer
// lets round, drawn on the U/V plane for a hue key and on the luma scale for a
// level key. A wire runs into the keyer from the store's raw read for a self
// key and from the program for an external one. With the ring modulator open,
// arcs on the frequency axis show where its products land. On its own
// oscillator the bridge moves brightness up onto the subcarrier and chroma down
// to brightness. On the program, the bridge moves chroma down to DC.
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
  const inset =
    pick.selected === 'store'
      ? 'turn'
      : key !== 0 || pick.selected === 'keyer'
        ? 'slice'
        : null
  const turn = lapTurn({
    cfbDelayUs: v('cfbDelayUs'),
    cfbLines: v('cfbLines'),
    cfbClockPct: v('cfbClockPct'),
    cfbServoUs: v('cfbServoUs'),
  })
  const right = inset ? PLOT.right : WIDE_RIGHT
  const x = (mhz: number) => plotX(mhz, right)
  const byProgram = v('cfbKeyExt') > 0.5
  const ringLook: WireLook = v('cfbRing') > 0 && !off ? 'on' : 'dash'
  const byOscillator = v('cfbRingSrc') > 0.5
  const curve = trace(gains, right)
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
          <g className={own.caps}>
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
              {inset === 'slice' &&
                (byProgram ? (
                  <>
                    <circle
                      cx={KEY_IN_X}
                      cy={TOP_Y}
                      r={1.8}
                      className={own.dot}
                    />
                    <Wire
                      arrow={arrow}
                      d={`M${KEY_IN_X} ${TOP_Y} V${bottom}`}
                      look={keyLook}
                    />
                  </>
                ) : (
                  <>
                    <circle cx={TAP_X} cy={BOT_Y} r={1.8} className={own.dot} />
                    <Wire
                      arrow={arrow}
                      d={`M${TAP_X} ${BOT_Y} V${UNDER_Y} H${KEY_IN_X} V${BOT_Y + H / 2}`}
                      look={keyLook}
                    />
                  </>
                ))}
            </g>

            <g className={own.names}>
              {boxes.map(b => (
                <BoxView
                  key={b.id}
                  box={b}
                  selected={b.id === pick.selected}
                  onSelect={pick.toggle}
                />
              ))}
            </g>

            <Label x={PLOT.left + 4} y={PLOT.top - 8}>
              {pick.selected === 'ring'
                ? 'gain per lap and ring products'
                : 'loop gain per lap'}
            </Label>
            <line
              x1={PLOT.left}
              x2={right}
              y1={plotY(0)}
              y2={plotY(0)}
              className={styles.grid}
            />
            <line
              x1={PLOT.left}
              x2={right}
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
              x1={x(FSC_MHZ)}
              x2={x(FSC_MHZ)}
              y1={PLOT.top}
              y2={PLOT.bottom}
              className={own.fsc}
            />
            <Label x={x(FSC_MHZ)} y={PLOT.top - 8} anchor="middle">
              fsc
            </Label>
            <g className={own.units}>
              {MHZ_TICKS.map(n => (
                <Label
                  key={n}
                  x={x(n)}
                  y={PLOT.bottom + 12}
                  anchor={n === BAND_MHZ ? 'end' : 'middle'}
                >
                  {n === BAND_MHZ ? `${n} MHz` : String(n)}
                </Label>
              ))}
            </g>
            <clipPath id={clip}>
              <rect
                x={PLOT.left}
                y={PLOT.top - 2}
                width={right - PLOT.left}
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
                <path d={trace(upGains, right)} className={own.faderUp} />
                <Label
                  x={right}
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

            {pick.selected === 'ring' &&
              (byOscillator ? (
                <>
                  <Wire
                    arrow={arrow}
                    look={ringLook}
                    d={`M${x(FOLD_LO_MHZ)} 103 Q${(x(FOLD_LO_MHZ) + x(FSC_MHZ)) / 2} 86 ${x(FSC_MHZ)} 101`}
                  />
                  <Wire
                    arrow={arrow}
                    look={ringLook}
                    d={`M${x(FSC_MHZ)} 105 Q${(x(FOLD_LO_MHZ) + x(FSC_MHZ)) / 2} 113 ${x(FOLD_LO_MHZ)} 106`}
                  />
                  <Label x={x(FSC_MHZ) + 6} y={104}>
                    light ⇄ hue
                  </Label>
                </>
              ) : (
                <>
                  <Wire
                    arrow={arrow}
                    look={ringLook}
                    d={`M${x(FSC_MHZ)} 103 Q${(x(FOLD_DC_MHZ) + x(FSC_MHZ)) / 2} 86 ${x(FOLD_DC_MHZ)} 103`}
                  />
                  <Label x={x(FSC_MHZ) + 6} y={104}>
                    hue × hue → light
                  </Label>
                </>
              ))}

            {inset && (
              <Label
                x={SLICE_X}
                y={WHEEL.cy - WHEEL.radius - 6}
                anchor="middle"
              >
                {inset === 'turn'
                  ? turnWords(turn)
                  : byHue
                    ? 'keyed by hue'
                    : 'keyed by level'}
              </Label>
            )}
            {inset === 'turn' ? (
              <TurnDial {...WHEEL} turn={turn} on={!off} arrow={arrow} />
            ) : inset !== 'slice' ? null : byHue ? (
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
          </g>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
