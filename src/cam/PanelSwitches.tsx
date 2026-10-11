import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { LoopIcon, MixIcon, SlidersIcon } from './icons'
import { Switch } from './Switch'

export type Panel = 'tune' | 'loops' | 'mix'

// The switches that open a panel, down the picture's right edge.
export function PanelSwitches(props: {
  panel: Panel | null
  onToggle: (panel: Panel) => void
}) {
  const { panel, onToggle } = props
  return (
    <div className={cx(styles.switches, styles.right)}>
      <Switch
        on={panel === 'tune'}
        label="tune"
        title="the look's own knobs"
        onClick={() => onToggle('tune')}
      >
        <SlidersIcon />
      </Switch>
      <Switch
        on={panel === 'loops'}
        label="feedback"
        title="every knob on the camera loop and the mixer loop"
        onClick={() => onToggle('loops')}
      >
        <LoopIcon />
      </Switch>
      <Switch
        on={panel === 'mix'}
        label="sources"
        title="what is on A and B, and how the two mix"
        onClick={() => onToggle('mix')}
      >
        <MixIcon />
      </Switch>
    </div>
  )
}
