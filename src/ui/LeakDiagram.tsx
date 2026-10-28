import { FSC, SAMPLE_RATE } from '../core/signal/constants'
import { sliderFor, snapToStep } from './controls'
import { useControlsApi } from './ControlsContext'
import {
  ire,
  lit,
  openBox,
  rightOf,
  stageBoxes,
  useReadings,
  useSelectedBox,
} from './diagram'
import styles from './Diagram.module.css'
import { Boxes, BoxRows, Diagram, Label, SumNode, Wire } from './DiagramParts'
import own from './LeakDiagram.module.css'
import { channelLine, ghostGains, type Leak } from './leakModel'
import { alongRange } from './plotAlong'
import { PlotHandle } from './PlotHandle'
import { LEAK_KEYS, LEAK_OPENS as OPENS } from './schematicKeys'
import { BAR_US, LINE_US, PICTURE_BAND } from './testLine'
import { TracePlot, type TraceScale } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 46
const H = 20
const SPLIT_X = 30
const SUM_X = 116
const SUM_R = 5
const TAP_X = 270
const COL = {
  ghost: { x: 50, w: 46 },
  hum: { x: 134, w: 40 },
  sound: { x: 192, w: 50 },
  buzz: { x: 248, w: 44 },
} satisfies Record<Part, { x: number; w: number }>

