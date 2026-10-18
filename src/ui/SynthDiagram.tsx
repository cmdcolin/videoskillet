import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { SYNTH_KEYS, SYNTH_OPENS as OPENS } from './schematicKeys'
import {
  colorizerOut,
  cyclesPerLine,
  synthLevel,
  synthWave,
} from './synthModel'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const TOP_Y = 10
const BOT_Y = 46
const MAIN_Y = 28
const H = 16
const COL = {
  luma: { x: 6, w: 37 },
  oscA: { x: 53, w: 43 },
  oscB: { x: 53, w: 43 },
  shape: { x: 110, w: 43 },
  mix: { x: 167, w: 31 },
  level: { x: 212, w: 43 },
  colour: { x: 269, w: 49 },
  over: { x: 269, w: 37 },
} satisfies Record<Part, { x: number; w: number }>
const JOIN_X = 328

const PLOT = { top: 76, bottom: 112 }
const WAVE = { left: 24, right: 164, ...PLOT }
const STRIP = { left: 200, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const WAVE_POINTS = 97
const STRIP_CELLS = 34

const after = (id: Part) => COL[id].x + COL[id].w
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')
const unit = (v: number) => String(v)
const rate = (cycles: number) => {
  const shown =
    cycles >= 10 ? Math.round(cycles) : Number(cycles.toPrecision(2))
  return `${shown} ${shown === 1 ? 'cycle' : 'cycles'} a line`
}
const css = (rgb: readonly number[]) =>
  `rgb(${rgb.map(c => Math.round(c * 255)).join(' ')})`

export function SynthDiagram() {
  const r = useReadings(SYNTH_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const live = (id: Part) => r.touched(...OPENS[id])
  const combined = v('synthMix') > 0.5
  const hz = v('synthAHz')
  const comparators = v('synthColorMode') > 0.5
  const wave = Array.from({ length: WAVE_POINTS }, (_, i) =>
    synthLevel(
      synthWave(i / (WAVE_POINTS - 1), v('synthShape')),
      v('synthLevel'),
    ),
  )
  const cell = (STRIP.right - STRIP.left) / STRIP_CELLS

  const box = (
    id: Part,
    y: number,
    name: string,
    help: string,
    h = H,
  ): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: COL[id].x,
    y: y - h / 2,
    w: COL[id].w,
    h,
    name,
    touched: live(id),
    help,
  })
  const boxes = [
    box(
      'luma',
      TOP_Y,
      'luma',
      "The picture's brightness into oscillator A's frequency input, so the wave runs faster through bright picture and the image draws itself as contour lines. The input reads the deck or the camera loop's return.",
    ),
    box(
      'oscA',
      TOP_Y,
      'osc A',
      'The first oscillator, read against the raster: one cycle per frame is a vertical gradient, the 15734 Hz line rate turns it sideways, a multiple paints standing bars, and 3579545 Hz lands on the subcarrier and returns flat colour.',
    ),
    box(
      'oscB',
      BOT_Y,
      'osc B',
      'The second oscillator, live once the combiner is off "osc A alone". It beats against the first, so a pair a few hertz apart draws a drifting moire.',
    ),
    box(
      'shape',
      MAIN_Y,
      'shape',
      'The waveform for both oscillators. Ramp is a sawtooth, triangle folds it symmetric, sine passes the encoder without ringing, and pulse is a comparator output with the most bandwidth to distort.',
      BOT_Y - TOP_Y + H,
    ),
    box(
      'mix',
      MAIN_Y,
      'mix',
      "How the two oscillators combine: sum is a mixing amplifier driven into its rails, ring mod a balanced multiply leaving only sum and difference, comparator puts B on a slicer's reference.",
    ),
    box(
      'level',
      MAIN_Y,
      'level',
      'Output contrast around mid-video, ahead of the colorizer. Past 1 the waveform runs into its rails and squares off.',
    ),
    box(
      'colour',
      MAIN_Y,
      'colour',
      'One signal into three guns through three phase shifts 120 degrees apart, or through three comparators that switch each gun fully on or off. The input filter softens what its slicers see, and the input is the oscillator or the picture.',
    ),
    box(
      'over',
      BOT_Y,
      'over',
      "Lays the synth over slot A's picture instead of replacing it. Source A only.",
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="video synth">
        {arrow => (
          <>
            <Wire
              arrow={arrow}
              d={`M${after('luma')} ${TOP_Y} H${COL.oscA.x}`}
              look={look(v('synthFm') > 0)}
            />
            <Wire
              arrow={arrow}
              d={`M${after('oscA')} ${TOP_Y} H${COL.shape.x}`}
              look={look(live('oscA'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('oscB')} ${BOT_Y} H${COL.shape.x}`}
              look={combined ? look(live('oscB')) : 'dash'}
            />
            <Wire
              arrow={arrow}
              d={`M${after('shape')} ${MAIN_Y} H${COL.mix.x}`}
              look={look(live('shape'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('mix')} ${MAIN_Y} H${COL.level.x}`}
              look={look(live('mix'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('level')} ${MAIN_Y} H${COL.colour.x}`}
              look={look(live('level'))}
            />
            <Wire
              arrow={arrow}
              d={`M${after('colour')} ${MAIN_Y} H${WIDTH - 2}`}
              look={look(live('colour') || v('synthColor') > 0)}
            />
            <Wire
              d={`M${after('over')} ${BOT_Y} H${JOIN_X} V${MAIN_Y}`}
              look={look(v('synthOver') > 0)}
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
              {...WAVE}
              title={
                hz === 0 ? 'osc A off' : `osc A, ${rate(cyclesPerLine(hz))}`
              }
              values={wave}
              scale={{ lo: 0, hi: 1, ticks: [0, 1], reference: 0.5 }}
              format={unit}
              ends={['0', '1 cycle']}
              look={r.touched('synthShape', 'synthLevel') ? 'on' : 'plain'}
            />

            <Label x={STRIP.left} y={PLOT.top - 6}>
              colorizer, level to colour
            </Label>
            {Array.from({ length: STRIP_CELLS }, (_, i) => (
              <rect
                key={i}
                x={STRIP.left + i * cell}
                y={STRIP.top}
                width={cell + 0.5}
                height={STRIP.bottom - STRIP.top}
                fill={css(
                  colorizerOut(
                    i / (STRIP_CELLS - 1),
                    v('synthColor'),
                    v('synthHueDeg'),
                    comparators,
                  ),
                )}
              />
            ))}
            <Label x={STRIP.left} y={STRIP.bottom + 11}>
              0
            </Label>
            <Label x={STRIP.right} y={STRIP.bottom + 11} anchor="end">
              1
            </Label>
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
