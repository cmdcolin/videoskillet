import { useState } from 'react'

import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { MicIcon, MoreIcon, SideIcon, TiltIcon } from './icons'
import { Switch } from './Switch'

// The switches on the set itself, folded under more down the picture's left
// edge. A switch that is on stays out, so the picture never changes for a
// reason the page is hiding.
export function SetSwitches(props: {
  tilt: { supported: boolean; on: boolean; onToggle: () => void }
  side: { shown: boolean; on: boolean; onToggle: () => void }
  sound: { on: boolean; onToggle: () => void }
}) {
  const { tilt, side, sound } = props
  const [open, setOpen] = useState(false)
  return (
    <div className={cx(styles.switches, styles.left)}>
      <Switch
        on={open}
        label="more"
        title="tilt, on side and sound"
        onClick={() => setOpen(!open)}
      >
        <MoreIcon />
      </Switch>
      {tilt.supported && (open || tilt.on) ? (
        <Switch
          on={tilt.on}
          label="tilt"
          title="steer the loop by tilting the phone"
          onClick={tilt.onToggle}
        >
          <TiltIcon />
        </Switch>
      ) : null}
      {side.shown && (open || side.on) ? (
        <Switch
          on={side.on}
          label="on side"
          title="stand the set on its side, so the scan runs down the picture"
          onClick={side.onToggle}
        >
          <SideIcon />
        </Switch>
      ) : null}
      {open || sound.on ? (
        <Switch
          on={sound.on}
          label="sound"
          title="let the room's sound shake the set"
          onClick={sound.onToggle}
        >
          <MicIcon />
        </Switch>
      ) : null}
    </div>
  )
}