const PLOT = { top: 78, bottom: 122 }
const LINE = { left: 24, right: 164, ...PLOT }
const COMB = { left: 200, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const IRE_SCALE: TraceScale = {
  lo: -60,
  hi: 140,
  ticks: [0, 100],
  reference: 0,
}
const BAND_MHZ = 6
const FSC_X = COMB.left + ((COMB.right - COMB.left) * FSC) / 1e6 / BAND_MHZ

const signed = (v: number) => (v < 0 ? `−${(-v).toFixed(2)}` : v.toFixed(2))
const times = (v: number) => (v === 0 ? '0' : `${v}×`)
const usX = (us: number) =>
  LINE.left + ((LINE.right - LINE.left) * (us % LINE_US)) / LINE_US
// The delay that puts the bar's echo under `x`. Where that needs more than the
// slider's maximum, the function returns 0 or the maximum, whichever is nearer.
const delayAt = (x: number, max: number) => {
  const us = ((x - LINE.left) / (LINE.right - LINE.left)) * LINE_US
  const d = (((us - BAR_US[0]) % LINE_US) + LINE_US) % LINE_US
  return d <= max ? d : d > (max + LINE_US) / 2 ? 0 : max
}
const after = (id: Part) => rightOf(COL[id])

// A comb's teeth sit 1/τ apart, so a long delay needs points enough to draw
// every one of them.
const combPoints = (delayUs: number) =>
  Math.min(Math.max(Math.ceil(BAND_MHZ * delayUs * 16), 121), 2401)

// What channel.wgsl adds to the program on its way through the air or the
// cable. A reflection arrives late and sums back in, a ground loop adds mains
// hum and the ripple on an amplifier's supply multiplies by it, and the 4.5 MHz
// sound carrier leaks past its trap. The receiver's sound detector hears that
// same carrier, and with it the picture, as buzz. Under the drawing, one line
// of a black picture with a white bar as it leaves, and what the ghost does at
// each frequency.
export function LeakDiagram() {
  const r = useReadings(LEAK_KEYS)
  const pick = useSelectedBox()
  const { beginHand, writeControl } = useControlsApi()
  const v = r.value
  const l: Leak = {
    ghostDelayUs: v('ghostDelayUs'),
    ghostGain: v('ghostGain'),
    soundIre: v('soundIre'),
  }
  const ghostOn = l.ghostGain !== 0
  const humOn = v('humAmp') > 0 || v('humMod') > 0
  const soundOn = l.soundIre > 0
  const line = channelLine(l)
  const points = combPoints(l.ghostDelayUs)
  const comb = ghostGains(
    l,
    Array.from({ length: points }, (_, i) => (BAND_MHZ * i) / (points - 1)),
  )
  const combTop = 1 + Math.abs(l.ghostGain) > 2 ? 3 : 2
  const echoFrom = usX(BAR_US[0])
  const echoTo = usX(BAR_US[0] + l.ghostDelayUs)
  const echoY = LINE.top + 4
  const echoShown = ghostOn && l.ghostDelayUs * 1e-6 * SAMPLE_RATE >= 1
  const delay = sliderFor('ghostDelayUs')
  const setDelay = (us: number) =>
    writeControl('ghostDelayUs', snapToStep(delay, us))

  const box = stageBoxes(OPENS, H, r)
  const boxes = [
    box(
      'ghost',
      COL.ghost,
      BOT_Y,
      'ghost',
      'Multipath: a reflection of the program arriving late and summed back in at its own gain. The reflection carries its subcarrier with it, so every 70 ns of delay turns its hue 90°. A negative gain arrives inverted and draws a dark outline.',
    ),
    box(
      'hum',
      COL.hum,
      TOP_Y,
      'hum',
      "Mains hum. A ground loop adds 60 Hz to the signal; the ripple on an amplifier's supply multiplies the signal by it, sync included, mostly at 120 Hz.",
    ),
    box(
      'sound',
      COL.sound,
      TOP_Y,
      'sound',
      'The 4.5 MHz intercarrier sound leaking past its trap: 286 cycles a line, so the weave stands still until the program audio moves it. It is strongest in the dark, where the vision carrier is strongest.',
    ),
    box(
      'buzz',
      COL.buzz,
      BOT_Y,
      'buzz',
      "The same leak heard through the set's sound detector: the picture arrives on the audio line and plays out of the speakers.",
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="ghosting and leakage">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              video
            </Label>
            <Wire d={`M0 ${TOP_Y} H${SUM_X - SUM_R}`} />
            <circle cx={SPLIT_X} cy={TOP_Y} r={2} className={styles.dot} />
            <Wire
              arrow={arrow}
              d={`M${SPLIT_X} ${TOP_Y} V${BOT_Y} H${COL.ghost.x}`}
              look={ghostOn ? 'on' : 'dash'}
            />
            <Wire
              arrow={arrow}
              d={`M${after('ghost')} ${BOT_Y} H${SUM_X} V${TOP_Y + SUM_R}`}
              look={ghostOn ? 'on' : 'dash'}
            />
            <SumNode x={SUM_X} y={TOP_Y} r={SUM_R} on={ghostOn} />
            <Wire
              arrow={arrow}
              d={`M${SUM_X + SUM_R} ${TOP_Y} H${COL.hum.x}`}
              look={lit(ghostOn)}
            />
            <Wire
              arrow={arrow}
              d={`M${after('hum')} ${TOP_Y} H${COL.sound.x}`}
              look={lit(ghostOn || humOn)}
            />
            <Wire
              arrow={arrow}
              d={`M${after('sound')} ${TOP_Y} H${WIDTH - 2}`}
              look={lit(ghostOn || humOn || soundOn)}
            />
            <Label x={WIDTH - 2} y={TOP_Y - 6} anchor="end">
              to the set
            </Label>
            <circle cx={TAP_X} cy={TOP_Y} r={2} className={styles.dot} />
            <Wire
              arrow={arrow}
              d={`M${TAP_X} ${TOP_Y} V${BOT_Y - H / 2}`}
              look={v('buzzLevel') > 0 ? 'on' : 'dash'}
            />
            <Wire
              arrow={arrow}
              d={`M${after('buzz')} ${BOT_Y} H${WIDTH - 2}`}
              look={v('buzzLevel') > 0 ? 'on' : 'dash'}
            />
            <Label x={WIDTH - 2} y={BOT_Y - 6} anchor="end">
              audio
            </Label>

            <Boxes boxes={boxes} pick={pick} />

            <TracePlot
              {...LINE}
              title={
                echoShown
                  ? `echo +${r.read('ghostDelayUs')} ×${signed(l.ghostGain)}`
                  : 'one line, IRE'
              }
              values={line}
              scale={IRE_SCALE}
              format={ire}
              ends={['0', `${LINE_US.toFixed(1)} µs`]}
              along={alongRange(0, LINE_US, 'µs')}
              band={PICTURE_BAND}
              look={ghostOn || soundOn ? 'on' : 'plain'}
            />
            {echoShown && (
              <>
                <line
                  x1={echoFrom}
                  x2={echoFrom}
                  y1={echoY - 3}
                  y2={echoY + 3}
                  className={own.span}
                />
                <path
                  d={
                    echoTo > echoFrom
                      ? `M${echoFrom} ${echoY} H${echoTo}`
                      : `M${echoFrom} ${echoY} H${LINE.right} M${LINE.left} ${echoY} H${echoTo}`
                  }
                  className={own.span}
                />
                <line
                  x1={echoTo}
                  x2={echoTo}
                  y1={echoY - 3}
                  y2={echoY + 3}
                  className={own.span}
                />
              </>
            )}
            {ghostOn && (
              <PlotHandle
                x={echoTo}
                y={echoY}
                label="ghost delay"
                reading={`${l.ghostDelayUs.toFixed(2)} µs`}
                value={l.ghostDelayUs}
                range={delay}
                onGrab={beginHand}
                onMove={pointer => setDelay(delayAt(pointer.x, delay.max))}
                onNudge={dx => setDelay(l.ghostDelayUs + dx * delay.step * 10)}
              />
            )}

            <TracePlot
              {...COMB}
              title="ghost gain"
              values={comb}
              scale={{
                lo: 0,
                hi: combTop,
                ticks: [0, 1, combTop],
                reference: 1,
              }}
              format={times}
              ends={['0', `${BAND_MHZ} MHz`]}
              along={alongRange(0, BAND_MHZ, 'MHz')}
              look={ghostOn ? 'on' : 'plain'}
            />
            <line
              x1={FSC_X}
              x2={FSC_X}
              y1={PLOT.top}
              y2={PLOT.bottom}
              className={styles.fsc}
            />
            <Label x={FSC_X} y={PLOT.top - 6} anchor="middle">
              fsc
            </Label>
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
