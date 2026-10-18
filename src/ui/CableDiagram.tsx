import { BandLane } from './BandLane'
import styles from './CableDiagram.module.css'
import {
  cableLine,
  contactBands,
  GUARD_ROWS,
  stripeBands,
  type Band,
} from './cableModel'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { CABLE_KEYS, CABLE_OPENS as OPENS } from './schematicKeys'
import { LINE_US, PICTURE_BAND } from './testLine'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 350
const ROW_Y = 14
const H = 20
const ORDER = [
  'guard',
  'scramble',
  'chroma',
  'plug',
  'flip',
  'load',
] as const satisfies readonly Part[]
const COL = {
  guard: { x: 24, w: 43 },
  scramble: { x: 77, w: 60 },
  chroma: { x: 147, w: 49 },
  plug: { x: 206, w: 37 },
  flip: { x: 253, w: 37 },
  load: { x: 300, w: 37 },
} satisfies Record<Part, { x: number; w: number }>

const PLOT = { top: 50, bottom: 98 }
const LINE = { left: 24, right: 164, ...PLOT }
const RASTER = { left: 208, right: 346, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const LANES = {
  pin: [0, 0.3],
  shield: [0.35, 0.65],
  stripe: [0.7, 1],
} as const
const IRE_SCALE = { lo: -110, hi: 210, ticks: [0, 100], reference: 0 }

const ire = (v: number) => (v < 0 ? `−${-v}` : String(v))
const after = (id: Part) => COL[id].x + COL[id].w
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')
const laneX = (lane: keyof typeof LANES, at: 0 | 1) =>
  RASTER.left + (RASTER.right - RASTER.left) * LANES[lane][at]

function Lane({
  lane,
  bands,
  className,
}: {
  lane: keyof typeof LANES
  bands: readonly Band[]
  className: string
}) {
  return (
    <BandLane
      x0={laneX(lane, 0)}
      x1={laneX(lane, 1)}
      top={RASTER.top}
      bottom={RASTER.bottom}
      bands={bands}
      className={className}
    />
  )
}

export function CableDiagram() {
  const r = useReadings(CABLE_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const cable = {
    polarityFlip: v('polarityFlip'),
    termination: v('termination'),
    chromaPinOnly: v('chromaPinOnly'),
    scramble: v('scramble'),
    scrambleMode: v('scrambleMode'),
  }
  const lineOn = r.touched(
    'polarityFlip',
    'termination',
    'chromaPinOnly',
    'scramble',
  )
  const plugOn = v('connectorGlitch') > 0
  const guardOn = v('macrovision') > 0
  const contacts = contactBands(v('connectorGlitch'), v('connectorMode'))
  const stripes = stripeBands(v('mvStripeDeg'))
  const live = ORDER.map(id => r.touched(...OPENS[id]))

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
      'guard',
      'guard',
      "Macrovision's gain-control lie, stamped on vertical-interval lines 12-19 where the receiver's AGC averages sync depth, and a colorstripe that rotates the burst on walking bands of lines. Both are aimed at recorders and are invisible in normal framing.",
    ),
    box(
      'scramble',
      'scramble',
      'Head-end scrambling: the sync tip lifted toward blanking until the set has no line start to lock to. Alternate scrambles every other line, and SSAVI adds a negative picture.',
    ),
    box(
      'chroma',
      'chroma',
      'Only the chroma pin of an S-video lead reaches the composite input: burst-locked colour with no luma and no sync tips.',
    ),
    box(
      'plug',
      'plug',
      'A loose RCA plug making and breaking contact in bands of lines, re-rolled every frame. The centre pin opens the path and snow fills the band; the shield loses the ground reference and the line rides a mains pedestal.',
    ),
    box(
      'flip',
      'flip',
      'Signal and ground swapped. The whole waveform negates, sync tips and burst included, so the separator latches onto the wrong level and the colours invert.',
    ),
    box(
      'load',
      'load',
      'One 75 Ω terminator is correct. Negative double-terminates and halves the signal; positive leaves the line open, so it runs hot and each edge rings with a short echo.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="cable and wiring">
        {arrow => (
          <>
            <Label x={0} y={ROW_Y - 6}>
              video
            </Label>
            <Wire arrow={arrow} d={`M0 ${ROW_Y} H${COL.guard.x}`} />
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
              values={cableLine(cable)}
              scale={IRE_SCALE}
              format={ire}
              ends={['0', `${LINE_US.toFixed(1)} µs`]}
              band={PICTURE_BAND}
              look={lineOn ? 'on' : 'plain'}
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
            <Lane lane="pin" bands={contacts.pin} className={styles.pin!} />
            <Lane
              lane="shield"
              bands={contacts.shield}
              className={styles.shield!}
            />
            <Lane lane="stripe" bands={stripes} className={styles.stripe!} />
            {guardOn && (
              <Lane
                lane="stripe"
                bands={[GUARD_ROWS]}
                className={styles.guard!}
              />
            )}
            {(['pin', 'shield', 'stripe'] as const).map(lane => (
              <Label
                key={lane}
                x={(laneX(lane, 0) + laneX(lane, 1)) / 2}
                y={PLOT.bottom + 11}
                anchor="middle"
                on={lane === 'pin' || lane === 'shield' ? plugOn : guardOn}
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
