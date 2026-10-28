import { IRE_SYNC, IRE_WHITE } from '../core/signal/constants'
import { sliderFor, snapToStep } from './controls'
import { useControlsApi } from './ControlsContext'
import {
  boxWidth,
  ire,
  openBox,
  stageBoxes,
  useReadings,
  useSelectedBox,
} from './diagram'
import { Boxes, BoxRows, Chain, Diagram, Label } from './DiagramParts'
import { alongRange } from './plotAlong'
import { PlotHandle } from './PlotHandle'
import styles from './RfDiagram.module.css'
import { ifResponse, NEXT_CHANNEL_MHZ, snowByLevel, SOUND_MHZ } from './rfModel'
import { RF_KEYS, RF_OPENS as OPENS } from './schematicKeys'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const ROW_Y = 14
const H = 20
const COL = {
  adjacent: { x: 40, w: boxWidth('adjacent') },
  tuning: { x: 114, w: boxWidth('tuning') },
  snow: { x: 177, w: boxWidth('snow') },
  ingress: { x: 228, w: boxWidth('ingress') },
} satisfies Record<Part, { x: number; w: number }>
const ORDER = ['adjacent', 'tuning', 'snow', 'ingress'] as const

const PLOT = { top: 50, bottom: 98 }
const SNOW = { left: 24, right: 164, ...PLOT }
const IF = { left: 204, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const LEVELS = 29
const IF_MHZ = { lo: -2, hi: 9 }
const IF_POINTS = 111
const IF_TOP = 1.2

const ifX = (mhz: number) =>
  IF.left + ((IF.right - IF.left) * (mhz - IF_MHZ.lo)) / (IF_MHZ.hi - IF_MHZ.lo)
const ifMHz = (x: number) =>
  IF_MHZ.lo + ((IF_MHZ.hi - IF_MHZ.lo) * (x - IF.left)) / (IF.right - IF.left)
const ifY = (gain: number) =>
  PLOT.bottom - ((PLOT.bottom - PLOT.top) * Math.min(gain, IF_TOP)) / IF_TOP

function Marker({ at, name, on }: { at: number; name: string; on: boolean }) {
  return (
    <g>
      <line
        x1={ifX(at)}
        x2={ifX(at)}
        y1={PLOT.top}
        y2={PLOT.bottom}
        className={on ? styles.markerOn : styles.marker}
      />
      <Label x={ifX(at)} y={PLOT.bottom + 11} anchor="middle" on={on}>
        {name}
      </Label>
    </g>
  )
}

export function RfDiagram() {
  const r = useReadings(RF_KEYS)
  const pick = useSelectedBox()
  const { beginHand, writeControl } = useControlsApi()
  const v = r.value
  const snow = v('rfSnow')
  const mistune = v('rfMistuneMHz')
  const adjacent = v('rfAdjacent')
  const live = ORDER.map(id => r.touched(...OPENS[id]))
  const detector = snowByLevel(snow, LEVELS)
  const response = Array.from({ length: IF_POINTS }, (_, i) =>
    ifResponse(IF_MHZ.lo + ((IF_MHZ.hi - IF_MHZ.lo) * i) / (IF_POINTS - 1)),
  )
  const tuning = sliderFor('rfMistuneMHz')
  const setMistune = (mhz: number) =>
    writeControl('rfMistuneMHz', snapToStep(tuning, mhz))

  const box = stageBoxes(OPENS, H, r)
  const boxes = [
    box(
      'adjacent',
      COL.adjacent,
      ROW_Y,
      'adjacent',
      "The next channel up the cable getting through the IF trap. The detector turns its carriers into beats: its sound carrier lays a 1.5 MHz weave over everything, and its raster's blanking crosses as slanted dark bars.",
    ),
    box(
      'tuning',
      COL.tuning,
      ROW_Y,
      'tuning',
      "The fine-tuning knob pulled off channel. Positive moves the 4.5 MHz sound carrier out of its trap, so it beats against the video and colour comes back as rainbow crawl. Negative slides the picture carrier down the IF's Nyquist slope until the colour killer cuts colour.",
    ),
    box(
      'snow',
      COL.snow,
      ROW_Y,
      'snow',
      'IF noise into the envelope detector. The picture rides a negative-modulation carrier, with sync at peak power and white at 12.5%, so whites sink into the noise first and sync goes last.',
    ),
    box(
      'ingress',
      COL.ingress,
      ROW_Y,
      'ingress',
      'A two-way radio getting into the cable through a cracked shield. The carrier is unrelated to any NTSC frequency, so its beat draws a herringbone at no fixed angle, and the program audio stands in for the speech.',
    ),
  ]
  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="RF and tuner">
        {arrow => (
          <>
            <Chain
              arrow={arrow}
              y={ROW_Y}
              from={0}
              to={WIDTH - 2}
              stages={ORDER.map((id, i) => ({ at: COL[id], live: live[i]! }))}
              input="cable"
              output="to the set"
            />

            <Boxes boxes={boxes} pick={pick} />

            <TracePlot
              {...SNOW}
              title="detector out, IRE"
              values={detector.mean}
              spread={detector.rms}
              scale={{ lo: -100, hi: 160, ticks: [0, 100], reference: 0 }}
              format={ire}
              ends={[ire(IRE_SYNC), `${IRE_WHITE}`]}
              along={alongRange(IRE_SYNC, IRE_WHITE, 'IRE in')}
              look={snow > 0 ? 'on' : 'plain'}
            />

            <TracePlot
              {...IF}
              title="IF, MHz (sketch)"
              values={response}
              scale={{ lo: 0, hi: IF_TOP, ticks: [0, 1], reference: 1 }}
              format={String}
              ends={[`${IF_MHZ.lo}`, `${IF_MHZ.hi}`]}
              along={alongRange(IF_MHZ.lo, IF_MHZ.hi, 'MHz')}
              look={mistune !== 0 ? 'on' : 'plain'}
            />
            <Marker at={mistune} name="pic" on={mistune !== 0} />
            <Marker at={SOUND_MHZ + mistune} name="snd" on={mistune > 0} />
            {adjacent > 0 && (
              <>
                <line
                  x1={ifX(NEXT_CHANNEL_MHZ)}
                  x2={ifX(NEXT_CHANNEL_MHZ)}
                  y1={PLOT.bottom}
                  y2={PLOT.bottom - (PLOT.bottom - PLOT.top) * adjacent}
                  className={styles.leak}
                />
                <Label
                  x={ifX(NEXT_CHANNEL_MHZ)}
                  y={PLOT.bottom - (PLOT.bottom - PLOT.top) * adjacent - 3}
                  anchor="middle"
                  on
                >
                  adj
                </Label>
              </>
            )}
            <PlotHandle
              x={ifX(mistune)}
              y={ifY(ifResponse(mistune))}
              label="fine tuning"
              reading={`${mistune.toFixed(2)} MHz`}
              value={mistune}
              range={tuning}
              onGrab={beginHand}
              onMove={pointer => setMistune(ifMHz(pointer.x))}
              onNudge={dx => setMistune(mistune + dx * tuning.step * 5)}
            />
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
