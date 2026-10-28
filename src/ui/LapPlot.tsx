import { useId, type ReactNode } from 'react'

import { polyline } from './diagram'
import styles from './Diagram.module.css'
import { Label } from './DiagramParts'

// What one lap round a feedback loop hands back, plotted at `xs` against a
// gain axis that `y` maps, with the curve in alarm colour above unity. With the
// fader down, `upGains` is the lap the loop would make with it up. `axis`
// labels the x axis.
export function LapPlot({
  left,
  right,
  top,
  bottom,
  title,
  grid,
  xs,
  gains,
  upGains,
  on,
  y,
  axis,
}: {
  left: number
  right: number
  top: number
  bottom: number
  title: string
  /** The gains drawn as grid lines, besides unity. */
  grid: readonly number[]
  xs: readonly number[]
  gains: readonly number[]
  upGains: readonly number[] | null
  on: boolean
  y: (gain: number) => number
  axis: ReactNode
}) {
  const clip = useId()
  const trace = (values: readonly number[]) =>
    polyline(values.map((g, i) => [xs[i]!, y(g)]))
  const curve = trace(gains)
  return (
    <>
      <Label x={left + 4} y={top - 8}>
        {title}
      </Label>
      {grid.map(g => (
        <line
          key={g}
          x1={left}
          x2={right}
          y1={y(g)}
          y2={y(g)}
          className={styles.grid}
        />
      ))}
      <line x1={left} x2={right} y1={y(1)} y2={y(1)} className={styles.unity} />
      {[0, 1, 2].map(g => (
        <Label key={g} x={left - 4} y={y(g) + 3} anchor="end">
          {g === 0 ? '0' : `${g}×`}
        </Label>
      ))}
      {axis}
      <clipPath id={clip}>
        <rect
          x={left}
          y={top - 2}
          width={right - left}
          height={y(1) - top + 2}
        />
      </clipPath>
      <path d={curve} className={on ? styles.curveOn : styles.curve} />
      {upGains && (
        <>
          <path d={trace(upGains)} className={styles.faderUp} />
          <Label
            x={right}
            y={Math.min(y(upGains.at(-1)!) + 11, bottom - 4)}
            anchor="end"
          >
            fader up
          </Label>
        </>
      )}
      <path
        d={curve}
        className={styles.curveAlarm}
        clipPath={`url(#${clip})`}
      />
    </>
  )
}
