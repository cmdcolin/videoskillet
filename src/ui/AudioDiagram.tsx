import styles from './AudioDiagram.module.css'
import {
  boxWidth,
  lit,
  openBox,
  useReadings,
  useSelectedBox,
  type BoxSpec,
} from './diagram'
import shared from './Diagram.module.css'
import { Boxes, BoxRows, Diagram, Label, Wire } from './DiagramParts'
import { AUDIO_KEYS, AUDIO_OPENS as OPENS } from './schematicKeys'

type Dest = Exclude<keyof typeof OPENS, 'wave'>
type Tap = 'wave' | 'bass' | 'level'

const WIDTH = 340
const BOX_Y = 16
const BOX_H = 20
const START_X = 36
const GAP = 4
const DOMAIN_GAP = 8
const BRACKET_Y = 12
const TAPS: readonly Tap[] = ['wave', 'bass', 'level']
const TAP_Y: Record<Tap, number> = { wave: 56, bass: 68, level: 80 }
const HEIGHT = TAP_Y.level + 10

const DESTS = [
  { id: 'video', tap: 'wave', domain: 'signal' },
  { id: 'roll', tap: 'bass', domain: 'sync' },
  { id: 'tear', tap: 'level', domain: 'sync' },
  { id: 'sag', tap: 'bass', domain: 'deflection' },
  { id: 'tank', tap: 'wave', domain: 'deflection' },
  { id: 'bend', tap: 'wave', domain: 'deflection' },
  { id: 'hue', tap: 'wave', domain: 'decoder' },
] as const satisfies readonly { id: Dest; tap: Tap; domain: string }[]

const HELP = {
  video:
    'The audio patched straight into the video input, in IRE. Loud passages land on the sync tips and the burst as well as the picture: the classic wrong-cable result.',
  roll: 'Bass energy detunes the vertical oscillator, so kick drums shove the frame vertically and it settles back.',
  tear: 'Overall audio level pulls the horizontal oscillator off frequency, so loud passages skew and tear the picture sideways.',
  sag: 'Bass loads the high-voltage supply as if the beam were drawing current, so the scan collapses on each hit and springs back. Needs supply ring in Deflection.',
  tank: 'Drives the audio waveform into the high-voltage tank alongside the beam current, so the supply rings with the music. Needs bass → HV sag above zero.',
  bend: 'The audio waveform patched into the horizontal deflection, one sample per scan line. Hue stays put while the glass bends.',
  hue: "The audio waveform driven into the colour demodulator's reference oscillator, the same wire the tint control sits on.",
} satisfies Record<Dest, string>

const NAME: Record<Dest, string> = {
  video: 'video',
  roll: 'roll',
  tear: 'tear',
  sag: 'sag',
  tank: 'tank',
  bend: 'bend',
  hue: 'hue',
}

interface Placed {
  id: Dest
  tap: Tap
  domain: string
  x: number
  w: number
}

const placed: Placed[] = []
for (const d of DESTS) {
  const before = placed.at(-1)
  const x =
    before === undefined
      ? START_X
      : before.x + before.w + (before.domain === d.domain ? GAP : DOMAIN_GAP)
  placed.push({ ...d, x, w: boxWidth(NAME[d.id]) })
}

const mid = (d: { x: number; w: number }) => d.x + d.w / 2

export function AudioDiagram() {
  const r = useReadings(AUDIO_KEYS)
  const pick = useSelectedBox()
  const routed = (id: Dest) => r.value(OPENS[id][0]) !== 0

  const boxes: BoxSpec[] = placed.map(d => ({
    id: d.id,
    keys: OPENS[d.id],
    x: d.x,
    y: BOX_Y,
    w: d.w,
    h: BOX_H,
    name: NAME[d.id],
    touched: routed(d.id),
    help: HELP[d.id],
  }))
  const domains = [...new Set(placed.map(d => d.domain))].map(domain => {
    const own = placed.filter(d => d.domain === domain)
    return { domain, from: own[0]!.x, to: own.at(-1)!.x + own.at(-1)!.w }
  })
  const reach = (tap: Tap) =>
    Math.max(...placed.filter(d => d.tap === tap).map(mid))

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="audio routings">
        {arrow => (
          <>
            {domains.map(({ domain, from, to }) => (
              <g key={domain}>
                <path
                  d={`M${from} ${BRACKET_Y} H${to}`}
                  className={styles.domain}
                />
                <Label x={(from + to) / 2} y={BRACKET_Y - 3} anchor="middle">
                  {domain}
                </Label>
              </g>
            ))}

            <Boxes boxes={boxes} pick={pick} />

            {TAPS.map(tap => (
              <g key={tap}>
                <Wire
                  d={`M${START_X - 4} ${TAP_Y[tap]} H${reach(tap)}`}
                  look={lit(placed.some(d => d.tap === tap && routed(d.id)))}
                />
                <Label
                  x={0}
                  y={TAP_Y[tap] + 3}
                  on={tap === 'wave' && r.touched('audioGain')}
                  pick={
                    tap === 'wave'
                      ? {
                          id: 'wave',
                          selected: pick.selected === 'wave',
                          onSelect: pick.toggle,
                        }
                      : undefined
                  }
                >
                  {tap}
                </Label>
              </g>
            ))}

            {placed.map(d => (
              <g key={d.id}>
                <Wire
                  arrow={arrow}
                  d={`M${mid(d)} ${TAP_Y[d.tap]} V${BOX_Y + BOX_H}`}
                  look={lit(routed(d.id))}
                />
                <circle
                  cx={mid(d)}
                  cy={TAP_Y[d.tap]}
                  r={2}
                  className={routed(d.id) ? styles.dotOn : shared.dot}
                />
              </g>
            ))}
          </>
        )}
      </Diagram>
      <BoxRows {...openBox(boxes, pick.selected)} />
    </>
  )
}
