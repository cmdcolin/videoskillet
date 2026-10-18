import styles from './BeamDiagram.module.css'
import { edgeProfile, lineProfile } from './beamModel'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { BEAM_KEYS, BEAM_OPENS as OPENS } from './schematicKeys'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const ROW_Y = 14
const H = 20
const COL = {
  strobe: { x: 30, w: 49 },
  spot: { x: 93, w: 37 },
  svm: { x: 144, w: 31 },
  recon: { x: 189, w: 43 },
  lines: { x: 246, w: 43 },
} satisfies Record<Part, { x: number; w: number }>
const ORDER = ['strobe', 'spot', 'svm', 'recon', 'lines'] as const

const PLOT = { top: 50, bottom: 98 }
const EDGE = { left: 24, right: 164, ...PLOT }
const GAP = { left: 200, right: 336, ...PLOT }
const HEIGHT = PLOT.bottom + 14
const EDGE_PX = { from: -4, to: 5 }
const EDGE_POINTS = 91
const GAP_POINTS = 41
const BRIGHT = 1
const DARK = 0.1

const after = (id: Part) => COL[id].x + COL[id].w
const look = (on: boolean): WireLook => (on ? 'on' : 'plain')

export function BeamDiagram() {
  const r = useReadings(BEAM_KEYS)
  const pick = useSelectedBox()
  const v = r.value
  const live = ORDER.map(id => r.touched(...OPENS[id]))
  const edge = edgeProfile(
    {
      spot: v('crtSpot'),
      svm: v('crtSvm'),
      svmWidth: v('crtSvmWidth'),
      sharp: v('crtSharp'),
    },
    EDGE_PX.from,
    EDGE_PX.to,
    EDGE_POINTS,
  )
  const bright = lineProfile(v('scanBeam'), v('scanBloom'), BRIGHT, GAP_POINTS)
  const dark = lineProfile(v('scanBeam'), v('scanBloom'), DARK, GAP_POINTS)
  const darkPath = dark
    .map(
      (value, i) =>
        `${i === 0 ? 'M' : 'L'}${(GAP.left + ((GAP.right - GAP.left) * i) / (GAP_POINTS - 1)).toFixed(1)} ${(GAP.bottom - (GAP.bottom - GAP.top) * value).toFixed(1)}`,
    )
    .join(' ')

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
      'strobe',
      'strobe',
      'Holds the beam-blanking gate on, so the guns are cut for most of each cycle and let through in flashes. The gate sits one line above the phosphor, so light already on the glass decays through the dark, and a feedback loop pumps at the strobe rate.',
    ),
    box(
      'spot',
      'spot',
      'How wide a spot the gun writes on the phosphor. The beam is a smooth blob, so light from one sample lands partly on its neighbours and every edge arrives as a ramp. The coating is a granular deposit, so its emission is mottled, strongest in the mid tones.',
    ),
    box(
      'svm',
      'svm',
      'Scan velocity modulation: consumer sets patch differentiated luma into an extra deflection coil, slowing the beam through a dark-to-bright edge. Emission follows dwell time, so light is moved across the edge rather than added. Negative wires the coil backwards.',
    ),
    box(
      'recon',
      'recon',
      'How the sampled line is reconstructed into continuous light. Toward 0 is linear interpolation, which loses high frequencies; toward 1 is a cubic that stays flat past the subcarrier and rings a little at an edge.',
    ),
    box(
      'lines',
      'lines',
      'The beam is a spot of finite height, so it does not quite fill the gap between scan lines. The spot grows with beam current, so bright lines are fatter than dark ones: scanlines show in the shadows and close up in the highlights.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="beam">
        {arrow => (
          <>
            <Label x={0} y={ROW_Y - 6}>
              gun
            </Label>
            <Wire arrow={arrow} d={`M0 ${ROW_Y} H${COL.strobe.x}`} />
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
              d={`M${after('lines')} ${ROW_Y} H${WIDTH - 2}`}
              look={look(live.some(Boolean))}
            />
            <Label x={WIDTH - 2} y={ROW_Y - 6} anchor="end">
              to the glass
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
              {...EDGE}
              title="edge, light by pixel"
              values={edge}
              scale={{ lo: 0, hi: 1.5, ticks: [0, 1], reference: 0 }}
              format={String}
              ends={[`${EDGE_PX.from}`, `${EDGE_PX.to}`]}
              look={
                r.touched('crtSpot', 'crtSvm', 'crtSvmWidth', 'crtSharp')
                  ? 'on'
                  : 'plain'
              }
            />

            <TracePlot
              {...GAP}
              title="line gap, dashed dark"
              values={bright}
              scale={{ lo: 0, hi: 1, ticks: [0, 1], reference: 1 }}
              format={String}
              ends={['−½ line', '½']}
              look={r.touched('scanBeam', 'scanBloom') ? 'on' : 'plain'}
            />
            {v('scanBloom') > 0 && v('scanBeam') > 0 && (
              <path d={darkPath} className={styles.dark} />
            )}
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
