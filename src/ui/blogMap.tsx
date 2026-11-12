import { renderToStaticMarkup } from 'react-dom/server'
import { arrowhead } from 'skillet-shared/wire-route'

import { BOX_H, boxWidth, HEAD } from './chainLayout'
import styles from './ChainMap.module.css'
import { PHASE_ORDER } from './controls'

export interface Callout {
  stage: string
  lines: string[]
}

export interface BlogMap {
  callouts: Callout[]
}

const PAD = 12
const GAP = 56
const LEAD = 14
const MID = PAD + BOX_H / 2
const LEADER = 16
const LINE = 12.5
const NOTE_CHAR = 5.2
const BOX_PAD = 10

export function blogMapMarkup(map: BlogMap) {
  const widths = PHASE_ORDER.map(name => boxWidth(name) + BOX_PAD)
  const lefts = widths.map(
    (_, i) => PAD + LEAD + widths.slice(0, i).reduce((n, w) => n + w + GAP, 0),
  )
  const ends = lefts.map((x, i) => x + widths[i]!)
  const right = ends.at(-1)! + LEAD
  const runs = [PAD, ...ends].map((x0, i) => [x0, lefts[i] ?? right] as const)
  const centre = (stage: string) => {
    const i = PHASE_ORDER.findIndex(name => name === stage)
    if (i < 0) throw new Error(`no stage named ${stage}`)
    return lefts[i]! + widths[i]! / 2
  }
  const noteTop = MID + BOX_H / 2 + LEADER
  const deepest = Math.max(...map.callouts.map(c => c.lines.length))
  const height = noteTop + deepest * LINE + PAD
  const widest = Math.max(
    ...map.callouts.flatMap(c => c.lines.map(l => l.length * NOTE_CHAR)),
  )
  const width = Math.max(right, centre(map.callouts.at(-1)!.stage) + widest / 2)
  return renderToStaticMarkup(
    <svg
      className={styles.map}
      viewBox={`0 0 ${Math.ceil(width + PAD)} ${Math.ceil(height)}`}
    >
      {runs.map(([x0, x1]) => (
        <g key={x0}>
          <line
            className={styles.mapWire}
            x1={x0}
            y1={MID}
            x2={x1 - HEAD}
            y2={MID}
          />
          <path
            className={styles.mapArrow}
            d={arrowhead(
              [
                [x0, MID],
                [x1, MID],
              ],
              HEAD,
              HEAD,
            )}
          />
        </g>
      ))}
      {PHASE_ORDER.map((name, i) => (
        <g key={name} className={styles.mapNode}>
          <rect
            className={styles.mapBox}
            x={lefts[i]}
            y={MID - BOX_H / 2}
            width={widths[i]}
            height={BOX_H}
            rx={3}
          />
          <text
            className={styles.mapLabel}
            x={lefts[i]! + widths[i]! / 2}
            y={MID}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {name}
          </text>
        </g>
      ))}
      {map.callouts.map(callout => {
        const x = centre(callout.stage)
        return (
          <g key={callout.stage}>
            <line
              className={styles.mapWire}
              x1={x}
              y1={MID + BOX_H / 2}
              x2={x}
              y2={noteTop - 4}
            />
            {callout.lines.map((line, i) => (
              <text
                key={line}
                className="note"
                x={x}
                y={noteTop + i * LINE + LINE / 2}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {line}
              </text>
            ))}
          </g>
        )
      })}
    </svg>,
  )
}
