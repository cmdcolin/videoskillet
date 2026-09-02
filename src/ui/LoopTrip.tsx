import { CAMERA_LOOP_GROUP, MIXER_LOOP_GROUP } from './controls'
import { useControlReading } from './ControlsContext'
import { loopTripSays } from './loopReading'
import styles from './LoopTrip.module.css'

import type { ControlKey } from '../core/controls'

// What a lap actually costs, for the two loops that are crossfades. Both fade
// the return against the live signal and then trim it, so the round trip is the
// fader times the trim and never the trim alone — a fader at 0.6 takes 40% off
// every lap that no trim under 1.67 makes back. The gain control reads as
// though 1 were the knife edge, and the whole feedback library was once
// authored against that: round trips of 0.53 to 0.97 on presets whose blurbs
// describe a loop breeding structure.
//
// Shown as the number rather than as a warning, because which side of unity is
// wanted depends on the look. What it does say is what the number means, which
// the two sliders cannot say separately.
const LOOPS: Record<string, { mix: ControlKey; gain: ControlKey }> = {
  [CAMERA_LOOP_GROUP]: { mix: 'fbMix', gain: 'fbGain' },
  [MIXER_LOOP_GROUP]: { mix: 'cfbMix', gain: 'cfbGain' },
}

export function LoopTrip({ group }: { group: string }) {
  const loop = LOOPS[group]
  const trip = useControlReading(c =>
    loop === undefined ? 0 : c[loop.mix] * c[loop.gain],
  )
  // Read unconditionally — a hook cannot be skipped, and the mixer loop has no
  // transport to escape a runaway through, so its reading ignores this.
  const camZoom = useControlReading(c => c.fbZoom)
  const zoom = group === CAMERA_LOOP_GROUP ? camZoom : undefined
  return loop === undefined || trip === 0 ? null : (
    <div
      className={styles.trip}
      title="the fader and the trim multiply: what one lap of the loop makes back of what it was handed"
    >
      {`round trip ${trip.toFixed(2)}× · ${loopTripSays(trip, zoom)}`}
    </div>
  )
}
