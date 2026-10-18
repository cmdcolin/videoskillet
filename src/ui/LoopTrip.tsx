import { cameraLapReading, cameraLoopOf } from './cameraLap'
import { CAMERA_LOOP_GROUP, MIXER_LOOP_GROUP } from './controls'
import { useControlReading } from './ControlsContext'
import { mixerLoopOf, peakLapGain } from './loopGain'
import { cameraLoopSays, mixerLoopSays } from './loopReading'
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
  // Read unconditionally — a hook cannot be skipped.
  const camZoom = useControlReading(c => c.fbZoom)
  const mixer = group === MIXER_LOOP_GROUP
  // The peak as one string, so a write that does not move it does not redraw.
  const peak = useControlReading(c => {
    if (loop === undefined) return ''
    if (mixer) {
      if (c.cfbMix === 0) return ''
      const p = peakLapGain(mixerLoopOf(c))
      return `${p.gain}|${p.mhz}`
    }
    if (c.fbMix === 0) return ''
    const p = cameraLapReading(cameraLoopOf(c))
    return `${p.gain}|${p.level}|${p.settle ?? ''}`
  })
  if (loop === undefined || trip === 0) return null
  const [a, b, settle] = peak.split('|')
  const says = mixer
    ? mixerLoopSays(trip, { gain: Number(a), mhz: Number(b) })
    : cameraLoopSays(
        trip,
        {
          gain: Number(a),
          level: Number(b),
          settle: settle ? Number(settle) : null,
        },
        camZoom,
      )
  return (
    <div
      className={styles.trip}
      title="the fader and the trim multiply: what one lap of the loop makes back of what it was handed"
    >
      {`round trip ${trip.toFixed(2)}× · ${says}`}
    </div>
  )
}
