import { HEAD_SWITCH_LINE, LINES } from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { alongPicture, alongRange } from './plotAlong'
import { TIMEBASE_KEYS, TIMEBASE_OPENS as OPENS } from './schematicKeys'
import { lineTiming, MID_LINE } from './tapeModel'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 14
const BOT_Y = 50
const H = 20
const COL = {
  capstan: { x: 26, w: 52 },
  shed: { x: 26, w: 78 },
  drum: { x: 156, w: 68 },
  tbc: { x: 252, w: 36 },
}
const DRUM_MID = COL.drum.x + COL.drum.w / 2

const PLOT = { top: 76, bottom: 116 }
const LEFT_PLOT = { left: 24, right: 164 }
const RIGHT_PLOT = { left: 200, right: 336 }
const HEIGHT = PLOT.bottom + 14
const FRAMES = 180
const SWITCH_BAND = [HEAD_SWITCH_LINE / LINES, 1] as const

// A deck's timebase as LineState writes it and timebase.wgsl resamples it. The
// capstan's wow and flutter and the sticky shed's stick-slip set how late each
// line is read off the tape, the drum adds the second head's own offset below
// the switch, and with no TBC every line leaves the deck at that timing. Under
// the drawing, each line's timing down the frame, and one line's over three
// seconds.
export function TimebaseDiagram() {
  const r = useReadings(TIMEBASE_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const timing = lineTiming(
    {
      tbJitterNs: v('tbJitterNs'),
      tbWowNs: v('tbWowNs'),
      tbStickNs: v('tbStickNs'),
      headSwitchShiftUs: v('headSwitchShiftUs'),
    },
    FRAMES,
  )

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
  const boxes: BoxSpec[] = [
    box(
      'capstan',
      COL.capstan,
      TOP_Y,
      'capstan',
      'The capstan pulls the tape past the drum, and its speed wanders. Wow is the slow wander of the capstan, pinch roller and reels, which leans whole regions of the picture sideways together. Flutter is a fast random walk from line to line, which makes edges shimmer.',
    ),
    box(
      'shed',
      COL.shed,
      BOT_Y,
      'sticky shed',
      'Hydrolysed binder makes the tape grab the drum. Tension builds until the patch breaks free and snaps forward, then it grabs again, so the timing ramps and snaps in bands of shear down the picture.',
    ),
    box(
      'drum',
      COL.drum,
      TOP_Y,
      'head drum',
      `The spinning drum carries two heads and hands over from one to the other at line ${HEAD_SWITCH_LINE}, near the bottom of the picture. The second head's timing is off by the switch shift, which tears the last lines into a hook, and switch noise fills the three lines at the handover.`,
    ),
    {
      x: COL.tbc.x,
      y: TOP_Y - H / 2,
      w: COL.tbc.w,
      h: H,
      name: 'TBC',
      off: true,
      touched: false,
      help: 'This deck has no time-base corrector, so every timing error above leaves it on the lines it hit. The burst moves with its line, so hue wobbles with the timing.',
    },
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]
  const speedLook: WireLook = r.touched(...OPENS.capstan) ? 'on' : 'plain'
  const shedLook: WireLook = r.touched(...OPENS.shed) ? 'on' : 'dash'
  const outLook: WireLook = r.touched(...TIMEBASE_KEYS) ? 'on' : 'plain'

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="tape timebase">
        {arrow => (
          <>
            <Label x={0} y={TOP_Y - 6}>
              tape
            </Label>
            <Wire arrow={arrow} d={`M0 ${TOP_Y} H${COL.capstan.x}`} />
            <Wire
              arrow={arrow}
              d={`M${COL.capstan.x + COL.capstan.w} ${TOP_Y} H${COL.drum.x}`}
              look={speedLook}
            />
            <Label
              x={(COL.capstan.x + COL.capstan.w + COL.drum.x) / 2}
              y={TOP_Y - 4}
              anchor="middle"
              on={speedLook === 'on'}
            >
              wow, flutter
            </Label>
            <Wire
              arrow={arrow}
              d={`M${COL.shed.x + COL.shed.w} ${BOT_Y} H${DRUM_MID} V${TOP_Y + H / 2}`}
              look={shedLook}
            />
            <Label
              x={COL.shed.x + COL.shed.w + 6}
              y={BOT_Y - 4}
              on={shedLook === 'on'}
            >
              stick-slip
            </Label>
            <Wire
              arrow={arrow}
              d={`M${COL.drum.x + COL.drum.w} ${TOP_Y} H${COL.tbc.x}`}
              look={outLook}
            />
            <Wire
              arrow={arrow}
              d={`M${COL.tbc.x + COL.tbc.w} ${TOP_Y} H${WIDTH - 2}`}
              look={outLook}
            />
            <Label x={WIDTH - 2} y={TOP_Y - 6} anchor="end">
              video
            </Label>

            {boxes.map(b => (
              <BoxView
                key={b.name}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <TracePlot
              {...LEFT_PLOT}
              {...PLOT}
              title="line timing, µs early"
              values={timing.field}
              scale={{ floor: 1 }}
              ends={['top', 'bottom']}
              along={alongPicture}
              band={SWITCH_BAND}
              look={outLook === 'on' ? 'on' : 'plain'}
            />
            <Label
              x={
                LEFT_PLOT.left +
                (LEFT_PLOT.right - LEFT_PLOT.left) * SWITCH_BAND[0] -
                3
              }
              y={PLOT.top + 9}
              anchor="end"
            >
              switch
            </Label>
            <TracePlot
              {...RIGHT_PLOT}
              {...PLOT}
              title={`line ${MID_LINE}, µs early`}
              values={timing.over}
              scale={{ floor: 1 }}
              ends={['0', `${FRAMES / 60} s`]}
              along={alongRange(0, FRAMES / 60, 's')}
              look={r.touched(...OPENS.capstan, ...OPENS.shed) ? 'on' : 'plain'}
            />
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
