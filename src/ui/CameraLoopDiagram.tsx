import { useId } from 'react'

import { cameraLapGains, greyLevels, type CameraLoop } from './cameraLap'
import own from './CameraLoopDiagram.module.css'
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
import { PlotProbe } from './PlotProbe'
import {
  CAMERA_LOOP_KEYS,
  CAMERA_LOOP_OPENS,
  TUBE_FACE_KEYS,
  TUBE_FACE_OPENS,
} from './schematicKeys'

const OPENS = { ...CAMERA_LOOP_OPENS, ...TUBE_FACE_OPENS }
const READ = [...CAMERA_LOOP_KEYS, ...TUBE_FACE_KEYS]

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 50
const H = 20
const FADER = { x: 52, w: 52 }
const IRIS_UP_X = 60
const PICKUP_UP_X = 92
const ROW = {
  iris: { x: 0, w: 43 },
  pickup: { x: 70, w: 60 },
  lens: { x: 150, w: 48 },
  face: { x: 262, w: 77 },
}
const DROP_X = ROW.face.x + ROW.face.w / 2

const PLOT = { left: 22, right: 334, top: 82, bottom: 126 }
const HEIGHT = PLOT.bottom + 14
const GAIN_TOP = 2
const LEVELS = greyLevels(120)

const plotX = (level: number) => PLOT.left + (PLOT.right - PLOT.left) * level
const plotY = (g: number) =>
  PLOT.bottom -
  ((PLOT.bottom - PLOT.top) * Math.min(Math.max(g, 0), GAIN_TOP)) / GAIN_TOP

const trace = (gains: readonly number[]) =>
  gains
    .map(
      (g, i) =>
        `${i === 0 ? 'M' : 'L'}${plotX(LEVELS[i]!).toFixed(1)} ${plotY(g).toFixed(1)}`,
    )
    .join(' ')

// The camera loop as compose.wgsl closes it, drawn as the mixer loop's sibling.
// The program crosses the fader into the chain, which ends on the tube's face.
// Light from the face crosses to the lens, the pickup tube reads it, and its
// picture runs up into the fader, whose exposure the iris servo trims. Under
// the loop, what one lap hands back of a grey patch at each level.
function CameraLoop({ initial }: { initial: Part | null }) {
  const r = useReadings(READ)
  const pick = useSelectedBox(initial)
  const clip = useId()
  const v = r.value
  const loop: CameraLoop = {
    mix: v('fbMix'),
    gain: v('fbGain'),
    black: v('fbBlack'),
    knee: v('fbKnee'),
    cutoff: v('crtCutoff'),
    gamma: v('crtGamma'),
    bloom: v('crtBloom'),
    halation: v('crtHalation'),
    glow: v('crtGlow'),
  }
  const off = loop.mix === 0
  const gains = cameraLapGains(loop, LEVELS)
  const peak = Math.max(...gains)
  const look: WireLook = off ? 'dash' : peak > 1 ? 'alarm' : 'on'
  const irisLook: WireLook = v('fbIris') !== 0 && !off ? 'on' : 'dash'
  const curve = trace(gains)
  // With the fader down, the lap at its full travel, where mix is 1.
  const upGains = off ? cameraLapGains({ ...loop, mix: 1 }, LEVELS) : null

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
    off: off && id !== 'fader' && id !== 'face',
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'fader',
      FADER,
      TOP_Y,
      'fader',
      "The crossfader between the program and the camera, and the camera's exposure. The two multiply into the round trip.",
    ),
    box(
      'iris',
      ROW.iris,
      BOT_Y,
      'iris',
      'An auto-iris servo metering the screen and trimming the exposure a frame late. Turned up, it overshoots and hunts.',
    ),
    box(
      'face',
      ROW.face,
      BOT_Y,
      'tube face',
      "What the camera shoots: the gun's cutoff and gamma, then the saturation, bloom, halation and glow of the glass.",
    ),
    box(
      'lens',
      ROW.lens,
      BOT_Y,
      'lens',
      "The camera's framing of the screen, zoom, tilt and aim, then the lens blur and vignette. Every lap reframes again.",
    ),
    box(
      'pickup',
      ROW.pickup,
      BOT_Y,
      'pickup',
      "The pickup tube: lag and comet tails on its target, then the sensor's black cut and highlight shoulder.",
    ),
  ]
  const bottom = BOT_Y - H / 2
  const under = TOP_Y + H / 2
  const back = (from: { x: number }, to: { x: number; w: number }) =>
    `M${from.x} ${BOT_Y} H${to.x + to.w}`

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="camera feedback loop">
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
              through the chain
            </Label>

            <g opacity={off ? 0.55 : 1}>
              <g className={own.light}>
                <Wire arrow={arrow} d={back(ROW.face, ROW.lens)} look={look} />
              </g>
              <Label
                x={(ROW.lens.x + ROW.lens.w + ROW.face.x) / 2}
                y={BOT_Y - 5}
                anchor="middle"
              >
                light
              </Label>
              <Wire arrow={arrow} d={back(ROW.lens, ROW.pickup)} look={look} />
              <Wire
                arrow={arrow}
                d={`M${PICKUP_UP_X} ${bottom} V${under}`}
                look={look}
              />
              <Wire
                arrow={arrow}
                d={`M${ROW.iris.w} ${BOT_Y} H${IRIS_UP_X} V${under}`}
                look={irisLook}
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
              loop gain per lap, by level
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
            <Label x={PLOT.left} y={PLOT.bottom + 12}>
              black
            </Label>
            <Label x={plotX(0.5)} y={PLOT.bottom + 12} anchor="middle">
              grey
            </Label>
            <Label x={PLOT.right} y={PLOT.bottom + 12} anchor="end">
              white
            </Label>
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
                r.touched(
                  'fbMix',
                  'fbGain',
                  'fbBlack',
                  'fbKnee',
                  'crtCutoff',
                  'crtGamma',
                  'crtBloom',
                  'crtHalation',
                  'crtGlow',
                )
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
            <PlotProbe
              {...PLOT}
              read={along => {
                const i = Math.round(along * (LEVELS.length - 1))
                return {
                  x: plotX(LEVELS[i]!),
                  y: plotY(gains[i]!),
                  text: `${Math.round(LEVELS[i]! * 100)}% · ${gains[i]!.toFixed(2)}×`,
                }
              }}
            />
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}

export function CameraLoopDiagram() {
  return <CameraLoop initial={null} />
}

// The tube face's own card draws the same loop, opened on the face.
export function TubeFaceDiagram() {
  return <CameraLoop initial="face" />
}
