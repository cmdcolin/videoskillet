import { BandLane } from './BandLane'
import styles from './CrosspointDiagram.module.css'
import { cutRows, driftAcrossFrame, lostRows } from './crosspointModel'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { alongPicture } from './plotAlong'
import { CROSSPOINT_KEYS, CROSSPOINT_OPENS as OPENS } from './schematicKeys'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const READ = [...CROSSPOINT_KEYS, 'bGenlock'] as const

const WIDTH = 340
const ROW_Y = 14
const H = 20
const COL = {
  wander: { x: 30, w: 49 },
  capture: { x: 93, w: 55 },
  leak: { x: 162, w: 37 },
  cut: { x: 213, w: 32 },
} satisfies Record<Part, { x: number; w: number }>
const ORDER = ['wander', 'capture', 'leak', 'cut'] as const

const PLOT = { top: 50, bottom: 98 }
const DRIFT = { left: 24, right: 164, ...PLOT }
const RASTER = { left: 200, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const POINTS = 41
const SPANS = [1, 2, 5, 10, 20]
const LANES = { cut: [0, 0.42], lock: [0.58, 1] } as const

const after = (id: Part) => COL[id].x + COL[id].w
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')
const laneX = (lane: keyof typeof LANES, at: 0 | 1) =>
  RASTER.left + (RASTER.right - RASTER.left) * LANES[lane][at]

export function CrosspointDiagram() {
  const r = useReadings(READ)
  const pick = useSelectedBox()
  const v = r.value
  const reach = v('bWanderUs')
  const capture = v('bCaptureUs')
  const genlocked = v('bGenlock') > 0.5
  const live = ORDER.map(id => r.touched(...OPENS[id]))
  const span =
    SPANS.find(s => s >= Math.max(reach, capture) * 1.05) ?? SPANS.at(-1)!
  const lost = genlocked ? lostRows(reach, capture) : []
  const windowY = (us: number) =>
    PLOT.bottom - ((PLOT.bottom - PLOT.top) * (us + span)) / (2 * span)

  const box = (id: Part, name: string, help: string): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: COL[id].x,
    y: ROW_Y - H / 2,
    w: COL[id].w,
    h: H,
    name,
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'wander',
      'wander',
      "How far source B's own clock strays from the house, as an aperiodic wander that tilts down the frame.",
    ),
    box(
      'capture',
      'capture',
      "How far off the genlock can still pull B back onto the house raster. Lines past it show B torn sideways with its colour rotating against the burst, in a band that moves with B's wander.",
    ),
    box(
      'leak',
      'leak',
      "B's high frequencies leaking past a closed fader through stray capacitance. Flat areas of B never get through, only its subcarrier and edges, so a faint rainbow moves on the bus with no picture behind it.",
    ),
    box(
      'cut',
      'cut',
      'A relay that switches the whole bus to B for this fraction of each frame, counted back from the bottom. Sync and burst switch with the picture, so the receiver meets two signals in one frame and has to find lock across the seam.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="crosspoint">
        {arrow => (
          <>
            <Label x={0} y={ROW_Y - 6}>
              B
            </Label>
            <Wire arrow={arrow} d={`M0 ${ROW_Y} H${COL.wander.x}`} />
            {ORDER.slice(0, -1).map((id, i) => (
              <Wire
                key={id}
                arrow={arrow}
                d={`M${after(id)} ${ROW_Y} H${COL[ORDER[i + 1]!].x}`}
                look={look(live.slice(0, i + 1).some(Boolean))}
              />
            ))}
            <Wire
              arrow={arrow}
              d={`M${after('cut')} ${ROW_Y} H${WIDTH - 2}`}
              look={look(live.some(Boolean))}
            />
            <Label x={WIDTH - 2} y={ROW_Y - 6} anchor="end">
              to the bus
            </Label>

            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <rect
              x={DRIFT.left}
              y={windowY(capture)}
              width={DRIFT.right - DRIFT.left}
              height={windowY(-capture) - windowY(capture)}
              className={styles.window}
            />
            <TracePlot
              {...DRIFT}
              title="B drift, µs, worst case"
              values={driftAcrossFrame(reach, POINTS)}
              scale={{
                lo: -span,
                hi: span,
                ticks: [-span, 0, span],
                reference: 0,
              }}
              format={signed}
              ends={['top', 'bottom']}
              along={alongPicture}
              look={lost.length > 0 ? 'alarm' : reach > 0 ? 'on' : 'plain'}
            />

            <Label x={RASTER.left} y={PLOT.top - 6}>
              one frame, B off lock
            </Label>
            <rect
              x={RASTER.left}
              y={RASTER.top}
              width={RASTER.right - RASTER.left}
              height={RASTER.bottom - RASTER.top}
              className={styles.frame}
            />
            <BandLane
              x0={laneX('cut', 0)}
              x1={laneX('cut', 1)}
              top={RASTER.top}
              bottom={RASTER.bottom}
              bands={cutRows(v('busCut'))}
              className={styles.cut!}
            />
            <BandLane
              x0={laneX('lock', 0)}
              x1={laneX('lock', 1)}
              top={RASTER.top}
              bottom={RASTER.bottom}
              bands={lost}
              className={styles.lost!}
            />
            {(['cut', 'lock'] as const).map(lane => (
              <Label
                key={lane}
                x={(laneX(lane, 0) + laneX(lane, 1)) / 2}
                y={RASTER.bottom + 11}
                anchor="middle"
                on={lane === 'cut' ? v('busCut') > 0 : lost.length > 0}
              >
                {lane}
              </Label>
            ))}
          </>
        )}
      </Diagram>
      <BoxRows
        keys={open}
        help={boxes.find(b => b.id === pick.selected)?.help}
      />
    </>
  )
}
