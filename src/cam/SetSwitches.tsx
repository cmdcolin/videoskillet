import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { MicIcon, SideIcon, TiltIcon } from './icons'
import { Switch } from './Switch'

// The switches on the set itself, down the picture's left edge.
export function SetSwitches(props: {
  tilt: { supported: boolean; on: boolean; onToggle: () => void }
  side: { shown: boolean; on: boolean; onToggle: () => void }
  sound: { on: boolean; onToggle: () => void }
}) {
  const { tilt, side, sound } = props
  return (
    <div className={cx(styles.switches, styles.left)}>
      {tilt.supported ? (
        <Switch
          on={tilt.on}
          label="tilt"
          title="steer the loop by tilting the phone"
          onClick={tilt.onToggle}
        >
          <TiltIcon />
        </Switch>
      ) : null}
      {side.shown ? (
        <Switch
          on={side.on}
          label="on side"
          title="stand the set on its side, so the scan runs down the picture"
          onClick={side.onToggle}
        >
          <SideIcon />
        </Switch>
      ) : null}
      <Switch
        on={sound.on}
        label="sound"
        title="let the room's sound shake the set"
        onClick={sound.onToggle}
      >
        <MicIcon />
      </Switch>
    </div>
  )
}
