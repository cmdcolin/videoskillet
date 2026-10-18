import { LINES } from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { frameShifts, hLocks, lineShifts, vLocks, type Hold } from './scanModel'
import { SYNC_KEYS, SYNC_OPENS as OPENS } from './schematicKeys'
import { TracePlot, type TraceScale } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 50
const H = 20
const COL = {
  separator: { x: 40, w: 66 },
  flywheel: { x: 130, w: 60 },
  osc: { x: 212, w: 48 },
}
const SEP_MID = COL.separator.x + COL.separator.w / 2
const WHEEL_MID = COL.flywheel.x + COL.flywheel.w / 2
const OSC_END = COL.osc.x + COL.osc.w
const TAP_X = 290
const BACK_Y = 34

const PLOT = { top: 84, bottom: 128 }
const LEFT_PLOT = { left: 24, right: 164 }
const RIGHT_PLOT = { left: 200, right: 336 }
const HEIGHT = PLOT.bottom + 14
const FRAMES = 60
const HALF_FRAME = LINES / 2
const ROLLING: TraceScale = {
  lo: -HALF_FRAME,
  hi: HALF_FRAME,
  ticks: [-250, 0, 250],
  reference: 0,
}

// The receiver's sync as sync_measure.wgsl and sync.wgsl run it. The separator
// slices line edges and the broad vertical pulses out of the video. The edges
// steer the horizontal flywheel, which pulls the line oscillator toward them by
// as much as the hold allows each line, and the broad pulses trigger the
// vertical oscillator early. Under the drawing, where a clean signal's lines
// land down the picture, and where its frame lands over a second.
export function SyncDiagram() {
  const r = useReadings(SYNC_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const hold: Hold = {
    hHold: v('hHold'),
    hDetuneHz: v('hDetuneHz'),
    syncBendUs: v('syncBendUs'),
    vHold: v('vHold'),
    vFreqHz: v('vFreqHz'),
  }
  const hLock = hLocks(hold)
  const vLock = vLocks(hold)
  const lines = lineShifts(hold)
  const frames = frameShifts(hold, FRAMES)
  const hLook: WireLook = hLock ? 'plain' : 'alarm'
  const vLook: WireLook = vLock ? 'plain' : 'alarm'

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
      'separator',
      COL.separator,
      TOP_Y,
      'separator',
      'Slices the video for the falling edge that starts each line and for the broad pulses of the vertical interval, at a fixed level or halfway to the deepest level it has seen.',
    ),
    box(
      'flywheel',
      COL.flywheel,
      TOP_Y,
      'flywheel',
      "Compares each edge with the line oscillator and pulls the oscillator toward it by the hold, up to 40 samples a line. The vertical interval's equalizing pulses kick it, and it takes the first lines of the picture to settle.",
    ),
    box(
      'hosc',
      COL.osc,
      TOP_Y,
      'H osc',
      'The line oscillator, free-running at its own rate. Inside the pull-in range the flywheel holds a detune as a steady shift; past it the phase gains every line and the raster shears.',
    ),
    box(
      'vosc',
      COL.osc,
      BOT_Y,
      'V osc',
      'The field oscillator, free-running at its own rate. The broad pulses trigger it early by as much as the hold allows each frame; past that the frame rolls.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="receiver sync">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              video
            </Label>
            <Wire arrow={arrow} d={`M0 ${TOP_Y} H${COL.separator.x}`} />
            <Wire
              arrow={arrow}
              d={`M${COL.separator.x + COL.separator.w} ${TOP_Y} H${COL.flywheel.x}`}
            />
            <Wire
              arrow={arrow}
              d={`M${COL.flywheel.x + COL.flywheel.w} ${TOP_Y} H${COL.osc.x}`}
              look={hLook}
            />
            <Wire
              arrow={arrow}
              d={`M${OSC_END} ${TOP_Y} H${WIDTH - 2}`}
              look={hLook}
            />
            <Label x={WIDTH - 2} y={TOP_Y - 6} anchor="end">
              H drive
            </Label>
            <Wire
              arrow={arrow}
              d={`M${TAP_X} ${TOP_Y} V${BACK_Y} H${WHEEL_MID} V${TOP_Y + H / 2}`}
              look={hLook}
            />

            <Wire
              arrow={arrow}
              d={`M${SEP_MID} ${TOP_Y + H / 2} V${BOT_Y} H${COL.osc.x}`}
            />
            <Label x={SEP_MID + 8} y={BOT_Y - 5}>
              vsync
            </Label>
            <Wire
              arrow={arrow}
              d={`M${OSC_END} ${BOT_Y} H${WIDTH - 2}`}
              look={vLook}
            />
            <Label x={WIDTH - 2} y={BOT_Y - 6} anchor="end">
              V drive
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
              title="line shift, µs right"
              values={lines}
              scale={{ floor: 1 }}
              ends={['top', 'bottom']}
              breakOver={20}
              look={
                !hLock
                  ? 'alarm'
                  : r.touched('hHold', 'hDetuneHz', 'syncBendUs')
                    ? 'on'
                    : 'plain'
              }
            />
            <TracePlot
              {...RIGHT_PLOT}
              {...PLOT}
              title="frame shift, lines up"
              values={frames}
              scale={vLock ? { floor: 1 } : ROLLING}
              ends={['0', '1 s']}
              breakOver={HALF_FRAME}
              look={
                !vLock
                  ? 'alarm'
                  : r.touched('vHold', 'vFreqHz')
                    ? 'on'
                    : 'plain'
              }
            />
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
