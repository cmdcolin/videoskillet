import { ACTIVE_HEIGHT } from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { ablDrive, beamIre, cardLoads, leftEdges, WHITE_BAR } from './scanModel'
import { DEFLECTION_KEYS, DEFLECTION_OPENS as OPENS } from './schematicKeys'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 50
const H = 20
const COL = {
  limiter: { x: 38, w: 56 },
  middle: { x: 120, w: 60 },
  right: { x: 284, w: 56 },
}
const YOKE_X = 240
const LIMIT_MID = COL.limiter.x + COL.limiter.w / 2
const MIDDLE_MID = COL.middle.x + COL.middle.w / 2

const PLOT = { top: 76, bottom: 116 }
const LEFT_PLOT = { left: 24, right: 164 }
const RIGHT_PLOT = { left: 200, right: 336 }
const HEIGHT = PLOT.bottom + 14
const DRIVE_FRAMES = 120
const WHITE_BEAM = beamIre(cardLoads('white'))
const BAR_BAND = [
  WHITE_BAR[0] / ACTIVE_HEIGHT,
  WHITE_BAR[1] / ACTIVE_HEIGHT,
] as const

// The receiver's deflection as decode.wgsl and sync.wgsl run it. The beam
// limiter sets the drive, the beam current that drive asks for loads the HV
// tank, and the tank's sag pulls each line sideways next to the parametric bend
// while its EHT sets the height. The vertical output stage draws the sweep and
// the flyback returns it. Under the drawing, where the left edge lands with a
// white bar on screen, and the drive the limiter allows after a cut to white.
export function DeflectionDiagram() {
  const r = useReadings(DEFLECTION_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const sagOn = v('hvSagUs') !== 0
  const ablOn = v('abl') > 0
  const edges = leftEdges({
    bendUs: v('bendUs'),
    bendShape: v('bendShape'),
    bendPeriod: v('bendPeriod'),
    hvSagUs: v('hvSagUs'),
    hvRing: v('hvRing'),
    abl: v('abl'),
  })
  const drive = ablDrive(v('abl'), WHITE_BEAM, DRIVE_FRAMES)
  const tail = drive.slice(-DRIVE_FRAMES / 4)
  const pumps = Math.max(...tail) - Math.min(...tail) > 0.05

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
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'limiter',
      COL.limiter,
      TOP_Y,
      'limiter',
      'The automatic beam limiter. Past what the flyback can source it turns the drive down, through a servo with its own lag, so the correction lands after the content that caused it. The knob undersizes the flyback and strips the damping.',
    ),
    box(
      'tank',
      COL.middle,
      TOP_Y,
      'HV tank',
      'The flyback and the EHT supply, one LC tank loaded by the beam current. It integrates down the raster in scan order, so a bright band pulls the lines below it sideways, and wound toward resonance it rings.',
    ),
    box(
      'bend',
      COL.right,
      TOP_Y,
      'bend',
      "A fixed bend in the tube's horizontal scan, by shape down the frame. Deflection-domain, so hue stays put.",
    ),
    box(
      'output',
      COL.middle,
      BOT_Y,
      'V output',
      "The vertical output stage: the sawtooth's amplitude, its curvature, and where it saturates and folds back.",
    ),
    box(
      'flyback',
      COL.right,
      BOT_Y,
      'flyback',
      'The vertical retrace: how many line times it takes, and whether the blanking pulse that hides it is there.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]
  const sagLook: WireLook = sagOn ? 'on' : 'dash'
  const ablLook: WireLook = ablOn ? 'on' : 'plain'
  const into = (y: number, look: WireLook) => ({
    from: `M${COL.middle.x + COL.middle.w} ${y} H${YOKE_X - 22}`,
    back: `M${COL.right.x} ${y} H${YOKE_X + 22}`,
    look,
  })
  const h = into(TOP_Y, sagLook)
  const vy = into(BOT_Y, r.touched(...OPENS.output) ? 'on' : 'plain')

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="receiver deflection">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              video
            </Label>
            <Wire arrow={arrow} d={`M0 ${TOP_Y} H${COL.limiter.x}`} />
            <Wire
              arrow={arrow}
              d={`M${COL.limiter.x + COL.limiter.w} ${TOP_Y} H${COL.middle.x}`}
              look={ablLook}
            />
            <Wire
              arrow={arrow}
              d={`M${LIMIT_MID} ${TOP_Y + H / 2} V${BOT_Y - 6}`}
              look={ablLook}
            />
            <Label x={LIMIT_MID} y={BOT_Y + 6} anchor="middle">
              to the guns
            </Label>
            <Wire arrow={arrow} d={h.from} look={h.look} />
            <Wire
              arrow={arrow}
              d={h.back}
              look={v('bendUs') !== 0 ? 'on' : 'dash'}
            />
            <Label x={YOKE_X} y={TOP_Y + 3} anchor="middle">
              H yoke
            </Label>
            <Wire
              arrow={arrow}
              d={`M${MIDDLE_MID} ${TOP_Y + H / 2} V${BOT_Y - H / 2}`}
              look={sagLook}
            />
            <Label x={MIDDLE_MID + 5} y={TOP_Y + H / 2 + 11}>
              EHT
            </Label>
            <Wire arrow={arrow} d={vy.from} look={vy.look} />
            <Wire
              arrow={arrow}
              d={vy.back}
              look={v('retraceLines') > 0 ? 'on' : 'plain'}
            />
            <Label x={YOKE_X} y={BOT_Y + 3} anchor="middle">
              V yoke
            </Label>

            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <TracePlot
              {...LEFT_PLOT}
              {...PLOT}
              title="left edge, µs right"
              values={edges}
              scale={{ floor: 1 }}
              ends={['top', 'bottom']}
              band={BAR_BAND}
              look={r.touched(...OPENS.tank, ...OPENS.bend) ? 'on' : 'plain'}
            />
            <Label
              x={LEFT_PLOT.left + (LEFT_PLOT.right - LEFT_PLOT.left) * 0.5}
              y={PLOT.top + 9}
              anchor="middle"
            >
              white
            </Label>
            <TracePlot
              {...RIGHT_PLOT}
              {...PLOT}
              title="drive, cut to white"
              values={drive}
              scale={{ lo: 0, hi: 1.2, ticks: [0, 1], reference: 1 }}
              format={String}
              ends={['cut', '2 s']}
              look={pumps ? 'alarm' : ablOn ? 'on' : 'plain'}
            />
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
