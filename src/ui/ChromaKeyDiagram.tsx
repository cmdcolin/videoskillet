import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Wire,
  type WireLook,
} from './DiagramParts'
import { mixerSlice } from './hueKey'
import { HueWheel } from './HueWheel'
import { CHROMA_KEY_KEYS, CHROMA_KEY_OPENS as OPENS } from './schematicKeys'

type Part = keyof typeof OPENS

const WIDTH = 340
const H = 20
const TOP_Y = 36
const BOT_Y = 84
const TRUNK_X = 4
const COL = {
  spill: { x: 14, w: 44 },
  delay: { x: 14, w: 44 },
  keyer: { x: 66, w: 44 },
  mix: { x: 92, w: 62 },
  fill: { x: 118, w: 36 },
}
const GATE_X = 100
const FILL_X = COL.fill.x + COL.fill.w / 2
const MIX_MID = COL.mix.x + COL.mix.w / 2
const WHEEL = { cx: 254, cy: 70, radius: 56 }
const RIM = 0.7
const HEIGHT = 142
const FILLS = ['program A', 'matte', 'loop bus']
const DEG = Math.PI / 180

// The keyer across the mixer as mix_b.wgsl runs it. B's picture crosses the
// spill canceller into the mix, and its encoded chroma runs the key path
// through the registration delay into the keyer, whose gate sets how much of B
// the mix keeps; the fill is what the mix shows where B is cut. Beside the
// boxes, the keyer's slice on the U/V plane: the shaded part of the wheel is
// the chroma it cuts.
export function ChromaKeyDiagram() {
  const r = useReadings(CHROMA_KEY_KEYS)
  const genlock = useReadings(['bGenlock']).value('bGenlock') > 0.5
  const pick = useSelectedBox()
  const v = r.value
  const key = v('bKey')
  const on = key !== 0
  const fill = Math.round(v('bKeyFill'))
  const keyLook: WireLook = on ? 'on' : 'dash'
  const slice = mixerSlice({
    bKeyHueDeg: v('bKeyHueDeg'),
    bKeyAcceptDeg: v('bKeyAcceptDeg'),
    bKeyClip: v('bKeyClip'),
    bKeySoft: v('bKeySoft'),
  })

  const box = (
    id: Part,
    y: number,
    name: string,
    help: string,
    off?: boolean,
  ): BoxSpec => ({
    id,
    keys: OPENS[id],
    x: COL[id].x,
    y: y - H / 2,
    w: COL[id].w,
    h: H,
    name,
    off: off ?? (!on && id !== 'mix'),
    touched: r.touched(...OPENS[id]),
    help,
  })
  const boxes = [
    box(
      'spill',
      TOP_Y,
      'spill',
      "The spill canceller reinjects B's own subcarrier in antiphase along the backing's phase, so backing colour reflected off the subject cancels.",
    ),
    box(
      'delay',
      BOT_Y,
      'delay',
      'The delay registers the key path against the video path. Off zero the matte lands beside the subject.',
    ),
    box(
      'keyer',
      BOT_Y,
      'keyer',
      "Slices B's chroma by hue and saturation: a wedge either side of the backing hue, above the clip, eased by the gain knob.",
    ),
    box(
      'fill',
      BOT_Y,
      'fill',
      "The fill is what the mix shows where the key cuts B: program A, the box's own matte, or the mixer loop's last frame. It acts on the genlocked path only.",
      !on || !genlock,
    ),
    box(
      'mix',
      TOP_Y,
      genlock ? 'A/B mix' : 'A + B',
      genlock
        ? 'The genlocked crossfade: the gate cuts B and the fill shows through the hole. A negative key cuts the subject and keeps the backing.'
        : 'The dirty sum: the gate cuts B, and program A stays on the bus everywhere. A negative key cuts the subject and keeps the backing.',
    ),
  ]
  const open = Object.entries(OPENS).find(([id]) => id === pick.selected)?.[1]
  const up = (x: number) => `M${x} ${BOT_Y - H / 2} V${TOP_Y + H / 2}`

  return (
    <>
      <Diagram width={WIDTH} height={HEIGHT} label="chroma keyer">
        {arrow => (
          <>
            <Label x={0} y={10}>
              B
            </Label>
            <Wire
              arrow={arrow}
              d={`M${TRUNK_X} 14 V${TOP_Y} H${COL.spill.x}`}
            />
            <Wire
              arrow={arrow}
              d={`M${TRUNK_X} ${TOP_Y} V${BOT_Y} H${COL.delay.x}`}
              look={keyLook}
            />
            <Label x={TRUNK_X + 4} y={(TOP_Y + BOT_Y) / 2 + 3}>
              chroma
            </Label>
            <Wire
              arrow={arrow}
              d={`M${COL.spill.x + COL.spill.w} ${TOP_Y} H${COL.mix.x}`}
              look={on && v('bKeySpill') > 0 ? 'on' : 'plain'}
            />
            <Wire
              arrow={arrow}
              d={`M${COL.delay.x + COL.delay.w} ${BOT_Y} H${COL.keyer.x}`}
              look={keyLook}
            />
            <Wire arrow={arrow} d={up(GATE_X)} look={keyLook} />
            <Label x={GATE_X - 4} y={(TOP_Y + BOT_Y) / 2 + 3} anchor="end">
              gate
            </Label>
            <Wire
              arrow={arrow}
              d={up(FILL_X)}
              look={on && genlock ? 'on' : 'dash'}
            />
            <Label
              x={FILL_X}
              y={BOT_Y + H / 2 + 12}
              anchor="middle"
              on={on && genlock}
            >
              {FILLS[fill] ?? FILLS[0]!}
            </Label>
            <Wire arrow={arrow} d={`M${MIX_MID} ${TOP_Y - H / 2} V12`} />
            <Label x={MIX_MID} y={8} anchor="middle">
              to the channel
            </Label>

            {boxes.map(b => (
              <BoxView
                key={b.id}
                box={b}
                selected={b.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}

            <HueWheel
              {...WHEEL}
              rim={RIM}
              slice={slice}
              invert={key < 0}
              on={on}
              strength={Math.min(Math.abs(key), 1)}
              dot={
                fill === 1
                  ? {
                      angle: v('bKeyMatteHueDeg') * DEG,
                      r: v('bKeyMatteSat'),
                      label: 'matte',
                    }
                  : undefined
              }
            />
          </>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}
