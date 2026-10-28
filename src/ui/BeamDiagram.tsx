import styles from './BeamDiagram.module.css'
import { edgeProfile, lineProfile } from './beamModel'
import {
  boxWidth,
  openBox,
  polyline,
  stageBoxes,
  useReadings,
  useSelectedBox,
} from './diagram'
import { Boxes, BoxRows, Chain, Diagram } from './DiagramParts'
import { alongRange } from './plotAlong'
import { BEAM_KEYS, BEAM_OPENS as OPENS } from './schematicKeys'
import { TracePlot } from './TracePlot'

type Part = keyof typeof OPENS

const WIDTH = 340
const ROW_Y = 14
const H = 20
const COL = {
  strobe: { x: 30, w: boxWidth('strobe') },
  spot: { x: 93, w: boxWidth('spot') },
  svm: { x: 144, w: boxWidth('svm') },
  recon: { x: 189, w: boxWidth('recon') },
  lines: { x: 246, w: boxWidth('lines') },
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
  const darkPath = polyline(
    dark.map((value, i) => [
      GAP.left + ((GAP.right - GAP.left) * i) / (GAP_POINTS - 1),
      GAP.bottom - (GAP.bottom - GAP.top) * value,
    ]),
  )

  const box = stageBoxes(OPENS, H, r)
  const boxes = [
    box(
      'strobe',
      COL.strobe,
      ROW_Y,
      'strobe',
      'Holds the beam-blanking gate on, so the guns are cut for most of each cycle and let through in flashes. The gate sits one line above the phosphor, so light already on the glass decays through the dark, and a feedback loop pumps at the strobe rate.',
    ),
    box(
      'spot',
      COL.spot,
      ROW_Y,
      'spot',
      'How wide a spot the gun writes on the phosphor. The beam is a smooth blob, so light from one sample lands partly on its neighbours and every edge arrives as a ramp. The coating is a granular deposit, so its emission is mottled, strongest in the mid tones.',
    ),
    box(
      'svm',
      COL.svm,
      ROW_Y,
      'svm',
      'Scan velocity modulation: consumer sets patch differentiated luma into an extra deflection coil, slowing the beam through a dark-to-bright edge. Emission follows dwell time, so light is moved across the edge rather than added. Negative wires the coil backwards.',
    ),
    box(
      'recon',
      COL.recon,
      ROW_Y,
      'recon',
      'How the sampled line is reconstructed into continuous light. Toward 0 is linear interpolation, which loses high frequencies; toward 1 is a cubic that stays flat past the subcarrier and rings a little at an edge.',
    ),
    box(
      'lines',
      COL.lines,
      ROW_Y,
      'lines',
      'The beam is a spot of finite height, so it does not quite fill the gap between scan lines. The spot grows with beam current, so bright lines are fatter than dark ones: scanlines show in the shadows and close up in the highlights.',
    ),
  ]

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="beam">
        {arrow => (
          <>
            <Chain
              arrow={arrow}
              y={ROW_Y}
              from={0}
              to={WIDTH - 2}
              stages={ORDER.map((id, i) => ({ at: COL[id], live: live[i]! }))}
              input="gun"
              output="glass"
            />

            <Boxes boxes={boxes} pick={pick} />

            <TracePlot
              {...EDGE}
              title="edge, light by pixel"
              values={edge}
              scale={{ lo: 0, hi: 1.5, ticks: [0, 1], reference: 0 }}
              format={String}
              ends={[`${EDGE_PX.from}`, `${EDGE_PX.to}`]}
              along={alongRange(EDGE_PX.from, EDGE_PX.to, 'px')}
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
              along={alongRange(-0.5, 0.5, 'line')}
              look={r.touched('scanBeam', 'scanBloom') ? 'on' : 'plain'}
            />
            {v('scanBloom') > 0 && v('scanBeam') > 0 && (
              <path d={darkPath} className={styles.dark} />
            )}
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
