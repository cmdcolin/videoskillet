import { RasterPanel } from './BandLane'
import styles from './CrosspointDiagram.module.css'
import { cutRows, driftAcrossFrame, lostRows } from './crosspointModel'
import { openBox, stageBoxes, useReadings, useSelectedBox } from './diagram'
import { Boxes, BoxRows, Chain, Diagram } from './DiagramParts'
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

  const box = stageBoxes(OPENS, H, r)
  const boxes = [
    box(
      'wander',
      COL.wander,
      ROW_Y,
      'wander',
      "How far source B's own clock strays from the house, as an aperiodic wander that tilts down the frame.",
    ),
    box(
      'capture',
      COL.capture,
      ROW_Y,
      'capture',
      "How far off the genlock can still pull B back onto the house raster. Lines past it show B torn sideways with its colour rotating against the burst, in a band that moves with B's wander.",
    ),
    box(
      'leak',
      COL.leak,
      ROW_Y,
      'leak',
      "B's high frequencies leaking past a closed fader through stray capacitance. Flat areas of B never get through, only its subcarrier and edges, so a faint rainbow moves on the bus with no picture behind it.",
    ),
    box(
      'cut',
      COL.cut,
      ROW_Y,
      'cut',
      'A relay that switches the whole bus to B for this fraction of each frame, counted back from the bottom. Sync and burst switch with the picture, so the receiver meets two signals in one frame and has to find lock across the seam.',
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="crosspoint">
        {arrow => (
          <>
            <Chain
              arrow={arrow}
              y={ROW_Y}
              from={0}
              to={WIDTH - 2}
              stages={ORDER.map((id, i) => ({ at: COL[id], live: live[i]! }))}
              input="B"
              output="to the bus"
            />

            <Boxes boxes={boxes} pick={pick} />

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
              ends={['top', 'bottom']}
              along={alongPicture}
              look={lost.length > 0 ? 'alarm' : reach > 0 ? 'on' : 'plain'}
            />

            <RasterPanel
              {...RASTER}
              title="one frame, B off lock"
              lanes={[
                {
                  name: 'cut',
                  span: [0, 0.42],
                  on: v('busCut') > 0,
                  layers: [
                    { bands: cutRows(v('busCut')), className: styles.cut! },
                  ],
                },
                {
                  name: 'lock',
                  span: [0.58, 1],
                  on: lost.length > 0,
                  layers: [{ bands: lost, className: styles.lost! }],
                },
              ]}
            />
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
