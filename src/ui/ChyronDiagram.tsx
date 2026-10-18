import own from './ChyronDiagram.module.css'
import { useReadings, useSelectedBox, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'
import {
  BoxRows,
  BoxView,
  Diagram,
  Label,
  Plate,
  Pressable,
  Wire,
} from './DiagramParts'
import {
  CAPTION_KEYS,
  CAPTION_OPENS,
  CC_BENDS,
  CG_BENDS,
  CHYRON_KEYS,
  CHYRON_OPENS,
} from './schematicKeys'

import type { ControlKey } from '../core/controls'

const CAPTION_READS: readonly ControlKey[] = [...CAPTION_KEYS, 'cc']

const GAP = 3
const SAMPLE_ROW = [0, 1, 1, 0, 0, 1, 1, 0]

interface Hold {
  bit: number
  high: boolean
}

// A bus drawn as its lines, bit 0 at the bottom. A held line is tied to a rail
// or to ground at a junction, and a crossed pair swaps places partway along.
function Bus({
  id,
  x,
  y,
  len,
  n,
  prefix,
  hold,
  cross,
  help,
  selected,
  onSelect,
}: {
  id: string
  x: number
  y: number
  len: number
  n: number
  prefix: string
  hold: Hold | null
  cross: number | null
  help: string
  selected: boolean
  onSelect: (id: string) => void
}) {
  const top = y - ((n - 1) * GAP) / 2
  const bottom = top + (n - 1) * GAP
  const at = (bit: number) => top + (n - 1 - bit) * GAP
  const end = x + len
  const hx = x + len * 0.25
  const cx = x + len * 0.7
  const crossed = (bit: number) =>
    cross !== null && (bit === cross || bit === cross + 1)
  const line = (bit: number) => {
    if (!crossed(bit)) return `M${x} ${at(bit)} H${end}`
    const other = bit === cross ? bit + 1 : bit - 1
    return `M${x} ${at(bit)} H${cx - 4} L${cx + 4} ${at(other)} H${end}`
  }
  return (
    <Pressable name={id} selected={selected} onSelect={() => onSelect(id)}>
      <title>{`${id} — ${help}`}</title>
      <rect
        x={x}
        y={top - 16}
        width={len}
        height={bottom - top + 32}
        rx={3}
        className={selected ? own.hitOpen : own.hit}
      />
      {Array.from({ length: n }, (_, bit) => (
        <Wire
          key={bit}
          d={line(bit)}
          look={crossed(bit) || hold?.bit === bit ? 'on' : 'plain'}
        />
      ))}
      {hold && (
        <>
          <path
            className={own.rail}
            d={
              hold.high
                ? `M${hx} ${at(hold.bit)} V${top - 4} M${hx - 3} ${top - 4} H${hx + 3}`
                : `M${hx} ${at(hold.bit)} V${bottom + 3} M${hx - 3} ${bottom + 3} H${hx + 3} M${hx - 2} ${bottom + 5} H${hx + 2} M${hx - 1} ${bottom + 7} H${hx + 1}`
            }
          />
          <circle cx={hx} cy={at(hold.bit)} r={1.8} className={own.junction} />
          <Label x={hx} y={top - 7} anchor="middle" on>
            {`${prefix}${hold.bit}`}
          </Label>
        </>
      )}
      {cross !== null && (
        <Label x={cx} y={top - 7} anchor="middle" on>
          {`${prefix}${cross}⇄${prefix}${cross + 1}`}
        </Label>
      )}
      <Label x={x + len * 0.62} y={bottom + 12} anchor="middle">
        {`${prefix}0–${prefix}${n - 1}`}
      </Label>
    </Pressable>
  )
}

// A single wire standing for a bus, slashed with how many lines it carries.
function Slash({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <>
      <path d={`M${x - 3} ${y + 4} L${x + 3} ${y - 4}`} className={own.slash} />
      <text x={x + 4} y={y + 10} className={own.width}>
        {n}
      </text>
    </>
  )
}

const M1 = 28
const M2 = 92
const C1 = 58
const C2 = 128
const R3 = 140
const ONE = 22
const TWO = 33
const FILL = R3 + ONE / 2
const KEY = R3 + 32 + ONE / 2
const SPLIT = (FILL + KEY) / 2
const PROGRAM = R3 + 66

// The character generator's data path, from the page memory that holds the
// text to the mixer that lays it on the picture, with each bend wired into the
// bus or counter it cuts. The caption decoder in the set carries the same part,
// so it draws the same chip and swaps the keyer for the box it paints.
function CharGen({ cg }: { cg: boolean }) {
  const b = cg ? CG_BENDS : CC_BENDS
  const opens = cg ? CHYRON_OPENS : CAPTION_OPENS
  const r = useReadings<ControlKey>(cg ? CHYRON_KEYS : CAPTION_READS)
  const pick = useSelectedBox(cg ? 'mix' : null)
  const off = r.value(cg ? 'cgMix' : 'cc') <= 0
  const box = (
    id: string,
    name: string,
    x: number,
    mid: number,
    w: number,
    h: number,
    keys: readonly ControlKey[],
    help: string,
  ): BoxSpec => ({
    id,
    name,
    x,
    y: mid - h / 2,
    w,
    h,
    keys,
    touched: keys.length > 0 && r.touched(...keys),
    help,
  })
  const held = (key: ControlKey): Hold | null => {
    const v = Math.round(r.value(key))
    return v === 0 ? null : { bit: Math.abs(v) - 1, high: v > 0 }
  }
  const crossAt = (key: ControlKey) => {
    const v = Math.round(r.value(key))
    return v === 0 ? null : v - 1
  }
  const dataHold = held(b.romData)

  const boxes: BoxSpec[] = [
    box(
      'raster',
      'raster',
      0,
      M1,
      50,
      TWO,
      opens.raster,
      cg
        ? 'Where the block starts on the picture and how many samples each font dot takes. The raster position drives both counters.'
        : 'The decoder paints on the set’s own raster, at a fixed place and size.',
    ),
    box(
      'page counter',
      'page\ncounter',
      62,
      M1,
      56,
      TWO,
      opens['page counter'],
      'Walks the page memory as the raster crosses the block. A slipping counter walks the page through itself a cell at a time.',
    ),
    box(
      'page ram',
      'page\nRAM',
      176,
      M1,
      46,
      TWO,
      opens['page ram'],
      'Four rows of thirty-two character codes.',
    ),
    box(
      'char counter',
      'char\ncounter',
      0,
      M2,
      56,
      TWO,
      opens['char counter'],
      'Forms the font address: the character code times the cell-height strap, plus the dot row. Its count slips when a frame or line reset arrives late.',
    ),
    box(
      'font rom',
      'font ROM\n2K×8',
      136,
      M2,
      62,
      TWO,
      opens['font rom'],
      'A 2 KiB EPROM: eleven address lines in, eight data lines out. Cells that have lost their charge read back as the erased state.',
    ),
  ]
  if (cg) {
    boxes.push(
      box(
        'key amp',
        'key\namp',
        0,
        SPLIT,
        38,
        TWO,
        CHYRON_OPENS['key amp'],
        'The key-processing amplifier. Its bandwidth is what softens the edge of the key.',
      ),
      box(
        'slicer',
        'slicer',
        48,
        SPLIT,
        50,
        ONE,
        CHYRON_OPENS.slicer,
        'Cuts the processed key at the clip level, which sets the stroke weight.',
      ),
      box(
        'fill',
        'fill',
        114,
        FILL,
        38,
        ONE,
        CHYRON_OPENS.fill,
        'The characters as video, at the fill level.',
      ),
      box(
        'timing',
        'timing',
        114,
        KEY,
        50,
        ONE,
        CHYRON_OPENS.timing,
        'The trim between key and fill. Off zero, the matte slides off the letters.',
      ),
      box(
        'edge',
        'edge',
        174,
        KEY,
        38,
        ONE,
        CHYRON_OPENS.edge,
        'A copy of the key delayed by samples and lines and OR-ed into it: the border and drop shadow.',
      ),
      box(
        'invert',
        'invert',
        222,
        KEY,
        50,
        ONE,
        CHYRON_OPENS.invert,
        'Cuts the other way: letter-shaped holes in a full-frame fill.',
      ),
      box(
        'mix',
        'mix',
        298,
        R3 + 38,
        38,
        76,
        CHYRON_OPENS.mix,
        'Lays the fill over program wherever the key is open.',
      ),
    )
  } else {
    boxes.push(
      box(
        'caption box',
        'caption\nbox',
        110,
        R3 + TWO / 2,
        56,
        TWO,
        CAPTION_OPENS['caption box'],
        'A black box behind the cells the decoder received, and the characters in white over it.',
      ),
    )
  }
  const busKeys: Record<string, readonly ControlKey[]> = opens
  const open =
    boxes.find(x => x.id === pick.selected)?.keys ??
    busKeys[pick.selected ?? '']
  const bus = (id: string) => ({
    id,
    selected: pick.selected === id,
    onSelect: pick.toggle,
  })
  const shift = { x: 242, y: M2 - 20, w: 66, h: 40 }
  return (
    <>
      <Diagram
        width={336}
        height={cg ? 246 : 182}
        label={
          cg ? 'character generator data path' : 'caption decoder data path'
        }
      >
        {arrow => (
          <g opacity={off ? 0.55 : 1}>
            <Wire arrow={arrow} d={`M50 ${M1} H62`} />
            <Wire arrow={arrow} d={`M334 ${M1} H222`} />
            <Label x={278} y={M1 - 5} anchor="middle">
              {cg ? 'caption text' : 'line 21 data'}
            </Label>
            <Wire
              arrow={arrow}
              d={`M199 ${M1 + TWO / 2} V${C1} H42 V${M2 - TWO / 2}`}
            />
            <Slash x={164} y={C1} n={7} />
            <Label x={52} y={C1 - 4}>
              code
            </Label>
            <Wire arrow={arrow} d={`M14 ${M1 + TWO / 2} V${M2 - TWO / 2}`} />
            <Label x={18} y={C1 + 4}>
              row
            </Label>
            <Wire
              arrow={arrow}
              d={
                cg
                  ? `M308 ${M2} H320 V${C2} H19 V${SPLIT - TWO / 2}`
                  : `M308 ${M2} H320 V${C2} H138 V${R3}`
              }
            />
            <Label x={262} y={C2 - 4}>
              dots
            </Label>
            <Bus
              {...bus('page bus')}
              x={118}
              y={M1}
              len={58}
              n={7}
              prefix="A"
              hold={held(b.pageAddr)}
              cross={null}
              help="Seven address lines into the page memory: A0–A4 the column, A5–A6 the row. A held line puts a character in a cell it was never written to."
            />
            <Bus
              {...bus('address bus')}
              x={56}
              y={M2}
              len={80}
              n={11}
              prefix="A"
              hold={held(b.romAddr)}
              cross={crossAt(b.romCross)}
              help="Eleven address lines into the font ROM. The low lines carry the dot row and the high ones the character, so a bend low in the bus scrambles rows and a bend high in it swaps characters."
            />
            <Bus
              {...bus('data bus')}
              x={198}
              y={M2}
              len={44}
              n={8}
              prefix="D"
              hold={dataHold}
              cross={null}
              help="Eight data lines, one per dot across a row of the glyph. A held line stripes a column down every character."
            />
            <g>
              <title>
                shift reg — Loads a row of eight dots and clocks them out one
                per dot.
              </title>
              <Plate x={shift.x} y={shift.y} w={shift.w} h={shift.h} inert />
              <text
                x={shift.x + shift.w / 2}
                y={shift.y + 15}
                textAnchor="middle"
                className={styles.name}
              >
                shift reg
              </text>
              {SAMPLE_ROW.map((lit, i) => {
                const forced = dataHold?.bit === i ? dataHold : null
                const look = forced
                  ? forced.high
                    ? own.cellHigh
                    : own.cellLow
                  : lit
                    ? own.cellLit
                    : own.cell
                return (
                  <rect
                    key={i}
                    x={shift.x + 13 + i * 5}
                    y={shift.y + 23}
                    width={5}
                    height={8}
                    className={look}
                  />
                )
              })}
            </g>
            {cg ? (
              <>
                <Wire arrow={arrow} d={`M38 ${SPLIT} H48`} />
                <Wire d={`M98 ${SPLIT} H106`} />
                <circle cx={106} cy={SPLIT} r={1.8} className={styles.head} />
                <Wire arrow={arrow} d={`M106 ${SPLIT} V${FILL} H114`} />
                <Wire arrow={arrow} d={`M106 ${SPLIT} V${KEY} H114`} />
                <Wire arrow={arrow} d={`M152 ${FILL} H298`} />
                <Wire arrow={arrow} d={`M164 ${KEY} H174`} />
                <Wire arrow={arrow} d={`M212 ${KEY} H222`} />
                <Wire arrow={arrow} d={`M272 ${KEY} H298`} />
                <Wire arrow={arrow} d={`M114 ${PROGRAM} H298`} />
                <Label x={110} y={PROGRAM + 4} anchor="end">
                  program
                </Label>
                <Wire arrow={arrow} d={`M317 ${R3 + 76} V${R3 + 92}`} />
                <Label x={312} y={R3 + 102} anchor="end">
                  out
                </Label>
              </>
            ) : (
              <>
                <Wire arrow={arrow} d={`M44 ${R3 + TWO / 2} H110`} />
                <Label x={0} y={R3 + TWO / 2 + 4}>
                  picture
                </Label>
                <Wire arrow={arrow} d={`M166 ${R3 + TWO / 2} H204`} />
                <Label x={208} y={R3 + TWO / 2 + 4}>
                  to the tube
                </Label>
              </>
            )}
            {boxes.map(x => (
              <BoxView
                key={x.id}
                box={x}
                selected={x.id === pick.selected}
                onSelect={pick.toggle}
              />
            ))}
          </g>
        )}
      </Diagram>
      <BoxRows keys={open} />
    </>
  )
}

export function ChyronDiagram() {
  return <CharGen cg />
}

export function CaptionDiagram() {
  return <CharGen cg={false} />
}
