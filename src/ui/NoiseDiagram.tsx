import { LINES } from '../core/signal/constants'
import { openBox, useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import own from './NoiseDiagram.module.css'
import {
  arcMarks,
  colourBand,
  colourBandGain,
  floorGain,
  ignitionMarks,
  strikeSlab,
  type Mark,
} from './noiseModel'
import { alongRange } from './plotAlong'
import { NOISE_KEYS, NOISE_OPENS as OPENS } from './schematicKeys'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const ROW_Y = 14
const H = 20
const COL = {
  floor: { x: 40, w: 43 },
  arcs: { x: 99, w: 37 },
  ignition: { x: 152, w: 60 },
  strikes: { x: 228, w: 55 },
} satisfies Record<Part, { x: number; w: number }>

const PLOT = { top: 50, bottom: 98 }
const FLOOR = { left: 24, right: 164, ...PLOT }
const RASTER = { left: 200, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const BAND_MHZ = 6
const POINTS = 61

const times = (v: number) => (v === 0 ? '0' : `${v}×`)
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')
const after = (id: Part) => COL[id].x + COL[id].w
const rasterX = (x: number) => RASTER.left + (RASTER.right - RASTER.left) * x
const rasterY = (row: number) =>
  RASTER.top + ((RASTER.bottom - RASTER.top) * row) / LINES

const marksPath = (marks: readonly Mark[]) =>
  marks
    .map(m => {
      const x0 = rasterX(m.x0)
      return `M${x0.toFixed(1)} ${rasterY(m.row).toFixed(1)}h${Math.max(rasterX(m.x1) - x0, 1).toFixed(1)}`
    })
    .join('')

export function NoiseDiagram() {
  const r = useReadings(NOISE_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const tilt = v('noiseTilt')
  const floorOn = v('noiseIre') > 0
  const arcsOn = v('impulseRate') > 0
  const ignitionOn = v('impulseHz') > 0
  const strikesOn = v('strikeRate') > 0
  const floor = Array.from({ length: POINTS }, (_, i) =>
    floorGain(tilt, (BAND_MHZ * 1e6 * i) / (POINTS - 1)),
  )
  const strike = strikeSlab(v('strikeRate'))

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
      'floor',
      'floor',
      "Gaussian snow added to the waveform. At 0 on the spectrum knob it is receiver noise through the IF filter, flat across the video band. At 1 it is the deck's FM demodulator, which differentiates the noise, so the floor rises into the chroma bandpass and decodes as coloured speckle.",
    ),
    box(
      'arcs',
      'arcs',
      'Sparse bright events from arcing thermostats and dying flybacks, from a few microseconds to a torn slab of hash. The dimmer lock bunches them into two bands per mains cycle that roll with the hum bar.',
    ),
    box(
      'ignition',
      'ignition',
      'A spark plug firing on a strict period. A period that is not a whole number of lines walks each hit sideways by the same step, which draws the drifting lattice of dashes.',
    ),
    box(
      'strikes',
      'strikes',
      'Lightning, a breaker arcing, a compressor kicking on: dozens of lines of dense hash that decays down the raster. It lands on sync tips, so the sync loop tears and the beam load spikes.',
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="noise and interference">
        {arrow => (
          <>
            <Label x={0} y={ROW_Y - 6}>
              video
            </Label>
            <Wire arrow={arrow} d={`M0 ${ROW_Y} H${COL.floor.x}`} />
            <Wire
              arrow={arrow}
              d={`M${after('floor')} ${ROW_Y} H${COL.arcs.x}`}
              look={look(floorOn)}
            />
            <Wire
              arrow={arrow}
              d={`M${after('arcs')} ${ROW_Y} H${COL.ignition.x}`}
              look={look(floorOn || arcsOn)}
            />
            <Wire
              arrow={arrow}
              d={`M${after('ignition')} ${ROW_Y} H${COL.strikes.x}`}
              look={look(floorOn || arcsOn || ignitionOn)}
            />
            <Wire
              arrow={arrow}
              d={`M${after('strikes')} ${ROW_Y} H${WIDTH - 2}`}
              look={look(floorOn || arcsOn || ignitionOn || strikesOn)}
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
              {...FLOOR}
              title={`floor, colour band ${colourBandGain(tilt).toFixed(1)}×`}
              values={floor}
              scale={{ lo: 0, hi: 2, ticks: [0, 1, 2], reference: 1 }}
              format={times}
              ends={['0', `${BAND_MHZ} MHz`]}
              along={alongRange(0, BAND_MHZ, 'MHz')}
              band={colourBand(BAND_MHZ * 1e6)}
              look={floorOn ? 'on' : 'plain'}
            />

            <Label x={RASTER.left} y={PLOT.top - 6}>
              one frame, example
            </Label>
            <rect
              x={RASTER.left}
              y={RASTER.top}
              width={RASTER.right - RASTER.left}
              height={RASTER.bottom - RASTER.top}
              className={own.frame}
            />
            {strike && (
              <rect
                x={RASTER.left}
                y={rasterY(strike.row)}
                width={RASTER.right - RASTER.left}
                height={Math.max(rasterY(strike.rows) - rasterY(0), 1.5)}
                className={own.slab}
              />
            )}
            <path
              d={marksPath([
                ...arcMarks(v('impulseRate'), v('impulseMains')),
                ...ignitionMarks(v('impulseHz')),
              ])}
              className={own.mark}
            />
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
