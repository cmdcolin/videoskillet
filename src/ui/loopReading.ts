import type { CameraLapReading } from './cameraLap'

// What a lap of a crossfaded loop makes back of what it was handed, said in
// words. Its own module rather than a second export off the component, so a
// hot update to either still refreshes.

export function loopTripSays(signed: number): string {
  // The mixer loop's trim goes negative: the return comes back inverted, so a
  // region alternates polarity frame to frame and edges buzz. What decides
  // whether it builds is still how much of itself a lap makes back, which is
  // the magnitude — the sign only says which way up it arrives.
  const trip = Math.abs(signed)
  const flips = signed < 0 ? ', inverting' : ''
  if (trip < 0.75) {
    // 1/(1-trip) laps to fall to 1/e, which at these numbers is a smear a few
    // frames deep rather than anything that accumulates.
    return `decays in about ${Math.max(1, Math.round(1 / (1 - trip)))} frames${flips}`
  }
  if (trip < 0.98) {
    return `just under — trails hold, structure does not build${flips}`
  }
  if (trip <= 1.02) {
    return `at the edge — patterns persist${flips}`
  }
  return `building${flips}`
}

const pct = (level: number) => `${Math.round(level * 100)}%`

const greyAt = (level: number) =>
  level < 0.35
    ? `at a dark grey (${pct(level)})`
    : level < 0.65
      ? `at a mid grey (${pct(level)})`
      : level < 0.9
        ? `at a bright grey (${pct(level)})`
        : `near white (${pct(level)})`

// The camera loop's gain depends on the level: the black cut takes the dim end
// away, the gun's gamma tilts the rest, and the sensor's shoulder bends the
// bright end back under unity. So the verdict reads the peak across levels, and
// a loop above unity grows until it reaches the level where the gain falls back
// through 1, and settles there.
//
// The zoom decides where. Expanding spreads what the loop gains over the whole
// raster, so the screen fills at the settled level, or pins white when nothing
// stops it. Collapsing concentrates it into a shrinking core while the surround
// is refreshed from the live picture, and holds. Measured in docs/CURATION.md.
export function cameraLoopSays(
  trip: number,
  peak: CameraLapReading,
  zoom: number,
): string {
  const head =
    Math.abs(peak.gain - trip) < 0.005
      ? ''
      : `peak ${peak.gain.toFixed(2)}× at ${pct(peak.level)} grey · `
  if (peak.gain <= 1.02) return head + loopTripSays(peak.gain)
  const expanding = zoom >= 1
  if (peak.settle === null) {
    return (
      head +
      (expanding ? 'building, and expanding — this walks to white' : 'building')
    )
  }
  const where = greyAt(peak.settle)
  return (
    head +
    (expanding
      ? `building, and expanding — the screen settles ${where}`
      : `building — the core settles ${where}`)
  )
}

// The mixer loop's gain is not flat once the resonance or the Y/C split is in
// the return, and a loop builds wherever its gain is highest. So the verdict
// reads the peak across the band, and names where it is when the peak stands
// clear of the broadband round trip.
export function mixerLoopSays(
  trip: number,
  peak: { gain: number; mhz: number },
): string {
  const says = loopTripSays(Math.sign(trip) * peak.gain)
  return Math.abs(peak.gain - Math.abs(trip)) < 0.005
    ? says
    : `peak ${peak.gain.toFixed(2)}× at ${peak.mhz.toFixed(1)} MHz · ${says}`
}
