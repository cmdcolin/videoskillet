import { RasterPanel } from './BandLane'
import styles from './CableDiagram.module.css'
import { cableLine, contactBands, humColumn } from './cableModel'
import {
  boxWidth,
  ire,
  openBox,
  polyline,
  stageBoxes,
  useReadings,
  useSelectedBox,
} from './diagram'
import { Boxes, BoxRows, Chain, Diagram } from './DiagramParts'
import { alongRange } from './plotAlong'
import { FEED_CABLE_KEYS, FEED_CABLE_OPENS } from './schematicKeys'
import { LINE_US, PICTURE_BAND } from './testLine'
import { TracePlot } from './TracePlot'

type Feed = 'a' | 'b'
type Part = keyof (typeof FEED_CABLE_OPENS)['a']

const WIDTH = 340
const ROW_Y = 14
const H = 20
const ORDER = [
  'snow',
  'hum',
  'plug',
  'flip',
  'load',
] as const satisfies readonly Part[]
const COL = {
  snow: { x: 30, w: boxWidth('snow') },
  hum: { x: 81, w: boxWidth('hum') },
  plug: { x: 126, w: boxWidth('plug') },
  flip: { x: 177, w: boxWidth('flip') },
  load: { x: 228, w: boxWidth('load') },
} satisfies Record<Part, { x: number; w: number }>

const PLOT = { top: 50, bottom: 98 }
const LINE = { left: 24, right: 164, ...PLOT }
const RASTER = { left: 200, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const LANES = {
  pin: [0, 0.28],
  shield: [0.33, 0.61],
  hum: [0.68, 1],
} as const
const HUM_RANGE_IRE = 40
const IRE_SCALE = { lo: -110, hi: 210, ticks: [0, 100], reference: 0 }

const laneX = (lane: keyof typeof LANES, at: 0 | 1) =>
  RASTER.left + (RASTER.right - RASTER.left) * LANES[lane][at]

function FeedCableDiagram({ feed }: { feed: Feed }) {
  const OPENS = FEED_CABLE_OPENS[feed]
  const r = useReadings(FEED_CABLE_KEYS[feed])
  const pick = useSelectedBox()
  const hum = r.value(OPENS.hum[0])
  const amount = r.value(OPENS.plug[0])
  const mode = r.value(OPENS.plug[1])
  const flip = r.value(OPENS.flip[0])
  const load = r.value(OPENS.load[0])
  const live = ORDER.map(id => r.touched(...OPENS[id]))
  const contacts = contactBands(amount, mode)
  const humPoints = humColumn(hum)
  const humCentre = (laneX('hum', 0) + laneX('hum', 1)) / 2
  const humSwing = (laneX('hum', 1) - laneX('hum', 0)) / 2
  const humPath = polyline(
    humPoints.map((value, i) => [
      humCentre + (value / HUM_RANGE_IRE) * humSwing,
      RASTER.top + ((RASTER.bottom - RASTER.top) * i) / (humPoints.length - 1),
    ]),
  )

  const box = stageBoxes(OPENS, H, r)
  const who = feed.toUpperCase()
  const boxes = [
    box(
      'snow',
      COL.snow,
      ROW_Y,
      'snow',
      `Snow on ${who}'s feed alone, from a long antenna run or a bad patch cable ahead of the mixer. It is flat across the video band.`,
    ),
    box(
      'hum',
      COL.hum,
      ROW_Y,
      'hum',
      `A ground loop on ${who}'s cable alone, this deck's outlet against the mixer's. It lifts ${who}'s sync tips with the picture, and the sign picks which leg of the mains it rides.`,
    ),
    box(
      'plug',
      COL.plug,
      ROW_Y,
      'plug',
      `The plug at the mixer's ${who} jack making and breaking contact in bands of lines, re-rolled every frame. The centre pin opens the path; the shield loses its ground reference.`,
    ),
    box(
      'flip',
      COL.flip,
      ROW_Y,
      'flip',
      `Signal and ground swapped on ${who}'s connector, negating its waveform and its sync before the mixer.`,
    ),
    box(
      'load',
      COL.load,
      ROW_Y,
      'load',
      `Termination on ${who}'s cable alone: negative is double-terminated and arrives dim, positive is open and runs hot with ringing.`,
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label={`feed ${who} cable`}>
        {arrow => (
          <>
            <Chain
              arrow={arrow}
              y={ROW_Y}
              from={0}
              to={WIDTH - 2}
              stages={ORDER.map((id, i) => ({ at: COL[id], live: live[i]! }))}
              input="deck"
              output="to the mixer"
            />

            <Boxes boxes={boxes} pick={pick} />

            <TracePlot
              {...LINE}
              title="one line, IRE"
              values={cableLine({
                polarityFlip: flip,
                termination: load,
                chromaPinOnly: 0,
                scramble: 0,
                scrambleMode: 0,
              })}
              scale={IRE_SCALE}
              format={ire}
              ends={['0', `${LINE_US.toFixed(1)} µs`]}
              along={alongRange(0, LINE_US, 'µs')}
              band={PICTURE_BAND}
              look={flip !== 0 || load !== 0 ? 'on' : 'plain'}
            />

            <RasterPanel
              {...RASTER}
              title="one frame, example"
              lanes={[
                {
                  name: 'pin',
                  span: LANES.pin,
                  on: amount > 0,
                  layers: [{ bands: contacts.pin, className: styles.pin! }],
                },
                {
                  name: 'shield',
                  span: LANES.shield,
                  on: amount > 0,
                  layers: [
                    { bands: contacts.shield, className: styles.shield! },
                  ],
                },
                { name: 'hum', span: LANES.hum, on: hum !== 0, layers: [] },
              ]}
            >
              {hum !== 0 && <path d={humPath} className={styles.trace} />}
            </RasterPanel>
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}

export const FeedACableDiagram = () => <FeedCableDiagram feed="a" />
export const FeedBCableDiagram = () => <FeedCableDiagram feed="b" />
