import { useId } from 'react'

import {
  ACTIVE_HEIGHT,
  ACTIVE_TOP,
  ACTIVE_WIDTH,
  LINES,
  SAMPLE_RATE,
} from '../core/signal/constants'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { alongRange } from './plotAlong'
import { VHS_KEYS, VHS_OPENS as OPENS } from './schematicKeys'
import {
  lost,
  rings,
  servoKick,
  SHUTTLE_STILL,
  shuttleNull,
  trackingTear,
  trackNull,
} from './tapeModel'
import { TracePlot } from './TracePlot'
import own from './VhsDiagram.module.css'

type Part = keyof typeof OPENS

interface Span {
  x: number
  w: number
}
const right = (s: Span) => s.x + s.w
const centre = (s: Span) => s.x + s.w / 2

const WIDTH = 340
const DIRECT_Y = 12
const TOP_Y = 34
const BOT_Y = 64
const H = 20
const TAP_X = 12
const ROW = {
  down: { x: 22, w: 40 },
  tape: { x: 92, w: 40 },
  up: { x: 156, w: 32 },
  mix: { x: 224, w: 34 },
  delay: { x: 272, w: 44 },
  tracking: { x: 0, w: 62 },
  servo: { x: 84, w: 46 },
  capstan: { x: 152, w: 56 },
  heads: { x: 252, w: 46 },
} satisfies Record<Part | 'down', Span>

const FOOT = { left: 0, right: 118, top: 90, bottom: 130 }
const PICTURE = { left: 128, right: 170 }
const SLANT = 22
const PATH_STEP = 3
const SCAN_STEP = 24
const SNOW_STEP = 3
const PLOT = { left: 204, right: 336, top: 90, bottom: 130 }
const HEIGHT = PLOT.bottom + 14
const FRAMES = 180

const rowY = (row: number) =>
  FOOT.top + ((FOOT.bottom - FOOT.top) * row) / LINES
const US_WIDE =
  (PICTURE.right - PICTURE.left) / ((ACTIVE_WIDTH / SAMPLE_RATE) * 1e6)

