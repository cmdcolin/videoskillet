import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { stopAt, zoomLabel } from './zoom'

export function ZoomStops(props: {
  stops: readonly number[]
  zoom: number
  onZoom: (zoom: number) => void
}) {
  const stop = stopAt(props.zoom, props.stops)
  return (
    <div className={styles.zoom} role="group" aria-label="Zoom">
      {props.stops.map(s => (
        <button
          key={s}
          className={cx(styles.zoomStop, s === stop && styles.zoomOn)}
          aria-label={`zoom ${zoomLabel(s)}×`}
          onClick={() => props.onZoom(s)}
        >
          {s === stop ? `${zoomLabel(props.zoom)}×` : zoomLabel(s)}
        </button>
      ))}
    </div>
  )
}
