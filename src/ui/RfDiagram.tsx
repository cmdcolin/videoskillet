import { IRE_SYNC, IRE_WHITE } from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { alongRange } from './plotAlong'
import styles from './RfDiagram.module.css'
import { ifResponse, NEXT_CHANNEL_MHZ, snowByLevel, SOUND_MHZ } from './rfModel'
import { RF_KEYS, RF_OPENS as OPENS } from './schematicKeys'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const ROW_Y = 14
const H = 20
const COL = {
  adjacent: { x: 40, w: 60 },
  tuning: { x: 114, w: 49 },
  snow: { x: 177, w: 37 },
  ingress: { x: 228, w: 55 },
} satisfies Record<Part, { x: number; w: number }>
const ORDER = ['adjacent', 'tuning', 'snow', 'ingress'] as const

const PLOT = { top: 50, bottom: 98 }
const SNOW = { left: 24, right: 164, ...PLOT }
const IF = { left: 204, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const LEVELS = 29
const IF_MHZ = { lo: -2, hi: 9 }
const IF_POINTS = 111

const ire = (v: number) => (v < 0 ? `−${-v}` : String(v))
const after = (id: Part) => COL[id].x + COL[id].w
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')
const ifX = (mhz: number) =>
  IF.left + ((IF.right - IF.left) * (mhz - IF_MHZ.lo)) / (IF_MHZ.hi - IF_MHZ.lo)

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
  const v = r.value
  const snow = v('rfSnow')
  const mistune = v('rfMistuneMHz')
  const adjacent = v('rfAdjacent')
  const live = ORDER.map(id => r.touched(...OPENS[id]))
  const detector = snowByLevel(snow, LEVELS)
  const response = Array.from({ length: IF_POINTS }, (_, i) =>
    ifResponse(IF_MHZ.lo + ((IF_MHZ.hi - IF_MHZ.lo) * i) / (IF_POINTS - 1)),
  )

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
      'adjacent',
      'adjacent',
      "The next channel up the cable getting through the IF trap. The detector turns its carriers into beats: its sound carrier lays a 1.5 MHz weave over everything, and its raster's blanking crosses as slanted dark bars.",
    ),
    box(
      'tuning',
      'tuning',
      "The fine-tuning knob pulled off channel. Positive moves the 4.5 MHz sound carrier out of its trap, so it beats against the video and colour comes back as rainbow crawl. Negative slides the picture carrier down the IF's Nyquist slope until the colour killer cuts colour.",
    ),
    box(
      'snow',
      'snow',
      'IF noise into the envelope detector. The picture rides a negative-modulation carrier, with sync at peak power and white at 12.5%, so whites sink into the noise first and sync goes last.',
    ),
    box(
      'ingress',
      'ingress',
      'A two-way radio getting into the cable through a cracked shield. The carrier is unrelated to any NTSC frequency, so its beat draws a herringbone at no fixed angle, and the program audio stands in for the speech.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]
  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="RF and tuner">
        {arrow => (
          <>
            <Label x={0} y={ROW_Y - 6}>
              cable
            </Label>
            <Wire arrow={arrow} d={`M0 ${ROW_Y} H${COL.adjacent.x}`} />
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
              d={`M${after('ingress')} ${ROW_Y} H${WIDTH - 2}`}
              look={look(live.some(Boolean))}
            />
            <Label x={WIDTH - 2} y={ROW_Y - 6} anchor="end">
              to the set
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
              scale={{ lo: 0, hi: 1.2, ticks: [0, 1], reference: 1 }}
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