// A deck's colour-under path and its head on the tape, as under_down.wgsl,
// channel.wgsl and LineState run them. Along the top, chroma goes down to
// 629 kHz, onto the tape and back up, and crossfades with the direct chroma.
// Along the bottom, the servo steers the capstan to keep the head on its track.
// Under the drawing, the head's path across the helical tracks beside the
// picture it plays, and where the servo puts the band after a kick.
export function VhsDiagram() {
  const r = useReadings(VHS_KEYS)
  const pick = useSelectedBox()
  const clip = useId()
  const v = r.value

  const underOn = v('colorUnderMix') > 0
  const amt = v('trackAmt')
  const pos = v('trackPos')
  const bars = v('shuttleX') - 1
  const clog = v('headClog')
  const hunt = v('trackHunt')

  const box = (
    id: Part,
    y: number,
    name: string,
    help: string,
    extra: Partial<BoxSpec> = {},
  ): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: ROW[id].x,
    y: y - H / 2,
    w: ROW[id].w,
    h: H,
    name,
    touched: r.touched(...OPENS[id]),
    help,
    ...extra,
  })
  const boxes: BoxSpec[] = [
    {
      x: ROW.down.x,
      y: TOP_Y - H / 2,
      w: ROW.down.w,
      h: H,
      name: 'down',
      off: !underOn,
      touched: false,
      help: 'On record, the deck heterodynes chroma from 3.58 MHz down to a 629 kHz carrier and lowpasses it at 1.2 MHz, which leaves colour a fraction of the bandwidth luma gets.',
    },
    box(
      'tape',
      TOP_Y,
      'tape',
      'The colour-under carrier as the head plays it back. It records under the luma FM with far less headroom, and its noise comes back through the narrow chroma bandpass as slow blotches of wrong hue.',
      { off: !underOn },
    ),
    box(
      'up',
      TOP_Y,
      'up',
      'Playback heterodynes the carrier back up to 3.58 MHz and bandpasses it 0.6 MHz either side. The head never lands exactly where it wrote, so the phase of the conversion walks from line to line and hue wanders with it.',
      { off: !underOn },
    ),
    box(
      'mix',
      TOP_Y,
      'mix',
      'Crossfades the direct chroma with the chroma that went through colour-under. At 0 only the direct chroma reaches the output.',
    ),
    box(
      'delay',
      TOP_Y,
      'delay',
      'The group delay of the chroma path against the luma path, in whole samples. The burst takes the same delay, so colour slides off its edges and hue holds.',
    ),
    box(
      'tracking',
      BOT_Y,
      'tracking',
      'How far the head strays from its track, and where down the sweep the servo is aiming. Off its track the head reads part of the neighbour, recorded at the other azimuth, so the RF fades and a band of lines turns to snow and tears sideways.',
    ),
    box(
      'servo',
      BOT_Y,
      'servo',
      'The auto-tracking servo reads the RF envelope and steers the capstan phase toward its peak, through a dead band and with less damping the higher hunt goes. A cut, a change of shuttle speed or a thump knocks it off the peak, and a loose servo overshoots and rings.',
    ),
    box(
      'capstan',
      BOT_Y,
      'capstan',
      'Tape speed as a multiple of play. Off play speed each sweep of the head crosses tracks of the other azimuth, and the RF nulls into a noise bar at each one.',
    ),
    box(
      'heads',
      BOT_Y,
      'heads',
      'Two heads take alternate sweeps, head A over the A tracks and head B over the B tracks. A clogged head reads snow for its whole sweep, so picture and snow alternate at field rate.',
    ),
  ]
  const open = boxes.find(b => b.id === pick.selected)

  const severity = (row: number) =>
    lost(trackNull(row, amt, pos), shuttleNull(row, bars, SHUTTLE_STILL))

  // The head's place across the tracks, in track pitches from the edge of its
  // own: half-way across at play, one more for each half of a crossing, and up
  // to one over onto the neighbour where the tracking band fades the RF out.
  const across = (row: number) =>
    0.5 + 2 * (row / LINES) * bars + Math.min(trackNull(row, amt, pos), 1)
  const rows = Array.from(
    { length: Math.floor(LINES / PATH_STEP) + 1 },
    (_, i) => Math.min(i * PATH_STEP, LINES),
  )
  const widths = rows.map(across)
  const lo = Math.min(...widths)
  const hi = Math.max(...widths)
  const room = FOOT.right - FOOT.left - SLANT - 8
  const pitch = Math.min(9, Math.max(1.5, room / Math.max(hi - lo + 1, 1)))
  const x0 = (FOOT.left + FOOT.right - SLANT - pitch * (lo + hi)) / 2
  const footX = (row: number, w: number) =>
    x0 + w * pitch + (SLANT * row) / LINES
  const firstTrack = Math.floor((FOOT.left - x0 - SLANT) / pitch) - 1
  const lastTrack = Math.ceil((FOOT.right - x0) / pitch) + 1
  const tracks = Array.from(
    { length: lastTrack - firstTrack + 1 },
    (_, i) => firstTrack + i,
  )
  const trackShape = (k: number) =>
    `M${footX(0, k).toFixed(1)} ${FOOT.top} L${footX(0, k + 1).toFixed(1)} ${FOOT.top} L${footX(LINES, k + 1).toFixed(1)} ${FOOT.bottom} L${footX(LINES, k).toFixed(1)} ${FOOT.bottom} Z`
  const pathLook = (row: number) =>
    severity(row) > 0.3
      ? styles.curveAlarm
      : r.touched(...OPENS.tracking, ...OPENS.capstan)
        ? styles.curveOn
        : styles.curve
  const headPath = rows.slice(1).map((row, i) => {
    const prev = rows[i]!
    return (
      <line
        key={row}
        x1={footX(prev, widths[i]!)}
        y1={rowY(prev)}
        x2={footX(row, widths[i + 1]!)}
        y2={rowY(row)}
        className={pathLook((prev + row) / 2)}
      />
    )
  })

  const tear = trackingTear({ trackAmt: amt, trackPos: pos, bars })
  const pictureRows = Array.from(
    { length: Math.floor(ACTIVE_HEIGHT / SCAN_STEP) },
    (_, i) => ACTIVE_TOP + SCAN_STEP / 2 + i * SCAN_STEP,
  )
  const snowRows = Array.from(
    { length: Math.floor(ACTIVE_HEIGHT / SNOW_STEP) },
    (_, i) => ACTIVE_TOP + i * SNOW_STEP,
  )

  const kick = servoKick(
    {
      trackPos: pos,
      trackAmt: amt,
      trackHunt: hunt,
      trackKick: v('trackKick'),
    },
    FRAMES,
  )

  const underLook: WireLook = underOn ? 'on' : 'dash'
  const trackLook: WireLook = r.touched(...OPENS.tracking) ? 'on' : 'plain'
  const servoLook: WireLook = hunt > 0 ? 'on' : 'plain'
  const tapeLook: WireLook = bars !== 0 ? 'on' : 'plain'
  const rfLook: WireLook = clog > 0 || amt > 0 || bars !== 0 ? 'on' : 'plain'

  return (
    <>
      <Diagram
        width={WIDTH}
        height={HEIGHT}
        label="VHS colour-under path and tracking"
      >
        {arrow => (
          <>
            <Label x={0} y={TOP_Y + 3}>
              C
            </Label>
            <Wire arrow={arrow} d={`M${TAP_X - 3} ${TOP_Y} H${ROW.down.x}`} />
            <Wire
              arrow={arrow}
              look={v('colorUnderMix') < 1 ? 'plain' : 'dash'}
              d={`M${TAP_X} ${TOP_Y} V${DIRECT_Y} H${centre(ROW.mix)} V${TOP_Y - H / 2}`}
            />
            <Label x={centre(ROW.tape)} y={DIRECT_Y - 3} anchor="middle">
              direct
            </Label>
            <Wire
              arrow={arrow}
              look={underLook}
              d={`M${right(ROW.down)} ${TOP_Y} H${ROW.tape.x}`}
            />
            <Label
              x={(right(ROW.down) + ROW.tape.x) / 2}
              y={TOP_Y - 4}
              anchor="middle"
              on={underOn}
            >
              629k
            </Label>
            <Wire
              arrow={arrow}
              look={underLook}
              d={`M${right(ROW.tape)} ${TOP_Y} H${ROW.up.x}`}
            />
            <Wire
              arrow={arrow}
              look={underLook}
              d={`M${right(ROW.up)} ${TOP_Y} H${ROW.mix.x}`}
            />
            <Label
              x={(right(ROW.up) + ROW.mix.x) / 2}
              y={TOP_Y - 4}
              anchor="middle"
              on={underOn}
            >
              3.58M
            </Label>
            <Wire
              arrow={arrow}
              d={`M${right(ROW.mix)} ${TOP_Y} H${ROW.delay.x}`}
            />
            <Wire
              arrow={arrow}
              look={v('ycDelayNs') !== 0 ? 'on' : 'plain'}
              d={`M${right(ROW.delay)} ${TOP_Y} H${WIDTH - 2}`}
            />
            <Label x={WIDTH - 2} y={TOP_Y - 5} anchor="end">
              C
            </Label>

            <Wire
              arrow={arrow}
              look={trackLook}
              d={`M${right(ROW.tracking)} ${BOT_Y} H${ROW.servo.x}`}
            />
            <Wire
              arrow={arrow}
              look={servoLook}
              d={`M${right(ROW.servo)} ${BOT_Y} H${ROW.capstan.x}`}
            />
            <Wire
              arrow={arrow}
              look={tapeLook}
              d={`M${right(ROW.capstan)} ${BOT_Y} H${ROW.heads.x}`}
            />
            <Label
              x={(right(ROW.capstan) + ROW.heads.x) / 2}
              y={BOT_Y - 4}
              anchor="middle"
              on={tapeLook === 'on'}
            >
              tape
            </Label>
            <Wire
              arrow={arrow}
              look={rfLook}
              d={`M${right(ROW.heads)} ${BOT_Y} H${WIDTH - 2}`}
            />
            <Label x={WIDTH - 2} y={BOT_Y - 6} anchor="end">
              RF
            </Label>

            {boxes.map(b => (
              <BoxView
                key={b.name}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <Label x={FOOT.left} y={FOOT.top - 6}>
              tracks
            </Label>
            <Label x={PICTURE.left} y={FOOT.top - 6}>
              picture
            </Label>
            <clipPath id={`${clip}-tape`}>
              <rect
                x={FOOT.left}
                y={FOOT.top}
                width={FOOT.right - FOOT.left}
                height={FOOT.bottom - FOOT.top}
              />
            </clipPath>
            <g clipPath={`url(#${clip}-tape)`}>
              {tracks.map(k =>
                k % 2 === 0 ? null : (
                  <path
                    key={k}
                    d={trackShape(k)}
                    className={clog > 0 ? own.dead : own.trackB}
                  />
                ),
              )}
              {tracks.map(k => (
                <line
                  key={k}
                  x1={footX(0, k)}
                  y1={FOOT.top}
                  x2={footX(LINES, k)}
                  y2={FOOT.bottom}
                  className={own.edge}
                />
              ))}
              {headPath}
            </g>
            <rect
              x={FOOT.left}
              y={FOOT.top}
              width={FOOT.right - FOOT.left}
              height={FOOT.bottom - FOOT.top}
              className={own.tape}
            />

            <clipPath id={`${clip}-picture`}>
              <rect
                x={PICTURE.left}
                y={rowY(ACTIVE_TOP)}
                width={PICTURE.right - PICTURE.left}
                height={rowY(ACTIVE_TOP + ACTIVE_HEIGHT) - rowY(ACTIVE_TOP)}
              />
            </clipPath>
            <g clipPath={`url(#${clip}-picture)`}>
              {pictureRows.map(row => (
                <line
                  key={row}
                  x1={PICTURE.left - tear[row]! * US_WIDE}
                  x2={PICTURE.right - tear[row]! * US_WIDE}
                  y1={rowY(row)}
                  y2={rowY(row)}
                  className={own.scan}
                />
              ))}
              {snowRows.map(row => {
                const s = severity(row + SNOW_STEP / 2)
                return s > 0 ? (
                  <rect
                    key={row}
                    x={PICTURE.left}
                    y={rowY(row)}
                    width={PICTURE.right - PICTURE.left}
                    height={rowY(row + SNOW_STEP) - rowY(row)}
                    opacity={s}
                    className={own.snow}
                  />
                ) : null
              })}
            </g>
            <rect
              x={PICTURE.left}
              y={rowY(ACTIVE_TOP)}
              width={PICTURE.right - PICTURE.left}
              height={rowY(ACTIVE_TOP + ACTIVE_HEIGHT) - rowY(ACTIVE_TOP)}
              className={own.tape}
            />
            <Label x={FOOT.left} y={FOOT.bottom + 11} on={clog > 0}>
              {clog > 0 ? 'head B clogged' : 'A and B azimuth'}
            </Label>

            <TracePlot
              {...PLOT}
              title="band after a kick, lines"
              values={kick}
              scale={{ floor: 10 }}
              ends={['kick', `${FRAMES / 60} s`]}
              along={alongRange(0, FRAMES / 60, 's')}
              look={rings(kick) ? 'alarm' : hunt > 0 ? 'on' : 'plain'}
            />
            {hunt === 0 && (
              <Label
                x={(PLOT.left + PLOT.right) / 2}
                y={(PLOT.top + PLOT.bottom) / 2 - 4}
                anchor="middle"
              >
                parked
              </Label>
            )}
          </>
        )}
      </Diagram>
      <BoxRows keys={open?.keys} note={open?.note} help={open?.help} />
    </>
  )
}
