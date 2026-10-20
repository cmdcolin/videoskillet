import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ControlSlider } from './ControlGroup'
import { NEEDS, sliderFor, type SliderNeed } from './controls'
import { useControlReading, useControlsApi } from './ControlsContext'
import { boxFold, boxHeight, LINE_H, type BoxSpec } from './diagram'
import styles from './Diagram.module.css'

import type { ControlKey } from '../core/controls'

// CROSS_REPO_SYNC(diagram-parts)
// The drawing sets its words in caps; a unit keeps its own case.
const UNIT =
  /((?<![A-Za-z])(?:[kMG]?Hz|[µnm]s|dB|[mk]V|mA)(?![A-Za-z])|(?<=\d ?)[sk](?![A-Za-z]))/

function Cased({ text }: { text: string }) {
  return text.split(UNIT).map((part, i) =>
    i % 2 ? (
      <tspan key={i} className={styles.unit}>
        {part}
      </tspan>
    ) : (
      part
    ),
  )
}

// A group the pointer and keyboard press to pick a box.
export function Pressable({
  name,
  selected,
  onSelect,
  className,
  opacity,
  children,
}: {
  name: string
  selected: boolean
  onSelect?: () => void
  className?: string
  opacity?: number
  children: ReactNode
}) {
  return (
    <g
      opacity={opacity}
      className={onSelect ? `${styles.pick} ${className ?? ''}` : className}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={onSelect ? `${name} controls` : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect()
              }
            }
          : undefined
      }
    >
      {children}
    </g>
  )
}

// A frame round part of a drawing: accent when a knob inside is off stock,
// filled when its rows are open.
export function Plate({
  x,
  y,
  w,
  h,
  touched,
  selected,
  inert,
}: {
  x: number
  y: number
  w: number
  h: number
  touched?: boolean
  selected?: boolean
  inert?: boolean
}) {
  const look = `${touched ? styles.boxOn : styles.box} ${selected ? styles.selected : ''} ${inert ? styles.inert : ''}`
  return <rect x={x} y={y} width={w} height={h} rx={3} className={look} />
}

// How far a pressable box takes presses above and below its frame. A box draws
// about 20px tall, and the margin brings the target to the 24px a finger needs.
const REACH = 3
const REACH_STYLE = { fill: 'transparent', stroke: 'none' }

// A stage drawn as a box with its name: accent when a knob inside is off stock,
// grey when nothing passes through it. The title is the browser's own tooltip.
export function BoxView({
  box,
  selected,
  onSelect,
}: {
  box: BoxSpec
  selected?: boolean
  onSelect?: (id: string) => void
}) {
  const lines = box.name.split('\n')
  const label = lines.join(' ')
  const pick = box.id !== undefined && box.keys?.length && onSelect
  const h = box.h ?? boxHeight(box.name)
  const top = box.y + (h - LINE_H * lines.length) / 2
  return (
    <Pressable
      name={label}
      selected={selected ?? false}
      onSelect={pick ? () => onSelect(box.id!) : undefined}
      opacity={box.off ? 0.55 : 1}
    >
      {box.help && <title>{`${label} — ${box.help}`}</title>}
      <Plate
        x={box.x}
        y={box.y}
        w={box.w}
        h={h}
        touched={box.touched}
        selected={selected}
        inert={!pick}
      />
      {pick ? (
        <rect
          x={box.x}
          y={box.y - REACH}
          width={box.w}
          height={h + 2 * REACH}
          style={REACH_STYLE}
        />
      ) : null}
      {lines.map((line, i) => (
        <text
          key={line + i}
          x={box.x + box.w / 2}
          y={top + LINE_H * (i + 1) - 3}
          textAnchor="middle"
          className={box.touched ? styles.nameOn : styles.name}
        >
          <Cased text={line} />
        </text>
      ))}
    </Pressable>
  )
}

export type WireLook = 'plain' | 'on' | 'dash' | 'alarm'

const WIRE_CLASS: Record<WireLook, string> = {
  plain: styles.wire!,
  on: styles.wireOn!,
  dash: styles.wireDash!,
  alarm: styles.wireAlarm!,
}

const HEAD_CLASS: Record<WireLook, string> = {
  plain: styles.head!,
  on: styles.headOn!,
  dash: styles.head!,
  alarm: styles.headAlarm!,
}

export function Wire({
  d,
  arrow,
  look,
}: {
  d: string
  arrow?: string
  look?: WireLook
}) {
  return (
    <path
      d={d}
      className={WIRE_CLASS[look ?? 'plain']}
      markerEnd={arrow && `url(#${arrow}-${look ?? 'plain'})`}
    />
  )
}

