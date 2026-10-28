import {
  ire,
  openBox,
  stageBoxes,
  useReadings,
  useSelectedBox,
} from './diagram'
import styles from './Diagram.module.css'
import { Boxes, BoxRows, Chain, Diagram, Label, Wire } from './DiagramParts'
import {
  dropoutLine,
  HOLE_FROM_US,
  lumaAfterCopies,
  patchHueDegrees,
} from './dubModel'
import { alongRange } from './plotAlong'
import { DUB_KEYS, DUB_OPENS as OPENS } from './schematicKeys'
import { LINE_US } from './testLine'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const READ = [...DUB_KEYS, 'lumaMHz', 'lumaPeak'] as const

const WIDTH = 340
const ROW_Y = 14
const LOOP_Y = 34
const H = 20
const COL = {
  drops: { x: 30, w: 60 },
  patch: { x: 104, w: 43 },
  dub: { x: 161, w: 32 },
} satisfies Record<Part, { x: number; w: number }>
const TAP_X = 210
const DROPS_MID = COL.drops.x + COL.drops.w / 2

const PLOT = { top: 66, bottom: 108 }
const LINE = { left: 24, right: 164, ...PLOT }
const BAND = { left: 204, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const BAND_MHZ = 6
const BAND_POINTS = 49
const IRE_SCALE = { lo: -60, hi: 140, ticks: [0, 100], reference: 0 }

const passes = (n: number) => `${n} ${n === 1 ? 'pass' : 'passes'}`

export function DubDiagram() {
  const r = useReadings(READ)
  const pick = useSelectedBox()
  const v = r.value
  const compensator = v('dropoutComp')
  const gens = v('dubGens')
  const rate = v('dropoutRate')
  const lenUs = v('dropoutLenUs')
  const live = (id: Part) => r.touched(...OPENS[id])
  const hue = patchHueDegrees(compensator)
  const hole: [number, number] = [
    HOLE_FROM_US / LINE_US,
    (HOLE_FROM_US + lenUs) / LINE_US,
  ]

  const box = stageBoxes(OPENS, H, r)
  const boxes = [
    box(
      'drops',
      COL.drops,
      ROW_Y,
      'dropouts',
      'Shed oxide or a clogged head leaves the head reading nothing for a moment: no carrier at all, so the gap reads as a white streak of hash. A line is 63.5 µs, so 25 µs is a streak across a third of the picture.',
    ),
    box(
      'patch',
      COL.patch,
      ROW_Y,
      'patch',
      'The compensator patches a dropout from a delay line holding what played a line or two ago. One line back arrives half a subcarrier cycle out, so it is invisible in brightness and complementary in hue. Two lines back is a whole number of cycles, so the hue is right and the patch is two lines stale.',
    ),
    box(
      'dub',
      COL.dub,
      ROW_Y,
      'dub',
      'Runs the whole tape and channel stage this many times over: a copy of a copy. Each generation adds its own noise, dropouts and timebase wander on top of the last, and narrows the bandwidth again.',
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="dropouts and dubs">
        {arrow => (
          <>
            <Chain
              arrow={arrow}
              y={ROW_Y}
              from={0}
              to={WIDTH - 2}
              stages={(['drops', 'patch', 'dub'] as const).map(id => ({
                at: COL[id],
                live: live(id),
              }))}
              input="tape"
              output="to the set"
            />
            <circle cx={TAP_X} cy={ROW_Y} r={2} className={styles.dot} />
            <Wire
              arrow={arrow}
              d={`M${TAP_X} ${ROW_Y} V${LOOP_Y} H${DROPS_MID} V${ROW_Y + H / 2}`}
              look={gens > 1 ? 'on' : 'dash'}
            />
            <Label
              x={(TAP_X + DROPS_MID) / 2}
              y={LOOP_Y + 11}
              anchor="middle"
              on={gens > 1}
            >
              {`${passes(gens)}, ${Math.round(rate * gens)} dropouts/frame`}
            </Label>

            <Boxes boxes={boxes} pick={pick} />

            <TracePlot
              {...LINE}
              title={
                compensator === 0
                  ? 'dropout, no patch'
                  : `dropout, patch hue ${hue}°`
              }
              values={dropoutLine(lenUs, compensator)}
              scale={IRE_SCALE}
              format={ire}
              ends={['0', `${LINE_US.toFixed(1)} µs`]}
              along={alongRange(0, LINE_US, 'µs')}
              band={hole}
              look={
                rate > 0 && compensator === 0
                  ? 'alarm'
                  : live('drops') || live('patch')
                    ? 'on'
                    : 'plain'
              }
            />

            <TracePlot
              {...BAND}
              title={`luma dB, ${passes(gens)}`}
              values={lumaAfterCopies(
                v('lumaMHz'),
                v('lumaPeak'),
                gens,
                BAND_POINTS,
                BAND_MHZ,
              )}
              scale={{ lo: -36, hi: 6, ticks: [0, -12, -24], reference: 0 }}
              format={ire}
              ends={['0', `${BAND_MHZ} MHz`]}
              along={alongRange(0, BAND_MHZ, 'MHz')}
              look={gens > 1 ? 'on' : 'plain'}
            />
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
