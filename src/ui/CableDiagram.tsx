import { RasterPanel } from './BandLane'
import styles from './CableDiagram.module.css'
import { cableLine, contactBands, GUARD_ROWS, stripeBands } from './cableModel'
import {
  boxWidth,
  ire,
  openBox,
  stageBoxes,
  useReadings,
  useSelectedBox,
} from './diagram'
import { Boxes, BoxRows, Chain, Diagram } from './DiagramParts'
import { alongRange } from './plotAlong'
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
  guard: { x: 24, w: boxWidth('guard') },
  scramble: { x: 77, w: boxWidth('scramble') },
  chroma: { x: 147, w: boxWidth('chroma') },
  plug: { x: 206, w: boxWidth('plug') },
  flip: { x: 253, w: boxWidth('flip') },
  load: { x: 300, w: boxWidth('load') },
} satisfies Record<Part, { x: number; w: number }>

const PLOT = { top: 50, bottom: 98 }
const LINE = { left: 24, right: 164, ...PLOT }
const RASTER = { left: 208, right: 346, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const IRE_SCALE = { lo: -110, hi: 210, ticks: [0, 100], reference: 0 }

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

  const box = stageBoxes(OPENS, H, r)
  const boxes = [
    box(
      'guard',
      COL.guard,
      ROW_Y,
      'guard',
      "Macrovision's gain-control lie, stamped on vertical-interval lines 12-19 where the receiver's AGC averages sync depth, and a colorstripe that rotates the burst on walking bands of lines. Both are aimed at recorders and are invisible in normal framing.",
    ),
    box(
      'scramble',
      COL.scramble,
      ROW_Y,
      'scramble',
      'Head-end scrambling: the sync tip lifted toward blanking until the set has no line start to lock to. Alternate scrambles every other line, and SSAVI adds a negative picture.',
    ),
    box(
      'chroma',
      COL.chroma,
      ROW_Y,
      'chroma',
      'Only the chroma pin of an S-video lead reaches the composite input: burst-locked colour with no luma and no sync tips.',
    ),
    box(
      'plug',
      COL.plug,
      ROW_Y,
      'plug',
      'A loose RCA plug making and breaking contact in bands of lines, re-rolled every frame. The centre pin opens the path and snow fills the band; the shield loses the ground reference and the line rides a mains pedestal.',
    ),
    box(
      'flip',
      COL.flip,
      ROW_Y,
      'flip',
      'Signal and ground swapped. The whole waveform negates, sync tips and burst included, so the separator latches onto the wrong level and the colours invert.',
    ),
    box(
      'load',
      COL.load,
      ROW_Y,
      'load',
      'One 75 Ω terminator is correct. Negative double-terminates and halves the signal; positive leaves the line open, so it runs hot and each edge rings with a short echo.',
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="cable and wiring">
        {arrow => (
          <>
            <Chain
              arrow={arrow}
              y={ROW_Y}
              from={0}
              to={WIDTH - 2}
              stages={ORDER.map(id => ({
                at: COL[id],
                live: r.touched(...OPENS[id]),
              }))}
            />
            <Boxes boxes={boxes} pick={pick} />

            <TracePlot
              {...LINE}
              title="one line, IRE"
              values={cableLine(cable)}
              scale={IRE_SCALE}
              format={ire}
              ends={['0', `${LINE_US.toFixed(1)} µs`]}
              along={alongRange(0, LINE_US, 'µs')}
              band={PICTURE_BAND}
              look={lineOn ? 'on' : 'plain'}
            />

            <RasterPanel
              {...RASTER}
              title="one frame, example"
              lanes={[
                {
                  name: 'pin',
                  span: [0, 0.3],
                  on: plugOn,
                  layers: [{ bands: contacts.pin, className: styles.pin! }],
                },
                {
                  name: 'shield',
                  span: [0.35, 0.65],
                  on: plugOn,
                  layers: [
                    { bands: contacts.shield, className: styles.shield! },
                  ],
                },
                {
                  name: 'stripe',
                  span: [0.7, 1],
                  on: guardOn,
                  layers: [
                    { bands: stripes, className: styles.stripe! },
                    ...(guardOn
                      ? [{ bands: [GUARD_ROWS], className: styles.guard! }]
                      : []),
                  ],
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