export function Label({
  x,
  y,
  anchor,
  on,
  pick,
  children,
}: {
  x: number
  y: number
  anchor?: 'start' | 'middle' | 'end'
  on?: boolean
  /** Makes the words a button for a box with no frame of its own. */
  pick?: { id: string; selected: boolean; onSelect: (id: string) => void }
  children: string
}) {
  const text = (
    <text
      x={x}
      y={y}
      textAnchor={anchor ?? 'start'}
      className={on ? styles.noteOn : styles.note}
    >
      <Cased text={children} />
    </text>
  )
  if (!pick) return text
  return (
    <Pressable
      name={pick.id}
      selected={pick.selected}
      onSelect={() => pick.onSelect(pick.id)}
      className={pick.selected ? styles.pickedLabel : ''}
    >
      {text}
    </Pressable>
  )
}

// The drawing's frame: an arrowhead in each wire look's colour, and the width
// the drawing scales from.
export function Diagram({
  left,
  width,
  height,
  label,
  children,
}: {
  /** How far the drawing runs left of x = 0. */
  left?: number
  width: number
  height: number
  label: string
  children: (arrow: string) => ReactNode
}) {
  const arrow = useId()
  return (
    <svg
      className={styles.diagram}
      viewBox={`${-(left ?? 0)} 0 ${width} ${height}`}
      role="group"
      aria-label={label}
    >
      <defs>
        {Object.entries(HEAD_CLASS).map(([look, className]) => (
          <marker
            key={look}
            id={`${arrow}-${look}`}
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 z" className={className} />
          </marker>
        ))}
      </defs>
      {children(arrow)}
    </svg>
  )
}
// CROSS_REPO_SYNC_END(diagram-parts)

const NEED_OF = new Map<string, SliderNeed | undefined>(Object.entries(NEEDS))

// The rows of the box that is open: the same rows the panel draws anywhere
// else, so a drag, a reset and a mod wire all work from here. Rows behind a shut
// gate fold into one line that opens it, drawn under the gate's own row when the
// box has it. Pressing a box scrolls its first rows into view, because the
// drawing puts them below its plots. A box open from the first render leaves
// the panel where it is.
export function BoxRows({
  keys,
  note,
  help,
}: {
  keys: readonly ControlKey[] | undefined
  note?: string
  /** What the open box does: two lines, and a press shows the rest. */
  help?: string
}) {
  const fold = useControlReading(c => boxFold(keys ?? [], c)).split(',')
  const top = useRef<HTMLSpanElement>(null)
  const opened = keys?.join()
  const was = useRef(opened)
  useEffect(() => {
    if (opened === was.current) return
    was.current = opened
    top.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [opened])
  if (!keys) return null
  const shown = keys.filter((_, i) => fold[i] === '')
  const folds = new Map<SliderNeed, number>()
  for (const owner of fold) {
    const need = NEED_OF.get(owner)
    if (need) folds.set(need, (folds.get(need) ?? 0) + 1)
  }
  const under = (key: ControlKey | undefined) =>
    [...folds]
      .filter(([need]) =>
        key === undefined ? !shown.includes(need.key) : need.key === key,
      )
      .map(([need, n]) => <FoldLine key={need.hint} need={need} n={n} />)
  return (
    <div className={styles.rows}>
      <span ref={top} className={styles.rowsTop} aria-hidden />
      {help && <HelpLine key={help} text={help} />}
      {note && <p className={styles.noteLine}>{note}</p>}
      {under(undefined)}
      {shown.map(key => (
        <Fragment key={key}>
          <ControlSlider slider={sliderFor(key)} />
          {under(key)}
        </Fragment>
      ))}
    </div>
  )
}

function HelpLine({ text }: { text: string }) {
  const [full, setFull] = useState(false)
  return (
    <button
      className={full ? styles.helpFull : styles.help}
      aria-expanded={full}
      onClick={() => setFull(!full)}
    >
      {text}
    </button>
  )
}

function FoldLine({ need, n }: { need: SliderNeed; n: number }) {
  const { writeControl } = useControlsApi()
  const gate = sliderFor(need.key)
  return (
    <button
      className={styles.fold}
      title={`click to set "${gate.label}" to ${need.fix}${gate.unit}`}
      onClick={() => writeControl(need.key, need.fix)}
    >
      {n === 1 ? '1 more control needs' : `${n} more controls need`} {need.hint}{' '}
      · click to set
    </button>
  )
}
