import { BandLane } from './BandLane'
import styles from './CableDiagram.module.css'
import { cableLine, contactBands, humColumn } from './cableModel'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
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
  snow: { x: 30, w: 37 },
  hum: { x: 81, w: 31 },
  plug: { x: 126, w: 37 },
  flip: { x: 177, w: 37 },
  load: { x: 228, w: 37 },
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

const ire = (v: number) => (v < 0 ? `−${-v}` : String(v))
const after = (id: Part) => COL[id].x + COL[id].w
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')
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
  const humPath = humPoints
    .map((value, i) => {
      const x = humCentre + (value / HUM_RANGE_IRE) * humSwing
      const y =
        RASTER.top + ((RASTER.bottom - RASTER.top) * i) / (humPoints.length - 1)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

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
  const who = feed.toUpperCase()
  const boxes = [
    box(
      'snow',
      'snow',
      `Snow on ${who}'s feed alone, from a long antenna run or a bad patch cable ahead of the mixer. It is flat across the video band.`,
    ),
    box(
      'hum',
      'hum',
      `A ground loop on ${who}'s cable alone, this deck's outlet against the mixer's. It lifts ${who}'s sync tips with the picture, and the sign picks which leg of the mains it rides.`,
    ),
    box(
      'plug',
      'plug',
      `The plug at the mixer's ${who} jack making and breaking contact in bands of lines, re-rolled every frame. The centre pin opens the path; the shield loses its ground reference.`,
    ),
    box(
      'flip',
      'flip',
      `Signal and ground swapped on ${who}'s connector, negating its waveform and its sync before the mixer.`,
    ),
    box(
      'load',
      'load',
      `Termination on ${who}'s cable alone: negative is double-terminated and arrives dim, positive is open and runs hot with ringing.`,
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label={`feed ${who} cable`}>
        {arrow => (
          <>
            <Label x={0} y={ROW_Y - 6}>
              deck
            </Label>
            <Wire arrow={arrow} d={`M0 ${ROW_Y} H${COL.snow.x}`} />
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
              d={`M${after('load')} ${ROW_Y} H${WIDTH - 2}`}
              look={look(live.some(Boolean))}
            />
            <Label x={WIDTH - 2} y={ROW_Y - 6} anchor="end">
              to the mixer
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
              band={PICTURE_BAND}
              look={flip !== 0 || load !== 0 ? 'on' : 'plain'}
            />

            <Label x={RASTER.left} y={PLOT.top - 6}>
              one frame, example
            </Label>
            <rect
              x={RASTER.left}
              y={RASTER.top}
              width={RASTER.right - RASTER.left}
              height={RASTER.bottom - RASTER.top}
              className={styles.frame}
            />
            <BandLane
              x0={laneX('pin', 0)}
              x1={laneX('pin', 1)}
              top={RASTER.top}
              bottom={RASTER.bottom}
              bands={contacts.pin}
              className={styles.pin!}
            />
            <BandLane
              x0={laneX('shield', 0)}
              x1={laneX('shield', 1)}
              top={RASTER.top}
              bottom={RASTER.bottom}
              bands={contacts.shield}
              className={styles.shield!}
            />
            {hum !== 0 && <path d={humPath} className={styles.trace} />}
            {(['pin', 'shield', 'hum'] as const).map(lane => (
              <Label
                key={lane}
                x={(laneX(lane, 0) + laneX(lane, 1)) / 2}
                y={PLOT.bottom + 11}
                anchor="middle"
                on={lane === 'hum' ? hum !== 0 : amount > 0}
              >
                {lane}
              </Label>
            ))}
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}

export const FeedACableDiagram = () => <FeedCableDiagram feed="a" />
export const FeedBCableDiagram = () => <FeedCableDiagram feed="b" />
